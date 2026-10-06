import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Minimal reader for the frozen Salesforce metadata the auth tables are checked against
 * (test-only; the XML is simple enough that a regex walk is exact).
 */
export const SALESFORCE_ROOT = resolve(__dirname, '../../../../salesforce/force-app/main/default');

export function readMetadata(relativePath: string): string {
  return readFileSync(resolve(SALESFORCE_ROOT, relativePath), 'utf8');
}

/** All `<tag>…</tag>` blocks of a document, each as a map of its child elements. */
export function blocks(xml: string, tag: string): Record<string, string>[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  const out: Record<string, string>[] = [];
  for (const match of xml.matchAll(re)) {
    const entry: Record<string, string> = {};
    for (const child of match[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) entry[child[1]] = child[2];
    out.push(entry);
  }
  return out;
}

export const bool = (value: string | undefined): boolean => value === 'true';

export interface PermissionSetXml {
  application: { application: string; visible: boolean }[];
  classes: { apexClass: string; enabled: boolean }[];
  objects: {
    object: string;
    allowCreate: boolean;
    allowRead: boolean;
    allowEdit: boolean;
    allowDelete: boolean;
    viewAllRecords: boolean;
    modifyAllRecords: boolean;
  }[];
  fields: { field: string; readable: boolean; editable: boolean }[];
  tabs: { tab: string; visibility: string }[];
}

export function readPermissionSet(name = 'dreamhouse'): PermissionSetXml {
  const xml = readMetadata(`permissionsets/${name}.permissionset-meta.xml`);
  return {
    application: blocks(xml, 'applicationVisibilities').map((b) => ({
      application: b.application,
      visible: bool(b.visible),
    })),
    classes: blocks(xml, 'classAccesses').map((b) => ({
      apexClass: b.apexClass,
      enabled: bool(b.enabled),
    })),
    objects: blocks(xml, 'objectPermissions').map((b) => ({
      object: b.object,
      allowCreate: bool(b.allowCreate),
      allowRead: bool(b.allowRead),
      allowEdit: bool(b.allowEdit),
      allowDelete: bool(b.allowDelete),
      viewAllRecords: bool(b.viewAllRecords),
      modifyAllRecords: bool(b.modifyAllRecords),
    })),
    fields: blocks(xml, 'fieldPermissions').map((b) => ({
      field: b.field,
      readable: bool(b.readable),
      editable: bool(b.editable),
    })),
    tabs: blocks(xml, 'tabSettings').map((b) => ({ tab: b.tab, visibility: b.visibility })),
  };
}

export function readSharingModel(object: string): string | undefined {
  const xml = readMetadata(`objects/${object}/${object}.object-meta.xml`);
  return /<sharingModel>([^<]*)<\/sharingModel>/.exec(xml)?.[1];
}
