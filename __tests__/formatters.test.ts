import {
  describeWeatherCode,
  formatNumber,
  getAirLabel,
  getPollenLabel,
  getStoredBoolean,
  getStoredText,
  getUvLabel,
  normalizeThemeMode,
} from '../src/formatters';

describe('formatters', () => {
  it('normalizes supported and unsupported theme values', () => {
    expect(normalizeThemeMode('light')).toBe('light');
    expect(normalizeThemeMode('dark')).toBe('dark');
    expect(normalizeThemeMode('system')).toBe('system');
    expect(normalizeThemeMode('sepia')).toBe('system');
    expect(normalizeThemeMode(null)).toBe('system');
  });

  it('reads persisted primitive values defensively', () => {
    expect(getStoredBoolean(true)).toBe(true);
    expect(getStoredBoolean('true')).toBe(false);
    expect(getStoredText('Zuerich')).toBe('Zuerich');
    expect(getStoredText(42)).toBe('');
  });

  it('formats numbers and missing values for UI output', () => {
    expect(formatNumber(12.34, 1)).toBe('12,3');
    expect(formatNumber(5)).toBe('5');
    expect(formatNumber(null)).toBe('Nicht verfügbar');
    expect(formatNumber(Number.NaN)).toBe('Nicht verfügbar');
  });

  it('maps weather codes to human readable labels', () => {
    expect(describeWeatherCode(null)).toBe('Aktuelle Lage');
    expect(describeWeatherCode(0)).toBe('Klar');
    expect(describeWeatherCode(2)).toBe('Teilweise bewölkt');
    expect(describeWeatherCode(45)).toBe('Nebel');
    expect(describeWeatherCode(53)).toBe('Nieselregen');
    expect(describeWeatherCode(63)).toBe('Regen');
    expect(describeWeatherCode(75)).toBe('Schnee');
    expect(describeWeatherCode(95)).toBe('Gewitter');
    expect(describeWeatherCode(999)).toBe('Aktuelle Lage');
  });

  it('classifies UV, air and pollen levels', () => {
    expect(getUvLabel(null)).toBe('Nicht verfügbar');
    expect(getUvLabel(2)).toBe('Niedrig');
    expect(getUvLabel(5)).toBe('Mittel');
    expect(getUvLabel(7)).toBe('Hoch');
    expect(getUvLabel(8)).toBe('Sehr hoch');

    expect(getAirLabel(null)).toBe('Nicht verfügbar');
    expect(getAirLabel(50)).toBe('Sauber');
    expect(getAirLabel(100)).toBe('Okay');
    expect(getAirLabel(150)).toBe('Für Empfindliche');
    expect(getAirLabel(151)).toBe('Schlecht');

    expect(getPollenLabel(null)).toBe('Nicht verfügbar');
    expect(getPollenLabel(10)).toBe('Niedrig');
    expect(getPollenLabel(50)).toBe('Mittel');
    expect(getPollenLabel(51)).toBe('Hoch');
  });
});
