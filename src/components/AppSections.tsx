import type { ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { PAGES } from '../constants';
import { describeWeatherCode, formatNumber, getAirLabel, getPollenLabel, getUvLabel } from '../formatters';
import { getRoadFactors } from '../services/data';
import { getToneColor } from '../theme';
import type { LocationSource, OutsideData, PageName, RoadData, Scheme, Theme, ThemeMode, WeatherData } from '../types';
import type { Styles } from '../styles';

function PageIndicator({
  scrollY,
  styles,
  viewportHeight,
}: {
  scrollY: Animated.Value;
  styles: Styles;
  viewportHeight: number;
}) {
  const safeHeight = Math.max(viewportHeight, 1);
  const indicatorTranslateX = scrollY.interpolate({
    inputRange: [0, safeHeight, safeHeight * 2],
    outputRange: [0, 28, 56],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.pageIndicator}>
      {PAGES.map((page) => (
        <View key={page} style={styles.pageDot} />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pageIndicatorHighlight,
          { transform: [{ translateX: indicatorTranslateX }] },
        ]}
      />
    </View>
  );
}

export function PageFrame({
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
  locationLabel,
  onOpenSettings,
  pageId,
  scrollY,
  styles,
  title,
  viewportHeight,
}: {
  locationLabel: string;
  onOpenSettings: () => void;
  pageId: PageName;
  scrollY: Animated.Value;
  styles: Styles;
  title: string;
  viewportHeight: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTitleBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.headerLocation}>{locationLabel}</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable
          accessibilityLabel="Einstellungen öffnen"
          accessibilityRole="button"
          hitSlop={10}
          onPress={onOpenSettings}
          style={styles.settingsButton}
          testID={`${pageId}-settings-open-button`}
        >
          <View style={styles.settingsIcon}>
            <View style={styles.settingsIconRow}>
              <View style={styles.settingsIconTrack} />
              <View style={[styles.settingsIconKnob, styles.settingsIconKnobTop]} />
            </View>
            <View style={styles.settingsIconRow}>
              <View style={styles.settingsIconTrack} />
              <View style={[styles.settingsIconKnob, styles.settingsIconKnobMiddle]} />
            </View>
            <View style={styles.settingsIconRow}>
              <View style={styles.settingsIconTrack} />
              <View style={[styles.settingsIconKnob, styles.settingsIconKnobBottom]} />
            </View>
          </View>
        </Pressable>
        <PageIndicator scrollY={scrollY} styles={styles} viewportHeight={viewportHeight} />
      </View>
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
  tone: RoadData['tone'] | OutsideData['tone'];
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

export function SettingsMenu({
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
  const sourceLabel = locationSource?.label ?? 'Noch nicht geladen';

  return (
    <Animated.View style={[styles.settingsOverlay, { opacity }]} testID="settings-menu">
      <Pressable accessibilityRole="button" style={styles.settingsBackdrop} onPress={onClose} />
      <Animated.View
        style={[
          styles.settingsDrawer,
          {
            transform: [{ translateX }],
            width: drawerWidth,
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.settingsDrawerContent}
        >
          <ScrollView
            contentContainerStyle={[styles.settingsContent, settingsInsets]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Einstellungen</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={styles.closeButton}
                testID="close-settings-button"
              >
                <Text style={styles.closeButtonText}>Schliessen</Text>
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
                  <Text style={styles.settingsHelp}>
                    Wenn aktiv, werden Daten für diesen Ort geladen.
                  </Text>
                </View>
                <Switch
                  ios_backgroundColor={theme.border}
                  onValueChange={onChangeDraftFixedLocationEnabled}
                  testID="fixed-location-switch"
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
                testID="fixed-location-input"
                value={draftFixedLocationText}
              />
              <Pressable
                accessibilityRole="button"
                onPress={onApplyLocationSettings}
                style={styles.secondaryButton}
                testID="apply-location-button"
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
                testID="open-system-settings-button"
              >
                <Text style={styles.plainButtonText}>Standort-Einstellungen öffnen</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Animated.View>
  );
}

export function OutsidePage({
  locationLabel,
  onOpenSettings,
  outside,
  scrollY,
  styles,
  theme,
  viewportHeight,
}: {
  locationLabel: string;
  onOpenSettings: () => void;
  outside: OutsideData;
  scrollY: Animated.Value;
  styles: Styles;
  theme: Theme;
  viewportHeight: number;
}) {
  return (
    <>
      <Header
        locationLabel={locationLabel}
        onOpenSettings={onOpenSettings}
        pageId="outside"
        scrollY={scrollY}
        styles={styles}
        title="Draussen"
        viewportHeight={viewportHeight}
      />
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

export function WeatherPage({
  locationLabel,
  onOpenSettings,
  scrollY,
  styles,
  viewportHeight,
  weather,
}: {
  locationLabel: string;
  onOpenSettings: () => void;
  scrollY: Animated.Value;
  styles: Styles;
  viewportHeight: number;
  weather: WeatherData;
}) {
  const weatherDescription = describeWeatherCode(weather.weatherCode);

  return (
    <>
      <Header
        locationLabel={locationLabel}
        onOpenSettings={onOpenSettings}
        pageId="weather"
        scrollY={scrollY}
        styles={styles}
        title="Wetter"
        viewportHeight={viewportHeight}
      />
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

export function RoadsPage({
  locationLabel,
  onOpenSettings,
  roads,
  scrollY,
  styles,
  theme,
  viewportHeight,
}: {
  locationLabel: string;
  onOpenSettings: () => void;
  roads: RoadData;
  scrollY: Animated.Value;
  styles: Styles;
  theme: Theme;
  viewportHeight: number;
}) {
  const factors = getRoadFactors(roads);

  return (
    <>
      <Header
        locationLabel={locationLabel}
        onOpenSettings={onOpenSettings}
        pageId="roads"
        scrollY={scrollY}
        styles={styles}
        title="Strassen"
        viewportHeight={viewportHeight}
      />
      <SummaryBlock
        styles={styles}
        summary={roads.summary}
        theme={theme}
        title={roads.status}
        tone={roads.tone}
      >
        <Text style={styles.explainerText}>
          Aus Kartendaten geschätzt, keine Live-Staugeschwindigkeit.
        </Text>
      </SummaryBlock>
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
