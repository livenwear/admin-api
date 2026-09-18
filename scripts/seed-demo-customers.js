const bcrypt = require('bcrypt');
const { Client } = require('pg');

const FIRST = [
  'سارا', 'رضا', 'نرگس', 'امیر', 'مهسا', 'کاوه', 'الهام', 'پارسا', 'نیلوفر', 'سینا',
  'هستی', 'آرش', 'مینا', 'بهرام', 'مریم', 'فرزاد', 'شیدا', 'پویا', 'یاسمن', 'دانیال',
  'آیدا', 'سامان', 'پریسا', 'کیان', 'لیلا', 'نوید', 'رها', 'عرفان', 'نازنین', 'مهراد',
  'نگار', 'شایان', 'آتنا', 'رادین', 'غزل', 'ایلیا', 'ستاره', 'کسری', 'ملیکا', 'آرمین',
];
const LAST = [
  'محمدی', 'کریمی', 'احمدی', 'حسینی', 'رضایی', 'موسوی', 'جعفری', 'نوری', 'کاظمی', 'صادقی',
  'عباسی', 'مرادی', 'حیدری', 'باقری', 'طاهری', 'اکبری', 'یوسفی', 'نظری', 'شریفی', 'قاسمی',
];

async function main() {
  const password = 'Customer@1234';
  const hash = await bcrypt.hash(password, 10);
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1234',
    database: 'liven',
  });
  await client.connect();

  const roleRes = await client.query(
    `SELECT id FROM roles WHERE slug = 'user' LIMIT 1`,
  );
  if (!roleRes.rows[0]) {
    throw new Error('USER role not found — start API once to seed roles');
  }
  const roleId = roleRes.rows[0].id;

  let created = 0;
  let updated = 0;

  for (let i = 1; i <= 40; i++) {
    const phone = `0912${String(1000000 + i).slice(-7)}`;
    const firstName = FIRST[(i - 1) % FIRST.length];
    const lastName = LAST[(i - 1) % LAST.length];

    const existing = await client.query(
      `SELECT id FROM users WHERE phone = $1`,
      [phone],
    );

    let userId;
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await client.query(
        `UPDATE users SET password = $1, "firstName" = $2, "lastName" = $3, "isActive" = true, "isVerified" = true, "updatedAt" = NOW() WHERE id = $4`,
        [hash, firstName, lastName, userId],
      );
      updated += 1;
    } else {
      const inserted = await client.query(
        `INSERT INTO users ("firstName", "lastName", email, password, phone, "isVerified", "twoFactorEnabled", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, NULL, $3, $4, true, false, true, NOW(), NOW())
         RETURNING id`,
        [firstName, lastName, hash, phone],
      );
      userId = inserted.rows[0].id;
      created += 1;
    }

    await client.query(
      `INSERT INTO user_roles (user_id, role_id, "createdAt")
       SELECT $1, $2, NOW()
       WHERE NOT EXISTS (
         SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2
       )`,
      [userId, roleId],
    );
  }

  const count = await client.query(
    `SELECT COUNT(*)::int AS c FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE r.slug = 'user'`,
  );

  console.log(
    JSON.stringify(
      {
        password,
        created,
        updated,
        customerUsers: count.rows[0].c,
        samplePhones: ['09121000001', '09121000002', '09121000040'],
      },
      null,
      2,
    ),
  );
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
