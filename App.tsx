import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppStatus, ChatMessage, MidiNoteEvent } from './types';
import { AppStatus as AppStatusEnum } from './types';
import { MIDI_BUFFER_DURATION_MS, IDLE_TIMEOUT_MS, MIDI_NUMBER_TO_NOTE_NAME } from './constants';
import { getAiResponse } from './services/geminiService';
import Piano from './components/Piano';
import Chat from './components/Chat';
import StatusIndicator from './components/StatusIndicator';
import Instructions from './components/Instructions';

// Declare Tone and WebMidi as they are loaded from a CDN
declare const Tone: any;
declare const WebMidi: any;

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatusEnum.IDLE);
  const statusRef = useRef(status);
  statusRef.current = status;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'ai', parts: [{ type: 'text', content: "Hello! I'm RiffLynx, your AI music sidekick. Play some notes on your MIDI keyboard, and I'll see them light up.\n\nWhen you're ready to chat, just say \"Lynx\" to get my attention." }] }
  ]);
  const [midiDevice, setMidiDevice] = useState<string | null>(null);
  const [userActiveNotes, setUserActiveNotes] = useState<Set<string>>(new Set());
  const midiBufferRef = useRef<MidiNoteEvent[]>([]);
  const idleTimerRef = useRef<number | null>(null);
  const [aiVisualizingNotes, setAiVisualizingNotes] = useState<Set<string>>(new Set());
  const [chatInputValue, setChatInputValue] = useState('');
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const currentQuestionRef = useRef<{ text: string, notes: string[] }>({ text: '', notes: [] });
  const synthRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const recognitionActiveRef = useRef(false);
  const midiTextInputBufferRef = useRef<MidiNoteEvent[]>([]);
  const midiTextInputTimerRef = useRef<number | null>(null);
  
  const stopAiVisualization = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Clears all scheduled events
    synthRef.current?.releaseAll();
    setAiVisualizingNotes(new Set()); // Force clear visuals immediately
  }, []);

  // Visualization for sequences (teleprompter). Returns total duration in ms.
  const playNoteSequenceVisualization = useCallback((noteSequence: string[][]): number => {
    if (!noteSequence || noteSequence.length === 0) {
        return 0;
    }

    stopAiVisualization(); // Clear previous transport events and notes

    const noteHoldSeconds = Tone.Time("0.8m").toSeconds();
    const stepIntervalSeconds = Tone.Time("1m").toSeconds();
    let cumulativeTime = Tone.now(); // Use audio context time for scheduling
    let totalDuration = 0;

    noteSequence.forEach(step => {
        const attackTime = cumulativeTime;
        const releaseTime = attackTime + noteHoldSeconds;

        // Schedule sound
        synthRef.current?.triggerAttackRelease(step, noteHoldSeconds, attackTime);
        
        // Schedule visual ON using Tone.Draw for perfect sync
        Tone.Draw.schedule(() => {
            setAiVisualizingNotes(prev => new Set([...prev, ...step]));
        }, attackTime);

        // Schedule visual OFF
        Tone.Draw.schedule(() => {
            setAiVisualizingNotes(prev => {
                const newSet = new Set(prev);
                step.forEach(note => newSet.delete(note));
                return newSet;
            });
        }, releaseTime);
        
        cumulativeTime += stepIntervalSeconds;
    });

    totalDuration = (cumulativeTime - Tone.now()) * 1000;
    
    // Ensure transport is started to process scheduled events
    if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
    }

    return totalDuration > 0 ? totalDuration : 500; // Return a minimum duration
  }, [stopAiVisualization]);

  // Simpler visualization for single clicks
  const handleNoteClick = useCallback((noteSequence: string[][]) => {
    const step = noteSequence[0]; // Clicks play the first step of a sequence
    if (!step) return;

    stopAiVisualization();
    const noteDuration = Tone.Time("0.8m").toSeconds();
    synthRef.current?.triggerAttackRelease(step, noteDuration, Tone.now());
    setAiVisualizingNotes(new Set(step));

    setTimeout(() => {
        // Only clear if the notes haven't been changed by another action
        setAiVisualizingNotes(prev => {
            const currentStepSet = new Set(step);
            if (prev.size === currentStepSet.size && [...prev].every(note => currentStepSet.has(note))) {
                return new Set();
            }
            return prev;
        });
    }, noteDuration * 950);
  }, [stopAiVisualization]);

  const processAndSendQuery = useCallback(async (rawTextQuery: string) => {
      if (!rawTextQuery.trim()) return;
      
      stopAiVisualization(); // Stop any previous reply
      setStatus(AppStatusEnum.THINKING);

      const userMessage: ChatMessage = {
          id: Date.now().toString(),
          sender: 'user',
          parts: [{ type: 'text', content: rawTextQuery }],
      };
      setMessages(prev => [...prev, userMessage]);

      const responseParts = await getAiResponse(rawTextQuery, midiBufferRef.current);
      
      const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          parts: responseParts,
      };
      
      // Check if we were interrupted before showing the AI response
      if (statusRef.current === AppStatusEnum.THINKING) {
        setMessages(prev => [...prev, aiMessage]);
        setStatus(AppStatusEnum.REPLYING);
      }
      
  }, [stopAiVisualization]);

  const handleAnimationComplete = useCallback(() => {
    if (statusRef.current === AppStatusEnum.REPLYING) {
      setStatus(AppStatusEnum.IDLE);
    }
  }, []);
  
  const handleTranscript = useCallback((transcript: string) => {
    const cleanTranscript = transcript.toLowerCase().trim();
    if (!cleanTranscript) return;

    const currentStatus = statusRef.current;
    
    // Flexible keyword spotting
    const activateKeywords = ['lynx', 'links', 'link'];
    const answerKeywords = ['answer', 'answers'];

    const containsActivate = activateKeywords.some(keyword => cleanTranscript.includes(keyword));
    const containsAnswer = answerKeywords.some(keyword => cleanTranscript.includes(keyword));

    // Handle the activation/interruption command first
    if (containsActivate) {
        if (currentStatus === AppStatusEnum.IDLE) {
            setStatus(AppStatusEnum.LISTENING);
            currentQuestionRef.current = { text: '', notes: [] };
        } else {
            stopAiVisualization();
            setStatus(AppStatusEnum.IDLE);
            currentQuestionRef.current = { text: '', notes: [] };
        }
        return; // Command handled
    }

    // Handle other commands only when in the correct state.
    if (currentStatus === AppStatusEnum.LISTENING) {
        if (containsAnswer) {
            const { text, notes } = currentQuestionRef.current;
            const noteText = notes.length > 0 ? ` [played: ${notes.join(' ')}]` : '';
            const fullQuery = (text.trim() + noteText).trim() || "Analyze what I just played.";
            processAndSendQuery(fullQuery);
            currentQuestionRef.current = { text: '', notes: [] };
        } else {
            // Append transcript if it's not another command.
            currentQuestionRef.current.text += transcript.charAt(0).toUpperCase() + transcript.slice(1) + ' ';
        }
    }
  }, [processAndSendQuery, stopAiVisualization]);

  // STABLE Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported by this browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
            handleTranscript(lastResult[0].transcript);
        }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted' && event.error !== 'network') {
        console.error('Speech recognition error:', event.error);
        recognitionActiveRef.current = false; // Stop trying to restart on critical error
      }
    };
    
    recognition.onend = () => {
      // The continuous loop: only restart if we are supposed to be active.
      if (recognitionActiveRef.current) {
        setTimeout(() => {
            try {
                if (recognitionRef.current) {
                   recognitionRef.current.start();
                }
            } catch(e) {
                // This can happen if start() is called while it's already starting.
                // console.warn("Could not restart recognition:", e);
            }
        }, 300); // A small delay to prevent rapid-fire restarts on error.
      }
    };
    
    recognitionActiveRef.current = true;
    try {
        recognition.start();
    } catch(e) {
        console.warn("Recognition could not be started, may already be running.");
    }

    return () => {
      recognitionActiveRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [handleTranscript]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => midiBufferRef.current = [], IDLE_TIMEOUT_MS);
  }, []);

  const addToMidiBuffer = useCallback((event: MidiNoteEvent) => {
    const now = Date.now();
    midiBufferRef.current.push(event);
    midiBufferRef.current = midiBufferRef.current.filter(e => now - e.timestamp < MIDI_BUFFER_DURATION_MS);
    resetIdleTimer();
  }, [resetIdleTimer]);

  const handleNoteOn = useCallback((e: any) => {
    const midiNumber = e.note.number;
    const noteName = MIDI_NUMBER_TO_NOTE_NAME[midiNumber];
    if (!noteName) return;
    
    setUserActiveNotes(prev => new Set(prev).add(noteName));
    synthRef.current?.triggerAttack(noteName, Tone.now(), e.velocity);
    
    const noteEvent: MidiNoteEvent = { timestamp: Date.now(), noteName, midiNumber, velocity: e.velocity, type: 'noteon' };
    addToMidiBuffer(noteEvent);

    const targetBuffer = isChatInputFocused ? midiTextInputBufferRef : { current: null };
    if (statusRef.current === AppStatusEnum.LISTENING) {
        const simplifiedNote = noteName.replace(/[0-9]/g, '');
        currentQuestionRef.current.notes.push(simplifiedNote);
    } else if (targetBuffer.current !== null) {
      targetBuffer.current.push(noteEvent);
      if (midiTextInputTimerRef.current) clearTimeout(midiTextInputTimerRef.current);
      midiTextInputTimerRef.current = window.setTimeout(() => {
          const notesToInsert = targetBuffer.current.sort((a,b) => a.timestamp - b.timestamp).map(n => n.noteName);
          if (notesToInsert.length > 0) {
              const formattedNotes = notesToInsert.length > 1 ? `(${notesToInsert.join(' ')})` : (notesToInsert[0] || '');
              setChatInputValue(prev => prev ? `${prev} ${formattedNotes}` : formattedNotes);
          }
          targetBuffer.current = [];
      }, 300);
    }
  }, [addToMidiBuffer, isChatInputFocused]);

  const handleNoteOff = useCallback((e: any) => {
    const midiNumber = e.note.number;
    const noteName = MIDI_NUMBER_TO_NOTE_NAME[midiNumber];
    if (!noteName) return;
    setUserActiveNotes(prev => { const newSet = new Set(prev); newSet.delete(noteName); return newSet; });
    synthRef.current?.triggerRelease(noteName, Tone.now() + 0.1);
  }, []);

  useEffect(() => {
    const startAudioContext = async () => { if (Tone.context.state !== 'running') await Tone.start(); };
    document.body.addEventListener('click', startAudioContext, { once: true });
    
    synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    
    const setupMidi = () => {
        if (WebMidi.inputs.length < 1) {
          setMidiDevice("No MIDI devices. Please connect one.");
          return;
        }
        setMidiDevice(`Connected: ${WebMidi.inputs.map(i => i.name).join(', ')}`);
        WebMidi.inputs.forEach(input => {
          input.addListener("noteon", handleNoteOn);
          input.addListener("noteoff", handleNoteOff);
        });
    };

    WebMidi.enable().then(setupMidi).catch(err => console.error(err));
    resetIdleTimer();

    return () => {
      document.body.removeEventListener('click', startAudioContext);
      if (WebMidi.enabled) WebMidi.disable();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      stopAiVisualization();
      synthRef.current?.dispose();
    };
  }, [handleNoteOn, handleNoteOff, resetIdleTimer, stopAiVisualization]);
  
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status === AppStatusEnum.THINKING || !chatInputValue.trim()) return;
    stopAiVisualization();
    processAndSendQuery(chatInputValue);
    setChatInputValue('');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center p-4 lg:p-8 space-y-4 font-sans text-gray-200">
      <main className="w-full max-w-7xl flex-grow flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/3 w-full flex flex-col space-y-6">
             <Instructions />
             <StatusIndicator status={status} />
             <div className="text-sm text-center text-gray-500">{midiDevice || 'Initializing MIDI...'}</div>
          </div>
          <div className="lg:w-2/3 w-full flex flex-col h-[40rem] lg:h-auto">
              <Chat 
                messages={messages} 
                inputValue={chatInputValue}
                onInputChange={setChatInputValue}
                onSendMessage={handleTextSubmit} 
                onFocus={() => setIsChatInputFocused(true)}
                onBlur={() => {setIsChatInputFocused(false); midiTextInputBufferRef.current = [];}}
                status={status}
                onNoteClick={handleNoteClick}
                onNoteVisualize={playNoteSequenceVisualization}
                onAnimationComplete={handleAnimationComplete}
              />
          </div>
      </main>
      <footer className="w-full max-w-7xl pt-4">
          <Piano activeNotes={userActiveNotes} aiNotes={aiVisualizingNotes} />
      </footer>
    </div>
  );
};

export default App;

declare global {
  interface Window { SpeechRecognition: any; webkitSpeechRecognition: any; }
}