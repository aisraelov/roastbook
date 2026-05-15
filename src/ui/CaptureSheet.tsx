import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { theme } from './theme';
import { useStore } from '../store';
import type { MicCapture } from '../types';

const DROPPED_LABEL: Record<string, string> = {
  'vad-empty': 'VAD: no speech',
  'empty': 'Whisper: empty',
  'hallucination': 'Whisper: repeat loop',
};

export function CaptureSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const captures = useStore((s) => s.captures);
  const reversed = [...captures].reverse();
  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>MIC CAPTURES</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            tap a row to play back. drops are kept too so you can hear what whisper rejected.
          </Text>
          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 30 }}>
            {reversed.length === 0 ? (
              <Text style={styles.empty}>
                no captures yet. connect glasses, talk, and they'll appear here.
              </Text>
            ) : (
              reversed.map((c) => (
                <CaptureRow
                  key={c.id}
                  capture={c}
                  playing={playingId === c.id}
                  onPlay={() => setPlayingId(c.id)}
                  onStop={() => setPlayingId(null)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CaptureRow({
  capture,
  playing,
  onPlay,
  onStop,
}: {
  capture: MicCapture;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  const player = useAudioPlayer({ uri: capture.fileUri });
  const status = useAudioPlayerStatus(player);

  const togglePlay = () => {
    if (playing) {
      player.pause();
      onStop();
      return;
    }
    player.seekTo(0);
    player.play();
    onPlay();
  };

  React.useEffect(() => {
    if (playing && status.didJustFinish) {
      onStop();
    }
  }, [playing, status.didJustFinish, onStop]);

  const status_label = capture.dropped
    ? DROPPED_LABEL[capture.dropped] ?? capture.dropped
    : capture.transcript
      ? 'transcribed ✓'
      : 'pending';

  const tint = capture.dropped
    ? theme.fadeMuted
    : capture.transcript
      ? theme.green
      : theme.muted;

  const time = new Date(capture.at).toLocaleTimeString([], { hour12: false });
  const cur = status.currentTime ?? 0;

  return (
    <Pressable
      onPress={togglePlay}
      style={[styles.row, playing && { borderColor: theme.green }]}>
      <View style={styles.rowHead}>
        <Text style={[styles.playIcon, { color: tint }]}>
          {playing ? '⏸' : '▶'}
        </Text>
        <Text style={styles.rowTime}>{time}</Text>
        <Text style={[styles.rowStatus, { color: tint }]}>{status_label}</Text>
      </View>
      <Text style={styles.rowMeta}>
        {capture.durationSeconds.toFixed(2)}s · peak {capture.peakDb.toFixed(1)}dBFS · rms{' '}
        {capture.rmsDb.toFixed(1)}dBFS · vad {capture.vadSegments}
      </Text>
      {capture.transcript ? (
        <Text style={styles.transcript} numberOfLines={3}>
          “{capture.transcript}”
        </Text>
      ) : null}
      {playing ? (
        <Text style={styles.progress}>
          {cur.toFixed(2)}s / {capture.durationSeconds.toFixed(2)}s
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '90%',
    paddingBottom: 30,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: { color: theme.ink, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  close: { color: theme.muted, fontSize: 30, fontWeight: '300' },
  subtitle: {
    color: theme.muted,
    fontSize: 11,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  list: { paddingHorizontal: 12 },
  empty: { color: theme.muted, textAlign: 'center', paddingVertical: 40 },
  row: {
    backgroundColor: theme.bgElev,
    borderColor: theme.borderSoft,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  playIcon: { fontSize: 18, fontWeight: '900', width: 22 },
  rowTime: { color: theme.fadeMuted, fontSize: 11, fontFamily: 'Courier' },
  rowStatus: {
    marginLeft: 'auto',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  rowMeta: { color: theme.muted, fontSize: 10, fontFamily: 'Courier' },
  transcript: {
    color: theme.ink,
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  progress: {
    color: theme.green,
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'Courier',
  },
});
