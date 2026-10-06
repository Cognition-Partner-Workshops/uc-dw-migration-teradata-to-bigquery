import { describe, expect, it } from 'vitest';
import { PROPERTY_FIELDS, daysOnMarket } from '@/pages/properties/propertyLayout';
import { changedValues, draftsOf, formatFieldValue, missingRequired } from './values';

const fields = Object.values(PROPERTY_FIELDS);

describe('record values', () => {
  it('diffs drafts against the record and types the payload by field', () => {
    const record = { name: 'A', price: 100, beds: 2, latitude: 1, longitude: 2, brokerId: null };
    const original = draftsOf(fields, record);
    const drafts = { ...original, price: '250000', beds: '', latitude: '42.1', brokerId: 'b1' };
    expect(changedValues(fields, drafts, original)).toEqual({
      price: 250000,
      beds: null,
      latitude: 42.1,
      brokerId: 'b1',
    });
  });

  it('sends every non-empty value when creating', () => {
    const drafts = { ...draftsOf(fields, undefined), name: 'New', status: 'Available' };
    expect(changedValues(fields, drafts, undefined)).toEqual({ name: 'New', status: 'Available' });
  });

  it('flags required fields that are empty', () => {
    expect(missingRequired(fields, draftsOf(fields, undefined))).toEqual(['name']);
  });

  it('formats currency, dates, geolocation and the Days On Market formula', () => {
    const record = {
      price: 450000,
      dateListed: '2020-05-30',
      createdAt: '2026-01-01T00:00:00.000Z',
      latitude: 42.365985,
      longitude: -71.055972,
    };
    expect(formatFieldValue(PROPERTY_FIELDS.price, record)).toBe('$450,000.00');
    expect(formatFieldValue(PROPERTY_FIELDS.dateListed, record)).toBe('May 30, 2020');
    expect(formatFieldValue(PROPERTY_FIELDS.location, record)).toBe('42.365985, -71.055972');
    expect(formatFieldValue(PROPERTY_FIELDS.daysOnMarket, record)).toBe(
      daysOnMarket('2020-05-30').toLocaleString('en-US'),
    );
    expect(daysOnMarket(null)).toBe(0);
    expect(daysOnMarket('2020-05-30', new Date(2020, 5, 29))).toBe(30);
  });
});
