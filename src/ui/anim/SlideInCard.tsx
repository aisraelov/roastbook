import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { ViewStyle, StyleProp } from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // When true, the card does an extra wiggle on first mount.
  hype?: boolean;
};

// Card that slides in from the right, springs into place, and (in hype mode)
// gives a quick rotational wiggle for emphasis. Used for new roast cards.
export function SlideInCard({ children, style, hype = false }: Props) {
  const translateX = useSharedValue(60);
  const scale = useSharedValue(0.92);
  const rotate = useSharedValue(hype ? -6 : 0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withSpring(0, { damping: 11, stiffness: 140 });
    opacity.value = withTiming(1, { duration: 220 });
    scale.value = withSpring(1, { damping: 10, stiffness: 180 });
    if (hype) {
      rotate.value = withSequence(
        withTiming(-6, { duration: 60 }),
        withSpring(4, { damping: 5, stiffness: 280 }),
        withSpring(0, { damping: 7, stiffness: 220 }),
      );
    }
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
      { rotateZ: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
