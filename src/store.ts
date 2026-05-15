import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type {
  FeedItem,
  GlassesPresence,
  LogEntry,
  MicCapture,
  Person,
  PersonId,
  PhotoSnap,
  Roast,
  Settings,
  TranscriptTurn,
} from './types';

const MAX_FEED = 400;

export type StoreState = {
  presence: GlassesPresence;
  settings: Settings;
  turns: TranscriptTurn[];
  photos: PhotoSnap[];
  roasts: Roast[];
  people: Record<PersonId, Person>;
  partialTranscript: string;
  micPcmBytes: number;
  lastError: string | null;
  logs: LogEntry[];
  scanResults: Array<{ id: string; name: string; model: string; rssi?: number }>;
  scanning: boolean;
  captures: MicCapture[];

  setPresence: (p: GlassesPresence) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setPartial: (text: string) => void;
  bumpPcm: (n: number) => void;
  setError: (m: string | null) => void;
  log: (level: LogEntry['level'], source: string, message: string) => void;
  setScanResults: (devices: Array<{ id: string; name: string; model: string; rssi?: number }>) => void;
  setScanning: (v: boolean) => void;
  addCapture: (c: Omit<MicCapture, 'id'>) => MicCapture;
  updateCapture: (id: string, patch: Partial<MicCapture>) => void;

  addTurn: (turn: Omit<TranscriptTurn, 'id'>) => TranscriptTurn;
  addPhoto: (photo: Omit<PhotoSnap, 'id'>) => PhotoSnap;
  attachFacesToPhoto: (photoId: string, personIds: PersonId[]) => void;
  addRoast: (roast: Omit<Roast, 'id'>) => Roast;
  markRoastSpoken: (id: string) => void;

  upsertPerson: (p: Person) => void;
  renamePerson: (id: PersonId, label: string) => void;
  setMe: (id: PersonId) => void;

  getFeed: () => FeedItem[];
  reset: () => void;
};

export const useStore = create<StoreState>((set, get) => ({
  presence: { state: 'idle' },
  settings: {
    ttsAloud: false,
    micEnabled: true,
    autoPhotoSeconds: 10,
    roastEverySeconds: 12,
    facesEnabled: true,
    mode: 'hyde',
  },
  turns: [],
  photos: [],
  roasts: [],
  people: {},
  partialTranscript: '',
  micPcmBytes: 0,
  lastError: null,
  logs: [],
  scanResults: [],
  scanning: false,
  captures: [],

  setPresence: (presence) => set({ presence }),
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
  setPartial: (partialTranscript) => set({ partialTranscript }),
  bumpPcm: (n) => set((s) => ({ micPcmBytes: s.micPcmBytes + n })),
  setError: (lastError) => set({ lastError }),
  log: (level, source, message) => {
    const entry: LogEntry = {
      id: uuid(),
      at: Date.now(),
      level,
      source,
      message,
    };
    if (level === 'error') console.error(`[${source}] ${message}`);
    else if (level === 'warn') console.warn(`[${source}] ${message}`);
    else console.log(`[${source}] ${message}`);
    set((s) => ({ logs: [...s.logs.slice(-200), entry] }));
  },
  setScanResults: (scanResults) => set({ scanResults }),
  setScanning: (scanning) => set({ scanning }),
  addCapture: (input) => {
    const capture: MicCapture = { id: uuid(), ...input };
    set((s) => ({ captures: [...s.captures.slice(-40), capture] }));
    return capture;
  },
  updateCapture: (id, patch) =>
    set((s) => ({
      captures: s.captures.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  addTurn: (input) => {
    const turn: TranscriptTurn = { id: uuid(), ...input };
    set((s) => ({ turns: [...s.turns.slice(-MAX_FEED), turn] }));
    return turn;
  },
  addPhoto: (input) => {
    const photo: PhotoSnap = { id: uuid(), ...input };
    set((s) => ({ photos: [...s.photos.slice(-MAX_FEED), photo] }));
    return photo;
  },
  attachFacesToPhoto: (photoId, facePersonIds) => {
    set((s) => ({
      photos: s.photos.map((p) =>
        p.id === photoId ? { ...p, facePersonIds } : p,
      ),
    }));
  },
  addRoast: (input) => {
    const roast: Roast = { id: uuid(), ...input };
    set((s) => ({ roasts: [...s.roasts.slice(-MAX_FEED), roast] }));
    return roast;
  },
  markRoastSpoken: (id) => {
    set((s) => ({
      roasts: s.roasts.map((r) => (r.id === id ? { ...r, spoken: true } : r)),
    }));
  },

  upsertPerson: (p) => set((s) => ({ people: { ...s.people, [p.id]: p } })),
  renamePerson: (id, label) =>
    set((s) => {
      const existing = s.people[id];
      if (!existing) {
        return s;
      }
      return { people: { ...s.people, [id]: { ...existing, label } } };
    }),
  setMe: (id) =>
    set((s) => {
      const next: Record<PersonId, Person> = {};
      for (const [pid, person] of Object.entries(s.people)) {
        next[pid] = { ...person, isMe: pid === id };
      }
      return { people: next };
    }),

  getFeed: () => {
    const { turns, photos, roasts } = get();
    const items: FeedItem[] = [
      ...turns.map((t) => ({ kind: 'turn' as const, at: t.endedAt, turn: t })),
      ...photos.map((p) => ({ kind: 'photo' as const, at: p.capturedAt, photo: p })),
      ...roasts.map((r) => ({ kind: 'roast' as const, at: r.createdAt, roast: r })),
    ];
    items.sort((a, b) => a.at - b.at);
    return items.slice(-MAX_FEED);
  },
  reset: () =>
    set({
      turns: [],
      photos: [],
      roasts: [],
      people: {},
      partialTranscript: '',
      micPcmBytes: 0,
      lastError: null,
    }),
}));
