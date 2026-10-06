import { useParams } from 'react-router-dom';
import { MigrationPlaceholder } from '@/components/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader';

/** flexipages/Property_Record_Page: highlights, details, propertyCarousel, propertyLocation, brokerCard. */
export function PropertyRecordPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <PageHeader title={`Property ${id ?? ''}`} subtitle="Property record page." />
      <MigrationPlaceholder
        ticket="UNT3-22"
        sources={[
          { name: 'Property_Record_Page', kind: 'flexipage' },
          { name: 'propertyCarousel', kind: 'LWC' },
          { name: 'propertyLocation', kind: 'LWC' },
          { name: 'brokerCard', kind: 'LWC' },
          { name: 'daysOnMarket', kind: 'LWC' },
          { name: 'pageTemplate_2_7_3', kind: 'Aura page template' },
        ]}
      />
    </>
  );
}
