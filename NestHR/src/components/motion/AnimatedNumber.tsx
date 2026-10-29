import React, { useEffect, useRef, useState } from 'react';
import { Easing, StyleProp, Text, TextStyle, Animated } from 'react-native';
import { useReduceMotion } from './useReduceMotion';
import { useFocusReplay } from './useFocusReplay';

interface Props {
  value: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
}

/** Counts up to `value`. JS-driven (text can't use the native driver). Ported from NestLeads. */
export default function AnimatedNumber({
  value,
  duration = 1400,
  style,
  prefix = '',
}: Props) {
  const reduce = useReduceMotion();
  const replay = useFocusReplay();
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduce || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, duration, reduce, replay, anim]);

  return (
    <Text style={style}>
      {Number.isFinite(value)
        ? prefix + display.toLocaleString('en-IN')
        : String(value)}
    </Text>
  );
}
