export enum AppStatus {
  IDLE = 'IDLE', // Free play, not in conversation
  LISTENING = 'LISTENING', // Said "Lynx", recording voice and MIDI
  THINKING = 'THINKING', // Said "Answer", processing with Gemini
  REPLYING = 'REPLYING', // AI is responding and/or visualizing notes
}

export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'notes'; notes: string[][]; originalText: string }; // notes is an array of steps (chords/notes)

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  parts: MessagePart[];
  sources?: { uri: string; title: string }[];
}

export interface MidiNoteEvent {
  timestamp: number;
  noteName: string; // e.g., "C#4"
  midiNumber: number; // e.g., 61
  velocity: number; // 0-1
  duration?: number; // in seconds
  type: 'noteon' | 'noteoff';
}