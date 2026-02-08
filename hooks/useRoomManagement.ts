import { useState, useCallback, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useRoomManagement() {
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [roomCreationError, setRoomCreationError] = useState<string | null>(null);
  const [ownedRooms, setOwnedRooms] = useState<string[]>([]);

  // Create a new room
  const createRoom = useCallback(async (
    roomName: string, 
    user: User | null
  ): Promise<boolean> => {
    if (!roomName.trim()) {
      setRoomCreationError('Please enter a room name');
      return false;
    }

    if (!user) {
      setRoomCreationError('Please sign in to create a room');
      return false;
    }

    setIsCreatingRoom(true);
    setRoomCreationError(null);

    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      // Store room creation with user ID
      const roomRef = doc(db, 'rooms', roomName);
      await setDoc(roomRef, {
        roomName,
        createdBy: user.uid,
        createdAt: new Date(),
        status: 'active',
        metadata: {
          createdBy: user.uid,
          userId: user.uid,
          userEmail: user.email,
          userName: user.displayName
        }
      });

      console.log('✅ Room created successfully:', roomName);
      
      // Update owned rooms
      setOwnedRooms(prev => [...prev, roomName]);
      
      return true;
    } catch (error) {
      console.error('Error creating room:', error);
      setRoomCreationError('Error creating room. Please try again.');
      return false;
    } finally {
      setIsCreatingRoom(false);
    }
  }, []);

  // Check if user owns the room
  const checkRoomOwnership = useCallback(async (
    roomName: string, 
    user: User | null
  ): Promise<boolean> => {
    if (!user || !roomName) return false;

    try {
      if (!db) {
        throw new Error('Firestore not initialized');
      }

      const roomRef = doc(db, 'rooms', roomName);
      const roomDoc = await getDoc(roomRef);
      
      if (roomDoc.exists()) {
        const roomData = roomDoc.data();
        return roomData?.createdBy === user.uid;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking room ownership:', error);
      return false;
    }
  }, []);

  // Get user's owned rooms
  const fetchOwnedRooms = useCallback(async (user: User | null) => {
    if (!user) return;

    try {
      // For now, we'll use a simple approach
      // In a real app, you might want to query a collection
      const rooms: string[] = [];
      setOwnedRooms(rooms);
    } catch (error) {
      console.error('Error fetching owned rooms:', error);
    }
  }, []);

  // Delete a room
  const deleteRoom = useCallback(async (
    roomName: string, 
    user: User | null
  ): Promise<boolean> => {
    if (!user || !roomName) return false;

    try {
      // Check ownership first
      const isOwner = await checkRoomOwnership(roomName, user);
      if (!isOwner) {
        setRoomCreationError('You can only delete rooms you created');
        return false;
      }

      if (!db) {
        throw new Error('Firestore not initialized');
      }

      // Delete room document
      const roomRef = doc(db, 'rooms', roomName);
      await deleteDoc(roomRef);

      // Update owned rooms
      setOwnedRooms(prev => prev.filter(room => room !== roomName));
      
      console.log('✅ Room deleted successfully:', roomName);
      return true;
    } catch (error) {
      console.error('Error deleting room:', error);
      setRoomCreationError('Error deleting room. Please try again.');
      return false;
    }
  }, [checkRoomOwnership]);

  // Generate unique room name
  const generateRoomName = useCallback((prefix: string = 'consultation'): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }, []);

  // Validate room name
  const validateRoomName = useCallback((roomName: string): boolean => {
    if (!roomName || roomName.trim().length === 0) {
      setRoomCreationError('Room name is required');
      return false;
    }

    if (roomName.length < 3) {
      setRoomCreationError('Room name must be at least 3 characters');
      return false;
    }

    if (roomName.length > 50) {
      setRoomCreationError('Room name must be less than 50 characters');
      return false;
    }

    // Allow alphanumeric, hyphens, and underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(roomName)) {
      setRoomCreationError('Room name can only contain letters, numbers, hyphens, and underscores');
      return false;
    }

    setRoomCreationError(null);
    return true;
  }, []);

  // Clear room creation error
  const clearRoomCreationError = useCallback(() => {
    setRoomCreationError(null);
  }, []);

  // Fetch owned rooms on mount if user is available
  useEffect(() => {
    // This would be called from a component that has access to the user
    // fetchOwnedRooms(user);
  }, [fetchOwnedRooms]);

  return {
    // State
    isCreatingRoom,
    roomCreationError,
    ownedRooms,
    
    // Actions
    createRoom,
    checkRoomOwnership,
    fetchOwnedRooms,
    deleteRoom,
    generateRoomName,
    validateRoomName,
    clearRoomCreationError,
  };
}
