# Secure Teleconsultation Platform

A HIPAA-compliant video consultation platform built with Next.js, LiveKit, Firebase, and AI-powered summarization.

## 🚀 Features

### Video Consultation
- **High-quality video calls** powered by LiveKit
- **Screen sharing** for medical imaging and documents
- **Chat functionality** for text communication
- **Secure room creation** with unique URLs
- **Mobile-responsive** design

### 🤖 AI-Powered Summarization
- **Automatic consultation summaries** generated after each call
- **Structured medical analysis** with key points, recommendations, and follow-up actions
- **Risk level assessment** and consultation categorization
- **HIPAA-compliant** data handling

### 🔒 Security & Compliance
- **Automatic deletion** of summaries after 30 days
- **Immediate call record cleanup** for security
- **Encrypted data storage** in Firebase
- **Audit logging** for all operations
- **Manual deletion** capabilities for admins

### 📊 Dashboard
- **Comprehensive consultation history** with AI summaries
- **Filtering and search** by category and risk level
- **Real-time updates** via Firestore listeners
- **Statistics and analytics** for consultation tracking

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Video**: LiveKit for real-time communication
- **Backend**: Firebase (Firestore, Authentication, Cloud Functions)
- **AI**: OpenAI GPT-4o-mini for summarization
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

## 📋 Prerequisites

- Node.js 18+ 
- Firebase project
- LiveKit account
- OpenAI API key
- Vercel account (for deployment)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Livekit
```

### 2. Install Dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```bash
# OpenAI API Key for AI summarization
OPENAI_API_KEY=your_openai_api_key_here

# LiveKit Configuration
NEXT_PUBLIC_LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

### 4. Firebase Setup

1. Create a Firebase project
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Set up security rules
5. Generate service account key

### 5. LiveKit Setup

1. Create a LiveKit account
2. Create a project
3. Get your API keys and server URL
4. Configure webhooks to point to `/api/webhook`

### 6. OpenAI Setup

1. Create an OpenAI account
2. Generate an API key
3. Add sufficient credits for API calls

### 7. Deploy Cloud Functions

```bash
cd functions
firebase deploy --only functions
```

### 8. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📚 Documentation

- [AI Summarization Setup](./AI_SUMMARIZATION_SETUP.md) - Detailed guide for AI features
- [LiveKit Setup](./LIVEKIT_SETUP.md) - LiveKit configuration guide
- [General Setup](./SETUP.md) - Complete setup instructions

## 🔧 Configuration

### LiveKit Webhook Configuration

Configure your LiveKit webhook to trigger AI summarization:

1. In LiveKit dashboard, go to Webhooks
2. Add webhook endpoint: `https://your-domain.com/api/webhook`
3. Select `room_finished` event
4. Save configuration

### Firebase Security Rules

Ensure your Firestore security rules allow authenticated access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /call-summaries/{document} {
      allow read, write: if request.auth != null;
    }
    match /scheduled-deletions/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Deploy Cloud Functions

```bash
cd functions
firebase deploy --only functions
```

## 📊 Usage

### For Doctors

1. **Start a Consultation**: Create a new room from the dashboard
2. **Share Room Link**: Send the unique room URL to patients
3. **Conduct Video Call**: Use video, audio, screen sharing, and chat
4. **Review Summaries**: Access AI-generated summaries in the dashboard
5. **Manage Records**: View, filter, and manually delete summaries as needed

### For Patients

1. **Join Consultation**: Click the room link provided by the doctor
2. **Enter Name**: Provide your name to join the call
3. **Participate**: Use video, audio, and chat features
4. **End Call**: Close the browser when consultation is complete

## 🔒 Security Features

- **HIPAA Compliance**: 30-day automatic deletion of all data
- **Encrypted Storage**: All data encrypted in transit and at rest
- **Access Control**: Authentication required for all sensitive operations
- **Audit Logging**: Complete audit trail of all activities
- **Secure Communication**: End-to-end encrypted video calls

## 🛠️ Development

### Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── dashboard/         # Doctor dashboard
│   ├── room/              # Video call rooms
│   └── ...
├── functions/             # Firebase Cloud Functions
├── lib/                   # Utility libraries
├── public/                # Static assets
└── ...
```

### Key Files

- `app/api/webhook/route.ts` - AI summarization webhook
- `app/dashboard/page.tsx` - Doctor dashboard
- `app/room/[room]/page.tsx` - Video call interface
- `functions/index.js` - Cloud Functions for automatic deletion

### Adding Features

1. **New API Routes**: Add to `app/api/`
2. **New Pages**: Add to `app/`
3. **Cloud Functions**: Add to `functions/index.js`
4. **Styling**: Use Tailwind CSS classes

## 🐛 Troubleshooting

### Common Issues

1. **Video Call Not Working**
   - Check LiveKit configuration
   - Verify environment variables
   - Check browser permissions

2. **AI Summaries Not Generated**
   - Verify OpenAI API key
   - Check webhook configuration
   - Review API usage limits

3. **Dashboard Not Loading**
   - Check Firebase configuration
   - Verify authentication setup
   - Check Firestore security rules

### Getting Help

1. Check the logs for error messages
2. Verify all environment variables are set
3. Review the documentation files
4. Check Firebase and LiveKit dashboards

## 📈 Monitoring

### Key Metrics to Monitor

- **Video Call Quality**: Connection stability, audio/video quality
- **AI Summary Generation**: Success rate, response times
- **Automatic Deletion**: Completion rate, error rates
- **User Engagement**: Dashboard usage, consultation frequency

### Logs to Watch

- Webhook processing logs
- AI summary generation logs
- Cloud Function execution logs
- Authentication logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is designed for medical consultations but should be used in compliance with local healthcare regulations. Always consult with legal and compliance experts before using in a production healthcare environment.

## 🆘 Support

For support and questions:

1. Check the documentation files
2. Review the troubleshooting section
3. Check the logs for error messages
4. Contact the development team

---

**Built with ❤️ for secure healthcare communication**
