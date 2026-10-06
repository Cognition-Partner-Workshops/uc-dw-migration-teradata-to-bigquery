import { Logger, Provider } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { FILE_STORAGE, FileStorage } from './file-storage';
import { LocalFileStorage } from './local-file-storage';
import { S3FileStorage } from './s3-file-storage';

export function createFileStorage(config: AppConfigService): FileStorage {
  const bucket = config.get('FILES_BUCKET');
  const storage = bucket
    ? S3FileStorage.create(bucket, config.get('AWS_REGION'))
    : new LocalFileStorage(config.get('FILES_LOCAL_DIR'));
  if (!bucket && config.isProduction) {
    new Logger('FileStorage').warn(
      `FILES_BUCKET is not set: files are written to ${storage.location} on the container's disk`,
    );
  }
  return storage;
}

export const fileStorageProvider: Provider = {
  provide: FILE_STORAGE,
  useFactory: createFileStorage,
  inject: [AppConfigService],
};
