import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setAudioModeAsync } from 'expo-audio';
import ConfettiCannon from 'react-native-confetti-cannon';
import { TopBar } from './ui/TopBar';
import { Feed } from './ui/Feed';
import { BottomBar } from './ui/BottomBar';
import { PeopleSheet } from './ui/PeopleSheet';
import { ScanSheet } from './ui/ScanSheet';
import { LogSheet } from './ui/LogSheet';
import { CaptureSheet } from './ui/CaptureSheet';
import { useGlassesSensors } from './sensors/useGlassesSensors';
import { assertKeysOrThrow, wireRoastTriggers } from './ai';
import { maybeRoast } from './ai/roast';
import { useStore } from './store';
import { theme } from './ui/theme';

export default function App() {
  const sensors = useGlassesSensors();
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [capturesOpen, setCapturesOpen] = useState(false);
  const [confettiCount, setConfettiCount] = useState(0);
  const seenRoastIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void setAudioModeAsync({
      // Play through the main speaker even when the silent switch is flipped.
      playsInSilentMode: true,
      // doNotMix → we own the audio route, iOS plays at full system volume
      // through the loudspeaker. mixWithOthers attenuates and sometimes
      // routes to the earpiece. We want loud.
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
      allowsRecording: true,
      allowsBackgroundRecording: true,
    }).catch(() => undefined);
    try {
      assertKeysOrThrow();
      useStore.getState().log('info', 'env', 'keys loaded');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      useStore.getState().log('error', 'env', msg);
      useStore.getState().setError(msg);
    }
    const off = wireRoastTriggers();

    // Auto-connect to last-paired glasses on launch.
    const t = setTimeout(() => {
      void sensors.connectDefault();
    }, 600);

    return () => {
      off();
      clearTimeout(t);
    };
  }, []);

  // Fire confetti every time a new roast lands.
  useEffect(() => {
    const unsub = useStore.subscribe((s) => {
      for (const r of s.roasts) {
        if (!seenRoastIdsRef.current.has(r.id)) {
          seenRoastIdsRef.current.add(r.id);
          setConfettiCount((c) => c + 1);
        }
      }
    });
    return () => unsub();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <TopBar
        onConnect={() => setScanOpen(true)}
        onDisconnect={() => void sensors.disconnect()}
        onOpenLogs={() => setLogsOpen(true)}
        onOpenCaptures={() => setCapturesOpen(true)}
      />
      <Feed />
      <BottomBar
        onPhoto={() => void sensors.takePhoto()}
        onPeople={() => setPeopleOpen(true)}
        onRoast={() => void maybeRoast('turn')}
      />
      <PeopleSheet visible={peopleOpen} onClose={() => setPeopleOpen(false)} />
      <ScanSheet
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onStartScan={() => void sensors.startScan()}
        onPick={(d) => {
          setScanOpen(false);
          void sensors.connectDevice(d);
        }}
      />
      <LogSheet visible={logsOpen} onClose={() => setLogsOpen(false)} />
      <CaptureSheet visible={capturesOpen} onClose={() => setCapturesOpen(false)} />

      {confettiCount > 0 ? (
        <ConfettiCannon
          key={confettiCount}
          count={120}
          origin={{ x: -10, y: 0 }}
          fadeOut
          autoStart
          fallSpeed={2800}
          explosionSpeed={420}
          colors={[
            theme.hyde,
            theme.jekyll,
            theme.green,
            theme.yellow,
            '#ff4ec3',
            '#9d6eff',
          ]}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0c' },
});
