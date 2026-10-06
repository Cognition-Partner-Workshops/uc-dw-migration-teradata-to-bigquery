import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotImplementedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateFileDto, FileCreatedDto } from './dto/create-file.dto';
import { RequirePermission, SfObjectAccess } from '../../auth/decorators';
import { FilesService } from './files.service';

/**
 * `FileUtilities` is not in the dreamhouse permission set (`files.invoke` = dreamhouse-admin only,
 * as in the org); the upload itself is ContentVersion create (`files.create`).
 */
@ApiTags('files')
@Controller('files')
@SfObjectAccess('ContentDocument')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
  @RequirePermission('files.invoke', 'files.create')
  @ApiOperation({
    summary: 'Upload a file and link it to a record',
    description:
      'Port of `@AuraEnabled FileUtilities.createFile` (used by the Property record page picture upload).',
  })
  @ApiCreatedResponse({ type: FileCreatedDto })
  @ApiNotImplementedResponse({ description: 'Not ported yet (UNT3-18)' })
  createFile(@Body() body: CreateFileDto): Promise<FileCreatedDto> {
    return this.files.createFile(body);
  }
}
