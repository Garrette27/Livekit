import { useState } from 'react';
import { User } from 'firebase/auth';
import { 
  InvitationFormData, 
  CreateInvitationRequest, 
  CreateInvitationResponse 
} from '@/lib/types';

interface UseInvitationFormProps {
  user: User;
  roomName: string;
}

export function useInvitationForm({ user, roomName }: UseInvitationFormProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<CreateInvitationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<InvitationFormData>({
    email: '',
    phone: '',
    expiresInHours: 24,
    waitingRoomEnabled: false,
    maxPatients: 10,
  });

  const handleCreateInvitation = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const request: CreateInvitationRequest = {
        roomName,
        ...(formData.email.trim() && { emailAllowed: formData.email.trim() }),
        ...(formData.phone?.trim() && { phoneAllowed: formData.phone.trim() }),
        expiresInHours: formData.expiresInHours,
        waitingRoomEnabled: formData.waitingRoomEnabled || false,
        maxPatients: formData.waitingRoomEnabled ? (formData.maxPatients || 10) : undefined,
        maxUses: formData.waitingRoomEnabled ? undefined : 1,
        doctorUserId: user.uid,
        doctorEmail: user.email || undefined,
        doctorName: user.displayName || undefined,
      };

      const response = await fetch('/api/invite/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invitation');
      }

      setCreatedInvitation(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create invitation';
      setError(errorMessage);
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      phone: '',
      expiresInHours: 24,
      waitingRoomEnabled: false,
      maxPatients: 10,
    });
    setCreatedInvitation(null);
    setError(null);
  };

  return {
    formData,
    setFormData,
    isCreating,
    createdInvitation,
    error,
    handleCreateInvitation,
    resetForm,
  };
}