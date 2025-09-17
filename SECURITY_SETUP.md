# Security Implementation Guide

This document outlines the security features implemented in the telemedicine application and how to configure them.

## Security Features Implemented

### 1. Security Headers ✅
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features
- **X-XSS-Protection**: Enables XSS filtering
- **Strict-Transport-Security**: Enforces HTTPS
- **Content-Security-Policy**: Prevents XSS and data injection

### 2. Enhanced Firestore Security Rules ✅
- User-based access control (users can only access their own data)
- Input validation at database level
- Server-side only writes for sensitive collections
- Audit log protection

### 3. Input Validation & Sanitization ✅
- Room name validation (alphanumeric, 3-50 characters)
- Participant name validation (2-100 characters, safe characters only)
- Email validation
- User ID validation
- HTML sanitization to prevent XSS
- Length limits on all inputs

### 4. Rate Limiting ✅
- Token generation: 5 requests per minute
- Webhook endpoints: 100 requests per minute
- General API: 100 requests per minute
- Authentication: 5 requests per 15 minutes
- IP-based blocking with configurable duration

### 5. Webhook Signature Verification ✅
- HMAC-SHA256 signature verification
- Timing-safe comparison to prevent timing attacks
- Configurable webhook secret
- Graceful fallback for development

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Existing variables (keep these)
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Security enhancements (add these)
LIVEKIT_WEBHOOK_SECRET=your_webhook_secret_here
NEXT_PUBLIC_APP_ENV=production

# Firebase variables (existing)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (existing)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"

# OpenAI (existing)
OPENAI_API_KEY=your_openai_api_key
```

## Security Configuration Steps

### 1. Deploy Security Headers
The security headers are automatically applied when you deploy to Vercel. No additional configuration needed.

### 2. Update Firestore Rules
Deploy the updated security rules:
```bash
firebase deploy --only firestore:rules
```

### 3. Configure Webhook Secret
1. Go to your LiveKit Cloud dashboard
2. Navigate to Webhooks section
3. Copy the webhook secret
4. Add it to your environment variables as `LIVEKIT_WEBHOOK_SECRET`

### 4. Test Security Features

#### Test Rate Limiting
```bash
# Test token generation rate limit (should fail after 5 requests)
for i in {1..6}; do
  curl -X POST https://your-domain.com/api/token \
    -H "Content-Type: application/json" \
    -d '{"roomName":"test-room","participantName":"test-user"}'
done
```

#### Test Input Validation
```bash
# Test invalid room name (should fail)
curl -X POST https://your-domain.com/api/token \
  -H "Content-Type: application/json" \
  -d '{"roomName":"<script>alert(1)</script>","participantName":"test-user"}'

# Test invalid participant name (should fail)
curl -X POST https://your-domain.com/api/token \
  -H "Content-Type: application/json" \
  -d '{"roomName":"valid-room","participantName":"<script>alert(1)</script>"}'
```

#### Test Webhook Verification
```bash
# Test webhook without signature (should fail if secret is configured)
curl -X POST https://your-domain.com/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'
```

## Security Monitoring

### Rate Limit Headers
All rate-limited endpoints return these headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: When the rate limit resets
- `Retry-After`: Seconds to wait before retrying (when blocked)

### Security Logs
Monitor these logs for security events:
- Rate limit violations
- Invalid webhook signatures
- Input validation failures
- Authentication failures

## Security Best Practices

### 1. Environment Variables
- Never commit secrets to version control
- Use different secrets for development and production
- Rotate secrets regularly
- Use environment-specific configurations

### 2. Input Validation
- Always validate and sanitize user input
- Use allowlists instead of blocklists
- Implement validation on both client and server
- Log validation failures for monitoring

### 3. Rate Limiting
- Monitor rate limit violations
- Adjust limits based on usage patterns
- Implement progressive delays for repeated violations
- Consider user-based rate limiting for authenticated endpoints

### 4. Webhook Security
- Always verify webhook signatures
- Use HTTPS for webhook endpoints
- Implement idempotency for webhook processing
- Log all webhook events for audit

## Troubleshooting

### Common Issues

#### Rate Limiting Too Strict
If legitimate users are being blocked:
1. Check the rate limit configuration in `lib/rate-limit.ts`
2. Adjust the limits in `RateLimitConfigs`
3. Consider implementing user-based rate limiting

#### Webhook Verification Failing
If webhooks are being rejected:
1. Verify the `LIVEKIT_WEBHOOK_SECRET` is correct
2. Check that LiveKit is sending the signature header
3. Ensure the webhook URL is accessible

#### Input Validation Too Restrictive
If valid inputs are being rejected:
1. Check the validation rules in `lib/validation.ts`
2. Adjust the regex patterns if needed
3. Test with various input formats

### Security Testing Checklist

- [ ] Security headers are present in responses
- [ ] Rate limiting works on all protected endpoints
- [ ] Input validation rejects malicious inputs
- [ ] Webhook signature verification works
- [ ] Firestore rules prevent unauthorized access
- [ ] No sensitive data in logs
- [ ] HTTPS is enforced
- [ ] CORS is properly configured

## Next Steps for Advanced Security

1. **Implement audit logging** for all security events
2. **Add session management** with device tracking
3. **Implement end-to-end encryption** for sensitive data
4. **Add multi-factor authentication**
5. **Implement anomaly detection** for suspicious activity
6. **Add data anonymization** for privacy compliance
7. **Implement automated security testing**

## Compliance Notes

These security measures help with:
- **HIPAA compliance** (data protection, access controls)
- **GDPR compliance** (data minimization, access controls)
- **SOC 2 compliance** (security controls, monitoring)
- **ISO 27001 compliance** (information security management)

For production use, consider additional measures:
- Regular security audits
- Penetration testing
- Security incident response procedures
- Data backup and recovery procedures
