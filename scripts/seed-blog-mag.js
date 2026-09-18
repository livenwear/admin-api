/**
 * Seed professional men's fashion magazine articles (covers + HTML body).
 * First batch: 20 · second batch: +20 for layout testing.
 * Usage: node scripts/seed-blog-mag.js
 *
 * Requires API running (default http://localhost:3013/api/v1) + admin credentials.
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

function fetchBuffer(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'LivenMagSeeder/1.0',
          Accept: 'image/*',
        },
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchBuffer(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode >= 400) {
          reject(new Error(`download ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      },
    );
    req.on('error', reject);
    req.setTimeout(25000, () => {
      req.destroy(new Error('download timeout'));
    });
  });
}

function multipart(fileBuffer, filename) {
  const boundary = '----LivenMag' + Date.now();
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

async function makeCover(index, title) {
  const palettes = [
    ['#1a1f2e', '#3d4563', '#e11d48'],
    ['#242938', '#5a6578', '#c4a574'],
    ['#12151f', '#30364f', '#f0f0db'],
    ['#1e2433', '#4a5568', '#acbac4'],
    ['#0f1218', '#2a3145', '#e1d9bc'],
  ];
  const [a, b, accent] = palettes[index % palettes.length];
  const safe = String(title)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .slice(0, 42);
  const svg = `<svg width="1600" height="1000" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${a}"/>
        <stop offset="55%" stop-color="${b}"/>
        <stop offset="100%" stop-color="${a}"/>
      </linearGradient>
    </defs>
    <rect width="1600" height="1000" fill="url(#g)"/>
    <circle cx="1320" cy="180" r="260" fill="${accent}" fill-opacity="0.18"/>
    <circle cx="220" cy="820" r="300" fill="#F0F0DB" fill-opacity="0.08"/>
    <rect x="80" y="120" width="8" height="120" fill="${accent}"/>
    <text x="110" y="170" fill="#F0F0DB" font-size="28" font-family="Tahoma,Arial" opacity="0.7">LIVEN MAG</text>
    <text x="110" y="280" fill="#F0F0DB" font-size="56" font-family="Tahoma,Arial" font-weight="700">${safe}</text>
    <text x="110" y="900" fill="#E1D9BC" font-size="24" font-family="Tahoma,Arial" opacity="0.75">لیون مود — ادیتوریال پوشاک مردانه</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

async function coverFromRemoteOrFallback(index, title, remoteUrl) {
  if (remoteUrl) {
    try {
      const raw = await fetchBuffer(remoteUrl);
      return await sharp(raw)
        .resize(1600, 1000, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch (e) {
      console.warn(`  cover download failed (#${index + 1}): ${e.message}`);
    }
  }
  return makeCover(index, title);
}

async function uploadBlog(token, buffer, filename) {
  const media = await request('POST', '/admin/media/upload?namespace=blog', {
    token,
    formData: multipart(buffer, filename),
  });
  return media.data.uuid;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + (n % 8), 15, 0, 0);
  return d.toISOString();
}

const CATEGORIES = [
  { name: 'استایل فصل', slug: 'seasonal-style' },
  { name: 'راهنمای خرید', slug: 'buying-guide' },
  { name: 'ترند', slug: 'trends' },
  { name: 'ادیتوریال', slug: 'editorial' },
];

const TAGS = [
  { name: 'کت‌وشلوار', slug: 'suit' },
  { name: 'کژوال', slug: 'casual' },
  { name: 'زمستان', slug: 'winter' },
  { name: 'تابستان', slug: 'summer' },
  { name: 'اکسسوری', slug: 'accessories' },
  { name: 'رنگ', slug: 'color' },
];

/** Unsplash fashion/menswear photos (hotlink OK for seeding) */
const REMOTE_COVERS = [
  'https://images.unsplash.com/photo-1490575477890-819f6cb85c4d?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1507680434567-5739c80be1ac?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1520975954732-35dd22299614?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1603252109303-11010881c31f?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1618354691330-a0dc47ba87af?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1506634572416-48cdfe530110?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1488161620813-1db3c9d0c8a4?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1492446845049-9c9d1871f94c?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1523380730670-a4a4e9d5e8b9?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1600&q=80',
];

function articleHtml(parts) {
  return parts.join('\n');
}

const ARTICLES = [
  {
    title: 'چطور کت‌وشلوار سرمه‌ای را برای هر موقعیت بپوشید',
    excerpt:
      'از جلسه کاری تا شام رسمی — فرمول‌های استایل لیون مود برای کت‌وشلوار سرمه‌ای.',
    cats: ['seasonal-style', 'editorial'],
    tags: ['suit', 'color'],
    featured: true,
    body: articleHtml([
      '<p>کت‌وشلوار سرمه‌ای ستون کمد مردانه است؛ رنگی که هم اقتدار می‌دهد و هم با تقریباً هر پیراهن و کراواتی جور می‌شود.</p>',
      '<h2>انتخاب برش مناسب</h2>',
      '<p>اگر شانه‌های پهن دارید، برش <strong>slim</strong> با شانه طبیعی بهتر می‌نشیند. برای قد متوسط، طول ژاکت تا میانه باسن ایده‌آل است.</p>',
      '<h3>پیراهن و کراوات</h3>',
      '<ul><li>پیراهن سفید کلاسیک برای جلسات رسمی</li><li>پیراهن آبی روشن برای روزمره اداری</li><li>کراوات بورگاندی یا خاکستری برای عمق رنگ</li></ul>',
      '<blockquote><p>سرمه‌ای وقتی درخشان می‌شود که کفش چرم قهوه‌ای یا مشکی مات با آن ست شود — براق افراطی نکنید.</p></blockquote>',
      '<h2>اکسسوری مینیمال</h2>',
      '<p>ساعت فلزی نازک، دستمال جیب ساده، و کمربند هم‌رنگ کفش کافی است. استایل لیون مود یعنی جزئیات دقیق، نه شلوغی.</p>',
    ]),
  },
  {
    title: 'راهنمای خرید اولین پالتوی زمستانی',
    excerpt:
      'پالتوی خوب سرمایه‌گذاری است؛ معیارهای پارچه، قد و رنگ را قبل از خرید بدانید.',
    cats: ['buying-guide'],
    tags: ['winter', 'casual'],
    featured: true,
    body: articleHtml([
      '<p>پالتو باید روی لایه‌های زیرین بنشیند، نه فقط روی تی‌شرت. هنگام پرو، ژاکت یا سویشرت بپوشید.</p>',
      '<h2>پارچه</h2>',
      '<p>پشم خالص یا ترکیب پشم–کشمیر گرم و خوش‌فرم است. اگر بودجه محدود است، پشم مخلوط با درصد بالا انتخاب کنید.</p>',
      '<h3>قد پالتو</h3>',
      '<ol><li>بالای زانو: شهری و سبک</li><li>میانه زانو: کلاسیک و همه‌کاره</li><li>زیر زانو: رسمی‌تر و گرم‌تر</li></ol>',
      '<p>رنگ‌های سرمه‌ای، ذغالی و شتری بیشترین ست را با شلوار جین و کت‌وشلوار می‌دهند.</p>',
    ]),
  },
  {
    title: 'پنج ترند پوشاک مردانه که این فصل می‌مانند',
    excerpt:
      'نه هرکی ترند است ماندگار است — این پنج ایده ارزش خرید واقعی دارند.',
    cats: ['trends'],
    tags: ['casual', 'summer'],
    featured: true,
    body: articleHtml([
      '<p>ترند یعنی الهام؛ نه اجبار. در لیون مود فقط ایده‌هایی را برجسته می‌کنیم که با کمد ایرانی جور باشند.</p>',
      '<h2>۱. بافت‌های برجسته</h2>',
      '<p>پولو و تی‌شرت با بافت سبک، عمق بصری می‌دهند بدون سنگینی.</p>',
      '<h2>۲. شلوار گشاد کنترل‌شده</h2>',
      '<p>گشاد نه یعنی بی‌فرم؛ کمر مشخص و پارچه خوش‌افتاده شرط است.</p>',
      '<h2>۳. لایه‌لایه کژوال</h2>',
      '<p>پیراهن روی تی‌شرت، یا جلیقه روی پیراهن — لایه‌ها استایل را بالغ می‌کنند.</p>',
      '<h2>۴. رنگ‌های خاکی و زیتونی</h2>',
      '<p>جایگزین امن برای مشکی همیشگی، مخصوصاً در کژوال شهری.</p>',
      '<h2>۵. کفش چرم مینیمال</h2>',
      '<p>یک جفت دربی قهوه‌ای تیره، بیشتر از سه جفت اسنیکر شلوغ به کارتان می‌آید.</p>',
    ]),
  },
  {
    title: 'چگونه شلوار جین مناسب قد و فرم بدن انتخاب کنیم',
    excerpt:
      'جین اشتباه قد را کوتاه و فرم را نامتوازن نشان می‌دهد — با این راهنما انتخاب کنید.',
    cats: ['buying-guide'],
    tags: ['casual'],
    featured: false,
    body: articleHtml([
      '<p>جین خوب مثل کت‌وشلوار خوب است: باید «مال شما» به نظر برسد.</p>',
      '<h2>قد و ساق</h2>',
      '<ul><li>ساق باریک برای قد بلند و لاغر</li><li>راست‌برش برای اکثر فرم‌ها</li><li>تaper خفیف برای استایل شهری مدرن</li></ul>',
      '<h3>رنگ</h3>',
      '<p>آبی متوسط همه‌کاره‌ترین است. مشکی برای شب و استایل مینیمال. روشن فقط اگر تناسب بالا و پایین را حفظ کنید.</p>',
      '<blockquote><p>لبه شلوار نباید روی کفش جمع شود؛ یک شکست تمیز روی رویه کفش کافی است.</p></blockquote>',
    ]),
  },
  {
    title: 'استایل اداری مینیمال برای روزهای شلوغ',
    excerpt:
      'کم‌تعداد، پرتکرار، همیشه مرتب — فرمول کمد اداری لیون مود.',
    cats: ['seasonal-style'],
    tags: ['suit', 'casual'],
    featured: false,
    body: articleHtml([
      '<p>کمد اداری شلوغ شما را کند می‌کند. پنج قطعه پایه کافی است تا هر صبح تصمیم سریع بگیرید.</p>',
      '<h2>پایه کمد</h2>',
      '<ol><li>دو پیراهن سفید/آبی</li><li>یک شلوار پارچه‌ای ذغالی</li><li>یک جین تیره تمیز</li><li>یک بلیزر سرمه‌ای</li><li>کفش چرم مشکی مات</li></ol>',
      '<p>رنگ‌ها را خنثی نگه دارید تا هر ترکیب کار کند. اکسسوری را به ساعت و کمربند محدود کنید.</p>',
    ]),
  },
  {
    title: 'رنگ‌های خنثی؛ راز کمدهای حرفه‌ای',
    excerpt:
      'خاکستری، سرمه‌ای، شتری و سفید شکسته — چطور بدون زحمت ست کنید.',
    cats: ['editorial'],
    tags: ['color'],
    featured: true,
    body: articleHtml([
      '<p>خنثی‌ها خسته‌کننده نیستند؛ وقتی بافت و تناسب درست باشد، لوکس به‌نظر می‌رسند.</p>',
      '<h2>پالت پیشنهادی</h2>',
      '<ul><li>سرمه‌ای برای اقتدار</li><li>شتری برای گرما</li><li>خاکستری برای تعادل</li><li>سفید شکسته به‌جای سفید تیز</li></ul>',
      '<h3>یک رنگ تأکیدی</h3>',
      '<p>در هر استایل فقط یک رنگ قوی (مثلاً بورگاندی یا زیتونی) اضافه کنید تا نگاه گیر کند، نه شلوغ شود.</p>',
    ]),
  },
  {
    title: 'کفش چرم مردانه: دربی، آکسفورد یا لوفر؟',
    excerpt:
      'تفاوت فرم‌ها و اینکه کدام را با کت‌وشلوار یا کژوال بپوشید.',
    cats: ['buying-guide'],
    tags: ['accessories', 'suit'],
    featured: false,
    body: articleHtml([
      '<p>کفش، پایان جمله استایل است. انتخاب اشتباه کل ست را ارزان نشان می‌دهد.</p>',
      '<h2>آکسفورد</h2>',
      '<p>رسمی‌ترین گزینه؛ برای کت‌وشلوار کامل و مراسم.</p>',
      '<h2>دربی</h2>',
      '<p>کمی بازتر و راحت‌تر؛ عالی برای اداره و شام نیمه‌رسمی.</p>',
      '<h2>لوفر</h2>',
      '<p>هوشمند و سریع؛ با شلوار پارچه‌ای یا جین تیره در فصل گرم.</p>',
      '<blockquote><p>همیشه کمربند را با رنگ کفش هماهنگ کنید — جزئیاتی که افراد دقیق می‌بینند.</p></blockquote>',
    ]),
  },
  {
    title: 'لایه‌بندی پاییزی بدون سنگین شدن',
    excerpt:
      'چطور با سه لایه سبک، گرم و شیک بمانید وقتی هوا نوسان دارد.',
    cats: ['seasonal-style'],
    tags: ['winter', 'casual'],
    featured: false,
    body: articleHtml([
      '<p>پاییز فصل لایه‌هاست؛ اما لایه زیاد = حجم اضافه. قانون سه لایه را رعایت کنید.</p>',
      '<h2>لایه ۱: بیس</h2>',
      '<p>تی‌شرت نخی یا پیراهن نازک.</p>',
      '<h2>لایه ۲: میانی</h2>',
      '<p>بافت نازک، فلامNEL یا جلیقه.</p>',
      '<h2>لایه ۳: بیرونی</h2>',
      '<p>کاپشن سبک، ترنچ یا اورشرت.</p>',
      '<p>رنگ لایه‌ها را در یک خانواده نگه دارید تا حتی با درآوردن لایه بیرونی، استایل کامل بماند.</p>',
    ]),
  },
  {
    title: 'پیراهن سفید بی‌نقص؛ از پارچه تا اتو',
    excerpt:
      'پیراهن سفید ساده نیست — کیفیت یقه، مچ و اتو تفاوت را می‌سازد.',
    cats: ['buying-guide', 'editorial'],
    tags: ['suit'],
    featured: false,
    body: articleHtml([
      '<p>یک پیراهن سفید عالی، بیشتر از سه پیراهن متوسط به کمدتان ارزش می‌دهد.</p>',
      '<h2>چه چیزی را چک کنید</h2>',
      '<ul><li>یقه محکم که بعد از شستشو نخوابد</li><li>مچ با دکمه واقعی و اندازه دقیق</li><li>پارچه کمی مات، نه براق پلاستیکی</li></ul>',
      '<h3>نگهداری</h3>',
      '<p>اتوی بخار از پشت پارچه، آویختن بلافاصله بعد از خشک‌شدن، و دوری از سفیدکننده قوی عمر پیراهن را زیاد می‌کند.</p>',
    ]),
  },
  {
    title: 'استایل کژوال جمعه؛ راحت اما مرتب',
    excerpt:
      'جمعه اداری یا دورهمی دوستانه — فرمول کژوال تمیز لیون مود.',
    cats: ['seasonal-style'],
    tags: ['casual'],
    featured: false,
    body: articleHtml([
      '<p>کژوال به‌معنای شلختگی نیست. هدف: راحت دیده شوید، نه بی‌توجه.</p>',
      '<h2>ترکیب برنده</h2>',
      '<p>جین تیره + پولو یا پیراهن بدون کراوات + کفش لوفر یا اسنیکر مینیمال سفید.</p>',
      '<h3>اشتباه رایج</h3>',
      '<p>تی‌شرت طرح‌دار بزرگ با جین روشن و کفش ورزشی رنگی — نگاه را پخش می‌کند. یک نقطه تمرکز کافی است.</p>',
    ]),
  },
  {
    title: 'کمربند، ساعت و کیف؛ اکسسوری‌هایی که واقعاً لازم‌اند',
    excerpt:
      'سه قطعه که استایل را تمام می‌کنند — بدون خریدهای اضافی بی‌مصرف.',
    cats: ['editorial'],
    tags: ['accessories'],
    featured: false,
    body: articleHtml([
      '<p>اکسسوری خوب دیده می‌شود؛ اکسسوری زیاد فریاد می‌زند.</p>',
      '<h2>کمربند</h2>',
      '<p>چرم ساده، سگک کوچک. یک مشکی و یک قهوه‌ای کافی است.</p>',
      '<h2>ساعت</h2>',
      '<p>صفحه خوانا، بند چرم یا فلزی نازک. ساعت خیلی بزرگ مچ را سنگین می‌کند.</p>',
      '<h2>کیف</h2>',
      '<p>کیف چرمی یا برزنتی ساخت‌یافته برای لپ‌تاپ؛ کوله‌های اسنیکری شلوغ را برای باشگاه نگه دارید.</p>',
    ]),
  },
  {
    title: 'چطور با بودجه متوسط، استایل گران‌قیمت بسازید',
    excerpt:
      'هوشمند بخرید: پارچه، تناسب و نگهداری مهم‌تر از برند روی یقه است.',
    cats: ['buying-guide'],
    tags: ['casual', 'suit'],
    featured: false,
    body: articleHtml([
      '<p>لوکس بودن بیشتر از لوگو، در تناسب و تمیزی است.</p>',
      '<h2>اولویت خرج</h2>',
      '<ol><li>کفش چرم خوب</li><li>یک پالتو یا بلیزر عالی</li><li>پیراهن‌های پایه‌ای باکیفیت</li></ol>',
      '<p>روی تی‌شرت‌های طرح‌دار گران هزینه نکنید. پایه خنثی بخرید و با اکسسوری بازی کنید.</p>',
      '<blockquote><p>خیاطی کوچک روی قد شلوار و آستین، ارزان‌ترین راه لوکس‌شدن است.</p></blockquote>',
    ]),
  },
  {
    title: 'استایل ساحلی و سفر تابستانی مردانه',
    excerpt:
      'لینن، رنگ‌های روشن و کفش باز — بدون کلیشه توریستی.',
    cats: ['seasonal-style', 'trends'],
    tags: ['summer', 'casual'],
    featured: false,
    body: articleHtml([
      '<p>تابستان فرصت بافت‌های سبک است؛ نه لباس‌های چسبان مصنوعی.</p>',
      '<h2>پیشنهاد بسته‌بندی</h2>',
      '<ul><li>دو پیراهن لینن یا کتان</li><li>شلوار chino روشن</li><li>یک شلوارک میانه (نه خیلی کوتاه)</li><li>صندل چرمی یا اسنیکر پارچه‌ای</li></ul>',
      '<p>رنگ سفید شکسته، آبی آسمانی و خاکی را ترکیب کنید. از چاپ‌های شلوغ دوری کنید مگر یک قطعه تأکیدی.</p>',
    ]),
  },
  {
    title: 'تی‌شرت اورسایز؛ کی بپوشیم و کی نه',
    excerpt:
      'اورسایز مد روز است، اما روی بعضی فرم‌ها اشتباه می‌نشیند.',
    cats: ['trends'],
    tags: ['casual'],
    featured: false,
    body: articleHtml([
      '<p>اورسایز خوب یعنی حجم کنترل‌شده، نه گونی.</p>',
      '<h2>قوانین سریع</h2>',
      '<ul><li>شانه تی‌شرت کمی پایین‌تر از شانه واقعی</li><li>قد تا میانه باسن، نه روی ران</li><li>با شلوار باریک‌تر بالانس کنید</li></ul>',
      '<p>اگر قد کوتاهی دارید، اورسایز افراطی شما را کوتاه‌تر نشان می‌دهد — یک سایز بالاتر از نرمال کافی است.</p>',
    ]),
  },
  {
    title: 'کت چرم؛ از موتورسواری تا استایل شهری',
    excerpt:
      'چطور کت چرم را از کلیشه خارج کنیم و با کمد روزمره ست کنیم.',
    cats: ['editorial', 'trends'],
    tags: ['casual', 'winter'],
    featured: false,
    body: articleHtml([
      '<p>کت چرم وقتی بالغ می‌شود که با قطعات ساده ست شود.</p>',
      '<h2>ست‌های پیشنهادی</h2>',
      '<ol><li>چرم مشکی + جین تیره + تی‌شرت سفید</li><li>چرم قهوه‌ای + chino خاکی + بوت چرم</li></ol>',
      '<p>از پوشیدن همزمان چرم براق و زیورآلات زیاد پرهیز کنید. چرم خودش نقطه تمرکز است.</p>',
    ]),
  },
  {
    title: 'جوراب، کمربند و جزئیاتی که عکس را لوکس می‌کنند',
    excerpt:
      'در استایلینگ محصول و استریت‌استایل، جزئیات کوچک تفاوت را می‌سازند.',
    cats: ['editorial'],
    tags: ['accessories', 'color'],
    featured: false,
    body: articleHtml([
      '<p>دوربین جزئیات را بزرگ می‌کند — مخصوصاً در فروشگاه آنلاین.</p>',
      '<h2>جوراب</h2>',
      '<p>با کت‌وشلوار، جوراب هم‌خانواده شلوار یا کفش. جوراب سفید ورزشی فقط با اسنیکر ورزشی.</p>',
      '<h2>کمربند و دوخت</h2>',
      '<p>دوخت منظم، سگک هم‌تراز وسط، و نبود چروک اضافی دور کمر پیام کیفیت می‌دهد.</p>',
    ]),
  },
  {
    title: 'چطور کمد کپسول مردانه ۳۰ قطعه‌ای بسازید',
    excerpt:
      'کمتر بخرید، بیشتر بپوشید — نقشه کپسول برای فصل‌های ایران.',
    cats: ['buying-guide'],
    tags: ['casual', 'suit'],
    featured: true,
    body: articleHtml([
      '<p>کمد کپسول یعنی هر قطعه با حداقل سه قطعه دیگر ست شود.</p>',
      '<h2>ساختار پیشنهادی</h2>',
      '<ul><li>۸ بالا: تی‌شرت، پیراهن، پولو، بافت</li><li>۶ پایین: جین، chino، شلوار پارچه‌ای</li><li>۴ رویی: بلیزر، پالتو، کاپشن، اورشرت</li><li>۴ کفش</li><li>۸ اکسسوری و پایه</li></ul>',
      '<p>قبل از خرید جدید، یک قطعه قدیمی را خارج کنید تا کمد متورم نشود.</p>',
    ]),
  },
  {
    title: 'استایل مهمانی شب؛ از بلیزر تا کفش براق کنترل‌شده',
    excerpt:
      'شب قرار است بدرخشید — بدون لباس تئاتری.',
    cats: ['seasonal-style'],
    tags: ['suit', 'accessories'],
    featured: false,
    body: articleHtml([
      '<p>مهمانی شب جای کت‌وشلوار خیلی رسمی یا تی‌شرت باشگاهی نیست؛ نقطه میانی را پیدا کنید.</p>',
      '<h2>فرمول امن</h2>',
      '<p>شلوار پارچه‌ای تیره + پیراهن مشکی یا سرمه‌ای بدون کراوات + بلیزر + کفش چرم کمی براق.</p>',
      '<blockquote><p>عطر قوی و اکسسوری زیاد را همزمان نیاورید؛ یکی کافی است.</p></blockquote>',
    ]),
  },
  {
    title: 'مراقبت از پشم و کشمیر در خانه',
    excerpt:
      'شستشوی اشتباه گران‌ترین بافت‌ها را خراب می‌کند — روش درست نگهداری.',
    cats: ['buying-guide'],
    tags: ['winter'],
    featured: false,
    body: articleHtml([
      '<p>کشمیر و پشم اگر درست نگهداری شوند سال‌ها عمر می‌کنند.</p>',
      '<h2>قوانین طلایی</h2>',
      '<ol><li>شستشوی دستی یا برنامه پشم با آب سرد</li><li>خشک‌کردن خوابیده روی حوله، نه آویزان سنگین</li><li>انبار با کیسه تنفس‌پذیر و ضدبید</li></ol>',
      '<p>اتوی مستقیم روی کشمیر نگذارید؛ بخار از فاصله کوتاه کافی است.</p>',
    ]),
  },
  {
    title: 'نگاه ادیتوریال: سه‌ست روزانه از کالکشن لیون مود',
    excerpt:
      'صبح اداره، عصر قرار، شب آخر هفته — سه ترکیب آماده برای الهام.',
    cats: ['editorial', 'trends'],
    tags: ['suit', 'casual', 'color'],
    featured: true,
    body: articleHtml([
      '<p>این سه ست، زبان بصری لیون مود را نشان می‌دهند: تمیز، مردانه، بدون شلوغی.</p>',
      '<h2>ست ۱ — اداره</h2>',
      '<p>بلیزر سرمه‌ای، پیراهن سفید، شلوار ذغالی، دربی مشکی.</p>',
      '<h2>ست ۲ — عصر</h2>',
      '<p>اورشرت شتری، تی‌شرت خامه‌ای، جین تیره، لوفر قهوه‌ای.</p>',
      '<h2>ست ۳ — آخر هفته</h2>',
      '<p>پولو زیتونی، chino خاکی، اسنیکر مینیمال سفید.</p>',
      '<blockquote><p>استایل خوب تکرار هوشمندانه است، نه خرید بی‌وقفه.</p></blockquote>',
    ]),
  },
  // --- batch 2: 20 more for layout / SEO stress-testing ---
  {
    title: 'بوت چلسی؛ چرا هنوز استاندارد استایل شهری است',
    excerpt: 'یک جفت چلسی خوب با جین، chino و حتی شلوار پارچه‌ای کار می‌کند.',
    cats: ['buying-guide'],
    tags: ['accessories', 'winter'],
    featured: false,
    body: articleHtml([
      '<p>چلسی بوت یعنی خطوط تمیز و پوشیدن سریع. برای شهرهای سرد ایران گزینه‌ای هوشمند است.</p>',
      '<h2>چرم یا جیر؟</h2>',
      '<p>چرم مات دوام بیشتری دارد؛ جیر ظاهر نرم‌تری می‌دهد اما نگهداری سخت‌تری می‌خواهد.</p>',
      '<ul><li>پاشنه کوتاه برای روزمره</li><li>رنگ قهوه‌ای تیره همه‌کاره‌تر از مشکی براق</li></ul>',
    ]),
  },
  {
    title: 'چطور پولوشرت را رسمی‌تر بپوشیم',
    excerpt: 'پولو فقط برای باشگاه نیست — با چند قانون، برای کژوال شیک هم جواب می‌دهد.',
    cats: ['seasonal-style'],
    tags: ['casual'],
    featured: false,
    body: articleHtml([
      '<p>پولو با پارچه ضخیم‌تر و یقه تمیز، سطح استایل را بالا می‌برد.</p>',
      '<h2>قوانین</h2>',
      '<ol><li>یک دکمه باز، نه بیشتر</li><li>با chino یا جین تیره</li><li>بدون لوگوی غول‌پیکر سینه</li></ol>',
    ]),
  },
  {
    title: 'راهنمای سایز کت مردانه بدون پرو حضوری',
    excerpt: 'اگر آنلاین می‌خرید، این اندازه‌ها را قبل از ثبت سفارش چک کنید.',
    cats: ['buying-guide'],
    tags: ['suit'],
    featured: true,
    body: articleHtml([
      '<p>عرض شانه و دور سینه مهم‌تر از عدد روی برچسب است.</p>',
      '<h2>چک‌لیست</h2>',
      '<ul><li>شانه کت روی استخوان شانه بنشیند</li><li>بازو آزاد باشد ولی باد نکند</li><li>دکمه وسط بدون کشش بسته شود</li></ul>',
    ]),
  },
  {
    title: 'استایل بارانی؛ ترنچ در هوای نامشخص تهران',
    excerpt: 'ترنچ کلاسیک هنوز بهترین لایه میانی برای بهار و پاییز است.',
    cats: ['seasonal-style', 'trends'],
    tags: ['winter', 'casual'],
    featured: false,
    body: articleHtml([
      '<p>ترنچ بژ یا خاکی روی تقریباً هر کمد خنثی می‌نشیند.</p>',
      '<blockquote><p>کمربند را گره بزنید، نه سگک شلوغ — ظاهر ادیتوریال‌تر می‌شود.</p></blockquote>',
    ]),
  },
  {
    title: 'جین مشکی؛ فرمول شب‌های شهری',
    excerpt: 'جین مشکی تمیز می‌تواند جای شلوار پارچه‌ای را در بسیاری از موقعیت‌ها بگیرد.',
    cats: ['editorial'],
    tags: ['casual', 'color'],
    featured: false,
    body: articleHtml([
      '<p>مشکی مات، نه براق. برش راست یا کمی taper.</p>',
      '<h2>ست پیشنهادی</h2>',
      '<p>تی‌شرت خامه‌ای + اورشرت ذغالی + بوت یا لوفر.</p>',
    ]),
  },
  {
    title: 'کلاه و عینک؛ اکسسوری‌هایی که استایل را تمام می‌کنند',
    excerpt: 'دو قطعه کوچک که در عکس محصول و استریت‌استایل تفاوت ایجاد می‌کنند.',
    cats: ['editorial'],
    tags: ['accessories'],
    featured: false,
    body: articleHtml([
      '<p>کلاه بیسبال ساده یا باکت مینیمال؛ عینک با فریم نازک فلزی.</p>',
      '<p>از پوشیدن همزمان چند اکسسوری پررنگ خودداری کنید.</p>',
    ]),
  },
  {
    title: 'پارچه‌های تابستانی مردانه: کتان، لینن، پنبه',
    excerpt: 'کدام پارچه برای گرما بهتر نفس می‌کشد و چطور چروک را مدیریت کنیم.',
    cats: ['buying-guide', 'seasonal-style'],
    tags: ['summer'],
    featured: true,
    body: articleHtml([
      '<p>لینن چروک می‌شود اما خنک است؛ کتان تعادل بهتری برای اداره دارد.</p>',
      '<h3>نکته نگهداری</h3>',
      '<p>اتوی بخار سبک بعد از شستشو، ظاهر را تازه نگه می‌دارد.</p>',
    ]),
  },
  {
    title: 'اشتباهات رایج در ست کردن رنگ سرمه‌ای و مشکی',
    excerpt: 'این دو رنگ سخت‌گیر نیستند — اگر بافت و تضاد را درست بچینید.',
    cats: ['trends'],
    tags: ['color', 'suit'],
    featured: false,
    body: articleHtml([
      '<p>سرمه‌ای و مشکی در نور مصنوعی ممکن است یکی به نظر برسند؛ بافت متفاوت نجات‌دهنده است.</p>',
      '<ul><li>یک لایه مات، یک لایه کمی براق</li><li>کفش را با تیره‌ترین قطعه هماهنگ کنید</li></ul>',
    ]),
  },
  {
    title: 'شلوار chino؛ ستون کمد کژوال هوشمند',
    excerpt: 'از خاکی تا زیتونی — chino پلی بین جین و شلوار رسمی است.',
    cats: ['buying-guide'],
    tags: ['casual'],
    featured: false,
    body: articleHtml([
      '<p>قد شلوار با یک شکست تمیز روی کفش، ظاهر را بالغ می‌کند.</p>',
      '<p>رنگ خاکی روشن برای تابستان؛ زیتونی برای پاییز.</p>',
    ]),
  },
  {
    title: 'نیم‌بوت در مقابل بوت بلند؛ کدام برای قد شما بهتر است',
    excerpt: 'انتخاب ارتفاع بوت می‌تواند خط پا را بلندتر یا کوتاه‌تر نشان دهد.',
    cats: ['buying-guide'],
    tags: ['accessories', 'winter'],
    featured: false,
    body: articleHtml([
      '<p>نیم‌بوت برای اکثر قدها ایمن‌تر است. بوت بلند را با شلوار باریک‌تر بالانس کنید.</p>',
    ]),
  },
  {
    title: 'استایل گنگ کنترل‌شده؛ از خیابان تا فروشگاه',
    excerpt: 'انرژی استریت‌ویر بدون شلوغی لوگو — زبان بصری لیون مود.',
    cats: ['editorial', 'trends'],
    tags: ['casual', 'color'],
    featured: true,
    body: articleHtml([
      '<p>گنگ بودن یعنی اعتمادبه‌نفس در تناسب و رنگ، نه فریاد طرح.</p>',
      '<h2>فرمول</h2>',
      '<ol><li>یک قطعه حجم‌دار</li><li>یک قطعه باریک برای بالانس</li><li>کفش مینیمال تیره</li></ol>',
    ]),
  },
  {
    title: 'چطور عکس استایل شخصی برای کمدتان آرشیو کنید',
    excerpt: 'قبل از خرید بعدی، آرشیو تصویری از ست‌های موفق خودتان بسازید.',
    cats: ['editorial'],
    tags: ['casual'],
    featured: false,
    body: articleHtml([
      '<p>هر ست موفق را با نور طبیعی عکس بگیرید و در یک آلبوم نگه دارید.</p>',
      '<p>قبل از خرید، بپرسید: این قطعه حداقل با سه ست آرشیو جور می‌شود؟</p>',
    ]),
  },
  {
    title: 'ژاکت بافتنی یقه هفت؛ لایه میانی همه‌کاره',
    excerpt: 'روی پیراهن اداری یا تی‌شرت خامه‌ای — یک بافت خوب فصل را نجات می‌دهد.',
    cats: ['seasonal-style'],
    tags: ['winter', 'casual'],
    featured: false,
    body: articleHtml([
      '<p>ضخامت متوسط انتخاب کنید تا زیر پالتو جا شود.</p>',
      '<blockquote><p>رنگ شتری یا خاکستری روشن روی جین تیره، ترکیب کلاسیک ادیتوریال است.</p></blockquote>',
    ]),
  },
  {
    title: 'کمربند پارچه‌ای یا چرم؟ انتخاب بر اساس موقعیت',
    excerpt: 'جزئیات کمر پیام رسمی یا کژوال بودن ست را مشخص می‌کند.',
    cats: ['buying-guide'],
    tags: ['accessories'],
    featured: false,
    body: articleHtml([
      '<p>چرم برای اداره و شب؛ پارچه‌ای برای تابستان و سفر.</p>',
      '<p>سگک کوچک و ساده همیشه بالغ‌تر از سگک بزرگ براق است.</p>',
    ]),
  },
  {
    title: 'راهنمای شستشوی جین تا رنگش زنده بماند',
    excerpt: 'جین را کمتر بشویید، پشت‌ورو خشک کنید، و از خشک‌کن داغ دوری کنید.',
    cats: ['buying-guide'],
    tags: ['casual'],
    featured: false,
    body: articleHtml([
      '<p>شستشوی زیاد جین را می‌کشد و رنگ را می‌کشد.</p>',
      '<ol><li>آب سرد</li><li>پشت‌ورو</li><li>خشک‌کردن هوایی</li></ol>',
    ]),
  },
  {
    title: 'ست مسافرتی مردانه در یک کوله ۳۵ لیتری',
    excerpt: 'چطور برای چهار روز سفر شهری، سبک و مرتب بسته‌بندی کنید.',
    cats: ['seasonal-style'],
    tags: ['summer', 'casual'],
    featured: false,
    body: articleHtml([
      '<p>رنگ‌های خنثی تکرارپذیر انتخاب کنید تا ترکیب‌ها زیاد شود.</p>',
      '<ul><li>۲ بالا پایه</li><li>۱ رویی سبک</li><li>۲ پایین</li><li>۱ کفش همه‌کاره</li></ul>',
    ]),
  },
  {
    title: 'ساعت فلزی در مقابل چرم؛ کدام با کمد شما می‌خواند',
    excerpt: 'بند را با فصل و کفش هماهنگ کنید، نه فقط با سلیقه لحظه‌ای.',
    cats: ['editorial'],
    tags: ['accessories'],
    featured: false,
    body: articleHtml([
      '<p>فلزی برای رسمی و تابستان؛ چرم برای پاییز و کژوال هوشمند.</p>',
    ]),
  },
  {
    title: 'تی‌شرت یقه گرد در برابر یقه هفت',
    excerpt: 'فرم گردن و عرض شانه تعیین می‌کند کدام یقه بهتر می‌نشیند.',
    cats: ['trends'],
    tags: ['casual'],
    featured: false,
    body: articleHtml([
      '<p>یقه گرد امن‌ترین گزینه است. یقه هفت گردن را کشیده‌تر نشان می‌دهد اگر شانه پهن دارید.</p>',
    ]),
  },
  {
    title: 'چطور بلیزر را روی هودی بپوشیم بدون ناهماهنگی',
    excerpt: 'ترکیب خیابانی–رسمی وقتی کار می‌کند که حجم و رنگ کنترل شود.',
    cats: ['trends', 'editorial'],
    tags: ['casual', 'suit'],
    featured: true,
    body: articleHtml([
      '<p>هودی باریک و بدون چاپ شلوغ، زیر بلیزر ساخت‌یافته.</p>',
      '<p>پایین را ساده نگه دارید: جین تیره و کفش تمیز.</p>',
    ]),
  },
  {
    title: 'چک‌لیست سریع قبل از خروج از خانه',
    excerpt: 'شصت ثانیه بررسی — چین‌وچروک، هماهنگی کفش و کمربند، و یک نقطه تمرکز.',
    cats: ['seasonal-style'],
    tags: ['suit', 'casual'],
    featured: false,
    body: articleHtml([
      '<p>استایل خوب اغلب از یک چک‌لیست کوتاه می‌آید، نه از خرید جدید.</p>',
      '<ol><li>آینه تمام‌قد</li><li>هماهنگی کفش/کمربند</li><li>حذف یک اکسسوری اضافی</li></ol>',
    ]),
  },
];

async function ensureTaxonomy(token, kind, items) {
  const listPath =
    kind === 'categories' ? '/admin/blog/categories' : '/admin/blog/tags';
  const existing = await request('GET', listPath, { token });
  const bySlug = new Map(
    (existing.data || []).map((x) => [x.slug, x]),
  );
  const out = {};
  for (const item of items) {
    if (bySlug.has(item.slug)) {
      out[item.slug] = bySlug.get(item.slug);
      continue;
    }
    const created = await request('POST', listPath, {
      token,
      body: { name: item.name, slug: item.slug },
    });
    out[item.slug] = created.data;
    console.log(`+ ${kind}: ${item.name}`);
  }
  return out;
}

async function main() {
  console.log('Logging in…', API);
  const login = await request('POST', '/admin/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login.data.accessToken;

  const cats = await ensureTaxonomy(token, 'categories', CATEGORIES);
  const tags = await ensureTaxonomy(token, 'tags', TAGS);

  // Skip if we already have many published posts with these titles
  const existing = await request('GET', '/admin/blog/posts?limit=100', {
    token,
  });
  const existingTitles = new Set(
    (existing.data || []).map((p) => p.title),
  );

  let created = 0;
  for (let i = 0; i < ARTICLES.length; i++) {
    const a = ARTICLES[i];
    if (existingTitles.has(a.title)) {
      console.log(`skip exists: ${a.title}`);
      continue;
    }

    console.log(`\n[${i + 1}/${ARTICLES.length}] ${a.title}`);
    const coverBuf = await coverFromRemoteOrFallback(
      i,
      a.title,
      REMOTE_COVERS[i % REMOTE_COVERS.length],
    );
    let featuredImageUuid = null;
    try {
      featuredImageUuid = await uploadBlog(
        token,
        coverBuf,
        `mag-cover-${i + 1}.jpg`,
      );
      console.log(`  cover uuid: ${featuredImageUuid}`);
    } catch (e) {
      console.warn(`  cover upload failed: ${e.message}`);
    }

    const categoryUuids = (a.cats || [])
      .map((s) => cats[s]?.uuid)
      .filter(Boolean);
    const tagUuids = (a.tags || [])
      .map((s) => tags[s]?.uuid)
      .filter(Boolean);

    const post = await request('POST', '/admin/blog/posts', {
      token,
      body: {
        title: a.title,
        excerpt: a.excerpt,
        content: a.body,
        status: 'published',
        publishedAt: daysAgo(ARTICLES.length - i),
        featuredImageUuid,
        featuredImageAlt: a.title,
        metaTitle: `${a.title} | مجله لیون مود`,
        metaDescription: a.excerpt,
        metaKeywords: [...(a.cats || []), ...(a.tags || [])].join(', '),
        isFeatured: Boolean(a.featured),
        categoryUuids,
        tagUuids,
        productUuids: [],
      },
    });
    created += 1;
    console.log(`  post OK: ${post.data?.slug || post.data?.uuid}`);
  }

  console.log(`\nDone. Created ${created} articles.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
