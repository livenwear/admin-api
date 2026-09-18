const http = require('http');
const API = process.env.API_BASE || 'http://localhost:3013/api/v1';

function request(method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + urlPath);
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = http.request(
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
            reject(new Error(`${res.statusCode}: ${raw.slice(0, 500)}`));
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
    body: {
      email: process.env.ADMIN_EMAIL || 'superadmin@liven.local',
      password: process.env.ADMIN_PASSWORD || 'SuperAdmin@1234',
    },
  });
  const token = login.data.accessToken;
  const cats = await request('GET', '/admin/catalog/categories?page=1&limit=50', {
    token,
  });
  console.log(
    'cats',
    (cats.data || []).slice(0, 6).map((c) => `${c.title}|${c.slug}`),
  );

  const posts = await request('GET', '/admin/blog/posts?limit=100', { token });
  const post =
    (posts.data || []).find((p) =>
      String(p.slug || '').includes('blyzr'),
    ) ||
    (posts.data || []).find((p) =>
      String(p.slug || '').includes('kmrbnd'),
    );
  if (!post) {
    console.error('no target post');
    process.exit(1);
  }
  console.log('post', post.slug);

  const full = await request('GET', `/admin/blog/posts/${post.uuid}`, {
    token,
  });
  const p = full.data;
  const shopUuids = (cats.data || [])
    .filter((c) => c.isActive !== false)
    .filter((c) => {
      const s = `${c.slug || ''} ${c.title || ''}`.toLowerCase();
      if (/women|زنان|دخت|دختر/i.test(s)) return false;
      return /jacket|pants|tshirt|men|کت|شلوار|تی|مردانه|hoodie|بلوز/i.test(
        s,
      );
    })
    .slice(0, 3)
    .map((c) => c.uuid);

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
      productUuids: (p.products || []).map((x) => x.uuid),
      shopCategoryUuids: shopUuids,
    },
  });
  console.log('linked shop cats', shopUuids.length);

  const pub = await request('GET', `/public/mag/${post.slug}`);
  console.log('products', (pub.data.products || []).length);
  console.log(
    'shelves',
    (pub.data.shopCategories || []).map((s) => ({
      t: s.title,
      n: (s.products || []).length,
    })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
