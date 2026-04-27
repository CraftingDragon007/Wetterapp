import * as Location from 'expo-location';

import {
  createOutsideUnavailableData,
  createRoadUnavailableData,
  fetchOutsideData,
  fetchRoadActivity,
  fetchWeather,
  geocodeFixedLocation,
  getLiveLocationLabel,
  getRoadFactors,
} from '../src/services/data';

jest.mock('expo-location', () => ({
  geocodeAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const mockedLocation = jest.mocked(Location);
const fetchMock = jest.fn();

function jsonResponse(payload: unknown, init: { ok?: boolean; status?: number } = {}) {
  return Promise.resolve({
    json: async () => payload,
    ok: init.ok ?? true,
    status: init.status ?? 200,
  }) as Promise<Response>;
}

describe('data service', () => {
  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    mockedLocation.geocodeAsync.mockReset();
    mockedLocation.reverseGeocodeAsync.mockReset();
  });

  it('maps weather API data into application weather data', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        current: {
          apparent_temperature: 17.5,
          relative_humidity_2m: 63,
          temperature_2m: 19.2,
          time: '2026-04-24T12:00',
          weather_code: 3,
          wind_speed_10m: 22.8,
        },
        current_units: {
          temperature_2m: '°C',
          wind_speed_10m: 'km/h',
        },
        timezone: 'Europe/Zurich',
      }),
    );

    await expect(fetchWeather(47.3769, 8.5417)).resolves.toEqual({
      apparentTemperature: 17.5,
      humidity: 63,
      latitude: 47.3769,
      longitude: 8.5417,
      observedAt: '2026-04-24T12:00',
      temperature: 19.2,
      temperatureUnit: '°C',
      timezone: 'Europe/Zurich',
      weatherCode: 3,
      windSpeed: 22.8,
      windSpeedUnit: 'km/h',
    });
  });

  it('throws when weather data is incomplete', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ current: {} }));

    await expect(fetchWeather(47, 8)).rejects.toThrow(
      'Der Wetterdienst hat keine Temperatur geliefert.',
    );
  });

  it('prefers native geocoding and reverse geocoding when available', async () => {
    mockedLocation.geocodeAsync.mockResolvedValueOnce([
      { latitude: 47.3769, longitude: 8.5417 },
    ] as never);
    mockedLocation.reverseGeocodeAsync.mockResolvedValueOnce([
      { city: 'Zürich', isoCountryCode: 'ch' },
    ] as never);

    await expect(geocodeFixedLocation('Zürich')).resolves.toEqual({
      label: 'Zürich, CH',
      latitude: 47.3769,
      longitude: 8.5417,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to web geocoding when native geocoding is unavailable', async () => {
    mockedLocation.geocodeAsync.mockRejectedValueOnce(new Error('native geocoder unavailable'));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            admin1: 'Bern',
            country: 'Schweiz',
            latitude: 46.948,
            longitude: 7.4474,
            name: 'Bern',
          },
        ],
      }),
    );

    await expect(geocodeFixedLocation('Bern')).resolves.toEqual({
      label: 'Bern, Schweiz',
      latitude: 46.948,
      longitude: 7.4474,
    });
  });

  it('falls back to web reverse geocoding when the device has no reverse geocoder', async () => {
    mockedLocation.reverseGeocodeAsync.mockRejectedValueOnce(new Error('native unavailable'));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        address: {
          country_code: 'ch',
          town: 'Winterthur',
        },
      }),
    );

    await expect(getLiveLocationLabel(47.5, 8.7)).resolves.toBe('Winterthur, CH');
  });

  it.each([
    {
      current: { grass_pollen: 2, pm2_5: 5, us_aqi: 20, uv_index: 1 },
      expected: { status: 'Gut draussen', tone: 'good' },
    },
    {
      current: { grass_pollen: 15, pm2_5: 8, us_aqi: 70, uv_index: 4 },
      expected: { status: 'Gut mit Einschränkung', tone: 'watch' },
    },
    {
      current: { grass_pollen: 60, pm2_5: 24, us_aqi: 130, uv_index: 9 },
      expected: { status: 'Lieber kurz warten', tone: 'bad' },
    },
  ])('classifies outside conditions correctly for %#', async ({ current, expected }) => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ current }));

    const result = await fetchOutsideData(47.3769, 8.5417);

    expect(result.status).toBe(expected.status);
    expect(result.tone).toBe(expected.tone);
  });

  it('derives road status and factors from overpass data', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        elements: [
          { id: 1, tags: { highway: 'construction' }, type: 'way' },
          { id: 2, tags: { construction: 'road' }, type: 'way' },
          { id: 3, tags: { access: 'no', highway: 'residential' }, type: 'way' },
          { id: 4, tags: { access: 'private', highway: 'secondary' }, type: 'way' },
          { id: 5, tags: { highway: 'motorway' }, type: 'way' },
          { id: 6, tags: { highway: 'primary' }, type: 'way' },
          { id: 7, tags: { highway: 'secondary' }, type: 'way' },
          { id: 8, tags: { highway: 'traffic_signals' }, type: 'node' },
          { id: 9, tags: { highway: 'traffic_signals' }, type: 'node' },
          { id: 10, tags: { highway: 'stop' }, type: 'node' },
        ],
      }),
    );

    const result = await fetchRoadActivity(47.3769, 8.5417);

    expect(result.status).toBe('Viel los');
    expect(result.tone).toBe('busy');
    expect(result.constructionCount).toBe(2);
    expect(result.restrictionCount).toBe(2);
    expect(result.majorRoadCount).toBe(4);
    expect(result.signalCount).toBe(3);
    expect(getRoadFactors(result)).toEqual([
      { label: 'Baustellen', value: '2 Baustellen in der Nähe' },
      { label: 'Kreuzungen', value: 'Einige geregelte Kreuzungen' },
      { label: 'Hauptstrassen', value: 'Hauptstrassen direkt nah' },
    ]);
  });

  it('creates stable fallback payloads when optional data sources fail', () => {
    expect(createRoadUnavailableData(47.3, 8.5, 'Keine Antwort')).toMatchObject({
      latitude: 47.3,
      longitude: 8.5,
      status: 'Strassendaten fehlen',
      summary: 'Keine Antwort',
      tone: 'moderate',
    });

    expect(createOutsideUnavailableData('API Timeout')).toEqual({
      aqi: null,
      pm25: null,
      pollen: null,
      status: 'Daten fehlen',
      summary: 'API Timeout',
      tone: 'watch',
      uvIndex: null,
    });
  });
});
