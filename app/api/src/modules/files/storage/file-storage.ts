import { Readable } from 'node:stream';

/** Nest injection token for the {@link FileStorage} implementation (S3 or local disk). */
export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface StoredObject {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

export interface StoredObjectHead {
  contentLength: number;
  contentType?: string;
}

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

/**
 * Where `ContentVersion.VersionData` goes. Production uses the private S3 bucket of
 * infra/modules/files ({@link S3FileStorage}); docker-compose and the test suites use a
 * directory on disk ({@link LocalFileStorage}). Keys are `files/<id>/<filename>` for stored
 * files and `uploads/<recordId>/<token>/<filename>` for pre-signed uploads awaiting their row.
 */
export interface FileStorage {
  readonly kind: 's3' | 'local';
  /** Bucket name or directory, for logs and diagnostics. */
  readonly location: string;
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(key: string): Promise<StoredObject | null>;
  headObject(key: string): Promise<StoredObjectHead | null>;
  copyObject(sourceKey: string, targetKey: string, contentType: string): Promise<void>;
  deleteObject(key: string): Promise<void>;
  /** `null` when the backend cannot hand out pre-signed URLs (local disk). */
  presignPut(key: string, contentType: string, ttlSeconds: number): Promise<PresignedUpload | null>;
  /** `null` when the backend cannot hand out pre-signed URLs; the API then streams the object itself. */
  presignGet(key: string, filename: string, ttlSeconds: number): Promise<string | null>;
}
