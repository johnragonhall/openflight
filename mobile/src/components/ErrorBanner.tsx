import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { R } from '../theme';
import { useThemeColors, type Palette } from '../state/useThemeColors';
import { useFontScale } from '../state/useFontScale';
import { useT } from '../i18n/useT';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorBanner = React.memo(function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const C = useThemeColors();
  const { scale } = useFontScale();
  const t = useT();
  const styles = useMemo(() => makeStyles(C, scale), [C, scale]);
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={styles.indicator} />
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      {onDismiss && (
        <PressableScale
          onPress={onDismiss}
          scale={0.88}
          style={styles.dismissBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('a11yDismissError')}
        >
          <Text style={styles.dismiss}>✕</Text>
        </PressableScale>
      )}
    </View>
  );
});

const makeStyles = (C: Palette, scale: (n: number) => number) => StyleSheet.create({
  banner: {
    backgroundColor: C.errDim,
    borderWidth: 1,
    borderColor: C.err,
    borderRadius: R.sm,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.err,
    flexShrink: 0,
  },
  message: { color: C.errText, fontSize: scale(13), flex: 1, lineHeight: 18 },
  dismissBtn: { alignItems: 'center', justifyContent: 'center' },
  dismiss: { color: C.err, fontSize: scale(14), fontWeight: '700' },
});
