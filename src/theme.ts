import type { OutsideTone, RoadTone, Scheme, Theme } from './types';

export function getTheme(scheme: Scheme): Theme {
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

export function getToneColor(theme: Theme, tone: RoadTone | OutsideTone) {
  if (tone === 'busy' || tone === 'bad') {
    return theme.danger;
  }

  if (tone === 'moderate' || tone === 'watch') {
    return theme.warning;
  }

  return theme.positive;
}
