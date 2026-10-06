import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/** Query parameters of Apex `PropertyController.getPagedPropertyList`. */
export class PropertyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches name, city or tags (SOQL `LIKE %searchKey%`)' })
  @IsOptional()
  @IsString()
  searchKey?: string;

  @ApiPropertyOptional({ default: 9999999 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice: number = 9999999;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBedrooms: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBathrooms: number = 0;
}
