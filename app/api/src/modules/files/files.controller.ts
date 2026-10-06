import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotImplementedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateFileDto, FileCreatedDto } from './dto/create-file.dto';
import { FilesService } from './files.service';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post()
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
