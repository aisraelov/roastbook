import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from './theme';
import { useStore } from '../store';

const LEVEL_COLOR = {
  info: theme.muted,
  warn: theme.yellow,
  error: theme.accent,
};

export function LogSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const logs = useStore((s) => s.logs);
  const reversed = [...logs].reverse();
  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>DEBUG LOG</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 30 }}>
            {reversed.length === 0 ? (
              <Text style={styles.empty}>no log entries yet.</Text>
            ) : (
              reversed.map((l) => (
                <View key={l.id} style={styles.row}>
                  <Text style={styles.time}>
                    {new Date(l.at).toLocaleTimeString([], { hour12: false })}
                  </Text>
                  <Text style={[styles.level, { color: LEVEL_COLOR[l.level] }]}>
                    {l.level.toUpperCase()}
                  </Text>
                  <Text style={styles.source}>{l.source}</Text>
                  <Text style={styles.msg} numberOfLines={6}>
                    {l.message}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    paddingBottom: 10,
  },
  title: { color: theme.ink, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  close: { color: theme.muted, fontSize: 30, fontWeight: '300' },
  list: { paddingHorizontal: 12 },
  empty: { color: theme.muted, textAlign: 'center', paddingVertical: 40 },
  row: {
    backgroundColor: theme.bgElev,
    borderColor: theme.borderSoft,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
    gap: 2,
  },
  time: { color: theme.fadeMuted, fontSize: 9, fontFamily: 'Courier' },
  level: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  source: { color: theme.blue, fontSize: 10, fontFamily: 'Courier' },
  msg: { color: theme.ink, fontSize: 11, fontFamily: 'Courier' },
});
