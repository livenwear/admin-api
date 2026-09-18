/**
 * Mark sample products as شگفت‌انگیز + set ratings.
 * Usage: node scripts/seed-amazing.js
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
                `${method} ${urlPath} -> ${res.statusCode}: ${
                  typeof data === 'string' ? data : JSON.stringify(data)
                }`,
              ),
            );
          } else resolve(data);
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
  const token = login.data.accessToken;
  const list = await request('GET', '/admin/products?limit=40&status=active', {
    token,
  });
  const products = list.data || [];
  if (!products.length) {
    throw new Error('No active products. Run seed-products.js first.');
  }

  let updated = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const makeAmazing = i < 14;
    const ratingAvg = Math.round((3.6 + (i % 15) * 0.1) * 10) / 10;
    const ratingCount = 8 + ((i * 7) % 90);
    await request('PATCH', `/admin/products/${p.uuid}`, {
      token,
      body: {
        isAmazing: makeAmazing,
        isFeatured: i % 3 === 0 || p.isFeatured,
        ratingAvg: Math.min(5, ratingAvg),
        ratingCount,
      },
    });
    updated += 1;
    console.log(
      `${makeAmazing ? 'AMAZING' : '-----'} ${p.name} ★${ratingAvg} (${ratingCount})`,
    );
  }

  const check = await request(
    'GET',
    '/public/products?filter=amazing&page=1&limit=10',
  );
  console.log(
    JSON.stringify(
      {
        updated,
        amazingTotal: check.meta?.total,
        sample: (check.data || []).slice(0, 3).map((x) => ({
          name: x.name,
          price: x.price,
          compareAtPrice: x.compareAtPrice,
          discountPercent: x.discountPercent,
          ratingAvg: x.ratingAvg,
          badges: x.badges,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
