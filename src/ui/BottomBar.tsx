import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import { theme, modeColor } from './theme';
import { useStore } from '../store';
import { PressyButton } from './anim/PressyButton';

type Props = {
  onPhoto: () => void;
  onPeople: () => void;
  onRoast: () => void;
};

export function BottomBar({ onPhoto, onPeople, onRoast }: Props) {
  const peopleCount = useStore((s) => Object.keys(s.people).length);
  const turnsCount = useStore((s) => s.turns.length);
  const roastCount = useStore((s) => s.roasts.length);
  const mode = useStore((s) => s.settings.mode);
  const mc = modeColor(mode);
  const ctaLabel = mode === 'jekyll' ? '✨ HYPE NOW' : '🔥 ROAST NOW';

  // CTA "breathes" gently — subtle scale loop so it draws the eye.
  const breath = useSharedValue(1);
  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1.025, { duration: 1200 }),
        withTiming(0.985, { duration: 1200 }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, []);
  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));

  return (
    <View style={styles.wrap}>
      <PressyButton onPress={onPhoto} style={styles.btn} haptic="light">
        <Text style={styles.label}>📸 SNAP</Text>
      </PressyButton>
      <PressyButton
        onPress={onRoast}
        haptic="medium"
        wiggle
        style={{ flex: 1 }}>
        <Animated.View
          style={[
            styles.btn,
            styles.ctaBtn,
            { backgroundColor: mc.fg, borderColor: mc.fg, flex: undefined as any },
            breathStyle,
          ]}>
          <Text style={[styles.label, { color: '#000' }]}>{ctaLabel}</Text>
          <Text style={[styles.subLabel, { color: 'rgba(0,0,0,0.55)' }]}>
            {roastCount} so far
          </Text>
        </Animated.View>
      </PressyButton>
      <PressyButton onPress={onPeople} style={styles.btn} haptic="light">
        <Text style={styles.label}>👥 {peopleCount}</Text>
        <Text style={styles.subLabel}>{turnsCount} turns</Text>
      </PressyButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.bg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
    paddingBottom: 26,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    backgroundColor: theme.bgElev,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderColor: theme.border,
    borderWidth: 1,
  },
  ctaBtn: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: { color: theme.ink, fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  subLabel: { color: theme.fadeMuted, fontSize: 9, marginTop: 2, letterSpacing: 0.8 },
});
