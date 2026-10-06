import { Box } from '@mantine/core';
import type { LatLngExpression } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_CENTER } from '@/components/map-defaults';
import '@/components/leaflet-icons';

export interface MapMarker {
  id: string;
  position: LatLngExpression;
  label?: string;
}

/**
 * Leaflet map (same Leaflet 1.9.4 the Salesforce app ships as the `leafletjs` static resource),
 * used by the propertyMap / propertyListMap / propertyLocation replacements.
 */
export function MapView({
  center = DEFAULT_CENTER,
  zoom = 12,
  markers = [],
  height = 360,
}: {
  center?: LatLngExpression;
  zoom?: number;
  markers?: MapMarker[];
  height?: number | string;
}) {
  return (
    <Box h={height} style={{ borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((marker) => (
          <Marker key={marker.id} position={marker.position}>
            {marker.label && <Popup>{marker.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </Box>
  );
}
