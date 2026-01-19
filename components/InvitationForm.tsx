import { InvitationFormData } from '@/lib/types';

interface InvitationFormProps {
  formData: InvitationFormData;
  setFormData: (data: InvitationFormData) => void;
  isCreating: boolean;
  onSubmit: () => void;
}

export default function InvitationForm({ 
  formData, 
  setFormData, 
  isCreating, 
  onSubmit 
}: InvitationFormProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      padding: '1.5rem'
    }}>
      <h3 style={{
        fontSize: '1.125rem',
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: '1rem'
      }}>
        Create New Invitation
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
            Patient Email (Optional)
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="patient@example.com"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Patient Phone (Optional)
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+1234567890"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          />
        </div>

        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Expires In (Hours)
          </label>
          <select
            value={formData.expiresInHours}
            onChange={(e) => setFormData({ ...formData, expiresInHours: parseInt(e.target.value) })}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem'
            }}
          >
            <option value={1}>1 Hour</option>
            <option value={6}>6 Hours</option>
            <option value={24}>24 Hours</option>
            <option value={72}>3 Days</option>
            <option value={168}>1 Week</option>
          </select>
        </div>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151'
          }}>
            <input
              type="checkbox"
              checked={formData.waitingRoomEnabled}
              onChange={(e) => setFormData({ ...formData, waitingRoomEnabled: e.target.checked })}
              style={{
                marginRight: '0.5rem',
                width: '1rem',
                height: '1rem'
              }}
            />
            Enable Waiting Room
          </label>
        </div>

        {formData.waitingRoomEnabled && (
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Maximum Patients
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.maxPatients}
              onChange={(e) => setFormData({ ...formData, maxPatients: parseInt(e.target.value) })}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
            />
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={isCreating}
          style={{
            width: '100%',
            padding: '0.5rem 1rem',
            backgroundColor: isCreating ? '#9ca3af' : '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: isCreating ? 'not-allowed' : 'pointer'
          }}
        >
          {isCreating ? 'Creating...' : 'Create Invitation'}
        </button>
      </div>
    </div>
  );
}