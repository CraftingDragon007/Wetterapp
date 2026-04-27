import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';

import App from '../App';
import { useLiveDataSync } from '../src/hooks/useLiveDataSync';

jest.mock('../src/hooks/useLiveDataSync', () => ({
  useLiveDataSync: jest.fn(),
}));

const mockedUseLiveDataSync = jest.mocked(useLiveDataSync);

const sampleWeather = {
  apparentTemperature: 18,
  humidity: 61,
  latitude: 47.3769,
  longitude: 8.5417,
  observedAt: '2026-04-24T12:00:00.000Z',
  temperature: 20,
  temperatureUnit: '°C',
  timezone: 'Europe/Zurich',
  weatherCode: 0,
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

function createHookState(overrides: Partial<ReturnType<typeof useLiveDataSync>> = {}) {
  return {
    applyLocationSettings: jest.fn(),
    draftFixedLocationEnabled: false,
    draftFixedLocationText: '',
    errorMessage: null,
    locationSource: {
      kind: 'live' as const,
      label: 'Aktueller Standort: Zürich, CH',
      latitude: 47.3769,
      longitude: 8.5417,
    },
    openSystemSettings: jest.fn(),
    outside: sampleOutside,
    phase: 'ready' as const,
    preferencesLoaded: true,
    roads: sampleRoads,
    setDraftFixedLocationEnabled: jest.fn(),
    setDraftFixedLocationText: jest.fn(),
    setSettingsMessage: jest.fn(),
    settingsMessage: null,
    syncData: jest.fn(),
    weather: sampleWeather,
    ...overrides,
  };
}

function renderSnapshot(overrides: Partial<ReturnType<typeof useLiveDataSync>> = {}) {
  mockedUseLiveDataSync.mockReturnValue(createHookState(overrides));

  return render(<App />).toJSON();
}

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(Animated, 'timing')
      .mockImplementation(((() => ({
        reset: jest.fn(),
        start: (callback?: (result: { finished: boolean }) => void) => {
          callback?.({ finished: true });
        },
        stop: jest.fn(),
      })) as unknown) as typeof Animated.timing);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a loading screen while data is being fetched', () => {
    mockedUseLiveDataSync.mockReturnValue(
      createHookState({
        outside: null,
        phase: 'loading-data',
        roads: null,
        weather: null,
      }),
    );

    render(<App />);

    expect(screen.getByText('Daten werden geladen')).toBeTruthy();
  });

  it('matches snapshot for the loading state', () => {
    expect(
      renderSnapshot({
        outside: null,
        phase: 'loading-data',
        roads: null,
        weather: null,
      }),
    ).toMatchSnapshot();
  });

  it('renders the error state and retries the initial sync', () => {
    const syncData = jest.fn();
    mockedUseLiveDataSync.mockReturnValue(
      createHookState({
        errorMessage: 'Netzwerkfehler',
        outside: null,
        phase: 'error',
        roads: null,
        syncData,
        weather: null,
      }),
    );

    render(<App />);

    expect(screen.getByText('Daten nicht verfügbar')).toBeTruthy();
    fireEvent.press(screen.getByTestId('retry-sync-button'));
    expect(syncData).toHaveBeenCalledWith('initial');
  });

  it('renders the permission-blocked state and opens system settings', () => {
    const openSystemSettings = jest.fn();
    mockedUseLiveDataSync.mockReturnValue(
      createHookState({
        openSystemSettings,
        phase: 'permission-blocked',
      }),
    );

    render(<App />);

    fireEvent.press(screen.getByTestId('permission-open-system-settings-button'));
    expect(openSystemSettings).toHaveBeenCalled();
  });

  it('renders ready data and opens the settings drawer from the weather page', async () => {
    mockedUseLiveDataSync.mockReturnValue(createHookState());

    render(<App />);

    expect(screen.getByText('Wetter')).toBeTruthy();
    expect(screen.getByText('Strassen')).toBeTruthy();
    expect(screen.getByText('Draussen')).toBeTruthy();

    fireEvent.press(screen.getByTestId('weather-settings-open-button'));

    await waitFor(() => expect(screen.getByTestId('settings-menu')).toBeTruthy());
    expect(screen.getByText('Einstellungen')).toBeTruthy();
    expect(screen.getByText('Ort übernehmen')).toBeTruthy();

    fireEvent.press(screen.getByTestId('close-settings-button'));

    await waitFor(() => expect(screen.queryByTestId('settings-menu')).toBeNull());
  });
});
