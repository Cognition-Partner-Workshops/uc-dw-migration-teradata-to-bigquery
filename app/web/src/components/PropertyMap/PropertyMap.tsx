import { Card, Title } from '@mantine/core';
import { MapView } from '@/components/MapView/MapView';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { useSelectedProperty } from '@/state/selectedProperty';

/** `zoomLevel = 14`. */
export const PROPERTY_MAP_ZOOM = 14;

/**
 * Port of `c/propertyMap`: `lightning-map` with one marker on the selected property's location
 * (subscribes `PropertySelected`), card title `Address, City`.
 */
export function PropertyMap({ height = 280 }: { height?: number | string }) {
  const { propertyId, property } = useSelectedProperty();
  const hasLocation = property && property.latitude !== null && property.longitude !== null;

  return (
    <Card withBorder padding="md" data-testid="property-map" data-property-id={propertyId ?? ''}>
      {property && (
        <Card.Section withBorder inheritPadding py="xs">
          <Title order={3} size="h5" lineClamp={1} data-testid="property-map-address">
            {property.address}, {property.city}
          </Title>
        </Card.Section>
      )}
      {hasLocation ? (
        <Card.Section mt="md">
          <MapView
            center={[property.latitude as number, property.longitude as number]}
            zoom={PROPERTY_MAP_ZOOM}
            markers={[
              {
                id: property.id,
                position: [property.latitude as number, property.longitude as number],
                label: (
                  <>
                    <strong>{property.name}</strong>
                    <br />
                    <b>Address</b>: {property.address}
                  </>
                ),
              },
            ]}
            height={height}
            data-testid="property-map-view"
          />
        </Card.Section>
      ) : property ? (
        <ErrorPanel
          friendlyMessage="Error retrieving map"
          errors={{ message: `${property.name} has no location` }}
        />
      ) : (
        <ErrorPanel friendlyMessage="Select a property to see its location" />
      )}
    </Card>
  );
}
