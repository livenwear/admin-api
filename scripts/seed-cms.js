/**
 * Seed lightweight promo banners + homepage hero slider (MinIO + CMS APIs).
 * Usage: node scripts/seed-cms.js
 *
 * If MinIO is down, still creates title-only banners / text slides so the UI works.
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
  const boundary = '----LivenCms' + Date.now();
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

async function makeBanner(index, title) {
  const colors = [
    ['#30364F', '#ACBAC4'],
    ['#3d445e', '#E1D9BC'],
    ['#242938', '#F0F0DB'],
  ];
  const [a, b] = colors[index % colors.length];
  const svg = `<svg width="1200" height="56" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="1200" height="56" fill="url(#g)"/>
    <text x="600" y="36" text-anchor="middle" fill="#F0F0DB" font-size="22" font-family="Tahoma">${title}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 72 }).toBuffer();
}

async function makeSlide(index, title) {
  const palettes = [
    ['#30364F', '#ACBAC4'],
    ['#242938', '#E1D9BC'],
    ['#3d445e', '#F0F0DB'],
  ];
  const [a, b] = palettes[index % palettes.length];
  const svg = `<svg width="1600" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="1600" height="720" fill="url(#g)"/>
    <circle cx="1280" cy="220" r="180" fill="rgba(240,240,219,0.12)"/>
    <circle cx="360" cy="520" r="220" fill="rgba(48,54,79,0.18)"/>
    <text x="120" y="320" fill="#F0F0DB" font-size="64" font-family="Tahoma">${title}</text>
    <text x="120" y="390" fill="#E1D9BC" font-size="28" font-family="Tahoma">Liven Collection</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 78 }).toBuffer();
}

async function upload(token, namespace, buffer, filename) {
  return request('POST', `/admin/media/upload?namespace=${namespace}`, {
    token,
    formData: multipart(buffer, filename),
  });
}

async function tryUpload(token, namespace, buffer, filename) {
  try {
    const media = await upload(token, namespace, buffer, filename);
    return media.data.uuid;
  } catch (e) {
    console.warn(`upload skipped (${namespace}/${filename}): ${e.message}`);
    return null;
  }
}

async function main() {
  const login = await request('POST', '/admin/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login.data.accessToken;

  const existingBanners = await request('GET', '/admin/cms/banners?limit=50', {
    token,
  });
  const hasPromo = (existingBanners.data || []).some(
    (b) => b.position === 'top_promo',
  );

  if (!hasPromo) {
    const promoTitles = [
      'ارسال رایگان برای سفارش‌های بالای ۳ میلیون',
      '۱۵٪ تخفیف اولین خرید — کد: LIVEN15',
      'کلکسیون تابستان لیون همین حالا آنلاین است',
    ];
    for (let i = 0; i < promoTitles.length; i++) {
      const buf = await makeBanner(i, promoTitles[i]);
      const fileUuid = await tryUpload(
        token,
        'banners',
        buf,
        `promo-${i + 1}.jpg`,
      );
      await request('POST', '/admin/cms/banners', {
        token,
        body: {
          title: promoTitles[i],
          fileUuid,
          position: 'top_promo',
          linkUrl: i === 1 ? '/auth/register' : '/search?q=لباس',
          displayOrder: i,
          isActive: true,
        },
      });
      console.log(`banner OK ${i + 1}${fileUuid ? ' +image' : ' (text-only)'}`);
    }
  } else {
    console.log('banners already present — skip');
  }

  const sliders = await request('GET', '/admin/cms/sliders', { token });
  const hero = (sliders.data || []).find((s) => s.slug === 'homepage-hero');
  if (!hero) {
    const slides = [
      {
        title: 'پوشاک مینیمال برای هر روز',
        subtitle: 'پارچه مرغوب، دوخت تمیز، حس آرام',
        buttonText: 'مشاهده محصولات',
        linkUrl: '/search?q=تی‌شرت',
        textColor: '#F0F0DB',
        overlayColor: 'rgba(36,41,56,0.35)',
      },
      {
        title: 'کلکسیون زنانه لیون',
        subtitle: 'طراحی نرم با پالت کرم و سرمه‌ای',
        buttonText: 'کشف زنانه',
        linkUrl: '/search?q=زنانه',
        textColor: '#F0F0DB',
        overlayColor: 'rgba(48,54,79,0.4)',
      },
      {
        title: 'استایل مردانه تازه',
        subtitle: 'از پیراهن تا کتشورت — یک نگاه کامل',
        buttonText: 'کشف مردانه',
        linkUrl: '/search?q=مردانه',
        textColor: '#F0F0DB',
        overlayColor: 'rgba(36,41,56,0.45)',
      },
    ];

    const items = [];
    for (let i = 0; i < slides.length; i++) {
      const buf = await makeSlide(i, slides[i].title);
      const fileUuid = await tryUpload(
        token,
        'sliders',
        buf,
        `slide-${i + 1}.jpg`,
      );
      items.push({
        ...slides[i],
        fileUuid,
        displayOrder: i,
        isActive: true,
      });
      console.log(`slide OK ${i + 1}${fileUuid ? ' +image' : ' (text-only)'}`);
    }

    await request('POST', '/admin/cms/sliders', {
      token,
      body: {
        name: 'اسلایدر صفحه اصلی',
        slug: 'homepage-hero',
        isActive: true,
        items,
      },
    });
    console.log('homepage-hero slider created');
  } else {
    console.log('homepage-hero already present — skip');
  }

  try {
    const cats = await request('GET', '/admin/catalog/categories?limit=100', {
      token,
    });
    const bySlug = Object.fromEntries(
      (cats.data || []).map((c) => [c.slug, c]),
    );
    const men = bySlug.men;
    if (men && bySlug.tshirts) {
      await request('PATCH', `/admin/catalog/categories/${bySlug.tshirts.uuid}`, {
        token,
        body: { parentUuid: men.uuid },
      });
    }
    if (men && bySlug.pants) {
      await request('PATCH', `/admin/catalog/categories/${bySlug.pants.uuid}`, {
        token,
        body: { parentUuid: men.uuid },
      });
    }
    if (men && bySlug.jackets) {
      await request('PATCH', `/admin/catalog/categories/${bySlug.jackets.uuid}`, {
        token,
        body: { parentUuid: men.uuid },
      });
    }
    console.log('category tree tuned for mega menu');
  } catch (e) {
    console.log('category nest skipped:', e.message);
  }

  console.log(JSON.stringify({ ok: true }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
