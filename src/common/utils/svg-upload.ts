import { BadRequestException } from '@nestjs/common';

const SVG_MIME = new Set([
  'image/svg+xml',
  'image/svg',
  'text/xml',
  'application/xml',
]);

export function isSvgUpload(file: {
  mimetype?: string;
  originalname?: string;
}): boolean {
  const mime = (file.mimetype || '').toLowerCase().trim();
  const name = (file.originalname || '').toLowerCase().trim();
  if (name.endsWith('.svg')) return true;
  return SVG_MIME.has(mime);
}

/** Reject non-SVG and strip obvious XSS vectors before MinIO store */
export function assertSafeSvgUpload(file: Express.Multer.File) {
  if (!file?.buffer?.length) {
    throw new BadRequestException('File is required.');
  }
  if (!isSvgUpload(file)) {
    throw new BadRequestException(
      'لوگوی دسته‌بندی فقط باید فایل SVG باشد (image/svg+xml).',
    );
  }

  const text = file.buffer.toString('utf8');
  if (!/<svg[\s>]/i.test(text)) {
    throw new BadRequestException('محتوای فایل یک SVG معتبر نیست.');
  }

  const dangerous =
    /<script[\s>]/i.test(text) ||
    /\bon\w+\s*=/i.test(text) ||
    /javascript\s*:/i.test(text) ||
    /data:\s*text\/html/i.test(text) ||
    /<foreignObject[\s>]/i.test(text) ||
    /xlink:href\s*=\s*["']\s*https?:/i.test(text);

  if (dangerous) {
    throw new BadRequestException(
      'فایل SVG محتوای ناامن دارد و رد شد.',
    );
  }
}

export function isSvgMime(mimeType?: string | null, originalName?: string | null) {
  return isSvgUpload({
    mimetype: mimeType || undefined,
    originalname: originalName || undefined,
  });
}

const RASTER_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const RASTER_EXT = /\.(jpe?g|png|webp|gif)$/i;

export function isRasterImageUpload(file: {
  mimetype?: string;
  originalname?: string;
}): boolean {
  const mime = (file.mimetype || '').toLowerCase().trim();
  const name = (file.originalname || '').toLowerCase().trim();
  if (RASTER_EXT.test(name)) return true;
  return RASTER_MIME.has(mime);
}

export function assertRasterImageUpload(file: Express.Multer.File) {
  if (!file?.buffer?.length) {
    throw new BadRequestException('File is required.');
  }
  if (isSvgUpload(file)) {
    throw new BadRequestException(
      'برای کاور دسته از عکس استفاده کنید (JPEG/PNG/WebP) — SVG فقط برای لوگو است.',
    );
  }
  if (!isRasterImageUpload(file)) {
    throw new BadRequestException(
      'کاور دسته فقط تصویر JPEG، PNG یا WebP مجاز است.',
    );
  }
  if (file.buffer.length > 8 * 1024 * 1024) {
    throw new BadRequestException('حجم کاور نباید بیشتر از ۸ مگابایت باشد.');
  }
}

export function isRasterImageMime(
  mimeType?: string | null,
  originalName?: string | null,
) {
  return isRasterImageUpload({
    mimetype: mimeType || undefined,
    originalname: originalName || undefined,
  });
}
