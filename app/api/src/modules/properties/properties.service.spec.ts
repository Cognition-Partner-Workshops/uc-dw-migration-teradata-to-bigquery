import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { GeocodingService } from '../geocoding/geocoding.service';
import { PropertyQueryDto } from './dto/property-query.dto';
import { PICTURE_FILE_TYPES, PropertiesService } from './properties.service';

function query(overrides: Partial<PropertyQueryDto> = {}): PropertyQueryDto {
  return Object.assign(new PropertyQueryDto(), overrides);
}

function prismaStub() {
  const prisma = {
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    property: { count: vi.fn(), findMany: vi.fn() },
    file: { findMany: vi.fn() },
  };
  const geocoding = { geocodeAddress: vi.fn() };
  return {
    prisma,
    geocoding,
    service: new PropertiesService(
      prisma as unknown as PrismaService,
      geocoding as unknown as GeocodingService,
    ),
  };
}

describe('PropertiesService.searchWhere (PropertyController.cls lines 37-47 / 62-69)', () => {
  it('matches %searchKey% on name, city and tags case-insensitively (SOQL LIKE)', () => {
    const where = PropertiesService.searchWhere(query({ searchKey: 'Villa' }));
    const like = { contains: 'Villa', mode: 'insensitive' };
    expect(where.OR).toEqual([{ name: like }, { city: like }, { tags: like }]);
  });

  it('applies the inclusive bounds and the Apex defaults when inputs are omitted', () => {
    expect(PropertiesService.searchWhere(query())).toMatchObject({
      OR: expect.arrayContaining([{ name: { contains: '', mode: 'insensitive' } }]),
      price: { lte: 9999999 },
      beds: { gte: 0 },
      baths: { gte: 0 },
    });
    expect(
      PropertiesService.searchWhere(query({ maxPrice: 500000, minBedrooms: 2, minBathrooms: 1 })),
    ).toMatchObject({ price: { lte: 500000 }, beds: { gte: 2 }, baths: { gte: 1 } });
  });
});

describe('PropertiesService.getPagedPropertyList', () => {
  it('returns the PagedResult shape with the unpaged count, OFFSET/LIMIT and ORDER BY Price__c', async () => {
    const { prisma, service } = prismaStub();
    prisma.property.count.mockResolvedValue(23);
    prisma.property.findMany.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Name 0',
        address: null,
        city: 'Boston',
        state: null,
        description: null,
        price: new Prisma.Decimal('20000.00'),
        baths: 3,
        beds: 3,
        thumbnail: null,
        locationLatitude: new Prisma.Decimal('42.3600825'),
        locationLongitude: null,
      },
    ]);

    const result = await service.getPagedPropertyList(query({ pageSize: 10, pageNumber: 3 }));

    expect(result).toEqual({
      pageSize: 10,
      pageNumber: 3,
      totalItemCount: 23,
      records: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Name 0',
          address: null,
          city: 'Boston',
          state: null,
          description: null,
          price: 20000,
          baths: 3,
          beds: 3,
          thumbnail: null,
          latitude: 42.3600825,
          longitude: null,
        },
      ],
    });
    const where = PropertiesService.searchWhere(query());
    expect(prisma.property.count).toHaveBeenCalledWith({ where });
    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        take: 10,
        skip: 20,
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
      }),
    );
  });
});

describe('PropertiesService.getPictures (PropertyController.cls lines 84-112)', () => {
  it('selects PNG/JPG/GIF files of the record ordered by CreatedDate and lower-cases the extension', async () => {
    const { prisma, service } = prismaStub();
    prisma.file.findMany.mockResolvedValue([
      { id: 'f1', title: 'MockPictureName', fileType: 'PNG' },
      { id: 'f2', title: 'Garden', fileType: 'JPG' },
    ]);

    const pictures = await service.getPictures('22222222-2222-4222-8222-222222222222');

    expect(prisma.file.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          recordId: '22222222-2222-4222-8222-222222222222',
          fileType: { in: [...PICTURE_FILE_TYPES] },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
    expect(pictures).toEqual([
      { id: 'f1', title: 'MockPictureName', fileExtension: 'png', url: '/files/f1' },
      { id: 'f2', title: 'Garden', fileExtension: 'jpg', url: '/files/f2' },
    ]);
  });

  it('answers [] (not null) when nothing is linked', async () => {
    const { prisma, service } = prismaStub();
    prisma.file.findMany.mockResolvedValue([]);
    await expect(service.getPictures('22222222-2222-4222-8222-222222222222')).resolves.toEqual([]);
  });
});
