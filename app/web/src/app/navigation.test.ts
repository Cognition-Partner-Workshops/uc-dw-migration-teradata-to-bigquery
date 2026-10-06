import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appTabs, findActiveTab, visibleTabs } from './navigation';

const salesforceRoot = resolve(__dirname, '../../../../salesforce/force-app/main/default');
const dreamhouseApp = resolve(salesforceRoot, 'applications/Dreamhouse.app-meta.xml');
const permissionSet = resolve(salesforceRoot, 'permissionsets/dreamhouse.permissionset-meta.xml');

/** Tabs the permission set marks Visible but the port reserves for dreamhouse-admin (mapping.yaml tab:Settings). */
const ADMIN_ONLY_DEVIATIONS = ['Settings'];

describe('appTabs', () => {
  it('matches the <tabs> of the Dreamhouse Lightning app, in order', () => {
    const xml = readFileSync(dreamhouseApp, 'utf8');
    const salesforceTabs = [...xml.matchAll(/<tabs>([^<]+)<\/tabs>/g)].map((m) => m[1]);
    expect(appTabs.map((tab) => tab.salesforceTab)).toEqual(salesforceTabs);
  });

  it('tab visibility follows the <tabSettings> of the dreamhouse permission set (plus standard tabs)', () => {
    const xml = readFileSync(permissionSet, 'utf8');
    const visible = [
      ...xml.matchAll(/<tab>([^<]+)<\/tab>\s*<visibility>Visible<\/visibility>/g),
    ].map((m) => m[1]);
    expect(visible.length).toBeGreaterThan(0);
    const standardTabs = visibleTabs(['dreamhouse']).map((t) => t.salesforceTab);
    for (const tab of visible) {
      if (ADMIN_ONLY_DEVIATIONS.includes(tab)) {
        expect(standardTabs).not.toContain(tab);
        expect(
          visibleTabs(['dreamhouse', 'dreamhouse-admin']).map((t) => t.salesforceTab),
        ).toContain(tab);
      } else {
        expect(standardTabs).toContain(tab);
      }
    }
    // standard tabs of the app (Home, Contact, File) are profile defaults -> dreamhouse
    expect(standardTabs).toEqual(
      expect.arrayContaining(['standard-home', 'standard-Contact', 'standard-File']),
    );
  });

  it('a user without the dreamhouse group sees no tab; the admin group sees them all', () => {
    expect(visibleTabs([])).toEqual([]);
    expect(visibleTabs(undefined)).toEqual([]);
    expect(visibleTabs(['other-app'])).toEqual([]);
    expect(visibleTabs(['dreamhouse', 'dreamhouse-admin'])).toEqual(appTabs);
    expect(visibleTabs(['dreamhouse']).map((t) => t.id)).not.toContain('settings');
  });

  it('has unique ids and paths', () => {
    expect(new Set(appTabs.map((t) => t.id)).size).toBe(appTabs.length);
    expect(new Set(appTabs.map((t) => t.path)).size).toBe(appTabs.length);
  });

  it('resolves the active tab from a pathname, including record pages', () => {
    expect(findActiveTab('/')?.id).toBe('home');
    expect(findActiveTab('/properties')?.id).toBe('properties');
    expect(findActiveTab('/properties/a0X123')?.id).toBe('properties');
    expect(findActiveTab('/property-explorer')?.id).toBe('property-explorer');
    expect(findActiveTab('/nope')).toBeUndefined();
  });
});
