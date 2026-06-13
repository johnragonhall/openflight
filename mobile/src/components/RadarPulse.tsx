import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

interface RingProps {
  delay: number;
  size: number;
  color: string;
}

function PulseRing({ delay, size, color }: RingProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.08, 1] });
  const opacity = anim.interpolate({
    inputRange: [0, 0.12, 0.65, 1],
    outputRange: [0, 0.55, 0.18, 0],
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

interface Props {
  size?: number;
  color?: string;
  rings?: number;
  label?: string;
}

export function RadarPulse({ size = 160, color = C.accent, rings = 3, label }: Props) {
  return (
    <View style={styles.container}>
      <View style={[styles.ringWrap, { width: size, height: size }]}>
        {Array.from({ length: rings }, (_, i) => (
          <PulseRing key={i} delay={i * 750} size={size} color={color} />
        ))}
        <View style={[styles.centerDot, { backgroundColor: color }]} />
      </View>
      {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 20 },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  centerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
