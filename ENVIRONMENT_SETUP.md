# Environment Setup Guide - Fix AI Integration & Webhooks

## Current Issues Identified

1. **AI Integration Not Working**: All summaries show "AI summary not available - OpenAI not configured"
2. **LiveKit Webhook Failing**: Getting "fetch failed" errors
3. **Manual Webhook Creating Fake Data**: Random durations and test data being generated

## Required Environment Variables

Create a `.env.local` file in your project root with the following variables:

### OpenAI Configuration (CRITICAL - Fixes AI Integration)
```env
OPENAI_API_KEY=your_actual_openai_api_key_here
```

### LiveKit Configuration (Fix Webhook Issues)
```env
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_actual_livekit_api_key_32_chars_or_more
LIVEKIT_API_SECRET=your_actual_livekit_api_secret_64_chars_or_more
```

### Firebase Configuration (Already Working)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDpok1iYHhrW0igOBuuBP1VWr8_2-EOjkM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=livekit-5eef6.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=livekit-5eef6
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=livekit-5eef6.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=900456648225
NEXT_PUBLIC_FIREBASE_APP_ID=1:900456648225:web:your_app_id_here

# Firebase Admin (Server-side)
FIREBASE_PROJECT_ID=livekit-5eef6
FIREBASE_CLIENT_EMAIL=your_service_account_email@livekit-5eef6.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
```

### Webhook Configuration
```env
NEXT_PUBLIC_BASE_URL=https://livekit-frontend-tau.vercel.app
LIVEKIT_WEBHOOK_SECRET=your_webhook_secret
```

## Step-by-Step Fix Instructions

### 1. Get OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up/Login and create an API key
3. Add it to your `.env.local` file as `OPENAI_API_KEY`

### 2. Get LiveKit Credentials
1. Go to [LiveKit Cloud](https://cloud.livekit.io/)
2. Create a project and get real API keys
3. Replace the placeholder values in your `.env.local`

### 3. Get Firebase Service Account
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (livekit-5eef6)
3. Go to Project Settings > Service Accounts
4. Generate new private key
5. Extract the values for `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY`

### 4. Deploy to Vercel
1. Add all environment variables to your Vercel project settings
2. Redeploy the application

## Testing After Setup

1. **Test OpenAI Integration**: Click "Test Manual Webhook" - should now show real AI summaries
2. **Test LiveKit Webhook**: Click "Test LiveKit Webhook" - should work without fetch errors
3. **Check Dashboard**: Real consultation data should appear instead of test data

## Expected Results After Fix

- ✅ AI summaries will be generated using OpenAI
- ✅ LiveKit webhooks will work properly
- ✅ Dashboard will show real consultation data
- ✅ No more "AI summary not available" messages
- ✅ No more "fetch failed" errors

## Troubleshooting

If you still see issues after setting up environment variables:

1. **Restart your development server**: `npm run dev`
2. **Clear browser cache** and reload the dashboard
3. **Check Vercel logs** for any deployment issues
4. **Verify API keys** are correct and have proper permissions
