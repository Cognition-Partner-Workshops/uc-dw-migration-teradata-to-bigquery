import {
  IconAddressBook,
  IconBuildingCommunity,
  IconFiles,
  IconHome,
  IconMap,
  IconSettings,
  IconTelescope,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import { ADMIN_GROUP, DREAMHOUSE_GROUP, hasGroup, type DreamhouseGroup } from '@/auth/groups';

/**
 * Navigation tabs of the Dreamhouse Lightning app
 * (salesforce/force-app/main/default/applications/Dreamhouse.app-meta.xml, `<tabs>` in order).
 * The app shell renders its navigation from this list; routes.tsx mounts a page per tab.
 * `requiredGroup` is the tab visibility of the `dreamhouse` permission set (`<tabSettings>`
 * Visible, standard tabs Default On) with one documented exception: Settings (sample data
 * import) is `dreamhouse-admin` only — docs/migration/mapping.yaml tab:Settings.
 */
export interface AppTab {
  /** Stable id used in tests and as the React key. */
  id: string;
  /** Label shown in the navigation (the Salesforce tab label). */
  label: string;
  /** Route path; also the prefix that marks the tab active (`/properties/123` -> Properties). */
  path: string;
  /** The Salesforce tab this replaces (`<tabs>` entry in Dreamhouse.app-meta.xml). */
  salesforceTab: string;
  /** Lightning page / object page the tab opened in Salesforce. */
  salesforcePage: string;
  icon: Icon;
  /** Cognito group that makes the tab visible (the permission set / profile that granted it). */
  requiredGroup: DreamhouseGroup;
}

export const appTabs: readonly AppTab[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    salesforceTab: 'standard-home',
    salesforcePage: 'Home (standard)',
    icon: IconHome,
    requiredGroup: DREAMHOUSE_GROUP,
  },
  {
    id: 'property-explorer',
    label: 'Property Explorer',
    path: '/property-explorer',
    salesforceTab: 'Property_Explorer',
    salesforcePage: 'flexipages/Property_Explorer',
    icon: IconTelescope,
    requiredGroup: DREAMHOUSE_GROUP,
  },
  {
    id: 'property-finder',
    label: 'Property Finder',
    path: '/property-finder',
    salesforceTab: 'Property_Finder',
    salesforcePage: 'flexipages/Property_Finder',
    icon: IconMap,
    requiredGroup: DREAMHOUSE_GROUP,
  },
  {
    id: 'contacts',
    label: 'Contacts',
    path: '/contacts',
    salesforceTab: 'standard-Contact',
    salesforcePage: 'Contact (standard object)',
    icon: IconAddressBook,
    requiredGroup: DREAMHOUSE_GROUP,
  },
  {
    id: 'properties',
    label: 'Properties',
    path: '/properties',
    salesforceTab: 'Property__c',
    salesforcePage: 'Property__c list + flexipages/Property_Record_Page',
    icon: IconBuildingCommunity,
    requiredGroup: DREAMHOUSE_GROUP,
  },
  {
    id: 'brokers',
    label: 'Brokers',
    path: '/brokers',
    salesforceTab: 'Broker__c',
    salesforcePage: 'Broker__c list + flexipages/Broker_Record_Page',
    icon: IconUsers,
    requiredGroup: DREAMHOUSE_GROUP,
  },
  {
    id: 'files',
    label: 'Files',
    path: '/files',
    salesforceTab: 'standard-File',
    salesforcePage: 'Files (standard)',
    icon: IconFiles,
    requiredGroup: DREAMHOUSE_GROUP,
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    salesforceTab: 'Settings',
    salesforcePage: 'flexipages/Settings',
    icon: IconSettings,
    requiredGroup: ADMIN_GROUP,
  },
];

/** True when a user with `groups` may see / open the tab. */
export function canOpenTab(tab: AppTab, groups: readonly string[] | undefined): boolean {
  return hasGroup(groups, tab.requiredGroup);
}

/** The tabs a user with `groups` sees in the navigation, in app order. */
export function visibleTabs(groups: readonly string[] | undefined): AppTab[] {
  return appTabs.filter((tab) => canOpenTab(tab, groups));
}

export function findActiveTab(pathname: string): AppTab | undefined {
  return appTabs.find((tab) =>
    tab.path === '/'
      ? pathname === '/'
      : pathname === tab.path || pathname.startsWith(`${tab.path}/`),
  );
}
