import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import {
  CHAT_ALLOWED_MIME,
  CHAT_MAX_FILE_BYTES,
} from 'src/modules/chat/chat.limits';

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Chat attachments: images only, max 5MB */
export function assertChatAttachment(file?: Express.Multer.File) {
  if (!file?.buffer?.length) {
    throw new BadRequestException('فایل پیوست ارسال نشده است.');
  }
  if (file.size > CHAT_MAX_FILE_BYTES) {
    throw new BadRequestException('حجم فایل نباید بیشتر از ۵ مگابایت باشد.');
  }
  const mime = (file.mimetype || '').toLowerCase();
  const ext = extname(file.originalname || '').toLowerCase();
  const mimeOk = (CHAT_ALLOWED_MIME as readonly string[]).includes(mime);
  if (!mimeOk && !ALLOWED_EXT.has(ext)) {
    throw new BadRequestException('فقط تصویر JPG، PNG یا WebP مجاز است.');
  }
  // Reject weird oversized filenames (path tricks)
  const name = String(file.originalname || '');
  if (name.length > 180 || /[\\/\0]/.test(name)) {
    throw new BadRequestException('نام فایل نامعتبر است.');
  }
}
