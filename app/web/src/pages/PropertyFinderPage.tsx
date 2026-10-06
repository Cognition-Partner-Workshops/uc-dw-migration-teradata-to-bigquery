import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';
import { DaysOnMarket } from '@/components/DaysOnMarket/DaysOnMarket';
import { MigrationPlaceholder } from '@/components/MigrationPlaceholder/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { PropertyFilter } from '@/components/PropertyFilter/PropertyFilter';
import { PropertyListMap } from '@/components/PropertyListMap/PropertyListMap';
import { PropertySummary } from '@/components/PropertySummary/PropertySummary';

/** flexipages/Property_Finder: barcodeScanner + propertyFilter | propertyListMap | propertySummary + daysOnMarket. */
export function PropertyFinderPage() {
  return (
    <>
      <PageHeader title="Property Finder" subtitle="Find listings on a map." />
      <ThreeColumnLayout
        left={
          <>
            <MigrationPlaceholder
              ticket="UNT3-23"
              sources={[{ name: 'barcodeScanner', kind: 'LWC (mobile only)' }]}
            />
            <PropertyFilter />
          </>
        }
        center={<PropertyListMap height={560} />}
        right={
          <>
            <PropertySummary />
            <DaysOnMarket />
          </>
        }
      />
    </>
  );
}
