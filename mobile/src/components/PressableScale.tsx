import React, { useCallback, useRef } from 'react';
import {
  Animated,
  StyleProp,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';

interface Props extends Omit<TouchableOpacityProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scale?: number;
}

export const PressableScale = React.memo(function PressableScale({
  children,
  scale = 0.97,
  style,
  onPressIn: outerPressIn,
  onPressOut: outerPressOut,
  ...rest
}: Props) {
  const anim = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(
    (e: Parameters<NonNullable<TouchableOpacityProps['onPressIn']>>[0]) => {
      Animated.spring(anim, {
        toValue: scale,
        useNativeDriver: true,
        speed: 120,
        bounciness: 0,
      }).start();
      outerPressIn?.(e);
    },
    [anim, scale, outerPressIn],
  );

  const onPressOut = useCallback(
    (e: Parameters<NonNullable<TouchableOpacityProps['onPressOut']>>[0]) => {
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 60,
        bounciness: 0,
      }).start();
      outerPressOut?.(e);
    },
    [anim, outerPressOut],
  );

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={style}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale: anim }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
});
