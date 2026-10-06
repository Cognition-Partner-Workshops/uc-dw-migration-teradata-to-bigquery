import { BadRequestException } from '@nestjs/common';

/** ContentDocument.FileType when PathOnClient has no usable extension. */
export const UNKNOWN_FILE_TYPE = 'UNKNOWN';

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
};

export interface FileName {
  /** PathOnClient as stored in the object key (trimmed, no directories). */
  filename: string;
  /** ContentVersion.Title: the filename without its extension. */
  title: string;
  /** ContentDocument.FileType: upper-case extension, `UNKNOWN` without one. */
  fileType: string;
  contentType: string;
}

/**
 * `ContentVersion.Title` / `PathOnClient` validation. Salesforce rejects a blank title at insert
 * time (FileUtilitiesTest.createFileFailsWhenIncorrectFilename); paths and control characters are
 * rejected here too because the name becomes part of the object key.
 */
export function parseFileName(input: string | undefined): FileName {
  const filename = (input ?? '').trim();
  if (!filename) throw new BadRequestException('filename must not be blank');
  if (
    filename === '.' ||
    filename === '..' ||
    /[\\/]/.test(filename) ||
    hasControlCharacter(filename)
  ) {
    throw new BadRequestException('filename must be a plain file name without directories');
  }
  if (Buffer.byteLength(filename, 'utf8') > 255) {
    throw new BadRequestException('filename must be at most 255 bytes');
  }
  const dot = filename.lastIndexOf('.');
  const extension = dot > 0 ? filename.slice(dot + 1) : '';
  const fileType =
    extension && extension.length <= 10 && /^[A-Za-z0-9]+$/.test(extension)
      ? extension.toUpperCase()
      : UNKNOWN_FILE_TYPE;
  return {
    filename,
    title: dot > 0 ? filename.slice(0, dot) : filename,
    fileType,
    contentType: contentTypeFor(filename),
  };
}

function hasControlCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function contentTypeFor(filename: string): string {
  const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

/** `Content-Disposition: inline` with the RFC 5987 encoded name (pictures render in the browser). */
export function contentDispositionInline(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

const DATA_URL_PREFIX = /^data:[^,]*;base64,/i;

/**
 * `EncodingUtil.base64Decode` equivalent: tolerant about missing padding, whitespace and a data-URL
 * prefix (what an LWC `FileReader.readAsDataURL` hands over), strict about the alphabet. Returns
 * `null` for anything that does not decode to at least one byte.
 */
export function decodeBase64(input: string | undefined): Buffer | null {
  if (typeof input !== 'string') return null;
  const data = input.replace(DATA_URL_PREFIX, '').replace(/\s+/g, '');
  if (!data) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) && !/^[A-Za-z0-9_-]+={0,2}$/.test(data)) return null;
  const bytes = Buffer.from(data, 'base64');
  return bytes.length > 0 ? bytes : null;
}
