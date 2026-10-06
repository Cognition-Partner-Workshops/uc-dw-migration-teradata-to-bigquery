import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Parameters of Apex `FileUtilities.createFile(base64data, filename, recordId)`. Either the body
 * comes inline as `base64Data` (as the LWC sent it) or, for large files, as the `uploadKey` of a
 * completed pre-signed upload (`POST /files/presigned-upload`).
 */
export class CreateFileDto {
  @ApiPropertyOptional({
    description:
      'File body, base64 encoded (ContentVersion.VersionData). Missing padding and a `data:` URL prefix are accepted. ' +
      'Required unless `uploadKey` is given; decoded size is capped by FILES_MAX_INLINE_BYTES.',
  })
  @ValidateIf((dto: CreateFileDto) => dto.uploadKey === undefined)
  @IsString()
  @IsNotEmpty()
  base64Data?: string;

  @ApiProperty({ description: 'ContentVersion.Title / PathOnClient', example: 'house01.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Record the file is linked to (ContentDocumentLink.LinkedEntityId)',
  })
  @IsUUID()
  recordId: string;

  @ApiPropertyOptional({
    description: 'Key returned by POST /files/presigned-upload once the PUT to S3 completed',
    example: 'uploads/4f0c.../8e1a.../house01.jpg',
  })
  @IsOptional()
  @IsString()
  @Matches(/^uploads\/[^\s]+$/)
  uploadKey?: string;
}

export class FileCreatedDto {
  @ApiProperty({ format: 'uuid', description: 'Equivalent of the returned ContentDocumentLink.Id' })
  id: string;

  @ApiProperty({
    description: 'API path that serves the file (same value GET /properties/{id}/pictures returns)',
    example: '/files/4f0c6a9e-1b2d-4c3e-8f90-123456789abc',
  })
  url: string;

  @ApiProperty({ description: 'ContentVersion.Title (filename without extension)' })
  title: string;

  @ApiProperty({ description: 'ContentDocument.FileType (upper-case extension)', example: 'JPG' })
  fileType: string;

  @ApiProperty({ description: 'Stored size in bytes' })
  size: number;
}

export class PresignedUploadRequestDto {
  @ApiProperty({ description: 'ContentVersion.Title / PathOnClient', example: 'house01.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @ApiProperty({ format: 'uuid', description: 'Record the file will be linked to' })
  @IsUUID()
  recordId: string;

  @ApiPropertyOptional({
    description: 'MIME type the client will send; derived from the filename when omitted',
    example: 'image/jpeg',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[\w.+-]+\/[\w.+-]+$/)
  contentType?: string;
}

export class PresignedUploadDto {
  @ApiProperty({ description: 'Pass back as `uploadKey` to POST /files after the PUT succeeded' })
  uploadKey: string;

  @ApiProperty({ format: 'uri', description: 'Pre-signed S3 URL to PUT the file body to' })
  url: string;

  @ApiProperty({ enum: ['PUT'] })
  method: 'PUT';

  @ApiProperty({
    description: 'Headers the PUT must carry (signed into the URL)',
    example: { 'Content-Type': 'image/jpeg' },
  })
  headers: Record<string, string>;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}
