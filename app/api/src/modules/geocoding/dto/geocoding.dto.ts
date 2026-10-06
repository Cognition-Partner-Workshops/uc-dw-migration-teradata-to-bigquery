import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

/** Port of Apex inner class `GeocodingService.GeocodingAddress`. */
export class GeocodingAddressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() street?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalcode?: string;
}

export class GeocodeAddressesDto {
  @ApiProperty({ type: GeocodingAddressDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => GeocodingAddressDto)
  addresses: GeocodingAddressDto[];
}

/** Port of Apex inner class `GeocodingService.Coordinates` (null when no match). */
export class CoordinatesDto {
  @ApiPropertyOptional({ nullable: true }) lat: number | null;
  @ApiPropertyOptional({ nullable: true }) lon: number | null;
}
