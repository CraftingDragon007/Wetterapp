import * as Location from 'expo-location';

import {
  AIR_QUALITY_ENDPOINT,
  GEOCODING_ENDPOINT,
  MAJOR_ROADS,
  OVERPASS_ENDPOINT,
  REVERSE_GEOCODING_ENDPOINT,
  ROAD_RADIUS_METERS,
  WEATHER_ENDPOINT,
} from '../constants';
import type {
  AirQualityResponse,
  OpenMeteoGeocodingResponse,
  OpenMeteoResponse,
  OutsideData,
  OverpassResponse,
  ReverseGeocodingResponse,
  RoadData,
  WeatherData,
} from '../types';

function getWeatherUrl(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
    forecast_days: '1',
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: 'auto',
  });

  return `${WEATHER_ENDPOINT}?${params.toString()}`;
}

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherData> {
  const response = await fetch(getWeatherUrl(latitude, longitude));

  if (!response.ok) {
    throw new Error(`Wetterdienst antwortet mit Status ${response.status}.`);
  }

  const payload = (await response.json()) as OpenMeteoResponse;
  const current = payload.current;
  const temperature = current?.temperature_2m;

  if (typeof temperature !== 'number') {
    throw new Error('Der Wetterdienst hat keine Temperatur geliefert.');
  }

  return {
    apparentTemperature:
      typeof current?.apparent_temperature === 'number' ? current.apparent_temperature : null,
    humidity:
      typeof current?.relative_humidity_2m === 'number' ? current.relative_humidity_2m : null,
    latitude,
    longitude,
    observedAt: current?.time ?? new Date().toISOString(),
    temperature,
    temperatureUnit: payload.current_units?.temperature_2m ?? '°C',
    timezone: payload.timezone ?? 'Ortszeit',
    weatherCode: typeof current?.weather_code === 'number' ? current.weather_code : null,
    windSpeed: typeof current?.wind_speed_10m === 'number' ? current.wind_speed_10m : null,
    windSpeedUnit: payload.current_units?.wind_speed_10m ?? 'km/h',
  };
}

export async function geocodeFixedLocation(query: string) {
  try {
    const results = await Location.geocodeAsync(query);
    const match = results.find(
      (result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude),
    );

    if (match) {
      const resolvedLabel = await getLiveLocationLabel(match.latitude, match.longitude);

      return {
        label: resolvedLabel ?? query,
        latitude: match.latitude,
        longitude: match.longitude,
      };
    }
  } catch {
    // Some Android devices do not provide a native geocoder. Fall back to web lookup.
  }

  const params = new URLSearchParams({
    count: '1',
    language: 'de',
    name: query,
  });
  const response = await fetch(`${GEOCODING_ENDPOINT}?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Der feste Ort konnte nicht aufgelöst werden.');
  }

  const payload = (await response.json()) as OpenMeteoGeocodingResponse;
  const match = payload.results?.find(
    (result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude),
  );

  if (!match || typeof match.latitude !== 'number' || typeof match.longitude !== 'number') {
    throw new Error('Der feste Ort wurde nicht gefunden.');
  }

  const parts = [match.name, match.admin1, match.country].filter(
    (value, index, values): value is string =>
      typeof value === 'string' && value.length > 0 && values.indexOf(value) === index,
  );

  return {
    label: parts.length > 0 ? parts.join(', ') : query,
    latitude: match.latitude,
    longitude: match.longitude,
  };
}

export async function getLiveLocationLabel(latitude: number, longitude: number) {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const match = results.find((result) => {
      const place =
        result.city ??
        result.district ??
        result.name ??
        result.street ??
        result.subregion ??
        result.region;
      return typeof place === 'string' && place.length > 0;
    });

    if (match) {
      const place =
        match.city ?? match.district ?? match.name ?? match.street ?? match.subregion ?? match.region;
      const countryCode =
        typeof match.isoCountryCode === 'string' ? match.isoCountryCode.toUpperCase() : null;

      if (place) {
        return countryCode ? `${place}, ${countryCode}` : place;
      }
    }
  } catch {
    // Some Android devices do not provide a native reverse geocoder. Fall back to web lookup.
  }

  const params = new URLSearchParams({
    'accept-language': 'de',
    format: 'jsonv2',
    lat: String(latitude),
    lon: String(longitude),
    zoom: '10',
  });
  const response = await fetch(`${REVERSE_GEOCODING_ENDPOINT}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as ReverseGeocodingResponse;
  const place =
    payload.address?.city ??
    payload.address?.town ??
    payload.address?.village ??
    payload.address?.hamlet ??
    payload.address?.suburb ??
    payload.address?.municipality ??
    payload.address?.county ??
    payload.address?.state;
  const countryCode = payload.address?.country_code?.toUpperCase();

  if (typeof place === 'string' && place.length > 0) {
    return typeof countryCode === 'string' && countryCode.length > 0
      ? `${place}, ${countryCode}`
      : place;
  }

  return null;
}

function getAirQualityUrl(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    current:
      'us_aqi,pm2_5,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
    forecast_days: '1',
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: 'auto',
  });

  return `${AIR_QUALITY_ENDPOINT}?${params.toString()}`;
}

function getOutsideStatus(aqi: number | null, uvIndex: number | null, pollen: number | null) {
  const airIsBad = aqi !== null && aqi > 100;
  const uvIsBad = uvIndex !== null && uvIndex >= 8;
  const pollenIsBad = pollen !== null && pollen > 50;

  if (airIsBad || uvIsBad || pollenIsBad) {
    return {
      status: 'Lieber kurz warten',
      summary: 'Eine Bedingung draussen ist gerade ungünstig.',
      tone: 'bad' as const,
    };
  }

  const airNeedsCare = aqi !== null && aqi > 50;
  const uvNeedsCare = uvIndex !== null && uvIndex > 5;
  const pollenNeedsCare = pollen !== null && pollen > 10;

  if (airNeedsCare || uvNeedsCare || pollenNeedsCare) {
    return {
      status: 'Gut mit Einschränkung',
      summary: 'Draussen passt es, aber ein Wert braucht Aufmerksamkeit.',
      tone: 'watch' as const,
    };
  }

  return {
    status: 'Gut draussen',
    summary: 'Luft, UV und Pollen wirken unauffällig.',
    tone: 'good' as const,
  };
}

function getMaxPollen(current: AirQualityResponse['current']) {
  const values = [
    current?.alder_pollen,
    current?.birch_pollen,
    current?.grass_pollen,
    current?.mugwort_pollen,
    current?.olive_pollen,
    current?.ragweed_pollen,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return values.length > 0 ? Math.max(...values) : null;
}

export async function fetchOutsideData(latitude: number, longitude: number): Promise<OutsideData> {
  const response = await fetch(getAirQualityUrl(latitude, longitude));

  if (!response.ok) {
    throw new Error(`Aussendaten antworten mit Status ${response.status}.`);
  }

  const payload = (await response.json()) as AirQualityResponse;
  const current = payload.current;
  const aqi = typeof current?.us_aqi === 'number' ? current.us_aqi : null;
  const pm25 = typeof current?.pm2_5 === 'number' ? current.pm2_5 : null;
  const uvIndex = typeof current?.uv_index === 'number' ? current.uv_index : null;
  const pollen = getMaxPollen(current);
  const status = getOutsideStatus(aqi, uvIndex, pollen);

  return {
    aqi,
    pm25,
    pollen,
    status: status.status,
    summary: status.summary,
    tone: status.tone,
    uvIndex,
  };
}

function getRoadActivityQuery(latitude: number, longitude: number) {
  return `
    [out:json][timeout:12];
    (
      way(around:${ROAD_RADIUS_METERS},${latitude},${longitude})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"];
      way(around:${ROAD_RADIUS_METERS},${latitude},${longitude})["highway"="construction"];
      way(around:${ROAD_RADIUS_METERS},${latitude},${longitude})["construction"];
      way(around:${ROAD_RADIUS_METERS},${latitude},${longitude})["access"~"^(no|private|destination)$"];
      way(around:${ROAD_RADIUS_METERS},${latitude},${longitude})["smoothness"~"^(bad|very_bad|horrible|very_horrible|impassable)$"];
      node(around:${ROAD_RADIUS_METERS},${latitude},${longitude})["highway"~"^(traffic_signals|stop)$"];
    );
    out tags center 90;
  `;
}

function getRoadStatus(
  constructionCount: number,
  restrictionCount: number,
  majorRoadCount: number,
  signalCount: number,
  roadCount: number,
) {
  const majorRoadPressure = Math.max(majorRoadCount - 2, 0);
  const signalPressure = Math.max(signalCount - 6, 0);
  const roadDensityPressure = Math.max(Math.min(roadCount, 80) - 18, 0);
  const score =
    constructionCount * 3.4 +
    restrictionCount * 2.2 +
    majorRoadPressure * 0.32 +
    signalPressure * 0.06 +
    roadDensityPressure * 0.018;

  if (constructionCount >= 3 || restrictionCount >= 4 || score >= 8.5) {
    return {
      score,
      status: 'Viel los',
      summary: 'Plane etwas mehr Zeit ein. In der Nähe gibt es viele Strassensignale.',
      tone: 'busy' as const,
    };
  }

  if (constructionCount > 0 || restrictionCount > 0 || score >= 2.8) {
    return {
      score,
      status: 'Ganz normal',
      summary: 'Rundherum ist etwas Bewegung, aber nichts wirkt auffällig.',
      tone: 'moderate' as const,
    };
  }

  return {
    score,
    status: 'Sehr ruhig',
    summary: 'Keine Baustellen, Sperren oder starken Strassensignale in der Nähe.',
    tone: 'clear' as const,
  };
}

export async function fetchRoadActivity(latitude: number, longitude: number): Promise<RoadData> {
  const body = new URLSearchParams({
    data: getRoadActivityQuery(latitude, longitude),
  }).toString();

  const response = await fetch(OVERPASS_ENDPOINT, {
    body,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'LiveWeatherJamChecker/1.0',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Strassendaten antworten mit Status ${response.status}.`);
  }

  const payload = (await response.json()) as OverpassResponse;
  const elements = Array.isArray(payload.elements) ? payload.elements : [];

  const roadElements = elements.filter((element) => {
    const highway = element.tags?.highway;
    return element.type === 'way' && typeof highway === 'string' && highway !== 'construction';
  });

  const constructionCount = elements.filter((element) => {
    const tags = element.tags ?? {};
    return tags.highway === 'construction' || typeof tags.construction === 'string';
  }).length;
  const restrictionCount = elements.filter((element) => {
    const access = element.tags?.access;
    return access === 'no' || access === 'private' || access === 'destination';
  }).length;
  const signalCount = elements.filter((element) => {
    const highway = element.tags?.highway;
    return element.type === 'node' && (highway === 'traffic_signals' || highway === 'stop');
  }).length;
  const majorRoadCount = roadElements.filter((element) => {
    const highway = element.tags?.highway;
    return typeof highway === 'string' && MAJOR_ROADS.has(highway);
  }).length;
  const status = getRoadStatus(
    constructionCount,
    restrictionCount,
    majorRoadCount,
    signalCount,
    roadElements.length,
  );

  return {
    checkedAt: new Date().toISOString(),
    constructionCount,
    latitude,
    longitude,
    majorRoadCount,
    restrictionCount,
    roadCount: roadElements.length,
    score: status.score,
    signalCount,
    status: status.status,
    summary: status.summary,
    tone: status.tone,
  };
}

export function createRoadUnavailableData(
  latitude: number,
  longitude: number,
  reason = 'Strassendaten wurden noch nicht geladen.',
): RoadData {
  return {
    checkedAt: new Date().toISOString(),
    constructionCount: 0,
    latitude,
    longitude,
    majorRoadCount: 0,
    restrictionCount: 0,
    roadCount: 0,
    score: 0,
    signalCount: 0,
    status: 'Strassendaten fehlen',
    summary: reason,
    tone: 'moderate',
  };
}

export function createOutsideUnavailableData(reason = 'Aussendaten wurden noch nicht geladen.'): OutsideData {
  return {
    aqi: null,
    pm25: null,
    pollen: null,
    status: 'Daten fehlen',
    summary: reason,
    tone: 'watch',
    uvIndex: null,
  };
}

export function getRoadFactors(roads: RoadData) {
  const roadworks =
    roads.constructionCount === 0
      ? 'Keine in der Nähe'
      : roads.constructionCount === 1
        ? '1 Baustelle in der Nähe'
        : `${roads.constructionCount} Baustellen in der Nähe`;
  const controls =
    roads.signalCount === 0
      ? 'Ruhige Kreuzungen'
      : roads.signalCount < 8
        ? 'Einige geregelte Kreuzungen'
        : 'Viele geregelte Kreuzungen';
  const mainRoads =
    roads.majorRoadCount === 0
      ? 'Abseits grosser Strassen'
      : roads.majorRoadCount < 4
        ? 'Ein paar Hauptstrassen nah'
        : 'Hauptstrassen direkt nah';

  return [
    { label: 'Baustellen', value: roadworks },
    { label: 'Kreuzungen', value: controls },
    { label: 'Hauptstrassen', value: mainRoads },
  ];
}
