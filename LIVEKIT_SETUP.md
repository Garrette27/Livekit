# LiveKit Setup Guide

## Getting LiveKit Credentials

1. **Go to LiveKit Cloud Console**: Visit https://cloud.livekit.io/
2. **Sign up/Login**: Create an account or sign in
3. **Create a Project**: 
   - Click "Create Project" or "New Project"
   - Give it a name (e.g., "My Video App")
4. **Get API Keys**:
   - In your project dashboard, go to "API Keys" section
   - Click "Create API Key"
   - Give it a name (e.g., "Development Key")
   - **IMPORTANT**: Copy both the API Key and API Secret
   - The API Key should be ~32+ characters long
   - The API Secret should be ~64+ characters long

## Environment Variables

Create a `.env.local` file in your project root with:

```env
# LiveKit Configuration
LIVEKIT_API_KEY=your_actual_api_key_here_32_chars_or_more
LIVEKIT_API_SECRET=your_actual_api_secret_here_64_chars_or_more
NEXT_PUBLIC_LIVEKIT_URL=wss://your-project-name.livekit.cloud

# Firebase Configuration (you already have these)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDpok1iYHhrW0igOBuuBP1VWr8_2-EOjkM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=livekit-5eef6.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=livekit-5eef6
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=livekit-5eef6.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=900456648225
```

## Current Issue

Your current LiveKit credentials appear to be incorrect:
- API Key: `API7aqt5JnUsfGr` (too short - should be ~32+ chars)
- API Secret: `f8sLiYKYx1fiA6CvfnlOpXlvOzyROteBSVB7LH3VFESC` (too short - should be ~64+ chars)

## Steps to Fix

1. **Get Real Credentials**: Follow steps 1-4 above to get actual LiveKit API keys
2. **Update .env.local**: Replace the placeholder values with your real credentials
3. **Restart Server**: Stop `npm run dev` and restart it
4. **Test**: Try joining a room again

## Common Issues

- **"invalid token" error**: Usually means wrong API key/secret
- **"401 Unauthorized"**: Check that your credentials are correct
- **"cryptographic primitive error"**: Indicates malformed JWT due to wrong credentials

## Verification

After updating credentials, you should see in the server logs:
- Token type: string
- Token length: ~200+ characters
- Token preview: eyJhbGciOiJIUzI1NiJ9.eyJ2aWRlbyI6eyJyb29tSm9pbiI6d...
