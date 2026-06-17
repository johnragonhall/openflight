import React, { useEffect, useRef } from 'react';
import {
  Animated, Platform, Pressable, StyleSheet, Text,
  useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { C, Glass } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useT, type TKey } from '../i18n/useT';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { on: IoniconName; off: IoniconName }> = {
  Live:      { on: 'radio',       off: 'radio-outline' },
  Analytics: { on: 'stats-chart', off: 'stats-chart-outline' },
  History:   { on: 'time',        off: 'time-outline' },
  Settings:  { on: 'settings',    off: 'settings-outline' },
};

const TAB_LABEL_KEYS: Record<string, TKey> = {
  Live: 'tabLive',
  Analytics: 'tabStats',
  History: 'tabHistory',
  Settings: 'settingsTitle',
};

const TAB_H = 52;

export function AnimatedTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabCount = state.routes.length;
  const tabWidth = width / tabCount;
  const reduceMotion = useReduceMotion();
  const t = useT();

  // Sliding indicator
  const indicatorX = useRef(new Animated.Value(state.index * tabWidth)).current;

  useEffect(() => {
    if (reduceMotion) {
      indicatorX.setValue(state.index * tabWidth);
      return;
    }
    Animated.spring(indicatorX, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  }, [state.index, tabWidth, reduceMotion, indicatorX]);

  // Per-tab press scale
  const scaleAnims = useRef(
    state.routes.map(() => new Animated.Value(1)),
  ).current;

  const handlePress = (index: number, routeKey: string, routeName: string) => {
    const isFocused = state.index === index;

    if (!reduceMotion) {
      Animated.sequence([
        Animated.spring(scaleAnims[index], {
          toValue: 0.82,
          useNativeDriver: true,
          speed: 50,
          bounciness: 0,
        }),
        Animated.spring(scaleAnims[index], {
          toValue: 1,
          useNativeDriver: true,
          speed: 24,
          bounciness: 6,
        }),
      ]).start();
    }

    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      navigation.navigate(routeName);
    }
  };

  const tabs = state.routes.map((route, index) => {
    const isFocused = state.index === index;
    const icons = TAB_ICONS[route.name];
    let iconName: IoniconName = 'help-circle-outline';
    if (icons) iconName = isFocused ? icons.on : icons.off;

    return (
      <Pressable
        key={route.key}
        onPress={() => handlePress(index, route.key, route.name)}
        style={styles.tab}
        android_ripple={{ color: 'rgba(212, 175, 55, 0.10)', borderless: false }}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={route.name}
      >
        <Animated.View
          style={[styles.iconWrap, { transform: [{ scale: scaleAnims[index] }] }]}
        >
          <Ionicons
            name={iconName}
            size={22}
            color={isFocused ? C.accent : C.sub}
          />
        </Animated.View>
        <Text style={[styles.label, isFocused && styles.labelActive]}>
          {TAB_LABEL_KEYS[route.name] ? t(TAB_LABEL_KEYS[route.name]!) : route.name}
        </Text>
      </Pressable>
    );
  });

  const barHeight = TAB_H + insets.bottom;

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: barHeight }]}>
      {/* Glass background - instrument glass with gold tint on iOS, elevated surface on Android */}
      {Platform.OS === 'ios' ? (
        <>
          <BlurView
            intensity={Glass.blurIntensity}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.glassOverlay]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidSurface]} />
      )}

      {/* Gold edge - top line of glass instrument panel */}
      <View style={styles.glassEdge} />

      {/* Sliding gold indicator */}
      <Animated.View
        style={[
          styles.indicator,
          { width: tabWidth, transform: [{ translateX: indicatorX }] },
        ]}
      />

      {tabs}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  // iOS: semi-transparent gold tint over blur substrate
  glassOverlay: {
    backgroundColor: Glass.overlayGold,
  },
  // Android: solid elevated surface with no blur
  androidSurface: {
    backgroundColor: Glass.androidBg,
  },
  // Gold hairline at top of bar - the glass instrument edge
  glassEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Glass.edgeGold,
    zIndex: 1,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    height: 2,
    backgroundColor: C.accent,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    zIndex: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    gap: 3,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: C.sub,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: C.accent,
    fontWeight: '700',
  },
});
