import { Controller, Get, Header, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { open } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const DEFAULT_LINES = 1000;
const MAX_LINES = 5000;

@Controller()
export class MylogController {
  constructor(private readonly config: ConfigService) {}

  @Get('mylog')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async mylog(@Query('lines') linesRaw?: string) {
    const lines = clampLines(linesRaw);
    const files = resolveLogFiles(this.config);
    const chunks: string[] = [];

    chunks.push(`Liven API live logs`);
    chunks.push(`time: ${new Date().toISOString()}`);
    chunks.push(`lines: ${lines}`);
    chunks.push(`cwd: ${process.cwd()}`);
    chunks.push('');

    for (const file of files) {
      chunks.push(`======== ${file.label} ========`);
      chunks.push(`path: ${file.path}`);
      if (!existsSync(file.path)) {
        chunks.push('(file not found)');
        chunks.push('');
        continue;
      }
      try {
        const text = await readLastLines(file.path, lines);
        chunks.push(text.trimEnd() || '(empty)');
      } catch (err) {
        chunks.push(`(read error: ${(err as Error).message})`);
      }
      chunks.push('');
    }

    const body = escapeHtml(chunks.join('\n'));
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Liven API /mylog</title>
  <style>
    body { margin: 0; background: #0b1220; color: #d7e0ea; font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    header { position: sticky; top: 0; padding: 12px 16px; background: #121a2b; border-bottom: 1px solid #243147; }
    h1 { margin: 0; font-size: 14px; color: #9fb3c8; font-weight: 600; }
    pre { margin: 0; padding: 16px; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>
<body>
  <header><h1>https://api.livenmode.ir/mylog — last ${lines} lines</h1></header>
  <pre>${body}</pre>
</body>
</html>`;
  }
}

function clampLines(raw?: string) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LINES;
  return Math.min(Math.floor(n), MAX_LINES);
}

function resolveLogFiles(config: ConfigService) {
  const appName = config.get<string>('PM2_APP_NAME', 'liven-api');
  const customDir = config.get<string>('MYLOG_DIR', '').trim();
  const repoLogs = join(process.cwd(), 'logs');
  const pm2Dir = join(homedir(), '.pm2', 'logs');

  const candidates = [
    {
      label: 'out',
      paths: [
        customDir ? join(customDir, 'out.log') : '',
        join(repoLogs, 'out.log'),
        join(pm2Dir, `${appName}-out.log`),
        join(pm2Dir, `${appName}-out-0.log`),
      ],
    },
    {
      label: 'error',
      paths: [
        customDir ? join(customDir, 'error.log') : '',
        join(repoLogs, 'error.log'),
        join(pm2Dir, `${appName}-error.log`),
        join(pm2Dir, `${appName}-error-0.log`),
      ],
    },
  ];

  return candidates.map((c) => ({
    label: c.label,
    path: c.paths.find((p) => p && existsSync(p)) || c.paths.find(Boolean) || '',
  }));
}

async function readLastLines(filePath: string, maxLines: number): Promise<string> {
  // Prefer `tail` on Linux VPS (fast). Fall back to Node for local Windows.
  try {
    const { stdout } = await execFileAsync(
      'tail',
      ['-n', String(maxLines), filePath],
      { maxBuffer: 12 * 1024 * 1024 },
    );
    return stdout;
  } catch {
    return readLastLinesNode(filePath, maxLines);
  }
}

async function readLastLinesNode(
  filePath: string,
  maxLines: number,
): Promise<string> {
  const fh = await open(filePath, 'r');
  try {
    const { size } = await fh.stat();
    if (size === 0) return '';

    const chunkSize = 64 * 1024;
    let position = size;
    let leftover = '';
    const lines: string[] = [];

    while (position > 0 && lines.length <= maxLines) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;
      const buf = Buffer.alloc(readSize);
      await fh.read(buf, 0, readSize, position);
      const text = buf.toString('utf8') + leftover;
      const parts = text.split(/\r?\n/);
      leftover = parts.shift() ?? '';
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        lines.push(parts[i]);
        if (lines.length >= maxLines) break;
      }
    }

    if (lines.length < maxLines && leftover) {
      lines.push(leftover);
    }

    return lines.reverse().slice(-maxLines).join('\n');
  } finally {
    await fh.close();
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
