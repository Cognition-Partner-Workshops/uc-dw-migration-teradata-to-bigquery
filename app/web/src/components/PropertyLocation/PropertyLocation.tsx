import { Card, Center, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconMapPin } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { propertyQuery } from '@/api/queries';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { formatNumber } from '@/lib/format';
import { distanceInMiles, type Coordinates } from './distance';

/**
 * Port of `c/propertyLocation`: the browser's geolocation (`navigator.geolocation`, the mobile
 * `getLocationService` branch has no counterpart) against `Location__Latitude__s` /
 * `Location__Longitude__s` of the property -> current coordinates and the distance in miles.
 */
export function PropertyLocation({ propertyId }: { propertyId: string }) {
  const property = useQuery(propertyQuery(propertyId));
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<unknown>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError({ message: 'No location services available' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) =>
        setLocation({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        }),
      (error) => setLocationError({ message: error.message || 'Could not determine location' }),
    );
  }, []);

  const error = property.error ?? locationError;
  const propertyLocation =
    property.data && property.data.latitude !== null && property.data.longitude !== null
      ? { latitude: property.data.latitude, longitude: property.data.longitude }
      : null;
  const distance =
    location && propertyLocation ? distanceInMiles(location, propertyLocation) : null;

  return (
    <Card withBorder padding="md" data-testid="property-location" data-property-id={propertyId}>
      <Card.Section withBorder inheritPadding py="xs">
        <Group gap="xs" wrap="nowrap">
          <IconMapPin size={18} />
          <Title order={3} size="h5">
            Distance to the Property
          </Title>
        </Group>
      </Card.Section>
      <Card.Section inheritPadding py="md">
        {error ? (
          <ErrorPanel friendlyMessage="Error computing location." errors={error} />
        ) : distance !== null && location ? (
          <Stack gap={4} data-testid="property-location-details">
            <Text size="sm">
              Current latitude: <b data-testid="property-location-latitude">{location.latitude}</b>
            </Text>
            <Text size="sm">
              Current longitude:{' '}
              <b data-testid="property-location-longitude">{location.longitude}</b>
            </Text>
            <Text size="sm">
              Distance to property:{' '}
              <b>
                <span data-testid="property-location-distance" data-value={distance}>
                  {formatNumber(distance, 2)}
                </span>{' '}
                miles
              </b>
            </Text>
          </Stack>
        ) : property.data && !propertyLocation ? (
          <ErrorPanel
            friendlyMessage="Error computing location."
            errors={{ message: `${property.data.name} has no location` }}
          />
        ) : (
          <Center py="md" data-testid="property-location-loading">
            <Loader size="sm" aria-label="Loading..." />
          </Center>
        )}
      </Card.Section>
    </Card>
  );
}
