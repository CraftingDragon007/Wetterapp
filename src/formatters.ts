import type { ThemeMode } from './types';

export function normalizeThemeMode(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function getStoredBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false;
}

export function getStoredText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function formatNumber(value: number | null, fractionDigits = 0) {
  if (value === null || !Number.isFinite(value)) {
    return 'Nicht verfügbar';
  }

  return value.toFixed(fractionDigits).replace('.', ',');
}

export function describeWeatherCode(code: number | null) {
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

export function getUvLabel(uvIndex: number | null) {
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

export function getAirLabel(aqi: number | null) {
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

export function getPollenLabel(pollen: number | null) {
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
