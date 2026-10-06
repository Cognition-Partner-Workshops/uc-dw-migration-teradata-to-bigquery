import { createReadStream } from 'node:fs';
import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { FileStorage, PresignedUpload, StoredObject, StoredObjectHead } from './file-storage';

/**
 * Disk-backed stand-in for the S3 bucket (docker-compose, CI, the characterisation specs).
 * Content types are not persisted; the API derives them from the filename when serving.
 */
export class LocalFileStorage implements FileStorage {
  readonly kind = 'local' as const;
  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(directory);
  }

  get location(): string {
    return this.root;
  }

  async putObject(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async getObject(key: string): Promise<StoredObject | null> {
    const head = await this.headObject(key);
    if (!head) return null;
    return { body: createReadStream(this.pathFor(key)), contentLength: head.contentLength };
  }

  async headObject(key: string): Promise<StoredObjectHead | null> {
    try {
      const info = await stat(this.pathFor(key));
      return info.isFile() ? { contentLength: info.size } : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async copyObject(sourceKey: string, targetKey: string): Promise<void> {
    const target = this.pathFor(targetKey);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(this.pathFor(sourceKey), target);
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async presignPut(): Promise<PresignedUpload | null> {
    return null;
  }

  async presignGet(): Promise<string | null> {
    return null;
  }

  private pathFor(key: string): string {
    const path = resolve(this.root, ...key.split('/'));
    if (path !== this.root && !path.startsWith(this.root + sep)) {
      throw new Error(`object key escapes the storage directory: ${key}`);
    }
    return path;
  }
}
