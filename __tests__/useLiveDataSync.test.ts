import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHookAsync, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { useLiveDataSync } from '../src/hooks/useLiveDataSync';
import * as dataService from '../src/services/data';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('expo-location', () => ({
  Accuracy: {
    Balanced: 3,
  },
  PermissionStatus: {
    DENIED: 'denied',
    GRANTED: 'granted',
  },
  getCurrentPositionAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

jest.mock('../src/services/data', () => {
  const actual = jest.requireActual('../src/services/data');

  return {
    ...actual,
    fetchOutsideData: jest.fn(),
    fetchRoadActivity: jest.fn(),
    fetchWeather: jest.fn(),
    geocodeFixedLocation: jest.fn(),
    getLiveLocationLabel: jest.fn(),
  };
});

const mockedAsyncStorage = jest.mocked(AsyncStorage);
const mockedLocation = jest.mocked(Location);
const mockedDataService = jest.mocked(dataService);
let appStateChangeHandler: ((state: AppStateStatus) => void) | null = null;

const sampleWeather = {
  apparentTemperature: 18,
  humidity: 61,
  latitude: 47.3769,
  longitude: 8.5417,
  observedAt: '2026-04-24T12:00:00.000Z',
  temperature: 20,
  temperatureUnit: '°C',
  timezone: 'Europe/Zurich',
  weatherCode: 2,
  windSpeed: 13.4,
  windSpeedUnit: 'km/h',
};

const sampleRoads = {
  checkedAt: '2026-04-24T12:00:00.000Z',
  constructionCount: 1,
  latitude: 47.3769,
  longitude: 8.5417,
  majorRoadCount: 2,
  restrictionCount: 0,
  roadCount: 11,
  score: 3.1,
  signalCount: 4,
  status: 'Ganz normal',
  summary: 'Rundherum ist etwas Bewegung, aber nichts wirkt auffällig.',
  tone: 'moderate' as const,
};

const sampleOutside = {
  aqi: 41,
  pm25: 8.2,
  pollen: 4,
  status: 'Gut draussen',
  summary: 'Luft, UV und Pollen wirken unauffällig.',
  tone: 'good' as const,
  uvIndex: 2,
};

describe('useLiveDataSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedAsyncStorage.setItem.mockResolvedValue();
    mockedLocation.hasServicesEnabledAsync.mockResolvedValue(true as never);
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      canAskAgain: true,
      status: Location.PermissionStatus.GRANTED,
    } as never);
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      canAskAgain: true,
      status: Location.PermissionStatus.GRANTED,
    } as never);
    mockedLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 47.3769,
        longitude: 8.5417,
      },
    } as never);
    mockedDataService.fetchWeather.mockResolvedValue(sampleWeather);
    mockedDataService.fetchRoadActivity.mockResolvedValue(sampleRoads);
    mockedDataService.fetchOutsideData.mockResolvedValue(sampleOutside);
    mockedDataService.getLiveLocationLabel.mockResolvedValue('Zürich, CH');
    mockedDataService.geocodeFixedLocation.mockResolvedValue({
      label: 'Bern, Schweiz',
      latitude: 46.948,
      longitude: 7.4474,
    });
    appStateChangeHandler = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
      appStateChangeHandler = handler;

      return {
        remove: jest.fn(),
      } as never;
    });
  });

  it('loads stored preferences and performs an initial fixed-location sync', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({
        fixedLocationEnabled: true,
        fixedLocationText: 'Bern',
        themeMode: 'dark',
      }),
    );
    const onThemeModeLoaded = jest.fn();

    const { result, unmountAsync } = await renderHookAsync(
      () =>
        useLiveDataSync({
          onThemeModeLoaded,
          themeMode: 'system',
        }),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.phase).toBe('ready'));

    expect(onThemeModeLoaded).toHaveBeenCalledWith('dark');
    expect(result.current.preferencesLoaded).toBe(true);
    expect(result.current.locationSource).toEqual({
      kind: 'fixed',
      label: 'Bern, Schweiz',
      latitude: 46.948,
      longitude: 7.4474,
    });
    expect(mockedDataService.fetchWeather).toHaveBeenCalledWith(46.948, 7.4474);
    expect(result.current.weather).toEqual(sampleWeather);

    await unmountAsync();
  });

  it('keeps the app ready and inserts fallback data when non-critical requests fail', async () => {
    mockedDataService.fetchRoadActivity.mockRejectedValueOnce(new Error('Overpass Timeout'));
    mockedDataService.fetchOutsideData.mockRejectedValueOnce(new Error('Air API Timeout'));

    const { result, unmountAsync } = await renderHookAsync(
      () =>
        useLiveDataSync({
          onThemeModeLoaded: jest.fn(),
          themeMode: 'light',
        }),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.phase).toBe('ready'));

    expect(result.current.locationSource?.kind).toBe('live');
    expect(result.current.locationSource?.label).toBe('Aktueller Standort: Zürich, CH');
    expect(result.current.roads).toMatchObject({
      status: 'Strassendaten fehlen',
      summary: 'Overpass Timeout',
      tone: 'moderate',
    });
    expect(result.current.outside).toEqual({
      aqi: null,
      pm25: null,
      pollen: null,
      status: 'Daten fehlen',
      summary: 'Air API Timeout',
      tone: 'watch',
      uvIndex: null,
    });

    await unmountAsync();
  });

  it('falls back to fixed-location data when location access is denied permanently', async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValueOnce({
      canAskAgain: true,
      status: Location.PermissionStatus.DENIED,
    } as never);
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      canAskAgain: false,
      status: Location.PermissionStatus.DENIED,
    } as never);

    const { result, unmountAsync } = await renderHookAsync(
      () =>
        useLiveDataSync({
          onThemeModeLoaded: jest.fn(),
          themeMode: 'system',
        }),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.phase).toBe('ready'));

    expect(result.current.locationSource).toEqual({
      kind: 'fixed',
      label: 'Zürich, Schweiz',
      latitude: 47.3769,
      longitude: 8.5417,
    });
    expect(mockedDataService.geocodeFixedLocation).not.toHaveBeenCalled();
    expect(mockedDataService.fetchWeather).toHaveBeenCalledWith(47.3769, 8.5417);
    expect(result.current.weather).toEqual(sampleWeather);
    expect(result.current.errorMessage).toBeNull();

    await unmountAsync();
  });

  it('does not restart the initial sync while the permission prompt is pending', async () => {
    let resolvePermission: (
      value: Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>,
    ) => void = () => undefined;

    mockedLocation.getForegroundPermissionsAsync.mockResolvedValueOnce({
      canAskAgain: true,
      status: Location.PermissionStatus.DENIED,
    } as never);
    mockedLocation.requestForegroundPermissionsAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePermission = resolve;
      }) as never,
    );

    const { result, unmountAsync } = await renderHookAsync(
      () =>
        useLiveDataSync({
          onThemeModeLoaded: jest.fn(),
          themeMode: 'system',
        }),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.phase).toBe('requesting-location'));

    act(() => {
      appStateChangeHandler?.('active');
      appStateChangeHandler?.('active');
    });

    expect(mockedLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('requesting-location');

    await act(async () => {
      resolvePermission({
        canAskAgain: false,
        expires: 'never',
        granted: false,
        status: Location.PermissionStatus.DENIED,
      });
    });

    await waitFor(() => expect(result.current.phase).toBe('ready'));
    expect(result.current.locationSource).toEqual({
      kind: 'fixed',
      label: 'Zürich, Schweiz',
      latitude: 47.3769,
      longitude: 8.5417,
    });

    await unmountAsync();
  });

  it('shows an error instead of staying in loading when fixed geocoding gets stuck', async () => {
    jest.useFakeTimers();
    mockedAsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify({
        fixedLocationEnabled: true,
        fixedLocationText: 'Basel',
      }),
    );
    mockedDataService.geocodeFixedLocation.mockReturnValueOnce(new Promise(() => {}));

    const { result, unmountAsync } = await renderHookAsync(
      () =>
        useLiveDataSync({
          onThemeModeLoaded: jest.fn(),
          themeMode: 'system',
        }),
      { concurrentRoot: false },
    );

    await act(async () => {
      jest.advanceTimersByTime(12000);
    });

    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current.errorMessage).toBe('Der feste Ort konnte nicht rechtzeitig aufgelöst werden.');

    await unmountAsync();
    jest.useRealTimers();
  });

  it('applies changed location settings and updates the user message', async () => {
    const { result, unmountAsync } = await renderHookAsync(
      () =>
        useLiveDataSync({
          onThemeModeLoaded: jest.fn(),
          themeMode: 'system',
        }),
      { concurrentRoot: false },
    );

    await waitFor(() => expect(result.current.phase).toBe('ready'));

    act(() => {
      result.current.setDraftFixedLocationEnabled(true);
      result.current.setDraftFixedLocationText('Basel');
    });

    mockedDataService.geocodeFixedLocation.mockResolvedValueOnce({
      label: 'Basel, Schweiz',
      latitude: 47.5596,
      longitude: 7.5886,
    });

    act(() => {
      result.current.applyLocationSettings();
    });

    await waitFor(() => expect(result.current.settingsMessage).toBe('Fester Ort aktiv: Basel'));
    await waitFor(() => expect(result.current.locationSource?.kind).toBe('fixed'));

    expect(result.current.locationSource).toEqual({
      kind: 'fixed',
      label: 'Basel, Schweiz',
      latitude: 47.5596,
      longitude: 7.5886,
    });

    await unmountAsync();
  });
});
