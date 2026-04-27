import type { PageName } from './types';

export const PAGES: PageName[] = ['outside', 'weather', 'roads'];

export const PAGE_INDEX: Record<PageName, number> = {
  outside: 0,
  weather: 1,
  roads: 2,
};

export const LOCATION_RETRY_MS = 2500;
export const DATA_SYNC_MS = 15000;
export const ROAD_RADIUS_METERS = 1800;
export const DEFAULT_FIXED_LOCATION_TEXT = 'Zürich, Schweiz';

export const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const AIR_QUALITY_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality';
export const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
export const REVERSE_GEOCODING_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

export const PREFERENCES_KEY = 'live-data-view.preferences.v1';
export const MAJOR_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary']);
