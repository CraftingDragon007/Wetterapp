import { StyleSheet } from 'react-native';

import type { Theme } from './types';

export function createStyles(theme: Theme) {
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
    headerActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    headerLocation: {
      color: theme.muted,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 4,
    },
    headerTitleBlock: {
      flex: 1,
      paddingRight: 12,
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
      width: 22,
    },
    pageIndicator: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      height: 6,
      position: 'relative',
    },
    pageIndicatorHighlight: {
      backgroundColor: theme.accent,
      borderRadius: 3,
      height: 6,
      left: 0,
      position: 'absolute',
      top: 0,
      width: 22,
      zIndex: 1,
    },
    settingsButton: {
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 10,
      borderWidth: 1,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    settingsIcon: {
      gap: 4,
      width: 16,
    },
    settingsIconKnob: {
      backgroundColor: theme.accent,
      borderRadius: 2,
      height: 4,
      position: 'absolute',
      top: 0,
      width: 4,
    },
    settingsIconKnobBottom: {
      left: 9,
    },
    settingsIconKnobMiddle: {
      left: 4,
    },
    settingsIconKnobTop: {
      left: 1,
    },
    settingsIconRow: {
      height: 4,
      justifyContent: 'center',
      position: 'relative',
    },
    settingsIconTrack: {
      backgroundColor: theme.muted,
      borderRadius: 1,
      height: 2,
      width: '100%',
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
    settingsDrawerContent: {
      flex: 1,
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

export type Styles = ReturnType<typeof createStyles>;
