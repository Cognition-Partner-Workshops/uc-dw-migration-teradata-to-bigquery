import { MapView } from '@/components/MapView/MapView';
import { MigrationPlaceholder } from '@/components/MigrationPlaceholder/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader/PageHeader';

/** flexipages/Property_Finder: filter + barcode scanner | list map | summary + days on market. */
export function PropertyFinderPage() {
  return (
    <>
      <PageHeader title="Property Finder" subtitle="Find listings on a map." />
      <MigrationPlaceholder
        ticket="UNT3-21"
        sources={[
          { name: 'propertyFilter', kind: 'LWC' },
          { name: 'propertyListMap', kind: 'LWC' },
          { name: 'propertySummary', kind: 'LWC' },
          { name: 'daysOnMarket', kind: 'LWC' },
          { name: 'barcodeScanner', kind: 'LWC (mobile only)' },
        ]}
      >
        <MapView height={420} />
      </MigrationPlaceholder>
    </>
  );
}
