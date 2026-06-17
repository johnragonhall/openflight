import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text } from 'react-native';
import type { TextStyle } from 'react-native';

interface Props {
  value: number;
  formatter?: (v: number) => string;
  style?: TextStyle | TextStyle[];
  duration?: number;
  numberOfLines?: number;
}

export const AnimatedNumber = React.memo(function AnimatedNumber({
  value,
  formatter,
  style,
  duration = 380,
  numberOfLines,
}: Props) {
  const animVal = useRef(new Animated.Value(value)).current;
  const [displayed, setDisplayed] = useState(value);
  const isFirstRef = useRef(true);

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      setDisplayed(value);
      return;
    }
    const id = animVal.addListener(({ value: v }) => setDisplayed(v));
    const anim = Animated.timing(animVal, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start(() => animVal.removeListener(id));
    return () => {
      anim.stop();
      animVal.removeListener(id);
    };
  }, [value]);

  const text = formatter ? formatter(displayed) : String(Math.round(displayed));
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {text}
    </Text>
  );
});
