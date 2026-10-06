import { ApiProperty } from '@nestjs/swagger';
import { IsBase64, IsNotEmpty, IsString, IsUUID } from 'class-validator';

/** Parameters of Apex `FileUtilities.createFile(base64data, filename, recordId)`. */
export class CreateFileDto {
  @ApiProperty({ description: 'File body, base64 encoded (ContentVersion.VersionData)' })
  @IsBase64()
  @IsNotEmpty()
  base64Data: string;

  @ApiProperty({ description: 'ContentVersion.Title / PathOnClient' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Record the file is linked to (ContentDocumentLink.LinkedEntityId)',
  })
  @IsUUID()
  recordId: string;
}

export class FileCreatedDto {
  @ApiProperty({ format: 'uuid', description: 'Equivalent of the returned ContentDocumentLink.Id' })
  id: string;

  @ApiProperty({ format: 'uri', description: 'Where the stored file can be fetched from (S3)' })
  url: string;
}
