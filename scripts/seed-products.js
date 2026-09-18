/**
 * Seed catalog + 20 clothing products with private MinIO images.
 * Usage: node scripts/seed-products.js
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
                `${method} ${urlPath} -> ${res.statusCode}: ${typeof data === 'string' ? data : JSON.stringify(data)}`,
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

async function makeProductImage(index) {
  const colors = ['#30364F', '#ACBAC4', '#E1D9BC', '#F0F0DB', '#3d445e', '#8a9aa6'];
  const bg = colors[index % colors.length];
  const svg = `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#242938"/>
      </linearGradient></defs>
      <rect width="800" height="1000" fill="url(#g)"/>
      <rect x="80" y="120" width="640" height="760" rx="48" fill="rgba(240,240,219,0.12)"/>
      <text x="400" y="480" text-anchor="middle" fill="#F0F0DB" font-size="42" font-family="Tahoma">${index + 1}</text>
      <text x="400" y="560" text-anchor="middle" fill="#E1D9BC" font-size="28" font-family="Tahoma">Liven</text>
    </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer();
}

function multipart(fileBuffer, filename) {
  const boundary = '----LivenBoundary' + Date.now();
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

const BRANDS = [
  { name: 'لیون', slug: 'liven' },
  { name: 'آسترا', slug: 'astra' },
  { name: 'نووا', slug: 'nova' },
];

const CATEGORIES = [
  { title: 'مردانه', slug: 'men', metaTitle: 'پوشاک مردانه لیون', metaDescription: 'پوشاک مردانه' },
  { title: 'زنانه', slug: 'women', metaTitle: 'پوشاک زنانه لیون', metaDescription: 'پوشاک زنانه' },
  { title: 'تی‌شرت', slug: 'tshirts', metaTitle: 'تی‌شرت | لیون', metaDescription: 'تی‌شرت' },
  { title: 'شلوار', slug: 'pants', metaTitle: 'شلوار | لیون', metaDescription: 'شلوار' },
  { title: 'کتشورت', slug: 'jackets', metaTitle: 'کتشورت | لیون', metaDescription: 'کتشورت' },
];

const PRODUCTS = [
  { name: 'تی‌شرت بیسیک سفید', cat: 'tshirts', brand: 'liven', base: 890000 },
  { name: 'تی‌شرت اورسایز مشکی', cat: 'tshirts', brand: 'astra', base: 980000 },
  { name: 'تی‌شرت راه‌راه آبی', cat: 'tshirts', brand: 'nova', base: 920000 },
  { name: 'شلوار جین اسلیم', cat: 'pants', brand: 'liven', base: 2450000 },
  { name: 'شلوار کتان بژ', cat: 'pants', brand: 'astra', base: 1890000 },
  { name: 'شلوار کارگو زیتونی', cat: 'pants', brand: 'nova', base: 2100000 },
  { name: 'هودی خاکستری', cat: 'jackets', brand: 'liven', base: 2750000 },
  { name: 'ژاکت بمبر مشکی', cat: 'jackets', brand: 'astra', base: 3200000 },
  { name: 'کتشورت دنیم روشن', cat: 'jackets', brand: 'nova', base: 2980000 },
  { name: 'پیراهن لینن سفید', cat: 'men', brand: 'liven', base: 1680000 },
  { name: 'پیراهن چهارخانه', cat: 'men', brand: 'astra', base: 1550000 },
  { name: 'پولوشرت سرمه‌ای', cat: 'men', brand: 'nova', base: 1350000 },
  { name: 'بلوز ساتن کرم', cat: 'women', brand: 'liven', base: 1780000 },
  { name: 'دامن پلیسه مشکی', cat: 'women', brand: 'astra', base: 1620000 },
  { name: 'تاپ بندی زیتونی', cat: 'women', brand: 'nova', base: 790000 },
  { name: 'مانتو اسپرت طوسی', cat: 'women', brand: 'liven', base: 3450000 },
  { name: 'کت بلیزر شتری', cat: 'women', brand: 'astra', base: 4100000 },
  { name: 'ست راحتی نخی', cat: 'women', brand: 'nova', base: 2250000 },
  { name: 'سویشرت زیپ‌دار', cat: 'jackets', brand: 'liven', base: 2590000 },
  { name: 'تی‌شرت گرافیکی', cat: 'tshirts', brand: 'astra', base: 1050000 },
];

async function main() {
  const login = await request('POST', '/admin/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login.data.accessToken;

  const brandMap = {};
  for (const b of BRANDS) {
    try {
      brandMap[b.slug] = (await request('POST', '/admin/catalog/brands', { token, body: b })).data.uuid;
    } catch {
      const list = await request('GET', '/admin/catalog/brands?limit=50', { token });
      brandMap[b.slug] = list.data.find((x) => x.slug === b.slug)?.uuid;
    }
  }

  const catMap = {};
  for (const c of CATEGORIES) {
    try {
      catMap[c.slug] = (await request('POST', '/admin/catalog/categories', { token, body: c })).data.uuid;
    } catch {
      const list = await request('GET', '/admin/catalog/categories?limit=100', { token });
      catMap[c.slug] = list.data.find((x) => x.slug === c.slug)?.uuid;
    }
  }

  let attrs = (await request('GET', '/admin/catalog/attributes', { token })).data;
  async function ensureAttr(name, type, values) {
    let attr = attrs.find((a) => a.name === name);
    if (!attr) {
      attr = (await request('POST', '/admin/catalog/attributes', {
        token,
        body: { name, type, isFilterable: true },
      })).data;
      attrs.push(attr);
    }
    const valueMap = {};
    for (const v of values) {
      let existing = (attr.values || []).find((x) => x.value === v.value);
      if (!existing) {
        existing = (await request('POST', `/admin/catalog/attributes/${attr.uuid}/values`, {
          token,
          body: v,
        })).data;
        attr.values = [...(attr.values || []), existing];
      }
      valueMap[v.value] = existing.uuid;
    }
    return valueMap;
  }

  const colorMap = await ensureAttr('رنگ', 'color', [
    { value: 'سفید', colorCode: '#F5F5F5' },
    { value: 'مشکی', colorCode: '#111111' },
    { value: 'آبی', colorCode: '#3B82F6' },
    { value: 'بژ', colorCode: '#E1D9BC' },
    { value: 'زیتونی', colorCode: '#6B8E23' },
  ]);
  const sizeMap = await ensureAttr('سایز', 'select', [
    { value: 'S' }, { value: 'M' }, { value: 'L' }, { value: 'XL' },
  ]);

  const existing = await request('GET', '/admin/products?limit=100', { token });
  const existingNames = new Set(existing.data.map((p) => p.name));

  let created = 0;
  let skipped = 0;
  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    if (existingNames.has(p.name)) {
      skipped += 1;
      console.log(`SKIP ${i + 1}/20 ${p.name}`);
      continue;
    }

    const imgBuf = await makeProductImage(i);
    const uploaded = await request('POST', '/admin/media/upload?namespace=products', {
      token,
      formData: multipart(imgBuf, `product-${i + 1}.jpg`),
    });

    const color = Object.keys(colorMap)[i % Object.keys(colorMap).length];
    const body = {
      name: p.name,
      shortDescription: `${p.name} — کیفیت فروشگاهی لیون`,
      description: `${p.name} با طراحی مینیمال، پارچه مرغوب و دوخت تمیز.`,
      brandUuid: brandMap[p.brand],
      categoryUuids: [catMap[p.cat]].filter(Boolean),
      type: 'variable',
      status: 'active',
      metaTitle: `${p.name} | فروشگاه لیون`,
      metaDescription: `خرید ${p.name} از لیون`,
      metaKeywords: `${p.name}, پوشاک, لیون`,
      isFeatured: i < 6,
      specifications: [
        { label: 'جنس', value: i % 2 ? 'پنبه' : 'کتان' },
        { label: 'کشور', value: 'ایران' },
        { label: 'فصل', value: 'چهارفصل' },
      ],
      variants: ['M', 'L'].map((size, idx) => ({
        sku: `LVN-${String(i + 1).padStart(3, '0')}-${size}-${Date.now().toString().slice(-4)}`,
        title: `${color} / ${size}`,
        price: p.base + idx * 50000,
        compareAtPrice: p.base + 200000,
        isDefault: idx === 0,
        isActive: true,
        attributeValueUuids: [colorMap[color], sizeMap[size]],
      })),
      images: [
        {
          fileUuid: uploaded.data.uuid,
          isPrimary: true,
          altText: p.name,
          displayOrder: 0,
        },
      ],
    };

    try {
      await request('POST', '/admin/products', { token, body });
      created += 1;
      console.log(`OK ${i + 1}/20 ${p.name}`);
    } catch (e) {
      console.error(`FAIL ${p.name}:`, e.message);
    }
  }

  const finalList = await request('GET', '/admin/products?limit=100', { token });
  console.log(JSON.stringify({ created, skipped, totalProducts: finalList.meta.total }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
