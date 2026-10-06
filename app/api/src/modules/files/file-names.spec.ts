import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  contentDispositionInline,
  contentTypeFor,
  decodeBase64,
  parseFileName,
} from './file-names';

/** FileUtilitiesTest.cls line 9 (`validBase64Data`): 659 characters, i.e. no trailing padding. */
const APEX_FIXTURE =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABh' +
  'Y3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAAB' +
  'UAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAA' +
  'AAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9Y' +
  'WVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAM' +
  'ZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb';

describe('parseFileName (ContentVersion.Title / PathOnClient)', () => {
  it('splits title, upper-case file type and content type like ContentDocument', () => {
    expect(parseFileName('house01.jpg')).toEqual({
      filename: 'house01.jpg',
      title: 'house01',
      fileType: 'JPG',
      contentType: 'image/jpeg',
    });
    expect(parseFileName('  Mock Picture.PNG ')).toMatchObject({
      filename: 'Mock Picture.PNG',
      title: 'Mock Picture',
      fileType: 'PNG',
      contentType: 'image/png',
    });
  });

  it('uses UNKNOWN when there is no usable extension', () => {
    expect(parseFileName('README')).toMatchObject({ title: 'README', fileType: 'UNKNOWN' });
    expect(parseFileName('.gitignore')).toMatchObject({ title: '.gitignore', fileType: 'UNKNOWN' });
    expect(parseFileName('archive.averyveryverylongext')).toMatchObject({ fileType: 'UNKNOWN' });
  });

  it('rejects blank names (FileUtilitiesTest.createFileFailsWhenIncorrectFilename) and paths', () => {
    for (const bad of ['', '   ', undefined, '.', '..', 'a/b.png', 'a\\b.png', 'x\u0000.png']) {
      expect(() => parseFileName(bad)).toThrow(BadRequestException);
    }
    expect(() => parseFileName(`${'x'.repeat(256)}.png`)).toThrow(BadRequestException);
  });
});

describe('decodeBase64 (EncodingUtil.base64Decode)', () => {
  it('accepts the unpadded Apex fixture', () => {
    const bytes = decodeBase64(APEX_FIXTURE);
    expect(bytes).not.toBeNull();
    expect(bytes!.length).toBe(Math.floor((APEX_FIXTURE.length * 3) / 4));
    expect(bytes!.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it('accepts padded, whitespace-wrapped and data-URL bodies', () => {
    expect(decodeBase64('aGVsbG8=')?.toString()).toBe('hello');
    expect(decodeBase64('aGVs\nbG8=\n')?.toString()).toBe('hello');
    expect(decodeBase64('data:text/plain;base64,aGVsbG8=')?.toString()).toBe('hello');
    expect(decodeBase64('aGVsbG8')?.toString()).toBe('hello');
  });

  it('rejects empty and non-base64 input (FileUtilitiesTest.createFileFailsWhenIncorrectBase64Data)', () => {
    expect(decodeBase64('')).toBeNull();
    expect(decodeBase64('   ')).toBeNull();
    expect(decodeBase64(undefined)).toBeNull();
    expect(decodeBase64('not base64!')).toBeNull();
    expect(decodeBase64('A')).toBeNull();
    expect(decodeBase64('====')).toBeNull();
  });
});

describe('content headers', () => {
  it('maps extensions and falls back to octet-stream', () => {
    expect(contentTypeFor('a.GIF')).toBe('image/gif');
    expect(contentTypeFor('a.bin')).toBe('application/octet-stream');
  });

  it('builds an inline Content-Disposition with an RFC 5987 name', () => {
    expect(contentDispositionInline('maison été.jpg')).toBe(
      `inline; filename="maison _t_.jpg"; filename*=UTF-8''maison%20%C3%A9t%C3%A9.jpg`,
    );
  });
});
