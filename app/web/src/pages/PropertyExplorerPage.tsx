import { Button, Card } from '@mantine/core';
import { Link } from 'react-router-dom';
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { PropertyFilter } from '@/components/PropertyFilter/PropertyFilter';
import { PropertyMap } from '@/components/PropertyMap/PropertyMap';
import { PropertySummary } from '@/components/PropertySummary/PropertySummary';
import { PropertyTileList } from '@/components/PropertyTileList/PropertyTileList';

/** flexipages/Property_Explorer: propertyFilter + Create_property flow | propertyTileList | propertySummary + propertyMap. */
export function PropertyExplorerPage() {
  return (
    <>
      <PageHeader
        title="Property Explorer"
        subtitle="Browse listings as tiles, filter them and see the selected one on a map."
      />
      <ThreeColumnLayout
        left={
          <>
            <PropertyFilter />
            {/* flowruntime:interview Create_property -> CreatePropertyWizard at /properties/new (UNT3-23) */}
            <Card withBorder padding="md" data-testid="create-property-flow">
              <Button component={Link} to="/properties/new" variant="light" fullWidth>
                Create Property
              </Button>
            </Card>
          </>
        }
        center={<PropertyTileList />}
        right={
          <>
            <PropertySummary />
            <PropertyMap />
          </>
        }
      />
    </>
  );
}
