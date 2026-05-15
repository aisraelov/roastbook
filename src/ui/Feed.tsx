import React, { useEffect, useMemo, useRef } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { theme, colorForPerson, modeColor } from './theme';
import { useStore } from '../store';
import type { FeedItem, Person } from '../types';
import { SlideInCard } from './anim/SlideInCard';

function timeStr(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function Feed() {
  const turns = useStore((s) => s.turns);
  const photos = useStore((s) => s.photos);
  const roasts = useStore((s) => s.roasts);
  const partial = useStore((s) => s.partialTranscript);
  const people = useStore((s) => s.people);
  const scrollRef = useRef<ScrollView>(null);

  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [
      ...turns.map((t) => ({ kind: 'turn' as const, at: t.endedAt, turn: t })),
      ...photos.map((p) => ({
        kind: 'photo' as const,
        at: p.capturedAt,
        photo: p,
      })),
      ...roasts.map((r) => ({
        kind: 'roast' as const,
        at: r.createdAt,
        roast: r,
      })),
    ];
    items.sort((a, b) => a.at - b.at);
    return items;
  }, [turns, photos, roasts]);

  const personIndex = useMemo(() => {
    const arr = Object.values(people).sort((a, b) =>
      a.lastSeenAt > b.lastSeenAt ? 1 : -1,
    );
    const idx: Record<string, number> = {};
    arr.forEach((p, i) => (idx[p.id] = i));
    return idx;
  }, [people]);

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [feed.length]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}>
      {feed.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>nothing yet</Text>
          <Text style={styles.emptySub}>
            connect your glasses, and I'll start narrating your life.
            {'\n'}
            try not to live a boring one.
          </Text>
        </View>
      ) : (
        feed.map((item, i) => {
          if (item.kind === 'turn') {
            const t = item.turn;
            const person: Person | undefined = t.personId
              ? people[t.personId]
              : undefined;
            const color = person
              ? colorForPerson(personIndex[person.id] ?? 0)
              : theme.muted;
            const label = person?.label ?? 'Voice';
            return (
              <SlideInCard key={`t-${t.id}`} style={styles.turn}>
                <View style={styles.turnHead}>
                  <View style={[styles.speakerDot, { backgroundColor: color }]} />
                  <Text style={[styles.speakerLabel, { color }]}>{label}</Text>
                  <Text style={styles.meta}>{timeStr(t.endedAt)}</Text>
                </View>
                <Text style={styles.turnText}>{t.text}</Text>
              </SlideInCard>
            );
          }
          if (item.kind === 'photo') {
            const p = item.photo;
            const facePerson = p.facePersonIds[0]
              ? people[p.facePersonIds[0]]
              : null;
            return (
              <SlideInCard key={`p-${p.id}`} style={styles.photoCard}>
                <Image
                  source={{ uri: p.fileUri }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoMeta}>📸 {timeStr(p.capturedAt)}</Text>
                  {facePerson ? (
                    <Text
                      style={[
                        styles.photoFace,
                        {
                          color: colorForPerson(personIndex[facePerson.id] ?? 0),
                        },
                      ]}>
                      {facePerson.label}
                    </Text>
                  ) : null}
                </View>
              </SlideInCard>
            );
          }
          const r = item.roast;
          const mc = modeColor(r.mode);
          return (
            <SlideInCard
              key={`r-${r.id}`}
              hype
              style={[styles.roastCard, { backgroundColor: mc.bg, borderColor: mc.fg }]}>
              <Text style={[styles.roastEyebrow, { color: mc.fg }]}>
                {r.mode === 'jekyll' ? 'JEKYLL' : 'HYDE'} · {timeStr(r.createdAt)}
                {r.spoken ? ' · 🔊' : ''}
              </Text>
              <Text style={styles.roastText}>{r.text}</Text>
            </SlideInCard>
          );
        })
      )}

      {partial ? (
        <View style={styles.partial}>
          <Text style={styles.partialLabel}>… hearing</Text>
          <Text style={styles.partialText}>{partial}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.bg },
  content: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 220, gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 100, gap: 10 },
  emptyTitle: {
    color: theme.fadeMuted,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  emptySub: {
    color: theme.muted,
    textAlign: 'center',
    lineHeight: 19,
    fontSize: 13,
    paddingHorizontal: 30,
  },
  turn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.bgElev,
    borderColor: theme.borderSoft,
    borderWidth: 1,
    borderRadius: 14,
  },
  turnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  speakerDot: { width: 7, height: 7, borderRadius: 999 },
  speakerLabel: {
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  meta: {
    color: theme.fadeMuted,
    marginLeft: 'auto',
    fontSize: 10,
    fontFamily: 'Courier',
  },
  turnText: { color: theme.ink, fontSize: 15, lineHeight: 21 },
  photoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: theme.bgElev,
    borderColor: theme.borderSoft,
    borderWidth: 1,
    aspectRatio: 4 / 3,
  },
  photo: { width: '100%', height: '100%' },
  photoOverlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  photoMeta: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: '#fff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
  },
  photoFace: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  roastCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  roastEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  roastText: { color: theme.ink, fontSize: 17, lineHeight: 23, fontWeight: '600' },
  partial: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.border,
  },
  partialLabel: {
    color: theme.fadeMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  partialText: { color: theme.muted, fontSize: 14, fontStyle: 'italic' },
});
