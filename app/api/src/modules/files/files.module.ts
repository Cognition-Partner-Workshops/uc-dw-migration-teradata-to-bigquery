import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { fileStorageProvider } from './storage/file-storage.provider';
import { FILE_STORAGE } from './storage/file-storage';

/** Salesforce Files (`ContentVersion`, `ContentDocumentLink`) + `FileUtilities`; objects in S3 (or local disk). */
@Module({
  controllers: [FilesController],
  providers: [fileStorageProvider, FilesService],
  exports: [FilesService, FILE_STORAGE],
})
export class FilesModule {}
