const jwt = require('jsonwebtoken');

// Test function to verify LiveKit credentials
function testLiveKitCredentials(apiKey, apiSecret) {
  try {
    const payload = {
      iss: apiKey,
      sub: 'test-user',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      video: {
        roomJoin: true,
        room: 'test-room'
      }
    };

    const token = jwt.sign(payload, apiSecret, {
      algorithm: 'HS256',
      header: {
        typ: 'JWT',
        alg: 'HS256'
      }
    });

    console.log('✅ Token generated successfully');
    console.log('Token preview:', token.substring(0, 50) + '...');
    console.log('Token length:', token.length);
    
    // Verify the token can be decoded
    const decoded = jwt.verify(token, apiSecret);
    console.log('✅ Token verified successfully');
    console.log('Decoded payload:', JSON.stringify(decoded, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Error generating/verifying token:', error.message);
    return false;
  }
}

// Usage example (replace with your actual credentials)
// testLiveKitCredentials('YOUR_API_KEY', 'YOUR_API_SECRET');

module.exports = { testLiveKitCredentials };
