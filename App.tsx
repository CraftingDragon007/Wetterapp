import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type AppPhase =
  | 'loading-preferences'
  | 'checking-location'
  | 'requesting-location'
  | 'permission-blocked'
  | 'loading-data'
  | 'ready'
  | 'error';

type PageName = 'outside' | 'weather' | 'roads';
type RoadTone = 'clear' | 'moderate' | 'busy';
type OutsideTone = 'good' | 'watch' | 'bad';
type Scheme = 'light' | 'dark';
type ThemeMode = 'system' | 'light' | 'dark';
type DataSourceKind = 'live' | 'fixed';

type WeatherData = {
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

type RoadData = {
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

type OutsideData = {
  aqi: number | null;
  pm25: number | null;
  pollen: number | null;
  status: string;
  summary: string;
  tone: OutsideTone;
  uvIndex: number | null;
};

type LocationSource = {
  kind: DataSourceKind;
  label: string;
  latitude: number;
  longitude: number;
};

type StoredPreferences = {
  fixedLocationEnabled?: boolean;
  fixedLocationText?: string;
  themeMode?: ThemeMode;
};

type SourceConfig = {
  fixedLocationEnabled: boolean;
  fixedLocationText: string;
};

type OpenMeteoResponse = {
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

type AirQualityResponse = {
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

type OverpassElement = {
  id: number;
  tags?: Record<string, string>;
  type: 'node' | 'way' | 'relation';
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type Theme = {
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

const PAGES: PageName[] = ['outside', 'weather', 'roads'];
const PAGE_INDEX: Record<PageName, number> = {
  outside: 0,
  weather: 1,
  roads: 2,
};

const LOCATION_RETRY_MS = 2500;
const DATA_SYNC_MS = 15000;
const ROAD_RADIUS_METERS = 1800;
const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const PREFERENCES_KEY = 'live-data-view.preferences.v1';
const MAJOR_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary']);

function getTheme(scheme: Scheme): Theme {
  if (scheme === 'dark') {
    return {
      accent: '#2fbf7f',
      background: '#11130f',
      border: '#30352e',
      danger: '#e06a54',
      muted: '#a0aa9c',
      onAccent: '#07110b',
      positive: '#3fc483',
      surface: '#191d17',
      text: '#f0f2ec',
      warning: '#d6a240',
    };
  }

  return {
    accent: '#167248',
    background: '#f4f6f1',
    border: '#d7ded4',
    danger: '#c2412c',
    muted: '#667066',
    onAccent: '#ffffff',
    positive: '#167248',
    surface: '#ffffff',
    text: '#111714',
    warning: '#a76b13',
  };
}

function getToneColor(theme: Theme, tone: RoadTone | OutsideTone) {
  if (tone === 'busy' || tone === 'bad') {
    return theme.danger;
  }

  if (tone === 'moderate' || tone === 'watch') {
    return theme.warning;
  }

  return theme.positive;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

function getStoredBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false;
}

function getStoredText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function formatNumber(value: number | null, fractionDigits = 0) {
  if (value === null || !Number.isFinite(value)) {
    return 'Nicht verfügbar';
  }

  return value.toFixed(fractionDigits).replace('.', ',');
}

function describeWeatherCode(code: number | null) {
  if (code === null) {
    return 'Aktuelle Lage';
  }

  if (code === 0) {
    return 'Klar';
  }

  if ([1, 2, 3].includes(code)) {
    return 'Teilweise bewölkt';
  }

  if ([45, 48].includes(code)) {
    return 'Nebel';
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return 'Nieselregen';
  }

  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return 'Regen';
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return 'Schnee';
  }

  if ([95, 96, 99].includes(code)) {
    return 'Gewitter';
  }

  return 'Aktuelle Lage';
}

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

async function fetchWeather(latitude: number, longitude: number): Promise<WeatherData> {
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
      summary: 'Eine Bedingung draußen ist gerade ungünstig.',
      tone: 'bad' as const,
    };
  }

  const airNeedsCare = aqi !== null && aqi > 50;
  const uvNeedsCare = uvIndex !== null && uvIndex > 5;
  const pollenNeedsCare = pollen !== null && pollen > 10;

  if (airNeedsCare || uvNeedsCare || pollenNeedsCare) {
    return {
      status: 'Gut mit Einschränkung',
      summary: 'Draußen passt es, aber ein Wert braucht Aufmerksamkeit.',
      tone: 'watch' as const,
    };
  }

  return {
    status: 'Gut draußen',
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

async function fetchOutsideData(latitude: number, longitude: number): Promise<OutsideData> {
  const response = await fetch(getAirQualityUrl(latitude, longitude));

  if (!response.ok) {
    throw new Error(`Außendaten antworten mit Status ${response.status}.`);
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
  const score =
    constructionCount * 3 +
    restrictionCount * 2 +
    majorRoadCount * 0.45 +
    signalCount * 0.08 +
    Math.min(roadCount, 80) * 0.025;

  if (constructionCount >= 3 || score >= 8) {
    return {
      score,
      status: 'Viel los',
      summary: 'Plane etwas mehr Zeit ein. In der Nähe gibt es viele Straßensignale.',
      tone: 'busy' as const,
    };
  }

  if (constructionCount > 0 || restrictionCount > 0 || score >= 3.5) {
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
    summary: 'Keine Baustellen, Sperren oder starken Straßensignale in der Nähe.',
    tone: 'clear' as const,
  };
}

async function fetchRoadActivity(latitude: number, longitude: number): Promise<RoadData> {
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
    throw new Error(`Straßendaten antworten mit Status ${response.status}.`);
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

function createRoadUnavailableData(
  latitude: number,
  longitude: number,
  reason = 'Straßendaten wurden noch nicht geladen.',
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
    status: 'Straßendaten fehlen',
    summary: reason,
    tone: 'moderate',
  };
}

function createOutsideUnavailableData(reason = 'Außendaten wurden noch nicht geladen.'): OutsideData {
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

function getRoadLevel(roads: RoadData) {
  return clamp(Math.round(100 * (1 - Math.exp(-roads.score / 8))), 0, 88);
}

function getRoadLevelLabel(roads: RoadData) {
  if (roads.tone === 'busy') {
    return 'Hoch';
  }

  if (roads.tone === 'moderate') {
    return 'Mittel';
  }

  return 'Niedrig';
}

function getRoadFactors(roads: RoadData) {
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
      ? 'Abseits großer Straßen'
      : roads.majorRoadCount < 4
        ? 'Ein paar Hauptstraßen nah'
        : 'Hauptstraßen direkt nah';

  return [
    { label: 'Baustellen', value: roadworks },
    { label: 'Kreuzungen', value: controls },
    { label: 'Hauptstraßen', value: mainRoads },
  ];
}

function getUvLabel(uvIndex: number | null) {
  if (uvIndex === null) {
    return 'Nicht verfügbar';
  }

  if (uvIndex <= 2) {
    return 'Niedrig';
  }

  if (uvIndex <= 5) {
    return 'Mittel';
  }

  if (uvIndex <= 7) {
    return 'Hoch';
  }

  return 'Sehr hoch';
}

function getAirLabel(aqi: number | null) {
  if (aqi === null) {
    return 'Nicht verfügbar';
  }

  if (aqi <= 50) {
    return 'Sauber';
  }

  if (aqi <= 100) {
    return 'Okay';
  }

  if (aqi <= 150) {
    return 'Für Empfindliche';
  }

  return 'Schlecht';
}

function getPollenLabel(pollen: number | null) {
  if (pollen === null) {
    return 'Nicht verfügbar';
  }

  if (pollen <= 10) {
    return 'Niedrig';
  }

  if (pollen <= 50) {
    return 'Mittel';
  }

  return 'Hoch';
}

type Styles = ReturnType<typeof createStyles>;

function PageIndicator({
  activeIndex,
  styles,
}: {
  activeIndex: number;
  styles: Styles;
}) {
  return (
    <View style={styles.pageIndicator}>
      {PAGES.map((page, index) => (
        <View
          key={page}
          style={[styles.pageDot, index === activeIndex && styles.pageDotActive]}
        />
      ))}
    </View>
  );
}

function PageFrame({
  children,
  index,
  scrollY,
  styles,
  viewportHeight,
}: {
  children: ReactNode;
  index: number;
  scrollY: Animated.Value;
  styles: Styles;
  viewportHeight: number;
}) {
  const safeHeight = Math.max(viewportHeight, 1);
  const inputRange = [(index - 1) * safeHeight, index * safeHeight, (index + 1) * safeHeight];
  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.62, 1, 0.62],
    extrapolate: 'clamp',
  });
  const translateY = scrollY.interpolate({
    inputRange,
    outputRange: [14, 0, -14],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.pageContent, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function Header({
  activeIndex,
  styles,
  title,
}: {
  activeIndex: number;
  styles: Styles;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <PageIndicator activeIndex={activeIndex} styles={styles} />
    </View>
  );
}

function SummaryBlock({
  children,
  styles,
  summary,
  theme,
  title,
  tone,
}: {
  children?: ReactNode;
  styles: Styles;
  summary: string;
  theme: Theme;
  title: string;
  tone: RoadTone | OutsideTone;
}) {
  const toneColor = getToneColor(theme, tone);

  return (
    <View style={styles.summaryBlock}>
      <View style={styles.summaryHeader}>
        <View style={[styles.statusMark, { backgroundColor: toneColor }]} />
        <Text style={styles.summaryTitle}>{title}</Text>
      </View>
      <Text style={styles.summaryText}>{summary}</Text>
      {children}
    </View>
  );
}

function DataRow({
  label,
  meta,
  styles,
  value,
}: {
  label: string;
  meta?: string;
  styles: Styles;
  value: string;
}) {
  return (
    <View style={styles.dataRow}>
      <View style={styles.dataRowText}>
        <Text style={styles.dataLabel}>{label}</Text>
        {meta ? <Text style={styles.dataMeta}>{meta}</Text> : null}
      </View>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function ThemeOption({
  active,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  styles: Styles;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.optionRow, active && styles.optionRowActive]}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
      <View style={[styles.optionRadio, active && styles.optionRadioActive]} />
    </Pressable>
  );
}

function SettingsMenu({
  drawerWidth,
  draftFixedLocationEnabled,
  draftFixedLocationText,
  locationSource,
  onApplyLocationSettings,
  onChangeDraftFixedLocationEnabled,
  onChangeDraftFixedLocationText,
  onClose,
  onOpenSystemSettings,
  onThemeModeChange,
  scheme,
  settingsAnim,
  settingsInsets,
  settingsMessage,
  styles,
  theme,
  themeMode,
}: {
  drawerWidth: number;
  draftFixedLocationEnabled: boolean;
  draftFixedLocationText: string;
  locationSource: LocationSource | null;
  onApplyLocationSettings: () => void;
  onChangeDraftFixedLocationEnabled: (value: boolean) => void;
  onChangeDraftFixedLocationText: (value: string) => void;
  onClose: () => void;
  onOpenSystemSettings: () => void;
  onThemeModeChange: (value: ThemeMode) => void;
  scheme: Scheme;
  settingsAnim: Animated.Value;
  settingsInsets: { paddingBottom: number; paddingTop: number };
  settingsMessage: string | null;
  styles: Styles;
  theme: Theme;
  themeMode: ThemeMode;
}) {
  const translateX = settingsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
    extrapolate: 'clamp',
  });
  const opacity = settingsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const sourceLabel =
    locationSource?.kind === 'fixed'
      ? locationSource.label
      : locationSource?.kind === 'live'
        ? 'Live-Standort'
        : 'Noch nicht geladen';

  return (
    <Animated.View style={[styles.settingsOverlay, { opacity }]}>
      <Pressable accessibilityRole="button" style={styles.settingsBackdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.settingsDrawer,
          {
            transform: [{ translateX }],
            width: drawerWidth,
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={[styles.settingsContent, settingsInsets]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>Einstellungen</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Schließen</Text>
            </Pressable>
          </View>

          <View style={styles.settingsGroup}>
            <Text style={styles.settingsLabel}>Darstellung</Text>
            <View style={styles.optionList}>
              <ThemeOption
                active={themeMode === 'system'}
                label="System"
                onPress={() => onThemeModeChange('system')}
                styles={styles}
              />
              <ThemeOption
                active={themeMode === 'light'}
                label="Hell"
                onPress={() => onThemeModeChange('light')}
                styles={styles}
              />
              <ThemeOption
                active={themeMode === 'dark'}
                label="Dunkel"
                onPress={() => onThemeModeChange('dark')}
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.settingsGroup}>
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.settingsLabel}>Fester Ort</Text>
                <Text style={styles.settingsHelp}>Wenn aktiv, werden Daten für diesen Ort geladen.</Text>
              </View>
              <Switch
                ios_backgroundColor={theme.border}
                onValueChange={onChangeDraftFixedLocationEnabled}
                thumbColor={Platform.OS === 'android' ? theme.surface : undefined}
                trackColor={{ false: theme.border, true: theme.accent }}
                value={draftFixedLocationEnabled}
              />
            </View>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              keyboardAppearance={scheme}
              onChangeText={onChangeDraftFixedLocationText}
              placeholder="z. B. Zürich, Schweiz"
              placeholderTextColor={theme.muted}
              returnKeyType="done"
              selectionColor={theme.accent}
              style={styles.locationInput}
              value={draftFixedLocationText}
            />
            <Pressable
              accessibilityRole="button"
              onPress={onApplyLocationSettings}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Ort übernehmen</Text>
            </Pressable>
            {settingsMessage ? <Text style={styles.settingsMessage}>{settingsMessage}</Text> : null}
            <Text style={styles.settingsFootnote}>Aktive Datenquelle: {sourceLabel}</Text>
          </View>

          <View style={styles.settingsGroup}>
            <Text style={styles.settingsLabel}>Systemstandort</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenSystemSettings}
              style={styles.plainButton}
            >
              <Text style={styles.plainButtonText}>Standort-Einstellungen öffnen</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function OutsidePage({
  activeIndex,
  outside,
  styles,
  theme,
}: {
  activeIndex: number;
  outside: OutsideData;
  styles: Styles;
  theme: Theme;
}) {
  return (
    <>
      <Header activeIndex={activeIndex} styles={styles} title="Draußen" />
      <SummaryBlock
        styles={styles}
        summary={outside.summary}
        theme={theme}
        title={outside.status}
        tone={outside.tone}
      />
      <View style={styles.section}>
        <DataRow
          label="UV"
          meta={`Index ${formatNumber(outside.uvIndex, 1)}`}
          styles={styles}
          value={getUvLabel(outside.uvIndex)}
        />
        <DataRow
          label="Luft"
          meta={`AQI ${outside.aqi === null ? '-' : Math.round(outside.aqi)}`}
          styles={styles}
          value={getAirLabel(outside.aqi)}
        />
        <DataRow
          label="Pollen"
          meta={`Spitze ${formatNumber(outside.pollen, 0)}`}
          styles={styles}
          value={getPollenLabel(outside.pollen)}
        />
        <DataRow
          label="PM2.5"
          meta="Feinstaub"
          styles={styles}
          value={outside.pm25 === null ? 'Nicht verfügbar' : `${formatNumber(outside.pm25, 1)} µg/m³`}
        />
      </View>
    </>
  );
}

function WeatherPage({
  activeIndex,
  styles,
  weather,
}: {
  activeIndex: number;
  styles: Styles;
  weather: WeatherData;
}) {
  const weatherDescription = describeWeatherCode(weather.weatherCode);

  return (
    <>
      <Header activeIndex={activeIndex} styles={styles} title="Wetter" />
      <View style={styles.temperatureBlock}>
        <Text style={styles.weatherStatus}>{weatherDescription}</Text>
        <View style={styles.temperatureRow}>
          <Text style={styles.temperature}>{Math.round(weather.temperature)}</Text>
          <Text style={styles.temperatureUnit}>{weather.temperatureUnit}</Text>
        </View>
      </View>
      <View style={styles.section}>
        <DataRow
          label="Gefühlt"
          styles={styles}
          value={`${formatNumber(weather.apparentTemperature)} ${weather.temperatureUnit}`}
        />
        <DataRow label="Feuchte" styles={styles} value={`${formatNumber(weather.humidity)}%`} />
        <DataRow
          label="Wind"
          styles={styles}
          value={`${formatNumber(weather.windSpeed, 1)} ${weather.windSpeedUnit}`}
        />
      </View>
    </>
  );
}

function RoadsPage({
  activeIndex,
  roads,
  styles,
  theme,
}: {
  activeIndex: number;
  roads: RoadData;
  styles: Styles;
  theme: Theme;
}) {
  const roadLevel = getRoadLevel(roads);
  const factors = getRoadFactors(roads);
  const toneColor = getToneColor(theme, roads.tone);

  return (
    <>
      <Header activeIndex={activeIndex} styles={styles} title="Straßen" />
      <SummaryBlock
        styles={styles}
        summary={roads.summary}
        theme={theme}
        title={roads.status}
        tone={roads.tone}
      >
        <Text style={styles.explainerText}>Aus Kartendaten geschätzt, keine Live-Staugeschwindigkeit.</Text>
      </SummaryBlock>
      <View style={styles.meterBlock}>
        <View style={styles.meterHeader}>
          <Text style={styles.dataLabel}>Einschätzung</Text>
          <Text style={styles.meterValue}>{getRoadLevelLabel(roads)}</Text>
        </View>
        <View style={styles.meterTrack}>
          <View
            style={[
              styles.meterFill,
              {
                backgroundColor: toneColor,
                width: `${Math.max(roadLevel, 4)}%`,
              },
            ]}
          />
        </View>
      </View>
      <View style={styles.section}>
        {factors.map((factor) => (
          <DataRow
            key={factor.label}
            label={factor.label}
            styles={styles}
            value={factor.value}
          />
        ))}
      </View>
    </>
  );
}

export default function App() {
  const colorScheme = useColorScheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const scheme: Scheme =
    themeMode === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const theme = useMemo(() => getTheme(scheme), [scheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [fixedLocationEnabled, setFixedLocationEnabled] = useState(false);
  const [fixedLocationText, setFixedLocationText] = useState('');
  const [draftFixedLocationEnabled, setDraftFixedLocationEnabled] = useState(false);
  const [draftFixedLocationText, setDraftFixedLocationText] = useState('');
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(windowHeight);
  const [phase, setPhase] = useState<AppPhase>('loading-preferences');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [roads, setRoads] = useState<RoadData | null>(null);
  const [outside, setOutside] = useState<OutsideData | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(PAGE_INDEX.weather);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const syncInFlightRef = useRef(false);
  const hasPositionedInitialPageRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(new Animated.Value(PAGE_INDEX.weather * windowHeight)).current;
  const readyIntro = useRef(new Animated.Value(0)).current;
  const settingsAnim = useRef(new Animated.Value(0)).current;
  const hasLoadedData = weather !== null && roads !== null && outside !== null;
  const drawerWidth = Math.min(Math.max(windowWidth * 0.84, 280), 360);
  const pageInsets = useMemo(
    () => ({
      paddingBottom: Platform.OS === 'android' ? 42 : 34,
      paddingTop: (Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0) + 34,
    }),
    [],
  );

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const openSettingsMenu = useCallback(() => {
    setSettingsOpen(true);
    setSettingsMessage(null);
    settingsAnim.stopAnimation();
    Animated.timing(settingsAnim, {
      duration: 190,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [settingsAnim]);

  const closeSettingsMenu = useCallback(() => {
    settingsAnim.stopAnimation();
    Animated.timing(settingsAnim, {
      duration: 160,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setSettingsOpen(false);
      }
    });
  }, [settingsAnim]);

  const settingsPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (settingsOpen) {
            return false;
          }

          return (
            gestureState.dx > 42 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx > 58) {
            openSettingsMenu();
          }
        },
      }),
    [openSettingsMenu, settingsOpen],
  );

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
        const results = await Location.geocodeAsync(fixedText);
        const match = results.find(
          (result) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude),
        );

        if (!match) {
          throw new Error('Der feste Ort wurde nicht gefunden.');
        }

        return {
          kind: 'fixed',
          label: fixedText,
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

      return {
        kind: 'live',
        label: 'Live-Standort',
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    },
    [fixedLocationEnabled, fixedLocationText],
  );

  const syncData = useCallback(
    async (mode: 'initial' | 'background' = 'background', sourceOverride?: SourceConfig) => {
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

        if (isInitial) {
          setPhase('loading-data');
        }

        const [weatherResult, roadsResult, outsideResult] = await Promise.allSettled([
          fetchWeather(source.latitude, source.longitude),
          fetchRoadActivity(source.latitude, source.longitude),
          fetchOutsideData(source.latitude, source.longitude),
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
              : 'Straßendaten konnten nicht geladen werden.'
            : null;
        const outsideSyncError =
          outsideResult.status === 'rejected'
            ? outsideResult.reason instanceof Error
              ? outsideResult.reason.message
              : 'Außendaten konnten nicht geladen werden.'
            : null;
        const nextRoads =
          roadsResult.status === 'fulfilled'
            ? roadsResult.value
            : roads ?? createRoadUnavailableData(source.latitude, source.longitude, roadSyncError ?? undefined);
        const nextOutside =
          outsideResult.status === 'fulfilled'
            ? outsideResult.value
            : outside ?? createOutsideUnavailableData(outsideSyncError ?? undefined);

        setWeather(weatherResult.value);
        setRoads(nextRoads);
        setOutside(nextOutside);
        setLocationSource(source);
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

        setThemeMode(nextThemeMode);
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
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) {
      return undefined;
    }

    syncData('initial');

    return () => {
      clearRetryTimer();
      requestIdRef.current += 1;
    };
  }, [clearRetryTimer, preferencesLoaded]);

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

  useEffect(() => {
    if (phase !== 'ready') {
      return;
    }

    readyIntro.setValue(0);
    Animated.timing(readyIntro, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [phase, readyIntro]);

  useEffect(() => {
    if (phase !== 'ready' || hasPositionedInitialPageRef.current || viewportHeight <= 0) {
      return;
    }

    hasPositionedInitialPageRef.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        animated: false,
        y: PAGE_INDEX.weather * viewportHeight,
      });
      scrollY.setValue(PAGE_INDEX.weather * viewportHeight);
    });
  }, [phase, scrollY, viewportHeight]);

  const handleScreenLayout = useCallback((event: { nativeEvent: { layout: { height: number } } }) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);

    if (nextHeight > 0) {
      setViewportHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    }
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = clamp(
        Math.round(event.nativeEvent.contentOffset.y / Math.max(viewportHeight, 1)),
        0,
        PAGES.length - 1,
      );
      setActiveIndex(nextIndex);
    },
    [viewportHeight],
  );

  const handleThemeModeChange = useCallback((nextThemeMode: ThemeMode) => {
    setThemeMode(nextThemeMode);
    setSettingsMessage(
      nextThemeMode === 'system'
        ? 'Darstellung folgt dem System.'
        : nextThemeMode === 'dark'
          ? 'Dunkle Darstellung aktiv.'
          : 'Helle Darstellung aktiv.',
    );
  }, []);

  const handleApplyLocationSettings = useCallback(() => {
    const nextFixedLocationText = draftFixedLocationText.trim();
    const nextFixedLocationEnabled = draftFixedLocationEnabled;

    setFixedLocationEnabled(nextFixedLocationEnabled);
    setFixedLocationText(nextFixedLocationText);
    setDraftFixedLocationText(nextFixedLocationText);
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

  const loadingLabel = useMemo(() => {
    if (!preferencesLoaded || phase === 'loading-preferences') {
      return 'Einstellungen werden geladen';
    }

    if (phase === 'loading-data') {
      return 'Daten werden geladen';
    }

    if (phase === 'requesting-location') {
      return 'Standortfreigabe wird angefragt';
    }

    return 'Standort wird geprüft';
  }, [phase, preferencesLoaded]);

  const openSystemSettings = useCallback(() => {
    Linking.openSettings().catch(() => {
      setErrorMessage('Öffne die Systemeinstellungen und erlaube den Standort für diese App.');
      setPhase('error');
    });
  }, []);

  const renderSettingsMenu = () =>
    settingsOpen ? (
      <SettingsMenu
        drawerWidth={drawerWidth}
        draftFixedLocationEnabled={draftFixedLocationEnabled}
        draftFixedLocationText={draftFixedLocationText}
        locationSource={locationSource}
        onApplyLocationSettings={handleApplyLocationSettings}
        onChangeDraftFixedLocationEnabled={setDraftFixedLocationEnabled}
        onChangeDraftFixedLocationText={setDraftFixedLocationText}
        onClose={closeSettingsMenu}
        onOpenSystemSettings={openSystemSettings}
        onThemeModeChange={handleThemeModeChange}
        scheme={scheme}
        settingsAnim={settingsAnim}
        settingsInsets={pageInsets}
        settingsMessage={settingsMessage}
        styles={styles}
        theme={theme}
        themeMode={themeMode}
      />
    ) : null;

  if (phase === 'permission-blocked') {
    return (
      <SafeAreaView style={styles.screen} {...settingsPanResponder.panHandlers}>
        <ExpoStatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.centered}>
          <Pressable style={styles.primaryButton} onPress={openSystemSettings}>
            <Text style={styles.primaryButtonText}>Standort-Einstellungen öffnen</Text>
          </Pressable>
        </View>
        {renderSettingsMenu()}
      </SafeAreaView>
    );
  }

  if (phase !== 'ready' || !weather || !roads || !outside) {
    const isError = phase === 'error';

    return (
      <SafeAreaView style={styles.screen} {...settingsPanResponder.panHandlers}>
        <ExpoStatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.centered}>
          {isError ? (
            <>
              <Text style={styles.errorTitle}>Daten nicht verfügbar</Text>
              <Text style={styles.errorText}>
                {errorMessage ?? 'Standortdaten konnten nicht geladen werden.'}
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => syncData('initial')}>
                <Text style={styles.primaryButtonText}>Erneut versuchen</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={styles.loadingText}>{loadingLabel}</Text>
            </>
          )}
        </View>
        {renderSettingsMenu()}
      </SafeAreaView>
    );
  }

  const introTranslateY = readyIntro.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  return (
    <SafeAreaView
      style={styles.screen}
      onLayout={handleScreenLayout}
      {...settingsPanResponder.panHandlers}
    >
      <ExpoStatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Animated.ScrollView
        ref={scrollRef}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        overScrollMode="never"
        pagingEnabled
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={viewportHeight}
      >
        <View style={[styles.page, pageInsets, { height: viewportHeight }]}>
          <Animated.View
            style={[
              styles.readyIntro,
              {
                opacity: readyIntro,
                transform: [{ translateY: introTranslateY }],
              },
            ]}
          >
            <PageFrame
              index={PAGE_INDEX.outside}
              scrollY={scrollY}
              styles={styles}
              viewportHeight={viewportHeight}
            >
              <OutsidePage
                activeIndex={activeIndex}
                outside={outside}
                styles={styles}
                theme={theme}
              />
            </PageFrame>
          </Animated.View>
        </View>
        <View style={[styles.page, pageInsets, { height: viewportHeight }]}>
          <Animated.View
            style={[
              styles.readyIntro,
              {
                opacity: readyIntro,
                transform: [{ translateY: introTranslateY }],
              },
            ]}
          >
            <PageFrame
              index={PAGE_INDEX.weather}
              scrollY={scrollY}
              styles={styles}
              viewportHeight={viewportHeight}
            >
              <WeatherPage activeIndex={activeIndex} styles={styles} weather={weather} />
            </PageFrame>
          </Animated.View>
        </View>
        <View style={[styles.page, pageInsets, { height: viewportHeight }]}>
          <Animated.View
            style={[
              styles.readyIntro,
              {
                opacity: readyIntro,
                transform: [{ translateY: introTranslateY }],
              },
            ]}
          >
            <PageFrame
              index={PAGE_INDEX.roads}
              scrollY={scrollY}
              styles={styles}
              viewportHeight={viewportHeight}
            >
              <RoadsPage
                activeIndex={activeIndex}
                roads={roads}
                styles={styles}
                theme={theme}
              />
            </PageFrame>
          </Animated.View>
        </View>
      </Animated.ScrollView>
      {renderSettingsMenu()}
    </SafeAreaView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    centered: {
      alignItems: 'center',
      backgroundColor: theme.background,
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    closeButton: {
      alignItems: 'center',
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: 12,
    },
    closeButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: '700',
    },
    dataLabel: {
      color: theme.muted,
      fontSize: 14,
    },
    dataMeta: {
      color: theme.muted,
      fontSize: 12,
      marginTop: 3,
    },
    dataRow: {
      alignItems: 'center',
      borderBottomColor: theme.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      minHeight: 58,
      paddingVertical: 13,
    },
    dataRowText: {
      flex: 1,
    },
    dataValue: {
      color: theme.text,
      flexShrink: 1,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'right',
    },
    errorText: {
      color: theme.muted,
      fontSize: 15,
      lineHeight: 22,
      marginBottom: 24,
      maxWidth: 320,
      textAlign: 'center',
    },
    errorTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 8,
    },
    explainerText: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 12,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    loadingText: {
      color: theme.muted,
      fontSize: 15,
      marginTop: 16,
    },
    locationInput: {
      backgroundColor: theme.background,
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      color: theme.text,
      fontSize: 16,
      minHeight: 48,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    meterBlock: {
      gap: 10,
    },
    meterFill: {
      borderRadius: 3,
      height: '100%',
    },
    meterHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    meterTrack: {
      backgroundColor: theme.border,
      borderRadius: 3,
      height: 8,
      overflow: 'hidden',
    },
    meterValue: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    optionList: {
      gap: 8,
    },
    optionRadio: {
      borderColor: theme.border,
      borderRadius: 6,
      borderWidth: 1,
      height: 12,
      width: 12,
    },
    optionRadioActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    optionRow: {
      alignItems: 'center',
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingHorizontal: 12,
    },
    optionRowActive: {
      borderColor: theme.accent,
    },
    optionText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
    },
    optionTextActive: {
      color: theme.accent,
    },
    page: {
      backgroundColor: theme.background,
      paddingHorizontal: 24,
      width: '100%',
    },
    pageContent: {
      flex: 1,
      justifyContent: 'space-between',
      width: '100%',
    },
    pageDot: {
      backgroundColor: theme.border,
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    pageDotActive: {
      backgroundColor: theme.accent,
      width: 22,
    },
    pageIndicator: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
    },
    plainButton: {
      alignItems: 'center',
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 46,
      paddingHorizontal: 12,
    },
    plainButtonText: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '700',
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: theme.accent,
      borderRadius: 8,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 18,
    },
    primaryButtonText: {
      color: theme.onAccent,
      fontSize: 16,
      fontWeight: '800',
    },
    readyIntro: {
      flex: 1,
    },
    screen: {
      backgroundColor: theme.background,
      flex: 1,
      overflow: 'hidden',
    },
    scrollContent: {
      backgroundColor: theme.background,
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: theme.accent,
      borderRadius: 8,
      justifyContent: 'center',
      minHeight: 46,
      paddingHorizontal: 12,
    },
    secondaryButtonText: {
      color: theme.onAccent,
      fontSize: 15,
      fontWeight: '800',
    },
    section: {
      borderTopColor: theme.border,
      borderTopWidth: 1,
    },
    settingsBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.28)',
    },
    settingsContent: {
      gap: 24,
      paddingHorizontal: 20,
    },
    settingsDrawer: {
      backgroundColor: theme.surface,
      borderRightColor: theme.border,
      borderRightWidth: 1,
      bottom: 0,
      left: 0,
      position: 'absolute',
      top: 0,
    },
    settingsFootnote: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    settingsGroup: {
      gap: 12,
    },
    settingsHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    settingsHelp: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 3,
    },
    settingsLabel: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '800',
    },
    settingsMessage: {
      color: theme.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    settingsOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 20,
    },
    settingsTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '800',
    },
    statusMark: {
      borderRadius: 4,
      height: 12,
      width: 12,
    },
    summaryBlock: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 8,
      borderWidth: 1,
      padding: 16,
    },
    summaryHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 9,
    },
    summaryText: {
      color: theme.muted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
    },
    summaryTitle: {
      color: theme.text,
      flex: 1,
      fontSize: 21,
      fontWeight: '800',
    },
    switchRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'space-between',
    },
    switchText: {
      flex: 1,
    },
    temperature: {
      color: theme.text,
      fontSize: 86,
      fontWeight: '800',
      lineHeight: 92,
    },
    temperatureBlock: {
      gap: 10,
    },
    temperatureRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 8,
    },
    temperatureUnit: {
      color: theme.muted,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 17,
    },
    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: '800',
    },
    weatherStatus: {
      color: theme.muted,
      fontSize: 18,
      fontWeight: '700',
    },
  });
}
