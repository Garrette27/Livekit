import { useState, useCallback, useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    speechRecognitionActive?: boolean;
  }
}

interface TranscriptionEntry {
  timestamp: string;
  text: string;
  confidence?: number;
  isFinal?: boolean;
}

export function useTranscription(roomName: string) {
  const [transcription, setTranscription] = useState<string[]>([]);
  const [manualNotes, setManualNotes] = useState<string[]>([]);
  const [speechRecognitionStatus, setSpeechRecognitionStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [isThrottled, setIsThrottled] = useState<boolean>(false);
  const [restartCount, setRestartCount] = useState<number>(0);
  const [lastRestartTime, setLastRestartTime] = useState<number>(0);
  
  const recognitionRef = useRef<any>(null);
  const isInitializedRef = useRef<boolean>(false);
  const userInteractedRef = useRef<boolean>(false);

  // Initialize speech recognition
  const initializeSpeechRecognition = useCallback(() => {
    if (isInitializedRef.current || !roomName) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported');
      setSpeechRecognitionStatus('error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      setSpeechRecognitionStatus('listening');
    };

    recognition.onresult = (event: any) => {
      console.log('🎤 Speech recognition result received');
      
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        const isFinal = result.isFinal;
        const confidence = result[0].confidence || 0;
        
        // Accept both final results and interim results with lower confidence threshold
        if (transcript && (isFinal || confidence > 0.3)) {
          const timestamp = new Date().toISOString();
          const entry = `[${timestamp}] ${transcript}`;
          
          setTranscription(prev => {
            const newTranscription = [...prev, entry];
            
            // Store in Firestore immediately
            storeTranscriptionEntry(newTranscription);
            
            return newTranscription;
          });
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('🎤 Speech recognition error:', event.error);
      setSpeechRecognitionStatus('error');
      
      // Auto-restart logic with throttling
      if (event.error === 'no-speech') {
        setTimeout(() => {
          const now = Date.now();
          if (now - lastRestartTime > 5000 && !isThrottled) {
            setLastRestartTime(now);
            setRestartCount(prev => prev + 1);
            recognition.start();
          }
        }, 5000);
      }
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended');
      setSpeechRecognitionStatus('idle');
      
      // Auto-restart with throttling
      setTimeout(() => {
        const now = Date.now();
        if (now - lastRestartTime > 3000 && !isThrottled) {
          recognition.start();
        }
      }, 3000);
    };

    isInitializedRef.current = true;
  }, [roomName, lastRestartTime, isThrottled]);

  // Start transcription
  const startTranscription = useCallback(() => {
    if (!userInteractedRef.current) {
      // Wait for user interaction
      const handleUserInteraction = () => {
        userInteractedRef.current = true;
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
        initializeSpeechRecognition();
      };

      document.addEventListener('click', handleUserInteraction);
      document.addEventListener('keydown', handleUserInteraction);
      document.addEventListener('touchstart', handleUserInteraction);
      
      return;
    }

    if (recognitionRef.current && recognitionRef.current.state !== 'recording') {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  }, [initializeSpeechRecognition]);

  // Stop transcription
  const stopTranscription = useCallback(() => {
    if (recognitionRef.current && recognitionRef.current.state === 'recording') {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }, []);

  // Add manual note
  const addManualNote = useCallback((note: string) => {
    if (!note.trim()) return;

    const timestamp = new Date().toISOString();
    const entry = `[Manual Note] (${timestamp}): ${note}`;
    
    setManualNotes(prev => [...prev, entry]);
    setTranscription(prev => {
      const newTranscription = [...prev, entry];
      storeTranscriptionEntry(newTranscription);
      return newTranscription;
    });
  }, []);

  // Store transcription entry in Firestore
  const storeTranscriptionEntry = useCallback(async (transcriptionData: string[]) => {
    if (!roomName) return;

    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const callRef = doc(db, 'calls', roomName);
      await updateDoc(callRef, {
        transcription: transcriptionData,
        lastTranscriptionUpdate: new Date(),
        transcriptionCount: transcriptionData.length,
        hasTranscriptionData: transcriptionData.length > 0
      });
      
      console.log('✅ Transcription stored successfully:', transcriptionData.length, 'entries');
    } catch (error) {
      console.error('Error storing transcription:', error);
    }
  }, [roomName]);

  // Clear transcription
  const clearTranscription = useCallback(() => {
    setTranscription([]);
    setManualNotes([]);
  }, []);

  // Throttle mechanism to prevent too many restarts
  useEffect(() => {
    if (restartCount > 10) {
      console.log('🛑 Too many speech recognition restarts, throttling for 30 seconds');
      setIsThrottled(true);
      setTimeout(() => {
        setIsThrottled(false);
        setRestartCount(0);
        console.log('✅ Speech recognition throttle lifted');
      }, 30000);
    }
  }, [restartCount]);

  // Initialize on mount
  useEffect(() => {
    startTranscription();

    return () => {
      stopTranscription();
      isInitializedRef.current = false;
    };
  }, [startTranscription, stopTranscription]);

  // Global flag to prevent multiple instances
  useEffect(() => {
    if (window.speechRecognitionActive) {
      return;
    }
    window.speechRecognitionActive = true;
    
    return () => {
      window.speechRecognitionActive = false;
    };
  }, []);

  return {
    // State
    transcription,
    manualNotes,
    speechRecognitionStatus,
    isThrottled,
    restartCount,
    
    // Actions
    startTranscription,
    stopTranscription,
    addManualNote,
    clearTranscription,
    
    // Internal state for debugging
    recognitionRef,
    isInitialized: isInitializedRef.current,
  };
}
