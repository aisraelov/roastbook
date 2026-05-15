import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';

type Props = {
  color: string;
  size?: number;
  pulse?: boolean;
};

// A small colored dot. If `pulse` is true, it does a soft glow halo loop;
// otherwise it sits still.
export function PulseDot({ color, size = 7, pulse = false }: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (pulse) {
      scale.value = withRepeat(
        withTiming(2.4, { duration: 900 }),
        -1,
        true,
      );
      opacity.value = withRepeat(
        withTiming(0, { duration: 900 }),
        -1,
        true,
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size,
            backgroundColor: color,
          },
          haloStyle,
        ]}
      />
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
        }}
      />
    </Animated.View>
  );
}
