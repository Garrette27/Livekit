'use client';
import { useState } from 'react';

export default function TestPage() {
  const [roomName, setRoomName] = useState('test-room-' + Date.now());
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [envCheck, setEnvCheck] = useState<any>(null);

  const testWebhook = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Testing webhook for room:', roomName);
      
      const response = await fetch('/api/manual-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName })
      });
      
      const data = await response.json();
      console.log('Webhook test result:', data);
      setResult(data);
      
      if (data.success) {
        // Wait a moment then check the dashboard
        setTimeout(() => {
          window.open('/dashboard', '_blank');
        }, 2000);
      }
    } catch (error) {
      console.error('Webhook test error:', error);
      setResult({ error: 'Test failed', details: error });
    } finally {
      setLoading(false);
    }
  };

  const testLiveKitWebhook = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Testing LiveKit webhook for room:', roomName);
      
      const response = await fetch('/api/test-livekit-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName })
      });
      
      const data = await response.json();
      console.log('LiveKit webhook test result:', data);
      setResult(data);
      
      if (data.success) {
        // Wait a moment then check the dashboard
        setTimeout(() => {
          window.open('/dashboard', '_blank');
        }, 2000);
      }
    } catch (error) {
      console.error('LiveKit webhook test error:', error);
      setResult({ error: 'Test failed', details: error });
    } finally {
      setLoading(false);
    }
  };

  const checkEnvironment = async () => {
    setLoading(true);
    setEnvCheck(null);
    
    try {
      console.log('Checking environment configuration...');
      
      const response = await fetch('/api/env-check');
      const data = await response.json();
      console.log('Environment check result:', data);
      setEnvCheck(data);
    } catch (error) {
      console.error('Environment check error:', error);
      setEnvCheck({ error: 'Environment check failed', details: error });
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
        maxWidth: '48rem', 
        margin: '0 auto'
      }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          color: '#1e40af', 
          marginBottom: '2rem',
          textAlign: 'center'
        }}>
          Webhook Test Page
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
            Test Configuration
          </h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
              Room Name
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={testWebhook}
              disabled={loading || !roomName.trim()}
              style={{
                backgroundColor: loading || !roomName.trim() ? '#9ca3af' : '#2563eb',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: loading || !roomName.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {loading ? 'Testing...' : 'Test Manual Webhook'}
            </button>
            
            <button
              onClick={testLiveKitWebhook}
              disabled={loading || !roomName.trim()}
              style={{
                backgroundColor: loading || !roomName.trim() ? '#9ca3af' : '#7c3aed',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: loading || !roomName.trim() ? 'not-allowed' : 'pointer',
                fontWeight: '600'
              }}
            >
              {loading ? 'Testing...' : 'Test LiveKit Webhook'}
            </button>

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
              {loading ? 'Checking...' : 'Check Environment'}
            </button>
          </div>
        </div>

        {result && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: result.error ? '#dc2626' : '#059669', 
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
              color: result.error ? '#dc2626' : '#059669'
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
            
            {result.success && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#dbeafe', borderRadius: '0.5rem' }}>
                <p style={{ color: '#1e40af', margin: 0 }}>
                  ✅ Test completed successfully! Check the dashboard to see the generated summary.
                </p>
              </div>
            )}
          </div>
        )}

        {envCheck && (
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
              color: envCheck.isConfigured ? '#059669' : '#dc2626', 
              marginBottom: '1rem'
            }}>
              Environment Configuration
            </h2>
            
            {envCheck.criticalIssues && envCheck.criticalIssues.length > 0 && (
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
                <h3 style={{ color: '#dc2626', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Critical Issues:</h3>
                <ul style={{ color: '#dc2626', margin: 0, paddingLeft: '1.5rem' }}>
                  {envCheck.criticalIssues.map((issue: string, index: number) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {envCheck.warnings && envCheck.warnings.length > 0 && (
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fffbeb', borderRadius: '0.5rem', border: '1px solid #fed7aa' }}>
                <h3 style={{ color: '#d97706', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Warnings:</h3>
                <ul style={{ color: '#d97706', margin: 0, paddingLeft: '1.5rem' }}>
                  {envCheck.warnings.map((warning: string, index: number) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {envCheck.isConfigured && (
              <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                <p style={{ color: '#059669', margin: 0, fontWeight: '600' }}>
                  ✅ All critical environment variables are properly configured!
                </p>
              </div>
            )}

            <pre style={{
              backgroundColor: '#f3f4f6',
              padding: '1rem',
              borderRadius: '0.5rem',
              overflow: 'auto',
              fontSize: '0.875rem',
              color: '#374151'
            }}>
              {JSON.stringify(envCheck.envStatus, null, 2)}
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
            Next Steps
          </h2>
          <ol style={{ color: '#6b7280', lineHeight: '1.6' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              Click "Check Environment" to verify your configuration
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Click one of the test buttons above to generate a test summary
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Check the console for detailed logs
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Visit the dashboard to see if the summary appears
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              Test with actual video calls to verify webhook triggering
            </li>
          </ol>
          
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #0ea5e9' }}>
            <p style={{ color: '#0c4a6e', margin: '0 0 0.5rem 0', fontWeight: '600' }}>
              Need help configuring environment variables?
            </p>
            <p style={{ color: '#0c4a6e', margin: 0, fontSize: '0.875rem' }}>
              Check the <a href="/ENVIRONMENT_SETUP.md" target="_blank" style={{ color: '#0ea5e9', textDecoration: 'underline' }}>Environment Setup Guide</a> for detailed instructions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
