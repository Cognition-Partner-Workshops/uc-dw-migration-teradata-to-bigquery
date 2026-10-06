import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateFileDto,
  FileCreatedDto,
  PresignedUploadDto,
  PresignedUploadRequestDto,
} from './dto/create-file.dto';
import { contentTypeFor, decodeBase64, parseFileName } from './file-names';
import { FILE_STORAGE, FileStorage, StoredObject } from './storage/file-storage';

export interface FileDownload {
  filename: string;
  contentType: string;
  /** Pre-signed S3 URL to redirect to; absent when the API streams the body itself. */
  redirectUrl?: string;
  object?: StoredObject;
}

export interface FileActor {
  username?: string;
  sub?: string;
}

/**
 * Port of Apex `FileUtilities` (ContentVersion + ContentDocumentLink). A Salesforce File is one
 * `files` row (ContentDocument + latest ContentVersion + ContentDocumentLink collapsed) plus the
 * object behind `files.s3_key` in {@link FileStorage}.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly maxInlineBytes: number;
  private readonly presignedUrlTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    config: AppConfigService,
  ) {
    this.maxInlineBytes = config.get('FILES_MAX_INLINE_BYTES');
    this.presignedUrlTtlSeconds = config.get('FILES_PRESIGNED_URL_TTL_SECONDS');
  }

  /**
   * `FileUtilities.createFile(base64data, filename, recordId)`: the `insert ContentVersion`
   * (object + row) and `insert ContentDocumentLink` (`files.record_id`) in one transaction. Every
   * failure surfaced as `AuraHandledException` in Apex is a 4xx here: blank/invalid filename and
   * base64 -> 400, unknown record -> 404, body over FILES_MAX_INLINE_BYTES -> 413.
   */
  async createFile(input: CreateFileDto, actor?: FileActor): Promise<FileCreatedDto> {
    if (input.base64Data !== undefined && input.uploadKey !== undefined) {
      throw new BadRequestException('send either base64Data or uploadKey, not both');
    }
    const name = parseFileName(input.filename);
    const body = input.uploadKey === undefined ? this.decodeInlineBody(input.base64Data) : null;
    await this.requireRecord(input.recordId);

    const uploadKey = input.uploadKey;
    let size = body?.length ?? 0;
    if (uploadKey !== undefined) {
      if (!uploadKey.startsWith(`uploads/${input.recordId}/`)) {
        throw new BadRequestException('uploadKey does not belong to recordId');
      }
      const uploaded = await this.storage.headObject(uploadKey);
      if (!uploaded)
        throw new BadRequestException('uploadKey has no uploaded object (PUT it first)');
      if (uploaded.contentLength === 0) throw new BadRequestException('uploaded object is empty');
      size = uploaded.contentLength;
    }

    const id = randomUUID();
    const s3Key = `files/${id}/${name.filename}`;
    const file = await this.prisma.$transaction(async (tx) => {
      const row = await tx.file.create({
        data: {
          id,
          title: name.title,
          fileType: name.fileType,
          s3Key,
          recordId: input.recordId,
          createdBy: actor?.username ?? actor?.sub ?? null,
        },
        select: { id: true, title: true, fileType: true },
      });
      // Written after the row so a storage failure rolls the row back; a crash between the
      // write and the commit leaves an unreferenced object at most.
      if (body) {
        await this.storage.putObject(s3Key, body, name.contentType);
      } else {
        await this.storage.copyObject(uploadKey!, s3Key, name.contentType);
      }
      return row;
    });
    if (uploadKey !== undefined) {
      await this.storage.deleteObject(uploadKey);
    }
    this.logger.debug({ fileId: file.id, recordId: input.recordId, size }, 'file created');
    return {
      id: file.id,
      url: this.urlFor(file.id),
      title: file.title,
      fileType: file.fileType,
      size,
    };
  }

  /** Large files: the client PUTs straight to S3 and then calls `createFile` with the `uploadKey`. */
  async createPresignedUpload(input: PresignedUploadRequestDto): Promise<PresignedUploadDto> {
    const name = parseFileName(input.filename);
    await this.requireRecord(input.recordId);
    const uploadKey = `uploads/${input.recordId}/${randomUUID()}/${name.filename}`;
    const signed = await this.storage.presignPut(
      uploadKey,
      input.contentType ?? name.contentType,
      this.presignedUrlTtlSeconds,
    );
    if (!signed) {
      throw new NotImplementedException(
        `pre-signed uploads need the S3 files bucket (FILES_BUCKET); this deployment stores files in ${this.storage.location}. ` +
          `Send bodies up to ${this.maxInlineBytes} bytes inline as base64Data.`,
      );
    }
    return { uploadKey, ...signed };
  }

  /** Body of a stored file (what the pictures endpoint links to). */
  async getDownload(id: string): Promise<FileDownload> {
    const file = await this.prisma.file.findUnique({
      where: { id },
      select: { s3Key: true, title: true, fileType: true },
    });
    if (!file) throw new NotFoundException(`file ${id} not found`);
    const filename = file.s3Key.slice(file.s3Key.lastIndexOf('/') + 1);
    const contentType = contentTypeFor(filename);
    const redirectUrl = await this.storage.presignGet(
      file.s3Key,
      filename,
      this.presignedUrlTtlSeconds,
    );
    if (redirectUrl) return { filename, contentType, redirectUrl };
    const object = await this.storage.getObject(file.s3Key);
    if (!object) {
      this.logger.error({ fileId: id, s3Key: file.s3Key }, 'file row has no object in storage');
      throw new NotFoundException(`file ${id} has no stored content`);
    }
    return { filename, contentType: object.contentType ?? contentType, object };
  }

  urlFor(id: string): string {
    return `/files/${id}`;
  }

  private decodeInlineBody(base64Data: string | undefined): Buffer {
    const body = decodeBase64(base64Data);
    if (!body) throw new BadRequestException('base64Data must be non-empty, valid base64');
    if (body.length > this.maxInlineBytes) {
      throw new PayloadTooLargeException(
        `decoded file is ${body.length} bytes; inline uploads are capped at ${this.maxInlineBytes} bytes, use POST /files/presigned-upload`,
      );
    }
    return body;
  }

  /** `ContentDocumentLink.LinkedEntityId` must exist (Apex: the link insert fails on a bogus id). */
  private async requireRecord(recordId: string): Promise<void> {
    const record = await this.prisma.property.findUnique({
      where: { id: recordId },
      select: { id: true },
    });
    if (!record) throw new NotFoundException(`record ${recordId} not found`);
  }
}
