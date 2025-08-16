# LiveKit Telehealth Console

A modern telehealth platform built with LiveKit, Firebase, and OpenAI that provides secure video calls with automatic AI-powered call summaries.

## 🚀 Features

- **Secure Video Calls**: Built on LiveKit's WebRTC infrastructure
- **Google Authentication**: Secure sign-in for healthcare providers
- **Room Management**: Create and manage telehealth sessions
- **Patient Links**: Shareable URLs for patients to join calls
- **AI Summaries**: Automatic call summaries using OpenAI GPT-4
- **Real-time Dashboard**: View call history and summaries
- **Automatic Cleanup**: Call records are automatically removed after sessions

## 🏗️ Architecture

This project implements **Option 2** from the LiveKit integration guide:

- **Frontend**: Next.js + LiveKit Components
- **Backend**: Firebase Functions + Vercel Serverless Functions
- **Database**: Firestore for call management and summaries
- **AI**: OpenAI GPT-4 for call summarization
- **Webhooks**: LiveKit webhooks for real-time room event processing

## 📁 Project Structure

```
livekit-frontend/
├── app/
│   ├── api/
│   │   ├── token/          # LiveKit token generation
│   │   └── webhook/        # LiveKit webhook handler
│   ├── dashboard/          # Call summaries dashboard
│   ├── room/[roomName]/    # Patient room joining
│   └── page.tsx            # Main console
├── lib/
│   ├── firebase.ts         # Client-side Firebase config
│   └── firebase-admin.ts   # Server-side Firebase admin
└── functions/              # Firebase Cloud Functions
    └── index.js            # LiveKit token generation
```

## 🔧 Setup Instructions

### 1. Prerequisites

- Node.js 18+ 
- Firebase project
- LiveKit Cloud account
- OpenAI API key

### 2. Environment Configuration

Create `.env.local` in `livekit-frontend/`:

```bash
# LiveKit
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Firebase (Client)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Server)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour key\n-----END PRIVATE KEY-----"

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### 3. Installation

```bash
# Install dependencies
npm install

# Install Firebase Functions dependencies
cd functions
npm install

# Return to root
cd ..
```

### 4. Firebase Setup

1. **Enable Services**:
   - Authentication (Google Sign-in)
   - Firestore Database
   - Cloud Functions

2. **Service Account**:
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Extract credentials for environment variables

3. **Security Rules** (Firestore):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /calls/{document} {
      allow read, write: if request.auth != null;
    }
    match /call-summaries/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. LiveKit Setup

1. **Create Project**:
   - Go to [LiveKit Cloud](https://cloud.livekit.io/)
   - Create new project
   - Get API key and secret

2. **Configure Webhook**:
   - Add webhook URL: `https://your-domain.com/api/webhook`
   - Select `room_finished` event
   - Copy webhook secret (optional)

### 6. OpenAI Setup

1. **Get API Key**:
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Create API key
   - Add to environment variables

## 🚀 Deployment

### Firebase Functions
```bash
firebase deploy --only functions
```

### Next.js Frontend
```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod
```

## 🔄 How It Works

### 1. Call Creation
1. Provider signs in with Google
2. Creates a new room with custom name
3. System generates LiveKit token
4. Provider joins the call
5. Patient link is generated and displayed

### 2. Patient Joining
1. Patient clicks the shared link
2. System generates patient token
3. Patient joins the same room
4. Video call begins

### 3. Call Completion
1. When call ends, LiveKit sends webhook
2. Webhook handler:
   - Deletes call record from Firestore
   - Generates AI summary using OpenAI
   - Stores summary in `call-summaries` collection
3. Provider can view summaries in dashboard

## 📊 Data Flow

```
Provider → Creates Room → Firestore (calls collection)
     ↓
Patient → Joins Room → LiveKit Video Call
     ↓
Call Ends → LiveKit Webhook → API Route
     ↓
Webhook Handler → Delete Call Record + Generate AI Summary
     ↓
Summary Stored → Firestore (call-summaries collection)
     ↓
Dashboard → Displays Call History + Summaries
```

## 🛡️ Security Features

- **Authentication**: Google OAuth required for all operations
- **Token-based**: LiveKit tokens with room-specific permissions
- **Database Rules**: Firestore security rules prevent unauthorized access
- **Webhook Validation**: Optional webhook secret verification

## 🔍 Monitoring & Debugging

### Logs
- **Frontend**: Browser console for client-side issues
- **API Routes**: Vercel function logs
- **Firebase Functions**: Firebase console logs

### Common Issues
1. **Token Generation Fails**: Check LiveKit credentials
2. **Webhook Not Working**: Verify webhook URL and event selection
3. **AI Summary Fails**: Check OpenAI API key and quota
4. **Firebase Errors**: Verify service account credentials

## 🚀 Future Enhancements

- **Recording**: Call recording and storage
- **Transcription**: Real-time speech-to-text
- **Analytics**: Call duration, participant metrics
- **Notifications**: Email/SMS reminders
- **Multi-tenant**: Support for multiple healthcare organizations
- **Mobile App**: React Native companion app

## 📚 Resources

- [LiveKit Documentation](https://docs.livekit.io/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Search existing issues
3. Create new issue with detailed description
4. Include environment details and error logs
