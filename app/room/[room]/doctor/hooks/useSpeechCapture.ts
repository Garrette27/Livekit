'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type SpeechStatus =
  | 'idle'
  | 'listening'
  | 'error'
  | 'permission-required'
  | 'unsupported';

interface SpeechCaptureArgs {
  roomName: string;
  token: string | null;
}

interface SpeechCaptureState {
  speechStatus: SpeechStatus;
  captureError: string | null;
  startCapture: (patientConsentConfirmed: boolean) => Promise<void>;
  stopCapture: () => void;
}

/**
 * Provide an explicit, consent-gated browser speech-note capture session.
 *
 * The recognizer listens only after `startCapture(true)` and never restarts
 * after the clinician stops it. Stored lines identify their browser-STT
 * provenance so downstream summaries cannot present them as a full recording.
 */
export function useSpeechCapture({ roomName, token }: SpeechCaptureArgs): SpeechCaptureState {
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [captureError, setCaptureError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptsRef = useRef<string[]>([]);
  const captureRequestedRef = useRef(false);

  const storeCaptureState = useCallback(
    async (active: boolean, consentConfirmed: boolean) => {
      if (!db || !roomName) return;
      await setDoc(
        doc(db, 'calls', roomName),
        {
          transcriptionCapture: {
            active,
            consentConfirmed,
            source: 'doctor-device-browser-speech-recognition',
            updatedAt: new Date(),
            ...(active ? { startedAt: new Date() } : { stoppedAt: new Date() }),
          },
          lastUpdated: new Date(),
        },
        { merge: true }
      );
    },
    [roomName]
  );

  const storeTranscription = useCallback(
    async (transcription: string[]) => {
      if (!db || !roomName) return;
      try {
        await setDoc(
          doc(db, 'calls', roomName),
          {
            roomName,
            transcription,
            transcriptionProvenance: 'doctor-device-browser-speech-recognition',
            lastUpdated: new Date(),
            status: 'active',
          },
          { merge: true }
        );
      } catch (error) {
        console.error('Error storing transcription:', error);
      }
    },
    [roomName]
  );

  useEffect(() => {
    if (!token || !roomName) return;

    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setSpeechStatus('unsupported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setCaptureError(null);
      setSpeechStatus('listening');
    };

    recognition.onresult = (event: any) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result.isFinal) continue;

        const transcript = result[0].transcript.trim();
        if (!transcript) continue;

        const next = [
          ...transcriptsRef.current,
          `[doctor-device-stt] ${new Date().toISOString()}: ${transcript}`,
        ];
        transcriptsRef.current = next;
        void storeTranscription(next);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'aborted') {
        setSpeechStatus('idle');
        return;
      }
      if (event.error === 'not-allowed') {
        captureRequestedRef.current = false;
        setSpeechStatus('permission-required');
        setCaptureError('Speech-note capture needs browser microphone permission.');
        return;
      }
      if (event.error === 'no-speech') {
        return;
      }

      captureRequestedRef.current = false;
      setSpeechStatus('error');
      setCaptureError('Speech-note capture stopped because the browser reported an error.');
    };

    recognition.onend = () => {
      if (!captureRequestedRef.current) {
        setSpeechStatus('idle');
        return;
      }

      // Browsers may end a continuous recognizer after silence. Restart only
      // while the clinician's explicit capture session remains active.
      try {
        recognition.start();
      } catch {
        captureRequestedRef.current = false;
        setSpeechStatus('error');
        setCaptureError('Speech-note capture could not continue.');
      }
    };

    recognitionRef.current = recognition;
    return () => {
      captureRequestedRef.current = false;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [roomName, storeTranscription, token]);

  const startCapture = useCallback(
    async (patientConsentConfirmed: boolean) => {
      if (!patientConsentConfirmed) {
        setCaptureError('Confirm the patient has consented before starting speech notes.');
        return;
      }
      if (!recognitionRef.current) {
        setCaptureError('Speech recognition is not supported in this browser.');
        return;
      }

      setCaptureError(null);
      captureRequestedRef.current = true;
      try {
        recognitionRef.current.start();
        await storeCaptureState(true, true);
      } catch {
        captureRequestedRef.current = false;
        setSpeechStatus('error');
        setCaptureError('Speech-note capture could not start.');
      }
    },
    [storeCaptureState]
  );

  const stopCapture = useCallback(() => {
    captureRequestedRef.current = false;
    recognitionRef.current?.stop();
    setSpeechStatus('idle');
    void storeCaptureState(false, true).catch((error) => {
      console.error('Error storing transcription stop state:', error);
    });
  }, [storeCaptureState]);

  return { speechStatus, captureError, startCapture, stopCapture };
}
