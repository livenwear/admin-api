/**
 * Fill expertReview for amazing products (PDP «بررسی تخصصی»).
 * Usage: node scripts/seed-expert-reviews.js
 */
const http = require('http');
const https = require('https');

const API = process.env.API_BASE || 'http://localhost:3013/api/v1';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin@liven.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SuperAdmin@1234';

function request(method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + urlPath);
    const lib = url.protocol === 'https:' ? https : http;
    const headers = {};
    let payload = null;
    if (body) {
      payload = Buffer.from(JSON.stringify(body));
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch {
            data = raw;
          }
          if (res.statusCode >= 400) {
            reject(
              new Error(
                `${method} ${urlPath} -> ${res.statusCode}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
              ),
            );
            return;
          }
          resolve(data);
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const login = await request('POST', '/admin/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login?.data?.accessToken;
  if (!token) throw new Error('Admin login failed');

  const list = await request('GET', '/admin/products?page=1&limit=40', {
    token,
  });
  const products = list?.data || [];
  let n = 0;
  for (const p of products) {
    if (!p.isAmazing && !p.isFeatured) continue;
    const text = [
      `در بررسی تخصصی «${p.name}»، کیفیت دوخت و انتخاب پارچه در اولویت ارزیابی قرار گرفته است.`,
      `فرم لباس با خطوط تمیز طراحی شده و برای استفاده روزمره و نیمه‌رسمی مناسب است.`,
      `پیشنهاد ما: پیش از شست‌وشو برچسب مراقبت را بخوانید و سایز را بر اساس جدول اندازه‌ها انتخاب کنید.`,
    ].join('\n\n');
    await request('PATCH', `/admin/products/${p.uuid}`, {
      token,
      body: { expertReview: text },
    });
    n += 1;
    console.log('expertReview OK', p.slug || p.name);
  }
  console.log(`Done. Updated ${n} products.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
