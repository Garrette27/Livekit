# Firebase Environment Variables Setup

## Issue: Firebase Private Key Error

The build error you're seeing is due to an incorrectly formatted Firebase private key in your environment variables.

## Solution

### 1. Check your `.env.local` file

Make sure your Firebase private key is properly formatted:

```bash
# Correct format
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----"

# OR if you have the key without the markers, the system will add them automatically
FIREBASE_PRIVATE_KEY="MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC..."
```

### 2. Common Issues and Fixes

#### Issue: "Only 8, 16, 24, or 32 bits supported: 88"
This error occurs when the private key is not properly formatted or has incorrect newline characters.

#### Fix: Proper Newline Handling
```bash
# Wrong (causes the error)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----"

# Correct (use actual newlines or \\n)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----"
```

### 3. Complete Environment Variables Template

Create or update your `.env.local` file with these variables:

```bash
# Firebase Configuration (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin Configuration (Server-side)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"

# LiveKit Configuration
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_WEBHOOK_SECRET=your_webhook_secret

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 4. How to Get Firebase Private Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (gear icon)
4. Go to "Service accounts" tab
5. Click "Generate new private key"
6. Download the JSON file
7. Extract the `private_key` field from the JSON
8. Use it in your environment variable

### 5. Alternative: Use JSON File (Not Recommended for Production)

If you're having trouble with the environment variable, you can temporarily use a JSON file:

```typescript
// lib/firebase-admin.ts (temporary solution)
import serviceAccount from './path/to/serviceAccountKey.json';

const app = initializeApp({
  credential: cert(serviceAccount as any),
});
```

**Note:** Never commit the JSON file to version control!

### 6. Test Your Setup

After updating your environment variables:

1. Restart your development server
2. Run `npm run build` again
3. The Firebase Admin errors should be resolved

### 7. Build-Time Considerations

The updated code now handles build-time errors gracefully:

- If Firebase Admin fails to initialize during build, it logs a warning instead of crashing
- This allows the build to complete even if environment variables are not set
- The app will still work in production when proper environment variables are provided

## Quick Fix

If you want to build immediately without fixing the Firebase issue:

1. Comment out or remove the Firebase Admin environment variables temporarily
2. Run `npm run build`
3. The build should complete successfully
4. Add the Firebase variables back when you're ready to test the full functionality

## Verification

After fixing the environment variables, you should see:
- No Firebase Admin initialization errors during build
- Successful build completion
- All invitation system features working properly
