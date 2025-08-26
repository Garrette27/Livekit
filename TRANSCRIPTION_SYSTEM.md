# LiveKit Transcription System

## Overview

The LiveKit transcription system has been enhanced to capture actual conversation content during video calls, enabling AI-powered summarization based on real conversation data instead of generic templates.

## How It Works

### 1. Real-time Speech Recognition
- **Web Speech API**: Uses the browser's built-in speech recognition capabilities
- **Continuous Monitoring**: Automatically captures speech during the call
- **Multi-participant Support**: Captures speech from all participants
- **Timestamp Tracking**: Each transcription entry includes timestamps

### 2. Manual Notes
- **Floating Button**: A 📝 button appears during calls for manual note-taking
- **Quick Input**: Users can add important conversation points manually
- **Real-time Storage**: Notes are immediately saved to Firestore

### 3. Data Storage
- **Firestore Integration**: All transcription data is stored in the `calls` collection
- **Real-time Updates**: Transcription is updated every 5 seconds during the call
- **Automatic Cleanup**: Call records are deleted after webhook processing

### 4. AI Summarization
- **Context-Aware**: AI receives actual conversation content
- **Structured Analysis**: Generates comprehensive medical summaries
- **Privacy-Focused**: Respects HIPAA compliance requirements

## Features

### Automatic Speech Capture
```javascript
// Web Speech API integration
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
recognitionRef.current = new SpeechRecognition();
recognitionRef.current.continuous = true;
recognitionRef.current.interimResults = true;
```

### Manual Note Taking
- Floating button (📝) in the bottom-right corner during calls
- Text area for entering important conversation points
- Ctrl+Enter to quickly save notes
- Automatic timestamp and participant identification

### Enhanced AI Prompts
The AI now receives actual conversation context:
```
Actual conversation transcript:
[Doctor] (2025-08-26T13:45:00.000Z): Hello, how are you feeling today?
[Patient] (2025-08-26T13:45:15.000Z): I've been experiencing headaches for the past week
[Doctor] (2025-08-26T13:45:30.000Z): Let's discuss your symptoms in detail
```

## Browser Compatibility

### Supported Browsers
- Chrome/Chromium (recommended)
- Edge
- Safari (limited support)
- Firefox (limited support)

### Requirements
- HTTPS connection (required for Web Speech API)
- Microphone permissions
- Modern browser with speech recognition support

## Privacy & Security

### Data Handling
- **Local Processing**: Speech recognition happens in the browser
- **Encrypted Storage**: All data stored in Firestore with encryption
- **Automatic Deletion**: Call records deleted after processing
- **HIPAA Compliance**: 30-day automatic deletion of summaries

### User Control
- Users can disable microphone access
- Manual notes are optional
- All data is user-controlled

## Troubleshooting

### Common Issues

1. **Speech Recognition Not Working**
   - Check browser compatibility
   - Ensure HTTPS connection
   - Verify microphone permissions
   - Try refreshing the page

2. **No Transcription Data**
   - Check browser console for errors
   - Verify microphone is working
   - Try manual note-taking as backup

3. **AI Summary Still Generic**
   - Check if transcription data exists in Firestore
   - Verify webhook is receiving transcription data
   - Check OpenAI API configuration

### Debug Information
- Browser console shows transcription entries
- Firestore contains raw transcription data
- Webhook logs show data processing steps

## Future Enhancements

### Planned Features
- **Multi-language Support**: Support for different languages
- **Advanced Speech Processing**: Better noise filtering
- **Real-time Translation**: Live translation capabilities
- **Enhanced AI Models**: More sophisticated summarization

### Integration Options
- **External STT Services**: Google Speech-to-Text, Azure Speech
- **Custom AI Models**: Fine-tuned medical summarization models
- **Analytics Dashboard**: Transcription quality metrics

## Configuration

### Environment Variables
```env
# Required for AI summarization
OPENAI_API_KEY=your_openai_api_key

# Firebase configuration (already configured)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY=your_private_key
```

### LiveKit Configuration
- Webhook URL: `https://your-domain.com/api/webhook`
- Event: `room_finished`
- Ensure webhook secret is configured

## Testing

### Manual Testing
1. Start a video call
2. Speak clearly into the microphone
3. Check browser console for transcription entries
4. Use manual note-taking feature
5. End the call and check webhook processing
6. Verify AI summary contains actual conversation content

### Automated Testing
- Use the "Test Webhook" feature in the dashboard
- Check transcription data in Firestore
- Verify AI summary quality

## Support

For issues or questions:
1. Check browser console for errors
2. Verify all environment variables are set
3. Test with manual webhook endpoint
4. Review Firestore data structure
5. Check webhook logs in Vercel dashboard
