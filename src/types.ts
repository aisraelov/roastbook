export type PersonId = string;

export type Person = {
  id: PersonId;
  label: string;
  voiceEmbedding?: number[];
  faceEmbedding?: number[];
  utteranceCount: number;
  faceCount: number;
  lastSeenAt: number;
  isMe?: boolean;
};

export type TranscriptTurn = {
  id: string;
  text: string;
  startedAt: number;
  endedAt: number;
  personId?: PersonId;
  confidence?: number;
};

export type PhotoSnap = {
  id: string;
  fileUri: string;
  byteCount: number;
  capturedAt: number;
  facePersonIds: PersonId[];
};

export type Roast = {
  id: string;
  text: string;
  createdAt: number;
  basedOnPhotoId?: string;
  basedOnTurnIds: string[];
  spoken: boolean;
  mode: Mode;
};

export type FeedItem =
  | { kind: 'turn'; at: number; turn: TranscriptTurn }
  | { kind: 'photo'; at: number; photo: PhotoSnap }
  | { kind: 'roast'; at: number; roast: Roast };

export type GlassesPresence =
  | { state: 'idle' }
  | { state: 'scanning' }
  | { state: 'connecting' }
  | { state: 'connected'; deviceModel?: string; batteryLevel?: number }
  | { state: 'error'; message: string };

export type Mode = 'hyde' | 'jekyll';

export type MicCapture = {
  id: string;
  at: number;
  fileUri: string;
  durationSeconds: number;
  peakDb: number;
  rmsDb: number;
  vadSegments: number;
  transcript?: string;
  dropped?: 'vad-empty' | 'empty' | 'hallucination';
};

export type LogEntry = {
  id: string;
  at: number;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
};

export type Settings = {
  ttsAloud: boolean;
  micEnabled: boolean;
  autoPhotoSeconds: number;
  roastEverySeconds: number;
  facesEnabled: boolean;
  mode: Mode;
};
