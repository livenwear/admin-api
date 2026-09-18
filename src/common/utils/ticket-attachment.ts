import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const ALLOWED_EXT = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);

/** Ticket attachments: images + PDF + Word + Excel, max 5MB */
export function assertTicketAttachment(file?: Express.Multer.File) {
  if (!file?.buffer?.length) {
    throw new BadRequestException('فایل پیوست ارسال نشده است.');
  }
  if (file.size > MAX_BYTES) {
    throw new BadRequestException('حجم فایل نباید بیشتر از ۵ مگابایت باشد.');
  }
  const mime = (file.mimetype || '').toLowerCase();
  const ext = extname(file.originalname || '').toLowerCase();
  const mimeOk = ALLOWED_MIME.has(mime);
  const extOk = ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) {
    throw new BadRequestException(
      'فقط تصویر (JPG/PNG/WebP)، PDF، ورد و اکسل مجاز است.',
    );
  }
}
