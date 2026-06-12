import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { C, R } from '../theme';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorBanner = React.memo(function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <View style={styles.banner}>
      <View style={styles.indicator} />
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
      {onDismiss && (
        <PressableScale onPress={onDismiss} scale={0.88} style={styles.dismissBtn} hitSlop={12}>
          <Text style={styles.dismiss}>✕</Text>
        </PressableScale>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
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
  message: { color: C.errText, fontSize: 13, flex: 1, lineHeight: 18 },
  dismissBtn: { alignItems: 'center', justifyContent: 'center' },
  dismiss: { color: C.err, fontSize: 14, fontWeight: '700' },
});
