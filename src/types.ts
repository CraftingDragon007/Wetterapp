export type AppPhase =
  | 'loading-preferences'
  | 'checking-location'
  | 'requesting-location'
  | 'permission-blocked'
  | 'loading-data'
  | 'ready'
  | 'error';

export type PageName = 'outside' | 'weather' | 'roads';
export type RoadTone = 'clear' | 'moderate' | 'busy';
export type OutsideTone = 'good' | 'watch' | 'bad';
export type Scheme = 'light' | 'dark';
export type ThemeMode = 'system' | 'light' | 'dark';
export type DataSourceKind = 'live' | 'fixed';

export type WeatherData = {
  apparentTemperature: number | null;
  humidity: number | null;
  latitude: number;
  longitude: number;
  observedAt: string;
  temperature: number;
  temperatureUnit: string;
  timezone: string;
  weatherCode: number | null;
  windSpeed: number | null;
  windSpeedUnit: string;
};

export type RoadData = {
  checkedAt: string;
  constructionCount: number;
  latitude: number;
  longitude: number;
  majorRoadCount: number;
  restrictionCount: number;
  roadCount: number;
  score: number;
  signalCount: number;
  status: string;
  summary: string;
  tone: RoadTone;
};

export type OutsideData = {
  aqi: number | null;
  pm25: number | null;
  pollen: number | null;
  status: string;
  summary: string;
  tone: OutsideTone;
  uvIndex: number | null;
};

export type LocationSource = {
  kind: DataSourceKind;
  label: string;
  latitude: number;
  longitude: number;
};

export type StoredPreferences = {
  fixedLocationEnabled?: boolean;
  fixedLocationText?: string;
  themeMode?: ThemeMode;
};

export type SourceConfig = {
  fixedLocationEnabled: boolean;
  fixedLocationText: string;
};

export type OpenMeteoResponse = {
  current?: {
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    temperature_2m?: number;
    time?: string;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  current_units?: {
    temperature_2m?: string;
    wind_speed_10m?: string;
  };
  timezone?: string;
};

export type OpenMeteoGeocodingResponse = {
  results?: Array<{
    admin1?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    name?: string;
  }>;
};

export type ReverseGeocodingResponse = {
  address?: {
    county?: string;
    city?: string;
    country_code?: string;
    hamlet?: string;
    municipality?: string;
    state?: string;
    suburb?: string;
    town?: string;
    village?: string;
  };
};

export type AirQualityResponse = {
  current?: {
    alder_pollen?: number;
    birch_pollen?: number;
    grass_pollen?: number;
    mugwort_pollen?: number;
    olive_pollen?: number;
    pm2_5?: number;
    ragweed_pollen?: number;
    us_aqi?: number;
    uv_index?: number;
  };
};

export type OverpassElement = {
  id: number;
  tags?: Record<string, string>;
  type: 'node' | 'way' | 'relation';
};

export type OverpassResponse = {
  elements?: OverpassElement[];
};

export type Theme = {
  accent: string;
  background: string;
  border: string;
  danger: string;
  muted: string;
  onAccent: string;
  positive: string;
  surface: string;
  text: string;
  warning: string;
};
