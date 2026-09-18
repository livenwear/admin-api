/**
 * Attach lightweight sample images to existing promo banners + homepage slider.
 * Usage: node scripts/attach-cms-images.js
 */
const http = require('http');
const https = require('https');
const sharp = require('sharp');

const API = process.env.API_BASE || 'http://localhost:3013/api/v1';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'superadmin@liven.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'SuperAdmin@1234';

function request(method, urlPath, { token, body, formData } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + urlPath);
    const lib = url.protocol === 'https:' ? https : http;
    const headers = {};
    let payload = null;

    if (formData) {
      payload = formData.buffer;
      Object.assign(headers, formData.headers);
    } else if (body) {
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

function multipart(fileBuffer, filename) {
  const boundary = '----LivenImg' + Date.now() + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`,
    'utf8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const buffer = Buffer.concat([head, fileBuffer, tail]);
  return {
    buffer,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': buffer.length,
    },
  };
}

async function makeBanner(index, label) {
  const pairs = [
    ['#30364F', '#ACBAC4'],
    ['#3d445e', '#E1D9BC'],
    ['#242938', '#8a9aa6'],
  ];
  const [a, b] = pairs[index % pairs.length];
  const svg = `<svg width="1400" height="64" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="1400" height="64" fill="url(#g)"/>
    <circle cx="80" cy="32" r="18" fill="rgba(240,240,219,0.25)"/>
    <text x="700" y="40" text-anchor="middle" fill="#F0F0DB" font-size="24" font-family="Tahoma">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 70 }).toBuffer();
}

async function makeSlide(index, title, subtitle) {
  const pairs = [
    ['#30364F', '#ACBAC4'],
    ['#242938', '#E1D9BC'],
    ['#3d445e', '#F0F0DB'],
  ];
  const [a, b] = pairs[index % pairs.length];
  const svg = `<svg width="1600" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="720" fill="url(#g)"/>
    <circle cx="1320" cy="180" r="200" fill="rgba(240,240,219,0.14)"/>
    <circle cx="280" cy="560" r="240" fill="rgba(36,41,56,0.22)"/>
    <rect x="90" y="220" width="8" height="120" rx="4" fill="#E1D9BC"/>
    <text x="120" y="290" fill="#F0F0DB" font-size="58" font-family="Tahoma">${title}</text>
    <text x="120" y="350" fill="#E1D9BC" font-size="26" font-family="Tahoma">${subtitle}</text>
    <text x="120" y="420" fill="rgba(240,240,219,0.7)" font-size="20" font-family="Tahoma">Liven Sample ${index + 1}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 76 }).toBuffer();
}

async function upload(token, namespace, buffer, filename) {
  const res = await request('POST', `/admin/media/upload?namespace=${namespace}`, {
    token,
    formData: multipart(buffer, filename),
  });
  return res.data.uuid;
}

async function main() {
  const login = await request('POST', '/admin/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login.data.accessToken;

  const banners = await request('GET', '/admin/cms/banners?position=top_promo&limit=20', {
    token,
  });
  const promo = (banners.data || []).slice(0, 3);
  if (!promo.length) {
    throw new Error('No top_promo banners found. Run seed-cms.js first.');
  }

  for (let i = 0; i < promo.length; i++) {
    const b = promo[i];
    const buf = await makeBanner(i, `Liven Promo ${i + 1}`);
    const fileUuid = await upload(token, 'banners', buf, `promo-sample-${i + 1}.jpg`);
    await request('PATCH', `/admin/cms/banners/${b.uuid}`, {
      token,
      body: { fileUuid },
    });
    console.log(`banner image OK ${i + 1}: ${b.uuid} -> ${fileUuid}`);
  }

  const sliders = await request('GET', '/admin/cms/sliders', { token });
  const hero = (sliders.data || []).find((s) => s.slug === 'homepage-hero');
  if (!hero) throw new Error('homepage-hero slider missing');

  const full = await request('GET', `/admin/cms/sliders/${hero.uuid}`, { token });
  const items = (full.data.items || []).slice(0, 3);
  if (!items.length) throw new Error('slider has no items');

  const labels = [
    ['Minimal Wear', 'Soft fabrics'],
    ['Women Edit', 'Cream and navy'],
    ['Men Edit', 'Fresh layers'],
  ];

  const nextItems = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const [t, s] = labels[i % labels.length];
    const buf = await makeSlide(i, t, s);
    const fileUuid = await upload(token, 'sliders', buf, `slide-sample-${i + 1}.jpg`);
    nextItems.push({
      title: it.title,
      subtitle: it.subtitle,
      linkUrl: it.linkUrl,
      buttonText: it.buttonText,
      textColor: it.textColor || '#F0F0DB',
      overlayColor: it.overlayColor || 'rgba(36,41,56,0.4)',
      displayOrder: i,
      isActive: true,
      fileUuid,
    });
    console.log(`slide image OK ${i + 1}: ${fileUuid}`);
  }

  await request('PATCH', `/admin/cms/sliders/${hero.uuid}`, {
    token,
    body: {
      name: full.data.name,
      slug: full.data.slug,
      isActive: true,
      items: nextItems,
    },
  });

  const pubBanners = await request('GET', '/public/banners?position=top_promo');
  const pubSlider = await request('GET', '/public/sliders/homepage-hero');
  console.log(
    JSON.stringify(
      {
        banners: (pubBanners.data || []).map((b) => ({
          title: b.title,
          imageUrl: b.imageUrl,
          fileUuid: b.fileUuid,
        })),
        slides: (pubSlider.data?.items || []).map((s) => ({
          title: s.title,
          imageUrl: s.imageUrl,
          fileUuid: s.fileUuid,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
