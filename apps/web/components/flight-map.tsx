'use client';

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { REGION_LABELS, type FlightRow } from '@/lib/types';

type FlightMapProps = {
  flights: FlightRow[];
  activeFlightId: string | null;
  loading: boolean;
  errorMessage: string | null;
  emptyMessage: string;
  onSelectFlight: (flightId: string) => void;
};

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;

const markerIcon = L.divIcon({
  className: 'flight-map-marker',
  html: '<span class="flight-map-marker__dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12]
});

export function FlightMap({
  flights,
  activeFlightId,
  loading,
  errorMessage,
  emptyMessage,
  onSelectFlight
}: FlightMapProps) {
  const mappableFlights = flights.filter(hasValidCoordinates);
  const activeFlight =
    mappableFlights.find((flight) => flight.id === activeFlightId) ?? mappableFlights[0] ?? null;

  if (loading) {
    return <MapStateBox message="Loading live flight positions from Supabase..." tone="neutral" />;
  }

  if (errorMessage) {
    return <MapStateBox message={errorMessage} tone="error" />;
  }

  if (mappableFlights.length === 0) {
    return <MapStateBox message={emptyMessage} tone="neutral" />;
  }

  const center: [number, number] =
    activeFlight && activeFlight.latitude !== null && activeFlight.longitude !== null
      ? [activeFlight.latitude, activeFlight.longitude]
      : DEFAULT_CENTER;

  return (
    <div className="h-[420px] overflow-hidden rounded-[1.5rem] border border-white/10">
      <MapContainer
        center={center}
        className="h-full w-full"
        scrollWheelZoom
        zoom={DEFAULT_ZOOM}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mappableFlights.map((flight) => (
          <Marker
            eventHandlers={{
              click: () => onSelectFlight(flight.id)
            }}
            icon={markerIcon}
            key={flight.id}
            position={[flight.latitude as number, flight.longitude as number]}
          >
            <Popup>
              <div className="space-y-2 text-sm text-slate-900">
                <p className="font-semibold">{flight.callsign ?? flight.icao24.toUpperCase()}</p>
                <MapPopupLine label="Origin" value={flight.origin_country ?? 'Unknown'} />
                <MapPopupLine label="Altitude" value={formatNumber(flight.baro_altitude, 'm')} />
                <MapPopupLine label="Velocity" value={formatNumber(flight.velocity, 'm/s')} />
                <MapPopupLine label="On ground" value={flight.on_ground ? 'Yes' : 'No'} />
                <MapPopupLine label="Region" value={REGION_LABELS[flight.region_key] ?? flight.region_key} />
                <MapPopupLine label="Observed" value={formatDateTime(flight.observed_at)} />
                <MapPopupLine label="Updated" value={formatDateTime(flight.updated_at)} />
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function MapPopupLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-medium">{label}:</span> {value}
    </p>
  );
}

function MapStateBox({ message, tone }: { message: string; tone: 'neutral' | 'error' }) {
  const styles =
    tone === 'error'
      ? 'border-rose-300/20 bg-rose-400/10 text-rose-100'
      : 'border-dashed border-white/10 bg-slate-950/40 text-slate-300';

  return (
    <div className={`flex h-[420px] items-center justify-center rounded-[1.5rem] border p-6 text-sm ${styles}`}>
      <p className="max-w-md text-center leading-6">{message}</p>
    </div>
  );
}

function hasValidCoordinates(flight: FlightRow) {
  return (
    typeof flight.latitude === 'number' &&
    Number.isFinite(flight.latitude) &&
    flight.latitude >= -90 &&
    flight.latitude <= 90 &&
    typeof flight.longitude === 'number' &&
    Number.isFinite(flight.longitude) &&
    flight.longitude >= -180 &&
    flight.longitude <= 180
  );
}

function formatNumber(value: number | null, suffix: string) {
  return value === null ? 'Unknown' : `${Math.round(value).toLocaleString()} ${suffix}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
