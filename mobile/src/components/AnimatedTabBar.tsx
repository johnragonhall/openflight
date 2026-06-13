import React, { useEffect, useRef } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { C } from '../theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { on: IoniconName; off: IoniconName }> = {
  Live:     { on: 'radio',       off: 'radio-outline' },
  History:  { on: 'time',        off: 'time-outline' },
  Stats:    { on: 'stats-chart', off: 'stats-chart-outline' },
  Range:    { on: 'flag',        off: 'flag-outline' },
  Settings: { on: 'settings',    off: 'settings-outline' },
};

const TAB_H = 52;

export function AnimatedTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabCount = state.routes.length;
  const tabWidth = width / tabCount;

  // Sliding indicator
  const indicatorX = useRef(new Animated.Value(state.index * tabWidth)).current;

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  }, [state.index, tabWidth]);

  // Per-tab press scale
  const scaleAnims = useRef(
    state.routes.map(() => new Animated.Value(1)),
  ).current;

  const handlePress = (index: number, routeKey: string, routeName: string) => {
    const isFocused = state.index === index;

    // Spring the icon
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

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_H + insets.bottom }]}>
      {/* Sliding top indicator */}
      <Animated.View
        style={[
          styles.indicator,
          { width: tabWidth, transform: [{ translateX: indicatorX }] },
        ]}
      />

      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const icons = TAB_ICONS[route.name];
        let iconName: IoniconName = 'help-circle-outline';
        if (icons) iconName = isFocused ? icons.on : icons.off;

        return (
          <Pressable
            key={route.key}
            onPress={() => handlePress(index, route.key, route.name)}
            style={styles.tab}
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
              {route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: C.s0,
    borderTopWidth: 1,
    borderTopColor: C.line,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    height: 2,
    backgroundColor: C.accent,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
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
    fontSize: 10,
    fontWeight: '500',
    color: C.sub,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: C.accent,
    fontWeight: '700',
  },
});
