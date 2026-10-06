import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appTabs, findActiveTab } from './navigation';

const dreamhouseApp = resolve(
  __dirname,
  '../../../../salesforce/force-app/main/default/applications/Dreamhouse.app-meta.xml',
);

describe('appTabs', () => {
  it('matches the <tabs> of the Dreamhouse Lightning app, in order', () => {
    const xml = readFileSync(dreamhouseApp, 'utf8');
    const salesforceTabs = [...xml.matchAll(/<tabs>([^<]+)<\/tabs>/g)].map((m) => m[1]);
    expect(appTabs.map((tab) => tab.salesforceTab)).toEqual(salesforceTabs);
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
