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
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Invitation</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient Email (Optional)
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="patient@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient Phone (Optional)
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+1234567890"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expires In (Hours)
          </label>
          <select
            value={formData.expiresInHours}
            onChange={(e) => setFormData({ ...formData, expiresInHours: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1}>1 Hour</option>
            <option value={6}>6 Hours</option>
            <option value={24}>24 Hours</option>
            <option value={72}>3 Days</option>
            <option value={168}>1 Week</option>
          </select>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.waitingRoomEnabled}
              onChange={(e) => setFormData({ ...formData, waitingRoomEnabled: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Enable Waiting Room</span>
          </label>
        </div>

        {formData.waitingRoomEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Patients
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.maxPatients}
              onChange={(e) => setFormData({ ...formData, maxPatients: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <button
          onClick={onSubmit}
          disabled={isCreating}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400"
        >
          {isCreating ? 'Creating...' : 'Create Invitation'}
        </button>
      </div>
    </div>
  );
}