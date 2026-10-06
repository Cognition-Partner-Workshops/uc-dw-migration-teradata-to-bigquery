import { BarcodeScanner } from '@/components/BarcodeScanner/BarcodeScanner';
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';
import { MigrationPlaceholder } from '@/components/MigrationPlaceholder/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { PropertyFilter } from '@/components/PropertyFilter/PropertyFilter';
import { PropertyListMap } from '@/components/PropertyListMap/PropertyListMap';
import { PropertySummary } from '@/components/PropertySummary/PropertySummary';

/** flexipages/Property_Finder: barcodeScanner (BarcodeDetector substitute) + propertyFilter | propertyListMap | propertySummary + daysOnMarket. */
export function PropertyFinderPage() {
  return (
    <>
      <PageHeader title="Property Finder" subtitle="Find listings on a map." />
      <ThreeColumnLayout
        left={
          <>
            <BarcodeScanner />
            <PropertyFilter />
          </>
        }
        center={<PropertyListMap height={560} />}
        right={
          <>
            <PropertySummary />
            <MigrationPlaceholder
              ticket="UNT3-22"
              sources={[{ name: 'daysOnMarket', kind: 'LWC' }]}
            />
          </>
        }
      />
    </>
  );
}
