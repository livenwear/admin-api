import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'ssh2';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(apiRoot, '.env.production');

const SSH_ONLY = new Set([
  'SSH_HOST',
  'SSH_PORT',
  'SSH_USER',
  'SSH_PASSWORD',
  'SSH_DB_REMOTE_PORT',
  'SSH_MINIO_REMOTE_PORT',
  'SSH_DB_LOCAL_PORT',
  'SSH_MINIO_LOCAL_PORT',
]);

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function listen(port, onSocket) {
  return new Promise((resolve, reject) => {
    const server = net.createServer(onSocket);
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

function connectSsh(options) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.once('ready', () => resolve(conn));
    conn.once('error', reject);
    conn.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
      finish(prompts.map(() => options.password));
    });
    conn.connect({
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password,
      tryKeyboard: true,
      readyTimeout: 20000,
      keepaliveInterval: 15000,
    });
  });
}

function forward(conn, localPort, remotePort) {
  return listen(localPort, (socket) => {
    conn.forwardOut('127.0.0.1', 0, '127.0.0.1', remotePort, (error, stream) => {
      if (error) {
        socket.destroy();
        return;
      }
      socket.pipe(stream).pipe(socket);
    });
  });
}

if (!fs.existsSync(envPath)) {
  console.error('فایل api/.env.production پیدا نشد.');
  process.exit(1);
}

const fileEnv = parseEnvFile(envPath);
const sshHost = fileEnv.SSH_HOST;
const sshUser = fileEnv.SSH_USER;
const sshPassword = fileEnv.SSH_PASSWORD;
const sshPort = Number(fileEnv.SSH_PORT || 22);
const dbLocal = Number(fileEnv.SSH_DB_LOCAL_PORT || 15432);
const minioLocal = Number(fileEnv.SSH_MINIO_LOCAL_PORT || 19010);
const dbRemote = Number(fileEnv.SSH_DB_REMOTE_PORT || fileEnv.DATABASE_PORT || 5432);
const minioRemote = Number(fileEnv.SSH_MINIO_REMOTE_PORT || fileEnv.MINIO_PORT || 9010);

if (!sshHost || !sshUser || !sshPassword) {
  console.error('SSH_HOST و SSH_USER و SSH_PASSWORD در .env.production لازم است.');
  process.exit(1);
}

const appEnv = {};
for (const [key, value] of Object.entries(fileEnv)) {
  if (!SSH_ONLY.has(key)) appEnv[key] = value;
}
appEnv.DATABASE_HOST = '127.0.0.1';
appEnv.DATABASE_PORT = String(dbLocal);
appEnv.MINIO_ENDPOINT = '127.0.0.1';
appEnv.MINIO_PORT = String(minioLocal);
appEnv.LIVEN_ENV_FILE = envPath;
appEnv.NODE_ENV = appEnv.NODE_ENV || 'production';

console.log('در حال اتصال به سرور برای تونل دیتابیس و MinIO...');

let conn;
let dbServer;
let minioServer;
let child;

async function shutdown(code = 0) {
  if (child && !child.killed) child.kill();
  dbServer?.close();
  minioServer?.close();
  conn?.end();
  process.exit(code);
}

try {
  conn = await connectSsh({
    host: sshHost,
    port: sshPort,
    username: sshUser,
    password: sshPassword,
  });
  dbServer = await forward(conn, dbLocal, dbRemote);
  minioServer = await forward(conn, minioLocal, minioRemote);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`اتصال به سرور برقرار نشد: ${message}`);
  process.exit(1);
}

console.log(`تونل دیتابیس: 127.0.0.1:${dbLocal} → سرور:${dbRemote}`);
console.log(`تونل MinIO: 127.0.0.1:${minioLocal} → سرور:${minioRemote}`);
console.log('API با env پروداکشن بالا می‌آید. این دیتابیس زنده است.');

const nestBin = path.join(apiRoot, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
child = spawn(
  process.execPath,
  [nestBin, 'start', '--watch', '--builder', 'swc'],
  {
    cwd: apiRoot,
    env: { ...process.env, ...appEnv },
    stdio: 'inherit',
  },
);

child.on('exit', (code) => {
  dbServer?.close();
  minioServer?.close();
  conn?.end();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
