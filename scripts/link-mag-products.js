/**
 * Link active products to magazine posts for shop-the-edit demos.
 * Usage: node scripts/link-mag-products.js
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

async function searchProducts(token, q, limit = 8) {
  const res = await request(
    'GET',
    `/admin/products?page=1&limit=${limit}&search=${encodeURIComponent(q)}`,
    { token },
  );
  return res.data || [];
}

async function findPostBySlug(token, slug) {
  const res = await request('GET', '/admin/blog/posts?limit=100', { token });
  return (res.data || []).find((p) => p.slug === slug) || null;
}

async function linkPost(token, post, productUuids) {
  // Need full post for required fields
  const full = await request('GET', `/admin/blog/posts/${post.uuid}`, {
    token,
  });
  const p = full.data;
  await request('PATCH', `/admin/blog/posts/${post.uuid}`, {
    token,
    body: {
      title: p.title,
      slug: p.slug,
      content: p.content,
      excerpt: p.excerpt,
      status: p.status,
      publishedAt: p.publishedAt,
      featuredImageUuid: p.featuredImageUuid,
      featuredImageAlt: p.featuredImageAlt,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      metaKeywords: p.metaKeywords,
      canonicalUrl: p.canonicalUrl,
      isFeatured: p.isFeatured,
      categoryUuids: (p.categories || []).map((c) => c.uuid),
      tagUuids: (p.tags || []).map((t) => t.uuid),
      productUuids,
    },
  });
}

const TARGETS = [
  {
    slug: 'kmrbnd-parchhay-ya-chrm-antkhab-br-asas-mvghayt',
    // No belt SKU in catalog yet — pair editorial with leather/tailored companions
    queries: ['بلیزر', 'کت', 'شلوار', 'جین'],
  },
  {
    slug: 'kfsh-chrm-mrdanh-drby-aksfvrd-ya-lvfr',
    queries: ['کفش', 'چرم', 'کت', 'جین'],
  },
  {
    slug: 'rahnmay-shstshvy-jyn-ta-rngsh-zndh-bmand',
    queries: ['جین', 'شلوار'],
  },
  {
    slug: 'kmrbnd-saat-v-kyf-akssvryhayy-kh-vaghaa-lazmand',
    queries: ['اکسسوری', 'کت', 'بلیزر', 'جین'],
  },
];

async function main() {
  console.log('Login…', API);
  const login = await request('POST', '/admin/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login.data.accessToken;

  for (const target of TARGETS) {
    const post = await findPostBySlug(token, target.slug);
    if (!post) {
      console.warn(`skip missing post: ${target.slug}`);
      continue;
    }

    const seen = new Set();
    const seenNames = new Set();
    const products = [];
    for (const q of target.queries) {
      const rows = await searchProducts(token, q, 10);
      for (const r of rows) {
        if (seen.has(r.uuid)) continue;
        if (String(r.status).toLowerCase() !== 'active') continue;
        const nameKey = String(r.name || '')
          .trim()
          .toLowerCase();
        if (nameKey && seenNames.has(nameKey)) continue;
        seen.add(r.uuid);
        if (nameKey) seenNames.add(nameKey);
        products.push(r);
        if (products.length >= 6) break;
      }
      if (products.length >= 6) break;
    }

    // Fallback: any active products
    if (products.length < 3) {
      const fallback = await request(
        'GET',
        '/admin/products?page=1&limit=12&status=active',
        { token },
      );
      for (const r of fallback.data || []) {
        if (seen.has(r.uuid)) continue;
        const nameKey = String(r.name || '')
          .trim()
          .toLowerCase();
        if (nameKey && seenNames.has(nameKey)) continue;
        seen.add(r.uuid);
        if (nameKey) seenNames.add(nameKey);
        products.push(r);
        if (products.length >= 6) break;
      }
    }

    const uuids = products.slice(0, 6).map((p) => p.uuid);
    console.log(
      `\n${post.title}\n  -> ${uuids.length} products:`,
      products.slice(0, 6).map((p) => p.name),
    );
    if (!uuids.length) {
      console.warn('  no products to link');
      continue;
    }
    await linkPost(token, post, uuids);
    console.log('  linked OK');
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
