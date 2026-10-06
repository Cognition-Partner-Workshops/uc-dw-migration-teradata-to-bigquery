import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiNotImplementedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { readBearerClaims } from '../../common/auth/bearer-claims';
import { AppConfigService } from '../../config/app-config.service';
import {
  CreateFileDto,
  FileCreatedDto,
  PresignedUploadDto,
  PresignedUploadRequestDto,
} from './dto/create-file.dto';
import { contentDispositionInline } from './file-names';
import { FileActor, FilesService } from './files.service';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly config: AppConfigService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Upload a file and link it to a record',
    description:
      'Port of `@AuraEnabled FileUtilities.createFile(base64data, filename, recordId)` (Property record page picture upload). ' +
      'Stores the body in the files bucket and inserts the `files` row linked to the record; the file then shows up in ' +
      '`GET /properties/{id}/pictures` and is served by `GET /files/{id}`. Bodies larger than FILES_MAX_INLINE_BYTES go ' +
      'through `POST /files/presigned-upload` first and are finalised here with `uploadKey` instead of `base64Data`.',
  })
  @ApiCreatedResponse({ type: FileCreatedDto })
  @ApiBadRequestResponse({
    description: 'Blank or invalid filename / base64Data (Apex AuraHandledException)',
  })
  @ApiNotFoundResponse({
    description: 'recordId does not exist (Apex: ContentDocumentLink insert failed)',
  })
  @ApiPayloadTooLargeResponse({ description: 'Decoded body exceeds FILES_MAX_INLINE_BYTES' })
  createFile(
    @Body() body: CreateFileDto,
    @Headers('authorization') authorization?: string,
  ): Promise<FileCreatedDto> {
    return this.files.createFile(body, this.actorFrom(authorization));
  }

  @Post('presigned-upload')
  @ApiOperation({
    summary: 'Pre-signed S3 upload for large files',
    description:
      'Returns a short-lived pre-signed `PUT` URL into the files bucket. After the upload succeeds, call `POST /files` ' +
      'with the returned `uploadKey` to create the file row (no counterpart in Apex, which was limited by request size).',
  })
  @ApiCreatedResponse({ type: PresignedUploadDto })
  @ApiNotFoundResponse({ description: 'recordId does not exist' })
  @ApiNotImplementedResponse({
    description: 'Deployment has no S3 files bucket (FILES_BUCKET unset)',
  })
  createPresignedUpload(@Body() body: PresignedUploadRequestDto): Promise<PresignedUploadDto> {
    return this.files.createPresignedUpload(body);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Download a file',
    description:
      'Body of the file behind a `files` row (`ContentVersion.VersionData`). With the S3 bucket this answers `302` to a ' +
      'pre-signed URL; without it the API streams the object itself.',
  })
  @ApiProduces('application/octet-stream', 'image/png', 'image/jpeg', 'image/gif')
  @ApiOkResponse({
    description: 'File body (local storage)',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiFoundResponse({ description: 'Redirect to a pre-signed S3 URL' })
  @ApiNotFoundResponse({ description: 'No such file' })
  async getFile(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const download = await this.files.getDownload(id);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    if (download.redirectUrl) {
      res.redirect(302, download.redirectUrl);
      return;
    }
    const object = download.object!;
    res.setHeader('Content-Type', download.contentType);
    res.setHeader('Content-Disposition', contentDispositionInline(download.filename));
    if (object.contentLength !== undefined) res.setHeader('Content-Length', object.contentLength);
    object.body.on('error', (error) => res.destroy(error));
    object.body.pipe(res);
  }

  /** `created_by` from the bearer token when one is present; the auth guard (UNT3-20) will own this. */
  private actorFrom(authorization?: string): FileActor | undefined {
    if (!authorization) return undefined;
    const secret =
      this.config.get('AUTH_TEST_JWT_SECRET') ??
      (this.config.isProduction ? undefined : 'dreamhouse-characterisation');
    if (!secret) return undefined;
    try {
      const claims = readBearerClaims(authorization, secret);
      return claims ? { username: claims.username, sub: claims.sub } : undefined;
    } catch {
      return undefined;
    }
  }
}
