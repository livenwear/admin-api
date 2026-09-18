/**
 * SEO-friendly slug for Persian + Latin names.
 * Prefers Latin transliteration for stable URLs.
 */
const FA_TO_LATIN: Record<string, string> = {
  '\u0627': 'a', // ا
  '\u0622': 'a', // آ
  '\u0628': 'b', // ب
  '\u067E': 'p', // پ
  '\u062A': 't', // ت
  '\u062B': 's', // ث
  '\u062C': 'j', // ج
  '\u0686': 'ch', // چ
  '\u062D': 'h', // ح
  '\u062E': 'kh', // خ
  '\u062F': 'd', // د
  '\u0630': 'z', // ذ
  '\u0631': 'r', // ر
  '\u0632': 'z', // ز
  '\u0698': 'zh', // ژ
  '\u0633': 's', // س
  '\u0634': 'sh', // ش
  '\u0635': 's', // ص
  '\u0636': 'z', // ض
  '\u0637': 't', // ط
  '\u0638': 'z', // ظ
  '\u0639': 'a', // ع
  '\u063A': 'gh', // غ
  '\u0641': 'f', // ف
  '\u0642': 'gh', // ق
  '\u06A9': 'k', // ک
  '\u06AF': 'g', // گ
  '\u0644': 'l', // ل
  '\u0645': 'm', // م
  '\u0646': 'n', // ن
  '\u0648': 'v', // و
  '\u0647': 'h', // ه
  '\u06CC': 'y', // ی
  '\u0649': 'y', // ى
  '\u0626': 'y', // ئ
  '\u0621': '', // ء
  '\u06F0': '0',
  '\u06F1': '1',
  '\u06F2': '2',
  '\u06F3': '3',
  '\u06F4': '4',
  '\u06F5': '5',
  '\u06F6': '6',
  '\u06F7': '7',
  '\u06F8': '8',
  '\u06F9': '9',
};

/** Strip Arabic diacritics / tatweel via unicode ranges (not object keys). */
function stripMarks(input: string) {
  return input
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '');
}

function transliterateFa(input: string) {
  return stripMarks(input)
    .split('')
    .map((ch) => FA_TO_LATIN[ch] ?? ch)
    .join('');
}

export function slugify(input: string): string {
  const trimmed = input.trim();
  const latin = transliterateFa(trimmed)
    .toLowerCase()
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (latin) return latin;

  // Fallback: keep Persian slug if transliteration produced nothing
  return stripMarks(trimmed)
    .toLowerCase()
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9\-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ensureUniqueSlug(base: string, suffix: string | number): string {
  const clean = slugify(base) || 'item';
  return `${clean}-${suffix}`;
}
