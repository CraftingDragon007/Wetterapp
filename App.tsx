import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as NativeStatusBar,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { OutsidePage, PageFrame, RoadsPage, SettingsMenu, WeatherPage } from './src/components/AppSections';
import { PAGE_INDEX } from './src/constants';
import { useLiveDataSync } from './src/hooks/useLiveDataSync';
import { createStyles } from './src/styles';
import { getTheme } from './src/theme';
import type { Scheme, ThemeMode } from './src/types';

export default function App() {
  const colorScheme = useColorScheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(windowHeight);

  const scheme: Scheme =
    themeMode === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const theme = useMemo(() => getTheme(scheme), [scheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
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
  } = useLiveDataSync({
    onThemeModeLoaded: setThemeMode,
    themeMode,
  });

  const hasPositionedInitialPageRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollY = useRef(new Animated.Value(PAGE_INDEX.weather * windowHeight)).current;
  const readyIntro = useRef(new Animated.Value(0)).current;
  const settingsAnim = useRef(new Animated.Value(0)).current;

  const drawerWidth = Math.min(Math.max(windowWidth * 0.84, 280), 360);
  const pageInsets = useMemo(
    () => ({
      paddingBottom: Platform.OS === 'android' ? 42 : 34,
      paddingTop: (Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0) + 34,
    }),
    [],
  );

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
  }, [setSettingsMessage, settingsAnim]);

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
            gestureState.x0 <= Math.min(windowWidth * 0.24, 120) &&
            gestureState.dx > 18 &&
            gestureState.vx > 0.05 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.1
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          if (
            gestureState.x0 <= Math.min(windowWidth * 0.3, 144) &&
            (gestureState.dx > 34 || gestureState.vx > 0.42)
          ) {
            openSettingsMenu();
          }
        },
      }),
    [openSettingsMenu, settingsOpen, windowWidth],
  );

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

  const handleThemeModeChange = useCallback((nextThemeMode: ThemeMode) => {
    setThemeMode(nextThemeMode);
    setSettingsMessage(
      nextThemeMode === 'system'
        ? 'Darstellung folgt dem System.'
        : nextThemeMode === 'dark'
          ? 'Dunkle Darstellung aktiv.'
          : 'Helle Darstellung aktiv.',
    );
  }, [setSettingsMessage]);

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

  const currentLocationLabel = locationSource?.label ?? 'Standort wird ermittelt';

  const renderSettingsMenu = () =>
    settingsOpen ? (
      <SettingsMenu
        drawerWidth={drawerWidth}
        draftFixedLocationEnabled={draftFixedLocationEnabled}
        draftFixedLocationText={draftFixedLocationText}
        locationSource={locationSource}
        onApplyLocationSettings={applyLocationSettings}
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
      <SafeAreaProvider>
        <SafeAreaView
          edges={['left', 'right']}
          style={styles.screen}
          {...settingsPanResponder.panHandlers}
        >
          <ExpoStatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <View style={styles.centered}>
            <Pressable
              style={styles.primaryButton}
              onPress={openSystemSettings}
              testID="permission-open-system-settings-button"
            >
              <Text style={styles.primaryButtonText}>Standort-Einstellungen öffnen</Text>
            </Pressable>
          </View>
          {renderSettingsMenu()}
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (phase !== 'ready' || !weather || !roads || !outside) {
    const isError = phase === 'error';

    return (
      <SafeAreaProvider>
        <SafeAreaView
          edges={['left', 'right']}
          style={styles.screen}
          {...settingsPanResponder.panHandlers}
        >
          <ExpoStatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <View style={styles.centered}>
            {isError ? (
              <>
                <Text style={styles.errorTitle}>Daten nicht verfügbar</Text>
                <Text style={styles.errorText}>
                  {errorMessage ?? 'Standortdaten konnten nicht geladen werden.'}
                </Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => syncData('initial')}
                  testID="retry-sync-button"
                >
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
      </SafeAreaProvider>
    );
  }

  const introTranslateY = readyIntro.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={['left', 'right']}
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
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
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
                  locationLabel={currentLocationLabel}
                  onOpenSettings={openSettingsMenu}
                  outside={outside}
                  scrollY={scrollY}
                  styles={styles}
                  theme={theme}
                  viewportHeight={viewportHeight}
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
                <WeatherPage
                  locationLabel={currentLocationLabel}
                  onOpenSettings={openSettingsMenu}
                  scrollY={scrollY}
                  styles={styles}
                  viewportHeight={viewportHeight}
                  weather={weather}
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
                index={PAGE_INDEX.roads}
                scrollY={scrollY}
                styles={styles}
                viewportHeight={viewportHeight}
              >
                <RoadsPage
                  locationLabel={currentLocationLabel}
                  onOpenSettings={openSettingsMenu}
                  roads={roads}
                  scrollY={scrollY}
                  styles={styles}
                  theme={theme}
                  viewportHeight={viewportHeight}
                />
              </PageFrame>
            </Animated.View>
          </View>
        </Animated.ScrollView>
        {renderSettingsMenu()}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
