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
    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-green-800 mb-4">Invitation Created Successfully!</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Invitation Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={invitation.inviteUrl}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Access Code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={accessCode}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono"
            />
            <button
              onClick={() => navigator.clipboard.writeText(accessCode)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p><strong>Expires:</strong> {new Date(invitation.expiresAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}