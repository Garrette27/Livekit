import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TranscriptionEntry {
  id: string;
  timestamp: Date;
  text: string;
  confidence?: number;
  isFinal?: boolean;
  speaker?: string;
}

export interface ManualNote {
  id: string;
  timestamp: Date;
  text: string;
  author: string;
}

export interface TranscriptionStorage {
  roomName: string;
  entries: TranscriptionEntry[];
  manualNotes: ManualNote[];
  lastUpdated: Date;
  totalEntries: number;
}

export interface TranscriptionRequest {
  roomName: string;
  text: string;
  timestamp: Date;
  isManual?: boolean;
  confidence?: number;
}

export interface TranscriptionResponse {
  success: boolean;
  error?: string;
  entryId?: string;
}

export class TranscriptionService {
  private static readonly COLLECTION_NAME = 'calls';
  private static readonly MAX_ENTRIES = 1000;

  /**
   * Store transcription entry in Firestore
   */
  static async storeTranscriptionEntry(
    request: TranscriptionRequest
  ): Promise<TranscriptionResponse> {
    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const callRef = doc(db, this.COLLECTION_NAME, request.roomName);
      const callDoc = await getDoc(callRef);

      let transcriptionData: string[] = [];
      
      if (callDoc.exists()) {
        const existingData = callDoc.data();
        transcriptionData = existingData?.transcription || [];
      }

      // Add new entry
      const timestamp = new Date().toISOString();
      const prefix = request.isManual ? '[Manual Note]' : '';
      const newEntry = `${prefix} (${timestamp}): ${request.text}`;
      
      transcriptionData.push(newEntry);

      // Limit entries to prevent storage bloat
      if (transcriptionData.length > this.MAX_ENTRIES) {
        transcriptionData = transcriptionData.slice(-this.MAX_ENTRIES);
      }

      await updateDoc(callRef, {
        transcription: transcriptionData,
        lastTranscriptionUpdate: new Date(),
        transcriptionCount: transcriptionData.length,
        hasTranscriptionData: transcriptionData.length > 0
      });

      return {
        success: true,
        entryId: `${request.roomName}-${Date.now()}`
      };
    } catch (error) {
      console.error('Store transcription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get transcription data for a room
   */
  static async getTranscriptionData(roomName: string): Promise<TranscriptionStorage | null> {
    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const callRef = doc(db, this.COLLECTION_NAME, roomName);
      const callDoc = await getDoc(callRef);

      if (!callDoc.exists()) {
        return null;
      }

      const data = callDoc.data();
      
      return {
        roomName,
        entries: this.parseTranscriptionEntries(data?.transcription || []),
        manualNotes: this.parseManualNotes(data?.transcription || []),
        lastUpdated: data?.lastTranscriptionUpdate?.toDate() || new Date(),
        totalEntries: data?.transcriptionCount || 0
      };
    } catch (error) {
      console.error('Get transcription data error:', error);
      return null;
    }
  }

  /**
   * Update transcription data
   */
  static async updateTranscriptionData(
    roomName: string, 
    transcriptionData: string[]
  ): Promise<TranscriptionResponse> {
    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const callRef = doc(db, this.COLLECTION_NAME, roomName);

      await updateDoc(callRef, {
        transcription: transcriptionData,
        lastTranscriptionUpdate: new Date(),
        transcriptionCount: transcriptionData.length,
        hasTranscriptionData: transcriptionData.length > 0
      });

      return { success: true };
    } catch (error) {
      console.error('Update transcription data error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear transcription data for a room
   */
  static async clearTranscriptionData(roomName: string): Promise<TranscriptionResponse> {
    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const callRef = doc(db, this.COLLECTION_NAME, roomName);

      await updateDoc(callRef, {
        transcription: [],
        lastTranscriptionUpdate: new Date(),
        transcriptionCount: 0,
        hasTranscriptionData: false
      });

      return { success: true };
    } catch (error) {
      console.error('Clear transcription data error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete transcription data for a room
   */
  static async deleteTranscriptionData(roomName: string): Promise<TranscriptionResponse> {
    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const callRef = doc(db, this.COLLECTION_NAME, roomName);
      const callDoc = await getDoc(callRef);

      if (callDoc.exists()) {
        await updateDoc(callRef, {
          transcription: [],
          lastTranscriptionUpdate: new Date(),
          transcriptionCount: 0,
          hasTranscriptionData: false,
          deletedAt: new Date()
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Delete transcription data error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get transcription statistics
   */
  static async getTranscriptionStatistics(roomName: string): Promise<any> {
    try {
      const transcriptionData = await this.getTranscriptionData(roomName);
      
      if (!transcriptionData) {
        return null;
      }

      const totalEntries = transcriptionData.totalEntries;
      const manualNotes = transcriptionData.manualNotes.length;
      const autoTranscriptions = transcriptionData.entries.length;
      const lastUpdated = transcriptionData.lastUpdated;

      // Calculate duration based on timestamps
      let duration = 0;
      if (transcriptionData.entries.length > 1) {
        const firstEntry = transcriptionData.entries[0];
        const lastEntry = transcriptionData.entries[transcriptionData.entries.length - 1];
        duration = lastEntry.timestamp.getTime() - firstEntry.timestamp.getTime();
      }

      return {
        roomName,
        totalEntries,
        manualNotes,
        autoTranscriptions,
        lastUpdated,
        duration: Math.round(duration / 1000), // Convert to seconds
        averageEntriesPerMinute: totalEntries > 0 ? Math.round(totalEntries / (duration / 60000)) : 0
      };
    } catch (error) {
      console.error('Get transcription statistics error:', error);
      return null;
    }
  }

  /**
   * Export transcription data
   */
  static exportTranscriptionData(roomName: string): Promise<string | null> {
    return this.getTranscriptionData(roomName)
      .then(data => {
        if (!data) return null;

        const exportData = {
          roomName,
          exportDate: new Date().toISOString(),
          entries: data.entries,
          manualNotes: data.manualNotes,
          statistics: {
            totalEntries: data.totalEntries,
            lastUpdated: data.lastUpdated
          }
        };

        return JSON.stringify(exportData, null, 2);
      });
    }

  /**
   * Parse transcription entries from string array
   */
  private static parseTranscriptionEntries(entries: string[]): TranscriptionEntry[] {
    return entries.map((entry: string, index: number) => {
      const isManual = entry.includes('[Manual Note]');
      const timestampMatch = entry.match(/\[([^\]]+)\]/);
      const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();
      const text = entry.replace(/^\[[^\]]+\]\s*/, '').trim();
      
      return {
        id: `${timestamp.getTime()}-${index}`,
        timestamp,
        text,
        isManual,
      };
    });
  }

  /**
   * Parse manual notes from string array
   */
  private static parseManualNotes(entries: string[]): ManualNote[] {
    return entries
      .filter((entry: string) => entry.includes('[Manual Note]'))
      .map((entry: string, index: number) => {
        const timestampMatch = entry.match(/\[([^\]]+)\]/);
        const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();
        const text = entry.replace(/^\[[^\]]+\]\s*/, '').trim();
        
        return {
          id: `manual-${timestamp.getTime()}-${index}`,
          timestamp,
          text,
          author: 'User' // Manual notes are always from the user
        };
      });
  }

/**
   * Search transcription entries
   */
  static async searchTranscription(
    roomName: string, 
    query: string
  ): Promise<TranscriptionEntry[]> {
    try {
      const transcriptionData = await this.getTranscriptionData(roomName);
      
      if (!transcriptionData) {
        return [];
      }

      const allEntries = [...transcriptionData.entries, ...transcriptionData.manualNotes];
      const searchQuery = query.toLowerCase();

      return allEntries.filter(entry => 
        entry.text.toLowerCase().includes(searchQuery)
      );
    } catch (error) {
      console.error('Search transcription error:', error);
      return [];
    }
  }
}
