import { Paper } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import type { LatLngExpression } from 'leaflet';
import { useEffect, useMemo } from 'react';
import { propertiesQuery } from '@/api/queries';
import type { PropertySummaryDto } from '@/api/types';
import { MapView, type MapMarker } from '@/components/MapView/MapView';
import { reduceErrors } from '@/lib/errors';
import { usePropertyFilters } from '@/state/propertyFilters';
import { rememberProperties, useSelectedProperty } from '@/state/selectedProperty';
import classes from './PropertyListMap.module.css';

/** `this.map.setView([42.356045, -71.08565], 13)`. */
const LIST_MAP_CENTER: LatLngExpression = [42.356045, -71.08565];
const LIST_MAP_ZOOM = 13;

/** `getTooltipMarkup(property)`. */
function PropertyTooltip({ property }: { property: PropertySummaryDto }) {
  return (
    <div
      className={classes.tooltipPicture}
      style={property.thumbnail ? { backgroundImage: `url(${property.thumbnail})` } : undefined}
    >
      <div className={classes.lowerThird}>
        <h1>{property.name}</h1>
        <p>
          Beds: {property.beds} - Baths: {property.baths}
        </p>
      </div>
    </div>
  );
}

/**
 * Port of `c/propertyListMap`: Leaflet map of the properties matching the current filters
 * (first page of GET /properties, like the LWC's `getPagedPropertyList` wire); clicking a marker
 * publishes `PropertySelected`.
 */
export function PropertyListMap({ height = 520 }: { height?: number | string }) {
  const { filters } = usePropertyFilters();
  const { selectProperty } = useSelectedProperty();
  const { data, error } = useQuery(propertiesQuery(filters));

  useEffect(() => {
    if (data) {
      rememberProperties(data.records);
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      notifications.show({
        title: 'Error loading properties',
        message: reduceErrors(error).join(', '),
        color: 'red',
      });
    }
  }, [error]);

  const markers = useMemo<MapMarker[]>(
    () =>
      (data?.records ?? [])
        .filter((property) => property.latitude !== null && property.longitude !== null)
        .map((property) => ({
          id: property.id,
          position: [property.latitude as number, property.longitude as number],
          tooltip: <PropertyTooltip property={property} />,
        })),
    [data],
  );

  return (
    <Paper
      withBorder
      p={0}
      data-testid="property-list-map"
      data-property-count={data?.records.length ?? 0}
    >
      <MapView
        center={LIST_MAP_CENTER}
        zoom={LIST_MAP_ZOOM}
        markers={markers}
        height={height}
        onMarkerClick={selectProperty}
        data-testid="property-list-map-view"
      />
    </Paper>
  );
}
