import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PropertyQueryDto } from './dto/property-query.dto';
import { PagedPropertiesDto, PropertyPictureDto, PropertySummaryDto } from './dto/property.dto';

/** `ContentDocument.FileType IN ('PNG', 'JPG', 'GIF')` (PropertyController.cls line 90). */
export const PICTURE_FILE_TYPES = ['PNG', 'JPG', 'GIF'] as const;

/** `SELECT Id, Name, Address__c, ... Location__Longitude__s FROM Property__c` (PropertyController.cls lines 48-61). */
const PROPERTY_SUMMARY_SELECT = {
  id: true,
  name: true,
  address: true,
  city: true,
  state: true,
  description: true,
  price: true,
  baths: true,
  beds: true,
  thumbnail: true,
  locationLatitude: true,
  locationLongitude: true,
} satisfies Prisma.PropertySelect;

type PropertySummaryRow = Prisma.PropertyGetPayload<{ select: typeof PROPERTY_SUMMARY_SELECT }>;

const toNumber = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : value.toNumber();

/**
 * Home of Apex `PropertyController` (+ `TestPropertyController`).
 * Both methods were `@AuraEnabled(cacheable=true)`: the controller answers them on GET with
 * `Cache-Control` and the web caches them through TanStack Query (app/web/src/api/queries.ts).
 */
@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `PropertyController.getPagedPropertyList(searchKey, maxPrice, minBedrooms, minBathrooms, pageSize, pageNumber)`.
   * Input defaults (`?? DEFAULT_MAX_PRICE`, `?? 0`, `?? 9`, `?? 1`) are applied by PropertyQueryDto.
   */
  async getPagedPropertyList(query: PropertyQueryDto): Promise<PagedPropertiesDto> {
    const where = PropertiesService.searchWhere(query);
    const offset = (query.pageNumber - 1) * query.pageSize;

    const [totalItemCount, rows] = await this.prisma.$transaction([
      // `SELECT COUNT() FROM Property__c WHERE ...` (lines 37-47)
      this.prisma.property.count({ where }),
      // `SELECT ... FROM Property__c WHERE ... ORDER BY Price__c LIMIT :pageSize OFFSET :offset` (lines 48-74)
      this.prisma.property.findMany({
        where,
        select: PROPERTY_SUMMARY_SELECT,
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
        take: query.pageSize,
        skip: offset,
      }),
    ]);

    return {
      pageSize: query.pageSize,
      pageNumber: query.pageNumber,
      totalItemCount,
      records: rows.map(PropertiesService.toSummary),
    };
  }

  /**
   * `PropertyController.getPictures(propertyId)`: ContentDocumentLinks of the record whose
   * ContentDocument.FileType is a picture, then the latest ContentVersion of each ordered by
   * CreatedDate. The two SOQL queries collapse into one over `files`. Apex returns null when
   * nothing is linked; over HTTP that is an empty array (the carousel treats both the same).
   */
  async getPictures(propertyId: string): Promise<PropertyPictureDto[]> {
    const files = await this.prisma.file.findMany({
      where: { recordId: propertyId, fileType: { in: [...PICTURE_FILE_TYPES] } },
      select: { id: true, title: true, fileType: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return files.map((file) => ({
      id: file.id,
      title: file.title,
      fileExtension: file.fileType.toLowerCase(),
      url: `/files/${file.id}`,
    }));
  }

  /**
   * `(Name LIKE :p OR City__c LIKE :p OR Tags__c LIKE :p) AND Price__c <= :maxPrice AND Beds__c >= :minBedrooms
   * AND Baths__c >= :minBathrooms` with `p = '%' + searchKey + '%'`. SOQL LIKE is case-insensitive, hence
   * `mode: 'insensitive'` (ILIKE, served by the pg_trgm indexes). Null Price/Beds/Baths never satisfy a
   * SOQL comparison and never satisfy the Prisma filters either.
   */
  static searchWhere(query: PropertyQueryDto): Prisma.PropertyWhereInput {
    const searchKey = query.searchKey ?? '';
    const like = { contains: searchKey, mode: 'insensitive' as const };
    return {
      OR: [{ name: like }, { city: like }, { tags: like }],
      price: { lte: query.maxPrice },
      beds: { gte: query.minBedrooms },
      baths: { gte: query.minBathrooms },
    };
  }

  static toSummary(row: PropertySummaryRow): PropertySummaryDto {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      description: row.description,
      price: toNumber(row.price),
      baths: row.baths,
      beds: row.beds,
      thumbnail: row.thumbnail,
      latitude: toNumber(row.locationLatitude),
      longitude: toNumber(row.locationLongitude),
    };
  }
}
