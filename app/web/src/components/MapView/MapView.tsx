import { Box } from '@mantine/core';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { useEffect, type ReactNode } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './leaflet-icons';
import { DEFAULT_CENTER } from './map-defaults';

export interface MapMarker {
  id: string;
  position: LatLngExpression;
  /** Popup content (opens on click). */
  label?: ReactNode;
  /** Tooltip content (shows on hover), like `marker.bindTooltip` in `propertyListMap`. */
  tooltip?: ReactNode;
}

function FitToMarkers({ bounds }: { bounds?: LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
    }
  }, [map, bounds]);
  return null;
}

function Recenter({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export function MapView({
  center = DEFAULT_CENTER,
  zoom = 12,
  markers = [],
  height = 360,
  fitToMarkers = false,
  onMarkerClick,
  'data-testid': testId = 'map-view',
}: {
  center?: LatLngExpression;
  zoom?: number;
  markers?: MapMarker[];
  height?: number | string;
  /** Zoom the map to show every marker whenever the markers change. */
  fitToMarkers?: boolean;
  onMarkerClick?: (markerId: string) => void;
  'data-testid'?: string;
}) {
  const bounds =
    fitToMarkers && markers.length > 0
      ? (markers.map((marker) => marker.position) as LatLngBoundsExpression)
      : undefined;

  return (
    <Box
      h={height}
      style={{ borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}
      data-testid={testId}
      data-marker-count={markers.length}
    >
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bounds ? <FitToMarkers bounds={bounds} /> : <Recenter center={center} zoom={zoom} />}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.position}
            eventHandlers={onMarkerClick ? { click: () => onMarkerClick(marker.id) } : undefined}
          >
            {marker.tooltip && <Tooltip offset={[12, 0]}>{marker.tooltip}</Tooltip>}
            {marker.label && <Popup>{marker.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </Box>
  );
}
