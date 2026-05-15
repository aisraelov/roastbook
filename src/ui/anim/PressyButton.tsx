import React from 'react';
import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  wiggle?: boolean;
};

// A Pressable that squishes when held, springs back on release, and fires a
// haptic on press-in. Optional 'wiggle' adds a tiny rotational jiggle on press.
export function PressyButton({
  style,
  haptic = 'light',
  wiggle = false,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotateZ: `${rotate.value}deg` },
    ],
  }));

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(0.92, { damping: 14, stiffness: 320 });
        if (wiggle) {
          rotate.value = withTiming(-2, { duration: 70 });
        }
        if (haptic !== 'none') {
          const map = {
            light: Haptics.ImpactFeedbackStyle.Light,
            medium: Haptics.ImpactFeedbackStyle.Medium,
            heavy: Haptics.ImpactFeedbackStyle.Heavy,
          } as const;
          void Haptics.impactAsync(map[haptic]);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 220 });
        if (wiggle) {
          rotate.value = withSpring(0, { damping: 6, stiffness: 250 });
        }
        onPressOut?.(e);
      }}>
      <Animated.View style={[style, animStyle]}>
        {typeof children === 'function' ? null : (children as React.ReactNode)}
      </Animated.View>
    </Pressable>
  );
}
