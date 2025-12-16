'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type SpeechStatus = 'idle' | 'listening' | 'error' | 'permission-required';

interface SpeechCaptureArgs {
  roomName: string;
  token: string | null;
}

interface SpeechCaptureState {
  speechStatus: SpeechStatus;
  captureError: string | null;
}

export function useSpeechCapture({ roomName, token }: SpeechCaptureArgs): SpeechCaptureState {
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [captureError, setCaptureError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptsRef = useRef<string[]>([]);
  const userInteractedRef = useRef(false);
  const hasStartedRef = useRef(false);

  const storeTranscription = useCallback(async (transcription: string[]) => {
    if (!db || !roomName) return;
    const callRef = doc(db, 'calls', roomName);
    try {
      await setDoc(
        callRef,
        {
          roomName,
          transcription,
          lastUpdated: new Date(),
          status: 'active'
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error storing transcription:', error);
    }
  }, [roomName]);

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
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setSpeechStatus('listening');
      hasStartedRef.current = true;
    };

    recognition.onresult = (event: any) => {
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript) {
            const timestamp = new Date().toISOString();
            const next = [...transcriptsRef.current, `${timestamp}: ${transcript}`];
            transcriptsRef.current = next;
            storeTranscription(next);
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
        setSpeechStatus('permission-required');
        setCaptureError('Microphone permission is required to capture speech.');
        return;
      }

      if (event.error === 'no-speech') {
        setTimeout(() => {
          if (hasStartedRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.log('Error restarting recognition:', e);
            }
          }
        }, 1000);
        return;
      }

      setSpeechStatus('error');
      setCaptureError(event.error || 'Speech recognition error');
    };

    recognition.onend = () => {
      setSpeechStatus('idle');
      if (token && hasStartedRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.log('Error restarting recognition:', e);
          }
        }, 500);
      }
    };

    recognitionRef.current = recognition;

    const startRecognition = () => {
      if (!userInteractedRef.current && recognitionRef.current) {
        userInteractedRef.current = true;
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Error starting speech recognition:', error);
        }
      }
    };

    const handleUserInteraction = () => {
      startRecognition();
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [roomName, token, storeTranscription]);

  return { speechStatus, captureError };
}


