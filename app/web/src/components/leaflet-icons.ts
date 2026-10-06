import L from 'leaflet';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Vite hashes asset URLs, so Leaflet's default icon path detection breaks; point it at the bundled files.
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });
