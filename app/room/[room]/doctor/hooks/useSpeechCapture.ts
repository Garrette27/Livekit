'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type SpeechStatus = 'idle' | 'listening' | 'error' | 'permission-required';

interface SpeechCaptureArgs {
  roomName: string;
  token: string | null;
  /** BCP 47 language used by browser speech recognition for this session. */
  language: string;
}

interface SpeechCaptureState {
  speechStatus: SpeechStatus;
  captureError: string | null;
}

const MAX_STORED_TRANSCRIPT_LINES = 1_000;

/**
 * Captures finalized browser speech-recognition results once and persists a
 * bounded transcript for later summarization. Changing the language restarts
 * recognition without discarding text already captured in the consultation.
 */
export function useSpeechCapture({ roomName, token, language }: SpeechCaptureArgs): SpeechCaptureState {
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [captureError, setCaptureError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptsRef = useRef<string[]>([]);
  const userInteractedRef = useRef(false);
  const hasStartedRef = useRef(false);

  const storeTranscription = useCallback(async (transcription: string[]) => {
    if (!db || !roomName) return;
    const firestoreDb = db; // Store in const so TypeScript knows it's defined
    const callRef = doc(firestoreDb, 'calls', roomName);
    try {
      await setDoc(
        callRef,
        {
          roomName,
          transcription,
          transcriptionCount: transcription.length,
          hasTranscriptionData: transcription.length > 0,
          recognitionLanguage: language,
          transcriptSource: 'browser_speech_recognition',
          lastUpdated: new Date(),
          status: 'active'
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error storing transcription:', error);
    }
  }, [roomName, language]);

  useEffect(() => {
    if (!token || !roomName) return;

    const SpeechRecognition = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = language;
    recognition.maxAlternatives = 1;
    let shouldListen = true;
    let restartTimer: number | null = null;

    const scheduleRestart = (delayMs: number) => {
      if (!shouldListen || restartTimer !== null) {
        return;
      }

      restartTimer = window.setTimeout(() => {
        restartTimer = null;
        if (!shouldListen || !recognitionRef.current) {
          return;
        }
        try {
          recognition.start();
        } catch (error) {
          console.log('Error restarting recognition:', error);
        }
      }, delayMs);
    };

    recognition.onstart = () => {
      setCaptureError(null);
      setSpeechStatus('listening');
      hasStartedRef.current = true;
    };

    recognition.onresult = (event: any) => {
      // SpeechRecognitionEvent.results is cumulative. Starting at resultIndex
      // prevents every earlier utterance from being appended again.
      const firstChangedResult = Number.isInteger(event.resultIndex) ? event.resultIndex : 0;
      for (let i = firstChangedResult; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript) {
            const timestamp = new Date().toISOString();
            const next = [
              ...transcriptsRef.current,
              `${timestamp}: ${transcript}`,
            ].slice(-MAX_STORED_TRANSCRIPT_LINES);
            transcriptsRef.current = next;
            void storeTranscription(next);
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') {
        setSpeechStatus('idle');
        return;
      }

      if (event.error === 'not-allowed') {
        // Only log as warning, don't show error to user - they can enable manually
        console.warn('Microphone permission not granted for speech recognition. Users can enable it manually in browser settings.');
        setSpeechStatus('permission-required');
        // Don't set error message - this is expected behavior if user hasn't granted permission
        // setCaptureError('Microphone permission is required to capture speech.');
        return;
      }

      if (event.error === 'no-speech') {
        scheduleRestart(1_000);
        return;
      }

      setSpeechStatus('error');
      setCaptureError(event.error || 'Speech recognition error');
    };

    recognition.onend = () => {
      setSpeechStatus('idle');
      if (token && hasStartedRef.current && shouldListen) {
        scheduleRestart(500);
      }
    };

    recognitionRef.current = recognition;

    const startRecognition = () => {
      if (!recognitionRef.current || hasStartedRef.current) {
        return;
      }

      userInteractedRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    };

    const handleUserInteraction = () => {
      startRecognition();
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    if (userInteractedRef.current) {
      startRecognition();
    }

    return () => {
      shouldListen = false;
      hasStartedRef.current = false;
      if (restartTimer !== null) {
        window.clearTimeout(restartTimer);
      }
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [roomName, token, language, storeTranscription]);

  return { speechStatus, captureError };
}


