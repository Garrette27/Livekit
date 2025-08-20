# LiveKit + Firebase + OpenAI Setup Guide

## Environment Variables Required

Create a `.env.local` file in your `livekit-frontend` directory with the following variables:

### LiveKit Configuration
```
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

### Firebase Configuration (Client-side)
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Firebase Admin Configuration (Server-side)
```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
```

### OpenAI Configuration
```
OPENAI_API_KEY=your_openai_api_key
```

### LiveKit Webhook Secret (optional but recommended)
```
LIVEKIT_WEBHOOK_SECRET=your_webhook_secret
```

## Setup Steps

### 1. LiveKit Cloud Setup
1. Go to [LiveKit Cloud](https://cloud.livekit.io/)
2. Create a new project
3. Get your API key and secret
4. Note your server URL

### 2. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Enable Authentication (Google Sign-in)
4. Enable Firestore Database
5. Create a service account and download the JSON key
6. Extract the required fields for environment variables

### 3. OpenAI Setup
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Add it to your environment variables

### 4. LiveKit Webhook Configuration
1. In your LiveKit Cloud dashboard, go to Webhooks
2. Add a new webhook with URL: `https://your-domain.com/api/webhook`
3. Select the `room_finished` event
4. Copy the webhook secret (if provided)

### 5. Deploy
1. Deploy your Firebase Functions: `firebase deploy --only functions`
2. Deploy your Next.js app to Vercel or your preferred platform
3. Update the webhook URL in LiveKit Cloud to point to your deployed domain

## How It Works

1. **User joins a room**: Frontend creates a room in Firestore and gets a LiveKit token
2. **Call ends**: LiveKit sends a webhook to your `/api/webhook` endpoint
3. **Webhook processing**: 
   - Immediately deletes the call record from Firestore
   - Generates an AI summary using OpenAI
   - Stores the summary in a separate collection
4. **Data cleanup**: Call records are automatically removed, summaries are preserved

## Collections in Firestore

- `calls`: Active call records (deleted when call ends)
- `call-summaries`: AI-generated summaries (preserved for reference)

## Testing

1. Start a call in your app
2. End the call
3. Check your webhook logs in the browser console
4. Verify the call record is deleted from Firestore
5. Check that a summary is generated and stored
