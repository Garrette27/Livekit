'use client';
import { useState } from 'react';

export default function DebugPage() {
  const [roomName, setRoomName] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testWebhook = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/test-webhook');
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ error: 'Test failed', details: error });
    } finally {
      setLoading(false);
    }
  };

  const checkEnvironment = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/env-check');
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ error: 'Environment check failed', details: error });
    } finally {
      setLoading(false);
    }
  };

  const triggerManualWebhook = async () => {
    if (!roomName.trim()) {
      alert('Please enter a room name');
      return;
    }

    setLoading(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/manual-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomName: roomName.trim() }),
      });
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ error: 'Manual webhook failed', details: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#eff6ff',
      padding: '2rem'
    }}>
      <div style={{ 
        maxWidth: '72rem', 
        margin: '0 auto'
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          color: '#1e40af', 
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          Webhook Debug Page
        </h1>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            color: '#1e40af', 
            marginBottom: '1rem'
          }}>
            Check Environment Variables
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            This will check if all required environment variables are properly configured.
          </p>
          <button
            onClick={checkEnvironment}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#9ca3af' : '#059669',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600'
            }}
          >
            {loading ? 'Checking...' : 'Check Environment Variables'}
          </button>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            color: '#1e40af', 
            marginBottom: '1rem'
          }}>
            Test Firebase Connection
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            This will test if Firebase Admin is properly configured and can store summaries.
          </p>
          <button
            onClick={testWebhook}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600'
            }}
          >
            {loading ? 'Testing...' : 'Test Firebase Connection'}
          </button>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            color: '#1e40af', 
            marginBottom: '1rem'
          }}>
            Manual Webhook Trigger
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            This will manually trigger the webhook to generate an AI summary for a specific room.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name (e.g., test-room-123)"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>
          <button
            onClick={triggerManualWebhook}
            disabled={loading || !roomName.trim()}
            style={{
              backgroundColor: loading || !roomName.trim() ? '#9ca3af' : '#dc2626',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: loading || !roomName.trim() ? 'not-allowed' : 'pointer',
              fontWeight: '600'
            }}
          >
            {loading ? 'Triggering...' : 'Trigger Manual Webhook'}
          </button>
        </div>

        {testResult && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: '#1e40af', 
              marginBottom: '1rem'
            }}>
              Test Results
            </h2>
            <pre style={{
              backgroundColor: '#f3f4f6',
              padding: '1rem',
              borderRadius: '0.5rem',
              overflow: 'auto',
              fontSize: '0.875rem',
              color: testResult.error ? '#dc2626' : '#059669'
            }}>
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}

        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          marginTop: '2rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            color: '#1e40af', 
            marginBottom: '1rem'
          }}>
            Troubleshooting Steps
          </h2>
          <ol style={{ color: '#6b7280', lineHeight: '1.6' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Check Environment Variables:</strong> Click the first button to verify all required variables are set
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Test Firebase Connection:</strong> If environment is OK, test Firebase Admin functionality
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Test Webhook:</strong> Use the manual trigger to test the full webhook flow
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Check Dashboard:</strong> After successful webhook, check the dashboard for the summary
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>LiveKit Configuration:</strong> Ensure LiveKit webhook is pointing to your deployed webhook URL
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
