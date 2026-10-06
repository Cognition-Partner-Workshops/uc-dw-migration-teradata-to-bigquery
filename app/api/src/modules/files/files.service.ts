import { Injectable } from '@nestjs/common';
import { NotPortedException } from '../../common/not-ported.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFileDto, FileCreatedDto } from './dto/create-file.dto';

/**
 * Home of Apex `FileUtilities` (+ `FileUtilitiesTest`).
 * Salesforce Files (ContentVersion/ContentDocumentLink) become S3 objects plus a
 * `files` table row linking them to a record.
 */
@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async createFile(_input: CreateFileDto): Promise<FileCreatedDto> {
    throw new NotPortedException('FileUtilities.createFile', 'UNT3-18');
  }
}
