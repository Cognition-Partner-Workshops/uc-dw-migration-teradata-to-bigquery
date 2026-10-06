import type { PagedPropertiesDto, PropertyDto, PropertyPictureDto } from '@/api/types';
import { BROKER, PROPERTY, PROPERTY_RECORD } from './property';

/** ISO date `days` days before today (local), for `Date_Listed__c` fixtures. */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** lwc/propertyLocation/__tests__/data/getRecord.json location (37.751, -97.822) in API shape. */
export const PROPERTY_FAR_AWAY: PropertyDto = {
  ...PROPERTY_RECORD,
  latitude: 37.751,
  longitude: -97.822,
};

/** lwc/propertyCarousel/__tests__/data/getPictures.json in API shape. */
export const PICTURES: PropertyPictureDto[] = [
  {
    id: '00000000-0000-4000-8000-00000000f001',
    title: 'house07',
    fileExtension: 'jpg',
    url: 'https://example.com/files/house07.jpg',
  },
  {
    id: '00000000-0000-4000-8000-00000000f002',
    title: 'house07-kitchen',
    fileExtension: 'jpg',
    url: 'https://example.com/files/house07-kitchen.jpg',
  },
];

export const PROPERTY_PAGE: PagedPropertiesDto = {
  pageSize: 25,
  pageNumber: 1,
  totalItemCount: 1,
  records: [PROPERTY],
};

export { BROKER, PROPERTY, PROPERTY_RECORD };
