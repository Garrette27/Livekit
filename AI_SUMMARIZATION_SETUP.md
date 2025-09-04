# AI Summarization and Automatic Deletion Setup

This document explains the AI-powered consultation summarization and automatic deletion features implemented for secure teleconsultation.

## Features Overview

### 🤖 AI Summarization
- **Structured Summaries**: AI generates comprehensive, structured summaries of consultations
- **Medical Focus**: Specialized prompts for medical consultation analysis
- **Key Components**:
  - Executive summary
  - Key points discussed
  - Medical recommendations
  - Follow-up actions required
  - Risk level assessment
  - Consultation category classification

### 🔒 Security & Compliance
- **Automatic Deletion**: Summaries are automatically deleted after 30 days for HIPAA compliance
- **Manual Deletion**: Admins can manually delete summaries when needed
- **Call Record Cleanup**: Original call records are deleted immediately after summary generation
- **Scheduled Cleanup**: Cloud Functions handle automatic deletion on a daily schedule

## Setup Instructions

### 1. Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# OpenAI API Key for AI summarization
OPENAI_API_KEY=your_openai_api_key_here

# LiveKit Configuration (existing)
NEXT_PUBLIC_LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Firebase Configuration (existing)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

### 2. OpenAI API Setup

1. Create an account at [OpenAI](https://platform.openai.com/)
2. Generate an API key
3. Add the API key to your environment variables
4. Ensure you have sufficient credits for API calls

### 3. Firebase Cloud Functions Deployment

Deploy the Cloud Functions for automatic deletion:

```bash
cd functions
npm install
firebase deploy --only functions
```

### 4. LiveKit Webhook Configuration

Configure LiveKit webhooks to trigger summary generation:

1. In your LiveKit dashboard, set up a webhook endpoint
2. Point it to: `https://your-domain.com/api/webhook`
3. Configure it to trigger on `room_finished` events

## How It Works

### 1. Call Completion Flow

```
1. Video call ends
2. LiveKit sends webhook to /api/webhook
3. AI generates structured summary
4. Summary stored in Firestore
5. Original call record deleted
6. Automatic deletion scheduled (30 days)
```

### 2. AI Summary Generation

The AI uses a specialized medical prompt to generate structured summaries:

```json
{
  "summary": "Concise overview of the consultation",
  "keyPoints": ["Main topics discussed", "Important symptoms", "Key findings"],
  "recommendations": ["Medical advice", "Prescriptions", "Lifestyle changes"],
  "followUpActions": ["Next appointments", "Tests required", "Follow-up care"],
  "riskLevel": "Low/Medium/High",
  "category": "Primary Care/Specialist/Emergency/Follow-up"
}
```

### 3. Automatic Deletion Process

- **Daily Schedule**: Cloud Function runs every 24 hours
- **30-Day Rule**: Summaries older than 30 days are automatically deleted
- **Cleanup**: Both summary and scheduled deletion records are removed
- **Logging**: All deletion activities are logged for audit purposes

## Dashboard Features

### Summary Display
- **Structured Layout**: Each summary shows all AI-generated components
- **Color Coding**: Risk levels and categories are color-coded
- **Filtering**: Filter by category and risk level
- **Search**: Find specific consultations quickly

### Security Indicators
- **Auto-delete Notice**: Shows when summaries will be automatically deleted
- **Manual Delete**: Admins can manually delete summaries
- **Audit Trail**: All deletion activities are logged

## API Endpoints

### Webhook Endpoint
- **URL**: `/api/webhook`
- **Method**: POST
- **Purpose**: Receives LiveKit room completion events
- **Actions**: Generates AI summary, stores data, schedules deletion

### Manual Deletion Endpoint
- **URL**: `/api/summary/delete?id={summaryId}`
- **Method**: DELETE
- **Purpose**: Manually delete a specific summary
- **Authentication**: Requires admin privileges

## Cloud Functions

### autoDeleteSummaries
- **Trigger**: Daily scheduled function
- **Purpose**: Automatically delete summaries older than 30 days
- **Logging**: Comprehensive logging of deletion activities

### manualDeleteSummary
- **Trigger**: HTTPS callable function
- **Purpose**: Manual deletion of specific summaries
- **Security**: Requires user authentication

### getDeletionStats
- **Trigger**: HTTPS callable function
- **Purpose**: Get deletion statistics and metrics
- **Returns**: Summary counts and deletion schedules

## Security Considerations

### HIPAA Compliance
- **30-Day Retention**: Summaries are automatically deleted after 30 days
- **No PII Storage**: AI summaries don't contain personally identifiable information
- **Secure Transmission**: All data transmitted over HTTPS
- **Access Control**: Only authenticated users can access summaries

### Data Protection
- **Immediate Cleanup**: Call records deleted immediately after summary generation
- **Encrypted Storage**: All data stored in encrypted Firestore
- **Audit Logging**: All deletion activities are logged
- **Manual Override**: Admins can manually delete summaries when needed

## Monitoring and Maintenance

### Logs to Monitor
- Webhook processing logs
- AI summary generation logs
- Automatic deletion logs
- Manual deletion logs

### Performance Metrics
- Summary generation success rate
- Deletion completion rate
- API response times
- Error rates

### Regular Maintenance
- Monitor OpenAI API usage and costs
- Review deletion logs for anomalies
- Update AI prompts as needed
- Monitor Cloud Function performance

## Troubleshooting

### Common Issues

1. **AI Summary Not Generated**
   - Check OpenAI API key configuration
   - Verify API credits are available
   - Check webhook endpoint configuration

2. **Summaries Not Deleted**
   - Verify Cloud Functions are deployed
   - Check Firestore permissions
   - Review Cloud Function logs

3. **Dashboard Not Loading**
   - Check Firebase configuration
   - Verify authentication setup
   - Check Firestore security rules

### Error Handling
- All functions include comprehensive error handling
- Failed operations are logged with detailed error messages
- Graceful fallbacks for missing data
- User-friendly error messages in the UI

## Cost Considerations

### OpenAI API Costs
- **GPT-4o-mini**: ~$0.15 per 1M input tokens
- **Typical Summary**: ~800 tokens per consultation
- **Estimated Cost**: ~$0.00012 per consultation

### Firebase Costs
- **Firestore**: Pay per read/write operation
- **Cloud Functions**: Pay per invocation
- **Estimated Cost**: Minimal for typical usage

## Future Enhancements

### Planned Features
- **Audio Transcription**: Convert audio to text for better summaries
- **Multi-language Support**: Support for multiple languages
- **Advanced Analytics**: Detailed consultation analytics
- **Export Functionality**: Export summaries in various formats
- **Integration**: Connect with EHR systems

### AI Improvements
- **Custom Training**: Train AI on specific medical specialties
- **Better Prompts**: Continuously improve AI prompts
- **Context Awareness**: Better understanding of medical context
- **Accuracy Improvements**: Reduce AI hallucinations

## Support

For technical support or questions about the AI summarization features:

1. Check the logs for error messages
2. Verify all environment variables are set correctly
3. Ensure all dependencies are installed
4. Review the troubleshooting section above

## Legal and Compliance

This implementation is designed to be HIPAA-compliant, but you should:

1. **Consult Legal Counsel**: Ensure compliance with your jurisdiction's laws
2. **Review Security**: Conduct security audits as needed
3. **Update Policies**: Update your privacy policies accordingly
4. **Train Staff**: Ensure staff understand the new features
5. **Monitor Usage**: Regularly review usage and compliance













