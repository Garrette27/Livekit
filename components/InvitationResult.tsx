import { User } from 'firebase/auth';
import { CreateInvitationResponse } from '@/lib/types';

interface InvitationResultProps {
  invitation: CreateInvitationResponse;
  user: User;
  onCopyLink?: () => void;
}

export default function InvitationResult({ invitation, user, onCopyLink }: InvitationResultProps) {
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitation.inviteUrl);
      onCopyLink?.();
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const accessCode = invitation.inviteUrl.split('/').pop() || '';

  return (
    <div style={{
      backgroundColor: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: '0.5rem',
      padding: '1.5rem'
    }}>
      <h3 style={{
        fontSize: '1.125rem',
        fontWeight: '600',
        color: '#15803d',
        marginBottom: '1rem'
      }}>
        Invitation Created Successfully!
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Invitation Link
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={invitation.inviteUrl}
              readOnly
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                backgroundColor: '#f9fafb',
                fontSize: '0.875rem'
              }}
            />
            <button
              onClick={handleCopyLink}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Access Code
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={accessCode}
              readOnly
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                backgroundColor: '#f9fafb',
                fontSize: '0.875rem',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={() => navigator.clipboard.writeText(accessCode)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Copy
            </button>
          </div>
        </div>

        <div style={{
          fontSize: '0.875rem',
          color: '#4b5563'
        }}>
          <p><strong>Expires:</strong> {new Date(invitation.expiresAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}