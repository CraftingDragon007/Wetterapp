import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { DATA_SYNC_MS, LOCATION_RETRY_MS, PREFERENCES_KEY } from '../constants';
import { getStoredBoolean, getStoredText, normalizeThemeMode } from '../formatters';
import {
  createOutsideUnavailableData,
  createRoadUnavailableData,
  fetchOutsideData,
  fetchRoadActivity,
  fetchWeather,
  geocodeFixedLocation,
  getLiveLocationLabel,
} from '../services/data';
import type {
  AppPhase,
  LocationSource,
  OutsideData,
  RoadData,
  SourceConfig,
  StoredPreferences,
  ThemeMode,
  WeatherData,
} from '../types';

type SyncMode = 'initial' | 'background';
const REQUEST_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }) as Promise<T>;
}

type UseLiveDataSyncParams = {
  onThemeModeLoaded: (value: ThemeMode) => void;
  themeMode: ThemeMode;
};

export function useLiveDataSync({ onThemeModeLoaded, themeMode }: UseLiveDataSyncParams) {
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [fixedLocationEnabled, setFixedLocationEnabled] = useState(false);
  const [fixedLocationText, setFixedLocationText] = useState('');
  const [draftFixedLocationEnabled, setDraftFixedLocationEnabled] = useState(false);
  const [draftFixedLocationText, setDraftFixedLocationText] = useState('');
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<AppPhase>('loading-preferences');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [roads, setRoads] = useState<RoadData | null>(null);
  const [outside, setOutside] = useState<OutsideData | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const hasTriggeredInitialSyncRef = useRef(false);

  const hasLoadedData = useMemo(
    () => weather !== null && roads !== null && outside !== null,
    [outside, roads, weather],
  );

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const savePreferences = useCallback(async (nextPreferences: StoredPreferences) => {
    try {
      await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(nextPreferences));
    } catch {
      setSettingsMessage('Einstellungen konnten nicht gespeichert werden.');
    }
  }, []);

  const resolveLocationSource = useCallback(
    async (config?: SourceConfig): Promise<LocationSource> => {
      const useFixed = config?.fixedLocationEnabled ?? fixedLocationEnabled;
      const fixedText = (config?.fixedLocationText ?? fixedLocationText).trim();

      if (useFixed && fixedText.length > 0) {
        const match = await geocodeFixedLocation(fixedText);

        return {
          kind: 'fixed',
          label: match.label,
          latitude: match.latitude,
          longitude: match.longitude,
        };
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        const error = new Error('Standortdienste sind deaktiviert.');
        error.name = 'LOCATION_CAN_RETRY';
        throw error;
      }

      const existingPermission = await Location.getForegroundPermissionsAsync();
      let permission = existingPermission;

      if (existingPermission.status !== Location.PermissionStatus.GRANTED) {
        setPhase('requesting-location');
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        const error = new Error('Standortfreigabe fehlt.');
        error.name = permission.canAskAgain ? 'LOCATION_CAN_RETRY' : 'LOCATION_BLOCKED';
        throw error;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const liveLabel = await getLiveLocationLabel(location.coords.latitude, location.coords.longitude);

      return {
        kind: 'live',
        label: liveLabel ? `Aktueller Standort: ${liveLabel}` : 'Aktueller Standort',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    },
    [fixedLocationEnabled, fixedLocationText],
  );

  const syncData = useCallback(
    async (mode: SyncMode = 'background', sourceOverride?: SourceConfig) => {
      const isInitial = mode === 'initial' || !hasLoadedData;

      if (syncInFlightRef.current && !isInitial) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      syncInFlightRef.current = true;
      clearRetryTimer();

      if (isInitial) {
        setPhase('checking-location');
        setErrorMessage(null);
      }

      try {
        const source = await resolveLocationSource(sourceOverride);

        if (requestIdRef.current !== requestId) {
          return;
        }

        setLocationSource(source);

        if (isInitial) {
          setPhase('loading-data');
        }

        const [weatherResult, roadsResult, outsideResult] = await Promise.allSettled([
          withTimeout(
            fetchWeather(source.latitude, source.longitude),
            REQUEST_TIMEOUT_MS,
            'Wetterdaten konnten nicht rechtzeitig geladen werden.',
          ),
          withTimeout(
            fetchRoadActivity(source.latitude, source.longitude),
            REQUEST_TIMEOUT_MS,
            'Strassendaten konnten nicht rechtzeitig geladen werden.',
          ),
          withTimeout(
            fetchOutsideData(source.latitude, source.longitude),
            REQUEST_TIMEOUT_MS,
            'Aussendaten konnten nicht rechtzeitig geladen werden.',
          ),
        ]);

        if (requestIdRef.current !== requestId) {
          return;
        }

        if (weatherResult.status === 'rejected') {
          throw weatherResult.reason;
        }

        const roadSyncError =
          roadsResult.status === 'rejected'
            ? roadsResult.reason instanceof Error
              ? roadsResult.reason.message
              : 'Strassendaten konnten nicht geladen werden.'
            : null;
        const outsideSyncError =
          outsideResult.status === 'rejected'
            ? outsideResult.reason instanceof Error
              ? outsideResult.reason.message
              : 'Aussendaten konnten nicht geladen werden.'
            : null;

        const nextRoads =
          roadsResult.status === 'fulfilled'
            ? roadsResult.value
            : roads ??
              createRoadUnavailableData(source.latitude, source.longitude, roadSyncError ?? undefined);
        const nextOutside =
          outsideResult.status === 'fulfilled'
            ? outsideResult.value
            : outside ?? createOutsideUnavailableData(outsideSyncError ?? undefined);

        setWeather(weatherResult.value);
        setRoads(nextRoads);
        setOutside(nextOutside);
        setPhase('ready');
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Standortdaten konnten nicht aktualisiert werden.';

        if (sourceOverride) {
          setSettingsMessage(message);
        }

        if (error instanceof Error && error.name.startsWith('LOCATION_')) {
          setPhase('permission-blocked');

          if (error.name === 'LOCATION_CAN_RETRY') {
            retryTimerRef.current = setTimeout(() => syncData('initial'), LOCATION_RETRY_MS);
          }

          return;
        }

        if (hasLoadedData) {
          setPhase('ready');
        } else {
          setErrorMessage(message);
          setPhase('error');
        }
      } finally {
        if (requestIdRef.current === requestId) {
          syncInFlightRef.current = false;
        }
      }
    },
    [clearRetryTimer, hasLoadedData, outside, resolveLocationSource, roads],
  );

  const applyLocationSettings = useCallback(() => {
    const nextFixedLocationText = draftFixedLocationText.trim();
    const nextFixedLocationEnabled = draftFixedLocationEnabled;

    setFixedLocationEnabled(nextFixedLocationEnabled);
    setFixedLocationText(nextFixedLocationText);
    setDraftFixedLocationText(nextFixedLocationText);

    if (!nextFixedLocationEnabled) {
      setLocationSource((currentSource) => ({
        kind: 'live',
        label: 'Standort wird ermittelt',
        latitude: currentSource?.latitude ?? 0,
        longitude: currentSource?.longitude ?? 0,
      }));
    }

    setSettingsMessage(
      nextFixedLocationEnabled && nextFixedLocationText.length > 0
        ? `Fester Ort aktiv: ${nextFixedLocationText}`
        : nextFixedLocationEnabled
          ? 'Fester Ort ist leer. Live-Standort bleibt aktiv.'
          : 'Live-Standort aktiv.',
    );

    syncData('initial', {
      fixedLocationEnabled: nextFixedLocationEnabled,
      fixedLocationText: nextFixedLocationText,
    });
  }, [draftFixedLocationEnabled, draftFixedLocationText, syncData]);

  const openSystemSettings = useCallback(() => {
    Linking.openSettings().catch(() => {
      setErrorMessage('Öffne die Systemeinstellungen und erlaube den Standort für diese App.');
      setPhase('error');
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    AsyncStorage.getItem(PREFERENCES_KEY)
      .then((storedValue) => {
        if (!isMounted || !storedValue) {
          return;
        }

        const parsed = JSON.parse(storedValue) as StoredPreferences;
        const nextThemeMode = normalizeThemeMode(parsed.themeMode);
        const nextFixedEnabled = getStoredBoolean(parsed.fixedLocationEnabled);
        const nextFixedText = getStoredText(parsed.fixedLocationText);

        onThemeModeLoaded(nextThemeMode);
        setFixedLocationEnabled(nextFixedEnabled);
        setFixedLocationText(nextFixedText);
        setDraftFixedLocationEnabled(nextFixedEnabled);
        setDraftFixedLocationText(nextFixedText);
      })
      .catch(() => {
        if (isMounted) {
          setSettingsMessage('Gespeicherte Einstellungen konnten nicht geladen werden.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setPreferencesLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [onThemeModeLoaded]);

  useEffect(() => {
    if (!preferencesLoaded) {
      return;
    }

    if (hasTriggeredInitialSyncRef.current) {
      return;
    }

    hasTriggeredInitialSyncRef.current = true;

    syncData('initial');
  }, [preferencesLoaded, syncData]);

  useEffect(() => {
    return () => {
      clearRetryTimer();
      requestIdRef.current += 1;
    };
  }, [clearRetryTimer]);

  useEffect(() => {
    if (!preferencesLoaded) {
      return;
    }

    savePreferences({
      fixedLocationEnabled,
      fixedLocationText,
      themeMode,
    });
  }, [fixedLocationEnabled, fixedLocationText, preferencesLoaded, savePreferences, themeMode]);

  useEffect(() => {
    if (phase !== 'ready') {
      return undefined;
    }

    const intervalId = setInterval(() => {
      syncData('background');
    }, DATA_SYNC_MS);

    return () => clearInterval(intervalId);
  }, [phase, syncData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || !preferencesLoaded) {
        return;
      }

      syncData(phase === 'ready' ? 'background' : 'initial');
    });

    return () => subscription.remove();
  }, [phase, preferencesLoaded, syncData]);

  return {
    applyLocationSettings,
    draftFixedLocationEnabled,
    draftFixedLocationText,
    errorMessage,
    locationSource,
    openSystemSettings,
    outside,
    phase,
    preferencesLoaded,
    roads,
    setDraftFixedLocationEnabled,
    setDraftFixedLocationText,
    setSettingsMessage,
    settingsMessage,
    syncData,
    weather,
  };
}
