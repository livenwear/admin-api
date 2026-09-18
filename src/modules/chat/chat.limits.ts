import { CHAT_MAX_ATTACHMENTS as ENTITY_MAX } from 'src/entities/enums/chat.enum';

/** Shared chat abuse / UX limits */
export const CHAT_MAX_BODY_LENGTH = 2000;
export const CHAT_MAX_ATTACHMENTS = ENTITY_MAX;
export const CHAT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CHAT_ALLOWED_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;
export const CHAT_SOCKET_MAX_PER_SEC = 5;

/** Strip control / zero-width junk and clamp length */
export function sanitizeChatBody(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\u0000/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
    .slice(0, CHAT_MAX_BODY_LENGTH);
}
