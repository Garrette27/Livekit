'use client';

import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { 
  InvitationFormData, 
  CreateInvitationRequest, 
  CreateInvitationResponse,
  InvitationListItem 
} from '@/lib/types';

interface InvitationManagerProps {
  user: User;
  roomName: string;
}

export default function InvitationManager({ user, roomName }: InvitationManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<CreateInvitationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<InvitationFormData>({
    email: '',
    countries: ['US'],
    browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'],
    deviceBinding: false,
    expiresInHours: 24,
  });

  const countryOptions = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
    { code: 'FR', name: 'France' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'AT', name: 'Austria' },
    { code: 'BE', name: 'Belgium' },
    { code: 'IE', name: 'Ireland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'GR', name: 'Greece' },
    { code: 'PL', name: 'Poland' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'HU', name: 'Hungary' },
    { code: 'SK', name: 'Slovakia' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'HR', name: 'Croatia' },
    { code: 'RO', name: 'Romania' },
    { code: 'BG', name: 'Bulgaria' },
    { code: 'LT', name: 'Lithuania' },
    { code: 'LV', name: 'Latvia' },
    { code: 'EE', name: 'Estonia' },
    { code: 'JP', name: 'Japan' },
    { code: 'KR', name: 'South Korea' },
    { code: 'CN', name: 'China' },
    { code: 'IN', name: 'India' },
    { code: 'SG', name: 'Singapore' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'TW', name: 'Taiwan' },
    { code: 'TH', name: 'Thailand' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'ID', name: 'Indonesia' },
    { code: 'PH', name: 'Philippines' },
    { code: 'VN', name: 'Vietnam' },
    { code: 'BR', name: 'Brazil' },
    { code: 'MX', name: 'Mexico' },
    { code: 'AR', name: 'Argentina' },
    { code: 'CL', name: 'Chile' },
    { code: 'CO', name: 'Colombia' },
    { code: 'PE', name: 'Peru' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'EG', name: 'Egypt' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'KE', name: 'Kenya' },
    { code: 'MA', name: 'Morocco' },
    { code: 'TN', name: 'Tunisia' },
    { code: 'DZ', name: 'Algeria' },
    { code: 'LY', name: 'Libya' },
    { code: 'SD', name: 'Sudan' },
    { code: 'ET', name: 'Ethiopia' },
    { code: 'GH', name: 'Ghana' },
    { code: 'UG', name: 'Uganda' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'ZM', name: 'Zambia' },
    { code: 'ZW', name: 'Zimbabwe' },
    { code: 'BW', name: 'Botswana' },
    { code: 'NA', name: 'Namibia' },
    { code: 'SZ', name: 'Eswatini' },
    { code: 'LS', name: 'Lesotho' },
    { code: 'MW', name: 'Malawi' },
    { code: 'MZ', name: 'Mozambique' },
    { code: 'MG', name: 'Madagascar' },
    { code: 'MU', name: 'Mauritius' },
    { code: 'SC', name: 'Seychelles' },
    { code: 'KM', name: 'Comoros' },
    { code: 'DJ', name: 'Djibouti' },
    { code: 'SO', name: 'Somalia' },
    { code: 'ER', name: 'Eritrea' },
    { code: 'SS', name: 'South Sudan' },
    { code: 'CF', name: 'Central African Republic' },
    { code: 'TD', name: 'Chad' },
    { code: 'NE', name: 'Niger' },
    { code: 'ML', name: 'Mali' },
    { code: 'BF', name: 'Burkina Faso' },
    { code: 'CI', name: 'Côte d\'Ivoire' },
    { code: 'LR', name: 'Liberia' },
    { code: 'SL', name: 'Sierra Leone' },
    { code: 'GN', name: 'Guinea' },
    { code: 'GW', name: 'Guinea-Bissau' },
    { code: 'GM', name: 'Gambia' },
    { code: 'SN', name: 'Senegal' },
    { code: 'MR', name: 'Mauritania' },
    { code: 'CV', name: 'Cape Verde' },
    { code: 'ST', name: 'São Tomé and Príncipe' },
    { code: 'GQ', name: 'Equatorial Guinea' },
    { code: 'GA', name: 'Gabon' },
    { code: 'CG', name: 'Republic of the Congo' },
    { code: 'CD', name: 'Democratic Republic of the Congo' },
    { code: 'AO', name: 'Angola' },
    { code: 'CM', name: 'Cameroon' },
    { code: 'CF', name: 'Central African Republic' },
    { code: 'TD', name: 'Chad' },
    { code: 'NE', name: 'Niger' },
    { code: 'ML', name: 'Mali' },
    { code: 'BF', name: 'Burkina Faso' },
    { code: 'CI', name: 'Côte d\'Ivoire' },
    { code: 'LR', name: 'Liberia' },
    { code: 'SL', name: 'Sierra Leone' },
    { code: 'GN', name: 'Guinea' },
    { code: 'GW', name: 'Guinea-Bissau' },
    { code: 'GM', name: 'Gambia' },
    { code: 'SN', name: 'Senegal' },
    { code: 'MR', name: 'Mauritania' },
    { code: 'CV', name: 'Cape Verde' },
    { code: 'ST', name: 'São Tomé and Príncipe' },
    { code: 'GQ', name: 'Equatorial Guinea' },
    { code: 'GA', name: 'Gabon' },
    { code: 'CG', name: 'Republic of the Congo' },
    { code: 'CD', name: 'Democratic Republic of the Congo' },
    { code: 'AO', name: 'Angola' },
    { code: 'CM', name: 'Cameroon' },
  ];

  const browserOptions = [
    { value: 'Chrome', label: 'Google Chrome' },
    { value: 'Firefox', label: 'Mozilla Firefox' },
    { value: 'Safari', label: 'Safari' },
    { value: 'Edge', label: 'Microsoft Edge' },
    { value: 'Opera', label: 'Opera' },
  ];

  const handleCreateInvitation = async () => {
    if (!formData.email.trim()) {
      setError('Please enter a patient email address');
      return;
    }

    if (formData.countries.length === 0) {
      setError('Please select at least one country');
      return;
    }

    if (formData.browsers.length === 0) {
      setError('Please select at least one browser');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const request: CreateInvitationRequest = {
        roomName,
        emailAllowed: formData.email,
        countryAllowlist: formData.countries,
        browserAllowlist: formData.browsers,
        deviceBinding: formData.deviceBinding,
        expiresInHours: formData.expiresInHours,
      };

      const response = await fetch('/api/invite/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const result: CreateInvitationResponse = await response.json();

      if (result.success) {
        setCreatedInvitation(result);
        // Reset form
        setFormData({
          email: '',
          countries: ['US'],
          browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'],
          deviceBinding: false,
          expiresInHours: 24,
        });
      } else {
        setError(result.error || 'Failed to create invitation');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error creating invitation:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('Invitation link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '1rem',
      padding: '2rem',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      marginBottom: '2rem'
    }}>
      <h3 style={{
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: '#1e40af',
        marginBottom: '1.5rem'
      }}>
        🔐 Create Secure Patient Invitation
      </h3>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem',
          color: '#dc2626'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {createdInvitation && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h4 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: '#166534',
            marginBottom: '1rem'
          }}>
            ✅ Invitation Created Successfully!
          </h4>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              Patient Invitation Link:
            </label>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              <input
                type="text"
                value={createdInvitation.inviteUrl}
                readOnly
                style={{
                  flex: '1',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#f9fafb'
                }}
              />
              <button
                onClick={() => copyToClipboard(createdInvitation.inviteUrl)}
                style={{
                  backgroundColor: '#059669',
                  color: 'white',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                📋 Copy
              </button>
            </div>
          </div>

          <div style={{
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <p><strong>Expires:</strong> {new Date(createdInvitation.expiresAt).toLocaleString()}</p>
            <p><strong>Invitation ID:</strong> {createdInvitation.invitationId}</p>
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Email Input */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Patient Email Address *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="patient@example.com"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Expiration Time */}
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
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem'
            }}
          >
            <option value={1}>1 Hour</option>
            <option value={6}>6 Hours</option>
            <option value={12}>12 Hours</option>
            <option value={24}>24 Hours</option>
            <option value={48}>48 Hours</option>
            <option value={72}>72 Hours</option>
            <option value={168}>1 Week</option>
          </select>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Country Selection */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Allowed Countries *
          </label>
          <select
            multiple
            value={formData.countries}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, option => option.value);
              setFormData({ ...formData, countries: selected });
            }}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              height: '120px'
            }}
          >
            {countryOptions.map(country => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <p style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            marginTop: '0.25rem'
          }}>
            Hold Ctrl/Cmd to select multiple countries
          </p>
        </div>

        {/* Browser Selection */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Allowed Browsers *
          </label>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            {browserOptions.map(browser => (
              <label key={browser.value} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem'
              }}>
                <input
                  type="checkbox"
                  checked={formData.browsers.includes(browser.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({
                        ...formData,
                        browsers: [...formData.browsers, browser.value]
                      });
                    } else {
                      setFormData({
                        ...formData,
                        browsers: formData.browsers.filter(b => b !== browser.value)
                      });
                    }
                  }}
                />
                {browser.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Device Binding */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem'
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#374151',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={formData.deviceBinding}
            onChange={(e) => setFormData({ ...formData, deviceBinding: e.target.checked })}
          />
          <span>Enable Device Binding (Bind invitation to first device that accesses it)</span>
        </label>
        <p style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          marginTop: '0.5rem',
          marginLeft: '1.5rem'
        }}>
          When enabled, the invitation will only work on the first device that accesses it. This provides additional security but may cause issues if the patient needs to switch devices.
        </p>
      </div>

      {/* Create Button */}
      <button
        onClick={handleCreateInvitation}
        disabled={isCreating}
        style={{
          backgroundColor: isCreating ? '#9ca3af' : '#2563eb',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '0.5rem',
          border: 'none',
          fontWeight: '600',
          fontSize: '1rem',
          cursor: isCreating ? 'not-allowed' : 'pointer',
          width: '100%',
          transition: 'background-color 0.2s ease'
        }}
      >
        {isCreating ? 'Creating Invitation...' : '🔐 Create Secure Invitation'}
      </button>
    </div>
  );
}
