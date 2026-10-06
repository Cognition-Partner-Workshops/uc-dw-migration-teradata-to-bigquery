import { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@nestjs/common';
import { contentDispositionInline } from '../file-names';
import { FileStorage, PresignedUpload, StoredObject, StoredObjectHead } from './file-storage';

/** S3 bucket from infra/modules/files (private, SSE, CORS for PUT/GET). The ECS task role grants the object actions. */
export class S3FileStorage implements FileStorage {
  readonly kind = 's3' as const;
  private readonly logger = new Logger(S3FileStorage.name);

  constructor(
    private readonly bucket: string,
    private readonly client: S3Client,
  ) {}

  static create(bucket: string, region: string): S3FileStorage {
    return new S3FileStorage(bucket, new S3Client({ region }));
  }

  get location(): string {
    return `s3://${this.bucket}`;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getObject(key: string): Promise<StoredObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) return null;
      return {
        body: response.Body as Readable,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async headObject(key: string): Promise<StoredObjectHead | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { contentLength: response.ContentLength ?? 0, contentType: response.ContentType };
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async copyObject(sourceKey: string, targetKey: string, contentType: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodeURIComponent(sourceKey).replace(/%2F/g, '/')}`,
        Key: targetKey,
        ContentType: contentType,
        MetadataDirective: 'REPLACE',
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      this.logger.warn(
        `could not delete ${key} from ${this.location}: ${(error as Error).message}`,
      );
    }
  }

  async presignPut(key: string, contentType: string, ttlSeconds: number): Promise<PresignedUpload> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: ttlSeconds },
    );
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async presignGet(key: string, filename: string, ttlSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: contentDispositionInline(filename),
      }),
      { expiresIn: ttlSeconds },
    );
  }
}

function isMissing(error: unknown): boolean {
  if (error instanceof NoSuchKey || error instanceof NotFound) return true;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return status === 404;
}
