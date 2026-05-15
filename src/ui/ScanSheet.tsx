import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme } from './theme';
import { useStore } from '../store';

type Props = {
  visible: boolean;
  onClose: () => void;
  onStartScan: () => void;
  onPick: (d: { id: string; name: string; model: string }) => void;
};

export function ScanSheet({ visible, onClose, onStartScan, onPick }: Props) {
  const scanning = useStore((s) => s.scanning);
  const results = useStore((s) => s.scanResults);
  const presence = useStore((s) => s.presence);

  useEffect(() => {
    if (visible) {
      onStartScan();
    }
  }, [visible]);

  const sorted = [...results].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>NEARBY GLASSES</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            {scanning ? (
              <>
                <ActivityIndicator color={theme.green} />
                <Text style={styles.statusText}>scanning for Mentra Live…</Text>
              </>
            ) : presence.state === 'connecting' ? (
              <>
                <ActivityIndicator color={theme.yellow} />
                <Text style={styles.statusText}>connecting…</Text>
              </>
            ) : (
              <Text style={styles.statusText}>
                {results.length > 0 ? 'tap a device to connect' : 'no devices found yet'}
              </Text>
            )}
            <Pressable onPress={onStartScan} style={styles.refreshBtn}>
              <Text style={styles.refreshText}>↻ RESCAN</Text>
            </Pressable>
          </View>

          {presence.state === 'error' ? (
            <Text style={styles.error}>error: {presence.message}</Text>
          ) : null}

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 30 }}>
            {sorted.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>nothing in range</Text>
                <Text style={styles.emptyBody}>
                  power on your Mentra Live, keep it close to the phone,
                  {'\n'}and make sure no other app has it connected.
                </Text>
              </View>
            ) : (
              sorted.map((d) => (
                <Pressable
                  key={d.id}
                  style={styles.row}
                  onPress={() => onPick(d)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{d.name || '(no name)'}</Text>
                    <Text style={styles.rowMeta}>
                      {d.model} · {d.id.slice(0, 12)}…
                    </Text>
                  </View>
                  <Text style={[styles.rssi, rssiColor(d.rssi)]}>
                    {d.rssi != null ? `${d.rssi} dBm` : '—'}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function rssiColor(rssi?: number) {
  if (rssi == null) return { color: theme.muted };
  if (rssi > -55) return { color: theme.green };
  if (rssi > -75) return { color: theme.yellow };
  return { color: theme.hyde };
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
    maxHeight: '85%',
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  statusText: { color: theme.muted, fontSize: 12, flex: 1 },
  refreshBtn: {
    backgroundColor: theme.bgElev,
    borderColor: theme.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshText: { color: theme.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  error: {
    color: theme.accent,
    fontSize: 12,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  list: { paddingHorizontal: 14 },
  empty: { paddingVertical: 50, alignItems: 'center' },
  emptyTitle: {
    color: theme.fadeMuted,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  emptyBody: { color: theme.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgElev,
    borderColor: theme.borderSoft,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
  },
  rowName: { color: theme.ink, fontSize: 15, fontWeight: '800' },
  rowMeta: { color: theme.fadeMuted, fontSize: 11, marginTop: 2, fontFamily: 'Courier' },
  rssi: { fontSize: 12, fontWeight: '900', fontFamily: 'Courier' },
});
