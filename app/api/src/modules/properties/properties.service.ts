import { Injectable } from '@nestjs/common';
import { NotPortedException } from '../../common/not-ported.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { PropertyQueryDto } from './dto/property-query.dto';
import { PagedPropertiesDto, PropertyPictureDto } from './dto/property.dto';

/**
 * Home of Apex `PropertyController` (+ `TestPropertyController`).
 * SOQL in the Apex class becomes Prisma queries against the `properties` table here.
 */
@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPagedPropertyList(_query: PropertyQueryDto): Promise<PagedPropertiesDto> {
    throw new NotPortedException('PropertyController.getPagedPropertyList', 'UNT3-16');
  }

  async getPictures(_propertyId: string): Promise<PropertyPictureDto[]> {
    throw new NotPortedException('PropertyController.getPictures', 'UNT3-16');
  }
}
