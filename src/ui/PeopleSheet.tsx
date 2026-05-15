import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme, colorForPerson } from './theme';
import { useStore } from '../store';
import type { Person } from '../types';

export function PeopleSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const people = useStore((s) => s.people);
  const rename = useStore((s) => s.renamePerson);
  const setMe = useStore((s) => s.setMe);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () =>
      Object.values(people).sort((a, b) =>
        a.lastSeenAt > b.lastSeenAt ? 1 : -1,
      ),
    [people],
  );

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>PEOPLE</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll}>
            {sorted.length === 0 ? (
              <Text style={styles.empty}>
                no one identified yet. start talking, take some pictures.
              </Text>
            ) : (
              sorted.map((p, i) => (
                <PersonRow
                  key={p.id}
                  index={i}
                  person={p}
                  value={edits[p.id] ?? p.label}
                  onChange={(v) =>
                    setEdits((prev) => ({ ...prev, [p.id]: v }))
                  }
                  onCommit={(v) => {
                    rename(p.id, v.trim() || p.label);
                  }}
                  onSetMe={() => setMe(p.id)}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PersonRow({
  index,
  person,
  value,
  onChange,
  onCommit,
  onSetMe,
}: {
  index: number;
  person: Person;
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  onSetMe: () => void;
}) {
  const color = colorForPerson(index);
  return (
    <View style={styles.row}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          onBlur={() => onCommit(value)}
          style={[styles.input, { color }]}
        />
        <Text style={styles.meta}>
          {person.utteranceCount} utt · {person.faceCount} faces · last{' '}
          {Math.round((Date.now() - person.lastSeenAt) / 1000)}s ago
          {person.isMe ? ' · YOU' : ''}
        </Text>
      </View>
      {!person.isMe ? (
        <Pressable onPress={onSetMe} style={styles.meBtn}>
          <Text style={styles.meBtnText}>I'M THIS</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  title: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  close: { color: theme.muted, fontSize: 30, fontWeight: '300' },
  scroll: { paddingHorizontal: 14 },
  empty: {
    color: theme.muted,
    paddingVertical: 30,
    textAlign: 'center',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bgElev,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 8,
    borderColor: theme.borderSoft,
    borderWidth: 1,
  },
  swatch: { width: 12, height: 12, borderRadius: 999 },
  input: {
    fontSize: 16,
    fontWeight: '800',
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  meta: { color: theme.fadeMuted, fontSize: 10, marginTop: 2 },
  meBtn: {
    backgroundColor: theme.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  meBtnText: { color: theme.ink, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
});
