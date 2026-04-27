import { getTheme, getToneColor } from '../src/theme';

describe('theme helpers', () => {
  it('returns light and dark palettes', () => {
    expect(getTheme('light')).toMatchObject({
      accent: '#167248',
      background: '#f4f6f1',
      text: '#111714',
    });

    expect(getTheme('dark')).toMatchObject({
      accent: '#2fbf7f',
      background: '#11130f',
      text: '#f0f2ec',
    });
  });

  it('maps status tones to semantic colors', () => {
    const theme = getTheme('light');

    expect(getToneColor(theme, 'bad')).toBe(theme.danger);
    expect(getToneColor(theme, 'busy')).toBe(theme.danger);
    expect(getToneColor(theme, 'watch')).toBe(theme.warning);
    expect(getToneColor(theme, 'moderate')).toBe(theme.warning);
    expect(getToneColor(theme, 'good')).toBe(theme.positive);
    expect(getToneColor(theme, 'clear')).toBe(theme.positive);
  });
});
