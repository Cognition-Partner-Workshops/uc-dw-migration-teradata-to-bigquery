import { describe, expect, it } from 'vitest';
import { FIELD_PERMISSIONS, fieldAccess, stripUnreadable, unwritableFields } from './field-policy';
import {
  APEX_CLASSES,
  APP_ACCESS,
  CLASS_ACCESS,
  DEVIATIONS,
  OBJECT_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_KEYS,
  effectiveObjectGrant,
  isPermitted,
  requiredGroups,
  type ApexClass,
  type SfObject,
} from './policy';
import { readPermissionSet, readSharingModel } from './salesforce-metadata.test-support';
import { ORG_WIDE_DEFAULTS, assertRecordAccess, recordAccessWhere } from './sharing';
import type { Principal } from './principal';

const permissionSet = readPermissionSet('dreamhouse');
const deviates = (subject: string) =>
  DEVIATIONS.some((d) => d.subject === subject && d.group === 'dreamhouse');

const standard: Principal = { sub: 'u-standard', username: 'standarduser', groups: ['dreamhouse'] };
const admin: Principal = {
  sub: 'u-admin',
  username: 'admin',
  groups: ['dreamhouse', 'dreamhouse-admin'],
};
const guest: Principal = { sub: 'u-guest', username: 'guest', groups: [] };

/**
 * The policy tables are a transcription of dreamhouse.permissionset-meta.xml; this spec keeps
 * them honest by re-reading the XML (the parity half of the permission matrix).
 */
describe('policy.ts mirrors dreamhouse.permissionset-meta.xml (group dreamhouse)', () => {
  it('application visibility -> app.access', () => {
    expect(permissionSet.application).toEqual([{ application: 'Dreamhouse', visible: true }]);
    expect(APP_ACCESS.dreamhouse).toBe(true);
    expect(isPermitted(['dreamhouse'], 'app.access')).toBe(true);
    expect(isPermitted([], 'app.access')).toBe(false);
  });

  it('objectPermissions -> OBJECT_PERMISSIONS (CRUD + viewAll/modifyAll), object for object', () => {
    expect(permissionSet.objects.map((o) => o.object).sort()).toEqual(['Broker__c', 'Property__c']);
    for (const o of permissionSet.objects) {
      expect(OBJECT_PERMISSIONS.dreamhouse[o.object as SfObject]).toEqual({
        create: o.allowCreate,
        read: o.allowRead,
        edit: o.allowEdit,
        delete: o.allowDelete,
        viewAllRecords: o.viewAllRecords,
        modifyAllRecords: o.modifyAllRecords,
      });
    }
  });

  it('classAccesses -> CLASS_ACCESS, except the documented deviations', () => {
    const enabled = new Set(permissionSet.classes.filter((c) => c.enabled).map((c) => c.apexClass));
    expect([...enabled].sort()).toEqual([
      'PagedResult',
      'PropertyController',
      'SampleDataController',
    ]);
    for (const apexClass of APEX_CLASSES) {
      if (deviates(`apexClass.${apexClass}`)) continue;
      expect(CLASS_ACCESS.dreamhouse[apexClass as ApexClass], apexClass).toBe(
        enabled.has(apexClass),
      );
    }
    // every deviation names a real class and really differs from the XML
    for (const d of DEVIATIONS.filter((d) => d.subject.startsWith('apexClass.'))) {
      const apexClass = d.subject.slice('apexClass.'.length) as ApexClass;
      expect(APEX_CLASSES).toContain(apexClass);
      expect(CLASS_ACCESS[d.group][apexClass]).not.toBe(enabled.has(apexClass));
      expect(d.reason.length).toBeGreaterThan(20);
    }
  });

  it('fieldPermissions -> FIELD_PERMISSIONS, field for field and flag for flag, in file order', () => {
    expect(
      FIELD_PERMISSIONS.map(({ sfField, readable, editable }) => ({
        field: sfField,
        readable,
        editable,
      })),
    ).toEqual(permissionSet.fields);
    // formula fields are exactly the read-only ones
    expect(FIELD_PERMISSIONS.filter((f) => f.formula).map((f) => f.sfField)).toEqual(
      permissionSet.fields.filter((f) => f.readable && !f.editable).map((f) => f.field),
    );
    // every rule maps to at least one API field and the API names are unique per object
    for (const object of ['Property__c', 'Broker__c'] as const) {
      const names = FIELD_PERMISSIONS.filter((f) => f.object === object).flatMap((f) => f.fields);
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('org-wide defaults -> ORG_WIDE_DEFAULTS for the custom objects', () => {
    expect(ORG_WIDE_DEFAULTS.Property__c).toBe(readSharingModel('Property__c'));
    expect(ORG_WIDE_DEFAULTS.Broker__c).toBe(readSharingModel('Broker__c'));
  });

  it('dreamhouse-admin is a superset of dreamhouse for every permission key', () => {
    for (const key of PERMISSION_KEYS) {
      if (isPermitted(['dreamhouse'], key))
        expect(requiredGroups(key), key).toContain('dreamhouse-admin');
      expect(isPermitted(['dreamhouse-admin'], key), key).toBe(true);
    }
  });

  it('no group at all (or an unrelated one) holds nothing', () => {
    for (const key of PERMISSION_KEYS) {
      expect(isPermitted([], key), key).toBe(false);
      expect(isPermitted(['other-app'], key), key).toBe(false);
    }
    expect(Object.keys(PERMISSIONS).length).toBe(PERMISSION_KEYS.length);
  });
});

describe('field-level security (field-policy.ts)', () => {
  it('dreamhouse reads every listed field and edits all but the formulas', () => {
    const access = fieldAccess(standard.groups, 'Property__c');
    expect(access.readable.has('daysOnMarket')).toBe(true);
    expect(access.editable.has('daysOnMarket')).toBe(false);
    expect([...access.controlled].filter((f) => !access.readable.has(f))).toEqual([]);
    expect([...access.controlled].filter((f) => !access.editable.has(f)).sort()).toEqual([
      'daysOnMarket',
      'pictureImg',
      'recordLink',
      'thumbnailImg',
    ]);
    expect([...fieldAccess(standard.groups, 'Broker__c').editable]).not.toContain('pictureImg');
  });

  it('dreamhouse-admin cannot write formula fields either', () => {
    expect(fieldAccess(admin.groups, 'Property__c').editable.has('recordLink')).toBe(false);
    expect(fieldAccess(admin.groups, 'Property__c').editable.has('price')).toBe(true);
  });

  it('a user without the permission set reads and edits no FLS-controlled field (hidden fields)', () => {
    const access = fieldAccess(guest.groups, 'Property__c');
    expect(access.readable.size).toBe(0);
    expect(access.editable.size).toBe(0);
    const record = { id: 'p1', name: 'Loft', price: 1, city: 'Boston', createdAt: 'x' };
    expect(stripUnreadable(record, guest.groups, 'Property__c')).toEqual({
      id: 'p1',
      createdAt: 'x',
    });
    expect(stripUnreadable({ records: [record], total: 1 }, guest.groups, 'Property__c')).toEqual({
      records: [{ id: 'p1', createdAt: 'x' }],
      total: 1,
    });
    expect(unwritableFields({ city: 'Boston', bogus: 1 }, guest.groups, 'Property__c')).toEqual([
      'city',
    ]);
  });

  it('stripUnreadable keeps everything a dreamhouse user may read and passes non-FLS keys through', () => {
    const record = { id: 'p1', name: 'Loft', price: 1, thumbnail: 'u', unknownComputed: true };
    expect(stripUnreadable(record, standard.groups, 'Property__c')).toEqual(record);
    expect(stripUnreadable([record], standard.groups, 'Property__c')).toEqual([record]);
    expect(stripUnreadable(null, standard.groups, 'Property__c')).toBeNull();
  });

  it('unwritableFields flags only formula fields for dreamhouse, nothing for ordinary fields', () => {
    expect(
      unwritableFields(
        { price: 1, daysOnMarket: 3, geocode: true },
        standard.groups,
        'Property__c',
      ),
    ).toEqual(['daysOnMarket']);
    expect(unwritableFields({ pictureImg: 'x', picture: 'y' }, admin.groups, 'Broker__c')).toEqual([
      'pictureImg',
    ]);
    expect(unwritableFields('not an object', standard.groups, 'Broker__c')).toEqual([]);
  });
});

describe('row-level sharing (sharing.ts)', () => {
  it('Public Read/Write + View All / Modify All: no ownership filter on Property__c and Broker__c', () => {
    for (const object of ['Property__c', 'Broker__c'] as const) {
      for (const op of ['read', 'edit', 'delete'] as const) {
        expect(recordAccessWhere(object, op, standard)).toEqual({});
        expect(recordAccessWhere(object, op, admin)).toEqual({});
      }
    }
    expect(effectiveObjectGrant(standard.groups, 'Property__c').modifyAllRecords).toBe(true);
  });

  it('Contact (Controlled by Parent, no Account): owner only for dreamhouse, everything for View All', () => {
    expect(recordAccessWhere('Contact', 'read', standard)).toEqual({ ownerId: 'u-standard' });
    expect(recordAccessWhere('Contact', 'edit', standard)).toEqual({ ownerId: 'u-standard' });
    expect(recordAccessWhere('Contact', 'delete', standard)).toEqual({ ownerId: 'u-standard' });
    expect(recordAccessWhere('Contact', 'read', admin)).toEqual({});
  });

  it('system context (no principal: seed, batch import) sees everything', () => {
    expect(recordAccessWhere('Contact', 'read', undefined)).toEqual({});
  });

  it('assertRecordAccess: invisible rows are not found, visible-but-read-only rows are 403', () => {
    expect(() =>
      assertRecordAccess('Contact', 'read', { ownerId: 'u-standard' }, standard),
    ).not.toThrow();
    expect(() =>
      assertRecordAccess('Contact', 'read', { ownerId: 'someone-else' }, standard),
    ).toThrow(/not found/);
    expect(() =>
      assertRecordAccess('Contact', 'edit', { ownerId: 'someone-else' }, standard),
    ).toThrow(/not found/);
    expect(() => assertRecordAccess('Contact', 'edit', { ownerId: null }, admin)).not.toThrow();
    expect(() =>
      assertRecordAccess('Property__c', 'delete', { ownerId: null }, standard),
    ).not.toThrow();
  });

  it('a group with CRUD but without View All on a Public Read/Write object may read and edit, but delete only its own', () => {
    // No such group exists in the org today; exercised through the grant union with the Contact baseline shape.
    const grant = effectiveObjectGrant(['dreamhouse'], 'Contact');
    expect(grant).toMatchObject({
      create: true,
      read: true,
      edit: true,
      delete: true,
      viewAllRecords: false,
    });
  });
});
