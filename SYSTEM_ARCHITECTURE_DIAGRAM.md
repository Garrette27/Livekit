# Telehealth Video Call App - System Architecture Diagram

## Complete System Architecture with One-to-One Invite Link System

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TELEHEALTH VIDEO CALL APP                                    │
│                              (LiveKit + React + Next.js + OpenAI)                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        FRONTEND LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   Home Page     │  │   Dashboard     │  │  Room Page      │  │ Patient Page    │            │
│  │   (Login/Create)│  │ (History/Stats) │  │  (Doctor View)  │  │ (Patient View)  │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│           │                     │                     │                     │                   │
│           │                     │                     │                     │                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │  Create Room    │  │  AI Summaries   │  │  Video Controls │  │  Join via Link  │            │
│  │  Component      │  │  Display        │  │  & Transcription│  │  (Invite System)│            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
           │                     │                     │                     │
           │                     │                     │                     │
           ▼                     ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    MIDDLEWARE LAYER                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                        Next.js Middleware (Security & Access Control)                  │   │
│  │  • Email verification                                                                   │   │
│  │  • Country/IP geofencing                                                                │   │
│  │  • Browser/device validation                                                            │   │
│  │  • Single-use token enforcement                                                         │   │
│  │  • Rate limiting                                                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      API LAYER                                                 │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   /api/token    │  │  /api/webhook   │  │ /api/invite     │  │ /api/summary    │            │
│  │  (LiveKit Auth) │  │ (LiveKit Events)│  │ (Invite System) │  │ (AI Processing) │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│           │                     │                     │                     │                   │
│           │                     │                     │                     │                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │ /api/track-     │  │ /api/cleanup-   │  │ /api/manual-    │  │ /api/test-*     │            │
│  │ consultation    │  │ sessions        │  │ webhook         │  │ (Testing APIs)  │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
           │                     │                     │                     │
           │                     │                     │                     │
           ▼                     ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    EXTERNAL SERVICES                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   LiveKit       │  │   OpenAI API    │  │  Firebase       │  │  Email Service  │            │
│  │  (Video/Audio)  │  │  (AI Summary)   │  │  (Database)     │  │  (Invitations)  │            │
│  │                 │  │                 │  │                 │  │                 │            │
│  │ • WebRTC        │  │ • GPT-4o-mini   │  │ • Firestore     │  │ • Magic Links   │            │
│  │ • Room Mgmt     │  │ • Transcription │  │ • Auth          │  │ • OTP           │            │
│  │ • Webhooks      │  │ • Summarization │  │ • Storage       │  │ • Notifications │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
           │                     │                     │                     │
           │                     │                     │                     │
           ▼                     ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DATA STORAGE                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              Firestore Collections                                     │   │
│  │                                                                                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │   │
│  │  │     rooms       │  │ call-summaries  │  │ consultations   │  │  invitations    │   │   │
│  │  │                 │  │                 │  │                 │  │                 │   │   │
│  │  │ • roomName      │  │ • AI Summary    │  │ • Patient Data  │  │ • Invite Token  │   │   │
│  │  │ • createdBy     │  │ • Key Points    │  │ • Duration      │  │ • Constraints   │   │   │
│  │  │ • createdAt     │  │ • Risk Level    │  │ • Status        │  │ • Email         │   │   │
│  │  │ • status        │  │ • Category      │  │ • Metadata      │  │ • Country       │   │   │
│  │  │ • metadata      │  │ • Participants  │  │ • Tracking      │  │ • Browser       │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘   │   │
│  │                                                                                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │   │
│  │  │     calls       │  │   users         │  │   sessions      │  │   audit_logs    │   │   │
│  │  │                 │  │                 │  │                 │  │                 │   │   │
│  │  │ • Active Calls  │  │ • User Profiles │  │ • User Sessions │  │ • Access Logs   │   │   │
│  │  │ • Transcription │  │ • Permissions   │  │ • Device Info   │  │ • Security      │   │   │
│  │  │ • Real-time     │  │ • Preferences   │  │ • Geolocation   │  │ • Compliance    │   │   │
│  │  │ • Auto-delete   │  │ • History       │  │ • Fingerprint   │  │ • Monitoring    │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              ONE-TO-ONE INVITE LINK SYSTEM (Option 1)                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              INVITATION FLOW                                            │   │
│  │                                                                                         │   │
│  │  1. Doctor Creates Invitation                                                           │   │
│  │     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                  │   │
│  │     │   Doctor UI     │───▶│  Invite API     │───▶│  Firestore      │                  │   │
│  │     │                 │    │                 │    │  (invitations)  │                  │   │
│  │     │ • Email Input   │    │ • Constraints   │    │                 │                  │   │
│  │     │ • Country List  │    │ • Token Gen     │    │ • Single Use    │                  │   │
│  │     │ • Browser List  │    │ • Email Send    │    │ • Expiry        │                  │   │
│  │     │ • Device Bind   │    │ • Validation    │    │ • Audit Trail   │                  │   │
│  │     └─────────────────┘    └─────────────────┘    └─────────────────┘                  │   │
│  │                                                                                         │   │
│  │  2. Patient Access Validation                                                           │   │
│  │     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                  │   │
│  │     │  Patient Link   │───▶│  Middleware     │───▶│  Token API      │                  │   │
│  │     │                 │    │                 │    │                 │                  │   │
│  │     │ • Magic Link    │    │ • Email Check   │    │ • LiveKit Token │                  │   │
│  │     │ • Device Info   │    │ • Country Check │    │ • Room Access   │                  │   │
│  │     │ • Browser Info  │    │ • Browser Check │    │ • Single Use    │                  │   │
│  │     │ • Geolocation   │    │ • Device Check  │    │ • Mark Used     │                  │   │
│  │     └─────────────────┘    └─────────────────┘    └─────────────────┘                  │   │
│  │                                                                                         │   │
│  │  3. Video Call Session                                                                  │   │
│  │     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                  │   │
│  │     │  LiveKit Room   │◀───│  Video Client   │◀───│  Patient Page   │                  │   │
│  │     │                 │    │                 │    │                 │                  │   │
│  │     │ • WebRTC        │    │ • Video/Audio   │    │ • Join Call     │                  │   │
│  │     │ • Transcription │    │ • Chat          │    │ • Controls      │                  │   │
│  │     │ • Recording     │    │ • Screen Share  │    │ • Leave Call    │                  │   │
│  │     └─────────────────┘    └─────────────────┘    └─────────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              AI SUMMARIZATION WORKFLOW                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              AUTOMATED PROCESSING                                       │   │
│  │                                                                                         │   │
│  │  1. Call End Detection                                                                  │   │
│  │     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                  │   │
│  │     │  LiveKit Room   │───▶│  Webhook API    │───▶│  Event Handler  │                  │   │
│  │     │                 │    │                 │    │                 │                  │   │
│  │     │ • room_finished │    │ • Signature     │    │ • Validation    │                  │   │
│  │     │ • participant_  │    │ • Rate Limit    │    │ • Idempotency   │                  │   │
│  │     │   left          │    │ • Security      │    │ • Processing    │                  │   │
│  │     └─────────────────┘    └─────────────────┘    └─────────────────┘                  │   │
│  │                                                                                         │   │
│  │  2. Data Collection & Processing                                                        │   │
│  │     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                  │   │
│  │     │  Firestore      │───▶│  Data Processor │───▶│  OpenAI API     │                  │   │
│  │     │                 │    │                 │    │                 │                  │   │
│  │     │ • Transcription │    │ • Text Cleanup  │    │ • GPT-4o-mini   │                  │   │
│  │     │ • Call Metadata │    │ • Context Build │    │ • Summarization │                  │   │
│  │     │ • Participants  │    │ • Prompt Gen    │    │ • Key Points    │                  │   │
│  │     │ • Duration      │    │ • Validation    │    │ • Risk Analysis │                  │   │
│  │     └─────────────────┘    └─────────────────┘    └─────────────────┘                  │   │
│  │                                                                                         │   │
│  │  3. Summary Storage & Display                                                           │   │
│  │     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                  │   │
│  │     │  AI Summary     │───▶│  Firestore      │───▶│  Dashboard      │                  │   │
│  │     │                 │    │                 │    │                 │                  │   │
│  │     │ • Structured    │    │ • call-summaries│    │ • History View  │                  │   │
│  │     │ • Key Points    │    │ • Auto-delete   │    │ • Statistics    │                  │   │
│  │     │ • Risk Level    │    │ • User Filter   │    │ • Search        │                  │   │
│  │     │ • Category      │    │ • Audit Trail   │    │ • Export        │                  │   │
│  │     └─────────────────┘    └─────────────────┘    └─────────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    SECURITY FEATURES                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              MULTI-LAYER SECURITY                                       │   │
│  │                                                                                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │   │
│  │  │  Authentication │  │  Authorization  │  │  Data Security  │  │  Network Security│   │   │
│  │  │                 │  │                 │  │                 │  │                 │   │   │
│  │  │ • Firebase Auth │  │ • Role-based    │  │ • Encryption    │  │ • HTTPS/WSS     │   │   │
│  │  │ • Google OAuth  │  │ • Token-based   │  │ • Data Masking  │  │ • CORS Policy   │   │   │
│  │  │ • Session Mgmt  │  │ • Permission    │  │ • Backup        │  │ • Rate Limiting │   │   │
│  │  │ • MFA Support   │  │ • Access Control│  │ • Retention     │  │ • DDoS Protection│   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘   │   │
│  │                                                                                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │   │
│  │  │  Invite Security│  │  Compliance     │  │  Monitoring     │  │  Audit Trail    │   │   │
│  │  │                 │  │                 │  │                 │  │                 │   │   │
│  │  │ • Single Use    │  │ • HIPAA Ready   │  │ • Real-time     │  │ • Access Logs   │   │   │
│  │  │ • Time Expiry   │  │ • GDPR Compliant│  │ • Alerts        │  │ • User Actions  │   │   │
│  │  │ • Geolocation   │  │ • Data Privacy  │  │ • Performance   │  │ • System Events │   │   │
│  │  │ • Device Binding│  │ • Retention     │  │ • Health Check  │  │ • Compliance    │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DEPLOYMENT ARCHITECTURE                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              CLOUD INFRASTRUCTURE                                       │   │
│  │                                                                                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │   │
│  │  │   Vercel        │  │   LiveKit       │  │   Firebase      │  │   OpenAI        │   │   │
│  │  │   (Frontend)    │  │   (Video)       │  │   (Backend)     │  │   (AI)          │   │   │
│  │  │                 │  │                 │  │                 │  │                 │   │   │
│  │  │ • Next.js App   │  │ • WebRTC        │  │ • Firestore     │  │ • GPT-4o-mini   │   │   │
│  │  │ • Edge Functions│  │ • Global CDN    │  │ • Functions     │  │ • API Access    │   │   │
│  │  │ • Auto Deploy   │  │ • Scalable      │  │ • Auth          │  │ • Rate Limits   │   │   │
│  │  │ • SSL/TLS       │  │ • Webhooks      │  │ • Storage       │  │ • Monitoring    │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘   │   │
│  │                                                                                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │   │
│  │  │   Cloudflare    │  │   Monitoring    │  │   Backup        │  │   CDN/Edge      │   │   │
│  │  │   (Security)    │  │   (Observability)│  │   (Data)        │  │   (Performance) │   │   │
│  │  │                 │  │                 │  │                 │  │                 │   │   │
│  │  │ • WAF Rules     │  │ • Logs          │  │ • Automated     │  │ • Global Edge   │   │   │
│  │  │ • DDoS Protect  │  │ • Metrics       │  │ • Point-in-time │  │ • Caching       │   │   │
│  │  │ • Bot Management│  │ • Alerts        │  │ • Cross-region  │  │ • Compression   │   │   │
│  │  │ • Rate Limiting │  │ • Dashboards    │  │ • Encryption    │  │ • Optimization  │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    DATA FLOW SEQUENCE                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  1. DOCTOR CREATES INVITATION                                                                   │
│     Doctor → Create Room → Set Constraints → Generate Token → Send Email → Store in DB         │
│                                                                                                 │
│  2. PATIENT ACCESSES INVITATION                                                                │
│     Patient → Click Link → Middleware Check → Token Validation → LiveKit Token → Join Room     │
│                                                                                                 │
│  3. VIDEO CALL SESSION                                                                          │
│     Both Users → LiveKit Room → WebRTC Connection → Real-time Communication → Transcription     │
│                                                                                                 │
│  4. CALL ENDS & AI PROCESSING                                                                   │
│     LiveKit → Webhook → Data Collection → OpenAI Processing → Summary Storage → Dashboard       │
│                                                                                                 │
│  5. DATA CLEANUP & RETENTION                                                                    │
│     Call Data → Auto-delete → Summary → 30-day Retention → Archive → Compliance                │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TECHNICAL SPECIFICATIONS                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  Frontend:           Next.js 14, React 18, TypeScript, Tailwind CSS                           │
│  Backend:            Next.js API Routes, Firebase Functions, Node.js                           │
│  Database:           Firestore (NoSQL), Real-time listeners, Security rules                    │
│  Video/Audio:        LiveKit (WebRTC), Global CDN, Scalable infrastructure                     │
│  AI/ML:              OpenAI GPT-4o-mini, Structured prompts, Medical context                   │
│  Authentication:     Firebase Auth, Google OAuth, Session management                           │
│  Security:           HTTPS/WSS, CORS, Rate limiting, Webhook signatures                        │
│  Deployment:         Vercel (Frontend), Firebase (Backend), LiveKit Cloud (Video)             │
│  Monitoring:         Real-time logs, Performance metrics, Error tracking                       │
│  Compliance:         HIPAA-ready, GDPR-compliant, Data retention policies                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Key Features Implemented

### 1. **One-to-One Invite Link System (Option 1)**
- **Single-use invitation tokens** with JWT-based security
- **Multi-constraint validation**: Email, country, browser, device fingerprinting
- **Geolocation enforcement** via IP-to-country mapping
- **Device binding** with first-seen device fingerprint
- **Time-based expiry** with configurable duration
- **Audit trail** for all access attempts and violations

### 2. **AI-Powered Summarization**
- **Real-time transcription** using Web Speech API
- **Automated processing** via LiveKit webhooks
- **OpenAI GPT-4o-mini** for intelligent summarization
- **Structured output**: Summary, key points, recommendations, risk levels
- **Medical context awareness** with specialized prompts
- **Auto-cleanup** of call data with summary preservation

### 3. **Comprehensive Dashboard**
- **Consultation history** with AI-generated summaries
- **Real-time statistics** and analytics
- **Search and filtering** capabilities
- **Export functionality** for compliance
- **User-specific data** with proper access controls
- **Responsive design** for mobile and desktop

### 4. **Security & Compliance**
- **Multi-layer security** with authentication, authorization, and data protection
- **HIPAA-ready architecture** with encryption and audit trails
- **GDPR compliance** with data retention and deletion policies
- **Rate limiting** and DDoS protection
- **Webhook signature verification** for LiveKit events
- **Real-time monitoring** and alerting

### 5. **Scalable Architecture**
- **Microservices approach** with separate concerns
- **Cloud-native deployment** on Vercel, Firebase, and LiveKit
- **Global CDN** for optimal performance
- **Auto-scaling** infrastructure
- **Real-time data synchronization** with Firestore
- **Edge computing** for reduced latency

## Implementation Timeline (1 Week)

- **Day 1-2**: Database schema, invite creation UI, email service integration
- **Day 3-4**: Middleware implementation, token API, constraint validation
- **Day 5-6**: Device fingerprinting, geolocation, single-use enforcement
- **Day 7**: Testing, security audit, deployment, and documentation

This architecture provides a robust, secure, and scalable foundation for your telehealth video call application with advanced AI summarization capabilities and comprehensive invite link management system.


