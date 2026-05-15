import React, { useEffect } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { theme, modeColor } from './theme';
import { useStore } from '../store';
import type { Mode } from '../types';
import { PressyButton } from './anim/PressyButton';
import { PulseDot } from './anim/PulseDot';

type Props = {
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenLogs: () => void;
  onOpenCaptures: () => void;
};

export function TopBar({ onConnect, onDisconnect, onOpenLogs, onOpenCaptures }: Props) {
  const presence = useStore((s) => s.presence);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  const connected = presence.state === 'connected';
  const scanning = presence.state === 'scanning' || presence.state === 'connecting';
  const dot =
    presence.state === 'connected'
      ? theme.green
      : scanning
        ? theme.yellow
        : presence.state === 'error'
          ? theme.accent
          : theme.fadeMuted;

  const statusLabel =
    presence.state === 'connected'
      ? `LIVE · ${presence.deviceModel ?? 'Mentra Live'} · ${presence.batteryLevel ?? '—'}%`
      : presence.state === 'scanning'
        ? 'SCANNING'
        : presence.state === 'connecting'
          ? 'CONNECTING'
          : presence.state === 'error'
            ? `ERROR · ${presence.message}`
            : 'OFFLINE';

  // Logo gets a tiny wiggle every ~15s for life.
  const logoTilt = useSharedValue(0);
  useEffect(() => {
    const tick = () => {
      logoTilt.value = withSequence(
        withTiming(-3, { duration: 80 }),
        withSpring(2, { damping: 4, stiffness: 320 }),
        withSpring(0, { damping: 7, stiffness: 200 }),
      );
    };
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, []);
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${logoTilt.value}deg` }],
  }));

  // Status pill glow when connected.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (connected) {
      glow.value = withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(glow);
      glow.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(glow);
  }, [connected]);
  const pillStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.2 + glow.value * 0.5,
    shadowRadius: 6 + glow.value * 8,
  }));

  const mode = settings.mode;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Animated.Text style={[styles.logo, logoStyle]}>ROASTBOOK</Animated.Text>
        <View style={styles.pillStack}>
          <PressyButton onPress={onOpenLogs} haptic="light">
            <Animated.View
              style={[
                styles.statusPill,
                { shadowColor: dot },
                pillStyle,
              ]}>
              <PulseDot color={dot} pulse={scanning} />
              <Text style={styles.statusText}>{statusLabel}</Text>
            </Animated.View>
          </PressyButton>
          <PressyButton onPress={onOpenCaptures} haptic="light">
            <View style={styles.miniPill}>
              <Text style={styles.miniPillText}>🎙 WAVS</Text>
            </View>
          </PressyButton>
        </View>
      </View>

      <ModeToggle
        mode={mode}
        onChange={(m) => setSettings({ mode: m })}
      />

      <View style={styles.row2}>
        <PressyButton
          onPress={connected ? onDisconnect : onConnect}
          haptic="heavy"
          wiggle>
          <View
            style={[
              styles.cta,
              { backgroundColor: connected ? theme.accent : theme.green },
            ]}>
            <Text style={[styles.ctaText, { color: connected ? '#fff' : '#06120a' }]}>
              {connected ? 'STOP' : 'CONNECT'}
            </Text>
          </View>
        </PressyButton>
        <View style={styles.toggleGroup}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>MIC</Text>
            <Switch
              value={settings.micEnabled}
              onValueChange={(v) => setSettings({ micEnabled: v })}
              thumbColor="#fff"
              trackColor={{ false: theme.borderSoft, true: theme.green }}
            />
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>READ ALOUD</Text>
            <Switch
              value={settings.ttsAloud}
              onValueChange={(v) => setSettings({ ttsAloud: v })}
              thumbColor="#fff"
              trackColor={{ false: theme.borderSoft, true: theme.hyde }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  const isJekyll = mode === 'jekyll';
  const isHyde = mode === 'hyde';
  const [trackWidth, setTrackWidth] = React.useState(0);
  const jekyllStyle = modeColor('jekyll');
  const hydeStyle = modeColor('hyde');

  // Slide the colored highlight between the two halves.
  const slide = useSharedValue(0);
  useEffect(() => {
    slide.value = withSpring(isHyde ? 0 : 1, { damping: 14, stiffness: 220 });
  }, [isHyde]);
  const highlightStyle = useAnimatedStyle(() => {
    const half = Math.max(0, (trackWidth - 8) / 2);
    return {
      transform: [{ translateX: slide.value * half }],
    };
  });

  return (
    <View
      style={styles.modeWrap}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.modeHighlight,
          { backgroundColor: isHyde ? hydeStyle.fg : jekyllStyle.fg },
          highlightStyle,
        ]}
      />
      <PressyButton style={styles.modeBtn} onPress={() => onChange('hyde')} haptic="medium">
        <Text style={[styles.modeLabel, { color: isHyde ? '#000' : theme.muted }]}>
          🔥 HYDE
        </Text>
        <Text style={[styles.modeSub, { color: isHyde ? 'rgba(0,0,0,0.6)' : theme.fadeMuted }]}>
          ROAST
        </Text>
      </PressyButton>
      <PressyButton style={styles.modeBtn} onPress={() => onChange('jekyll')} haptic="medium">
        <Text style={[styles.modeLabel, { color: isJekyll ? '#000' : theme.muted }]}>
          ✨ JEKYLL
        </Text>
        <Text style={[styles.modeSub, { color: isJekyll ? 'rgba(0,0,0,0.6)' : theme.fadeMuted }]}>
          HYPE
        </Text>
      </PressyButton>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: theme.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 12,
  },
  logo: {
    color: theme.ink,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 2.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.bgElev,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusText: {
    color: theme.muted,
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  cta: {
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  ctaText: { fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  toggleGroup: {
    flex: 1,
    gap: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toggleLabel: {
    color: theme.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  pillStack: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  miniPill: {
    backgroundColor: theme.bgElev,
    borderColor: theme.border,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  miniPillText: {
    color: theme.muted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modeWrap: {
    marginTop: 12,
    flexDirection: 'row',
    backgroundColor: theme.bgElev,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: theme.border,
    position: 'relative',
    overflow: 'hidden',
  },
  modeHighlight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    right: '50%',
    borderRadius: 10,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeLabel: {
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.5,
  },
  modeSub: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 2,
  },
});
