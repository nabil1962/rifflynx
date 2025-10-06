export const MIDI_BUFFER_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export const MIDI_SPLIT_POINT = 60; // C4 - separates left and right hand

export const PIANO_KEYS = [
  { note: 'A0', type: 'white' }, { note: 'A#0', type: 'black' }, { note: 'B0', type: 'white' },
  { note: 'C1', type: 'white' }, { note: 'C#1', type: 'black' }, { note: 'D1', type: 'white' }, { note: 'D#1', type: 'black' }, { note: 'E1', type: 'white' }, { note: 'F1', type: 'white' }, { note: 'F#1', type: 'black' }, { note: 'G1', type: 'white' }, { note: 'G#1', type: 'black' }, { note: 'A1', type: 'white' }, { note: 'A#1', type: 'black' }, { note: 'B1', type: 'white' },
  { note: 'C2', type: 'white' }, { note: 'C#2', type: 'black' }, { note: 'D2', type: 'white' }, { note: 'D#2', type: 'black' }, { note: 'E2', type: 'white' }, { note: 'F2', type: 'white' }, { note: 'F#2', type: 'black' }, { note: 'G2', type: 'white' }, { note: 'G#2', type: 'black' }, { note: 'A2', type: 'white' }, { note: 'A#2', type: 'black' }, { note: 'B2', type: 'white' },
  { note: 'C3', type: 'white' }, { note: 'C#3', type: 'black' }, { note: 'D3', type: 'white' }, { note: 'D#3', type: 'black' }, { note: 'E3', type: 'white' }, { note: 'F3', type: 'white' }, { note: 'F#3', type: 'black' }, { note: 'G3', type: 'white' }, { note: 'G#3', type: 'black' }, { note: 'A3', type: 'white' }, { note: 'A#3', type: 'black' }, { note: 'B3', type: 'white' },
  { note: 'C4', type: 'white' }, { note: 'C#4', type: 'black' }, { note: 'D4', type: 'white' }, { note: 'D#4', type: 'black' }, { note: 'E4', type: 'white' }, { note: 'F4', type: 'white' }, { note: 'F#4', type: 'black' }, { note: 'G4', type: 'white' }, { note: 'G#4', type: 'black' }, { note: 'A4', type: 'white' }, { note: 'A#4', type: 'black' }, { note: 'B4', type: 'white' },
  { note: 'C5', type: 'white' }, { note: 'C#5', type: 'black' }, { note: 'D5', type: 'white' }, { note: 'D#5', type: 'black' }, { note: 'E5', type: 'white' }, { note: 'F5', type: 'white' }, { note: 'F#5', type: 'black' }, { note: 'G5', type: 'white' }, { note: 'G#5', type: 'black' }, { note: 'A5', type: 'white' }, { note: 'A#5', type: 'black' }, { note: 'B5', type: 'white' },
  { note: 'C6', type: 'white' }, { note: 'C#6', type: 'black' }, { note: 'D6', type: 'white' }, { note: 'D#6', type: 'black' }, { note: 'E6', type: 'white' }, { note: 'F6', type: 'white' }, { note: 'F#6', type: 'black' }, { note: 'G6', type: 'white' }, { note: 'G#6', type: 'black' }, { note: 'A6', type: 'white' }, { note: 'A#6', type: 'black' }, { note: 'B6', type: 'white' },
  { note: 'C7', type: 'white' }, { note: 'C#7', type: 'black' }, { note: 'D7', type: 'white' }, { note: 'D#7', type: 'black' }, { note: 'E7', type: 'white' }, { note: 'F7', type: 'white' }, { note: 'F#7', type: 'black' }, { note: 'G7', type: 'white' }, { note: 'G#7', type: 'black' }, { note: 'A7', type: 'white' }, { note: 'A#7', type: 'black' }, { note: 'B7', type: 'white' },
  { note: 'C8', type: 'white' }
];

// Create a mapping from MIDI note number to a canonical note name (e.g., C#).
// This is the single source of truth for note identification, preventing sharp/flat ambiguity.
export const MIDI_NUMBER_TO_NOTE_NAME: { [key: number]: string } = {};
PIANO_KEYS.forEach((key, index) => {
    const midiNumber = 21 + index; // A0 is MIDI note 21
    MIDI_NUMBER_TO_NOTE_NAME[midiNumber] = key.note;
});