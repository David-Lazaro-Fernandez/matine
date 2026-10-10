'use client';

// Mapa de cines sobre MapLibre: un círculo por cine, con su radio y color ya calculados, y su ficha al pasar el cursor.
// MapLibre lee `window`, así que se importa dentro del efecto y nunca corre en el prerender.
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource, Map as MapLibre } from 'maplibre-gl';
import { tokens } from '@fluentui/react-components';
import { SkeletonBlock } from '@/components/common';
import { BASEMAP_STYLE, GRAY, INK, PAPER } from '@/lib/labels.generated';

export type MapPoint = {
  siteId: string;
  lat: number;
  lng: number;
  radius: number;
  color: string;
  opacity: number;
  tip: string;
  // Borde propio, como el punto de partida del Recomendador. Sin él, papel de 1 px.
  stroke?: string;
  strokeWidth?: number;
};

// Círculo de `km` alrededor de un punto, dibujado como línea.
export type Ring = { lat: number; lng: number; km: number };

const HEIGHT = 560;
const KM_PER_DEGREE = 111.32;
const RING_STEPS = 64;

function ringLine(ring: Ring | null | undefined) {
  const coordinates = ring ? Array.from({ length: RING_STEPS + 1 }, (_, i) => {
    const angle = (2 * Math.PI * i) / RING_STEPS;
    const dLat = (ring.km / KM_PER_DEGREE) * Math.sin(angle);
    const dLng = (ring.km / (KM_PER_DEGREE * Math.cos((ring.lat * Math.PI) / 180))) * Math.cos(angle);
    return [ring.lng + dLng, ring.lat + dLat];
  }) : [];
  return {
    type: 'FeatureCollection' as const,
    features: coordinates.length
      ? [{ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates }, properties: {} }]
      : [],
  };
}

function collection(points: MapPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map(({ lat, lng, ...properties }) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      properties,
    })),
  };
}

export function CinemaMap({ points, center, zoom, onPick, onMapClick, ring, height = HEIGHT }: {
  points: MapPoint[];
  center: [number, number];
  zoom: number;
  onPick?: (siteId: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  ring?: Ring | null;
  height?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const mapClick = useRef(onMapClick);
  mapClick.current = onMapClick;
  const [map, setMap] = useState<MapLibre | null>(null);

  useEffect(() => {
    let created: MapLibre | undefined;
    let cancelled = false;
    import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled || !box.current) return;
      const m = new maplibregl.Map({ container: box.current, style: BASEMAP_STYLE, center, zoom });
      created = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      m.on('load', () => {
        m.addSource('anillo', { type: 'geojson', data: ringLine(null) });
        m.addLayer({ id: 'anillo', type: 'line', source: 'anillo', paint: { 'line-color': GRAY, 'line-width': 1 } });
        m.addSource('cines', { type: 'geojson', data: collection([]) });
        m.addLayer({
          id: 'cines',
          type: 'circle',
          source: 'cines',
          paint: {
            'circle-radius': ['get', 'radius'],
            'circle-color': ['get', 'color'],
            'circle-opacity': ['get', 'opacity'],
            'circle-stroke-color': ['coalesce', ['get', 'stroke'], PAPER],
            'circle-stroke-width': ['coalesce', ['get', 'strokeWidth'], 1],
          },
        });
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, maxWidth: 'none' });
        const tip = document.createElement('div');
        Object.assign(tip.style, { whiteSpace: 'pre', lineHeight: '1.45', fontSize: '12px', color: INK });
        m.on('mousemove', 'cines', (e) => {
          const f = e.features?.[0];
          if (!f) return;
          m.getCanvas().style.cursor = 'pointer';
          tip.textContent = String(f.properties.tip);
          popup.setLngLat(e.lngLat).setDOMContent(tip).addTo(m);
        });
        m.on('mouseleave', 'cines', () => {
          m.getCanvas().style.cursor = '';
          popup.remove();
        });
        m.on('click', 'cines', (e) => {
          const f = e.features?.[0];
          if (f) pick.current?.(String(f.properties.siteId));
        });
        m.on('click', (e) => mapClick.current?.(e.lngLat.lat, e.lngLat.lng));
        setMap(m);
      });
    });
    return () => {
      cancelled = true;
      created?.remove();
    };
    // El mapa se crea una vez; los efectos de abajo siguen los datos y la vista.
  }, []);

  useEffect(() => {
    (map?.getSource('cines') as GeoJSONSource | undefined)?.setData(collection(points));
  }, [map, points]);

  useEffect(() => {
    (map?.getSource('anillo') as GeoJSONSource | undefined)?.setData(ringLine(ring));
  }, [map, ring?.lat, ring?.lng, ring?.km]);

  const [lng, lat] = center;
  useEffect(() => {
    map?.jumpTo({ center: [lng, lat], zoom });
  }, [map, lng, lat, zoom]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={box} style={{ height, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium }} />
      {!map && <div style={{ position: 'absolute', inset: 0 }}><SkeletonBlock height={height} /></div>}
    </div>
  );
}
