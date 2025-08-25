import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check all critical environment variables
    const envStatus = {
      // OpenAI (Critical for AI summaries)
      OPENAI_API_KEY: {
        exists: !!process.env.OPENAI_API_KEY,
        configured: process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here',
        preview: process.env.OPENAI_API_KEY ? 
          `${process.env.OPENAI_API_KEY.substring(0, 4)}...${process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4)}` : 
          'Not set'
      },
      
      // LiveKit (Critical for video calls)
      LIVEKIT_API_KEY: {
        exists: !!process.env.LIVEKIT_API_KEY,
        configured: process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_KEY !== 'your_livekit_api_key',
        preview: process.env.LIVEKIT_API_KEY ? 
          `${process.env.LIVEKIT_API_KEY.substring(0, 4)}...${process.env.LIVEKIT_API_KEY.substring(process.env.LIVEKIT_API_KEY.length - 4)}` : 
          'Not set'
      },
      LIVEKIT_API_SECRET: {
        exists: !!process.env.LIVEKIT_API_SECRET,
        configured: process.env.LIVEKIT_API_SECRET && process.env.LIVEKIT_API_SECRET !== 'your_livekit_api_secret',
        preview: process.env.LIVEKIT_API_SECRET ? 
          `${process.env.LIVEKIT_API_SECRET.substring(0, 4)}...${process.env.LIVEKIT_API_SECRET.substring(process.env.LIVEKIT_API_SECRET.length - 4)}` : 
          'Not set'
      },
      NEXT_PUBLIC_LIVEKIT_URL: {
        exists: !!process.env.NEXT_PUBLIC_LIVEKIT_URL,
        configured: process.env.NEXT_PUBLIC_LIVEKIT_URL && process.env.NEXT_PUBLIC_LIVEKIT_URL !== 'wss://your-livekit-server.livekit.cloud',
        value: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'Not set'
      },
      
      // Firebase (Already working)
      FIREBASE_PROJECT_ID: {
        exists: !!process.env.FIREBASE_PROJECT_ID,
        value: process.env.FIREBASE_PROJECT_ID || 'Not set'
      },
      FIREBASE_CLIENT_EMAIL: {
        exists: !!process.env.FIREBASE_CLIENT_EMAIL,
        configured: process.env.FIREBASE_CLIENT_EMAIL && !process.env.FIREBASE_CLIENT_EMAIL.includes('your_service_account_email'),
        preview: process.env.FIREBASE_CLIENT_EMAIL ? 
          `${process.env.FIREBASE_CLIENT_EMAIL.substring(0, 10)}...` : 
          'Not set'
      },
      FIREBASE_PRIVATE_KEY: {
        exists: !!process.env.FIREBASE_PRIVATE_KEY,
        configured: process.env.FIREBASE_PRIVATE_KEY && !process.env.FIREBASE_PRIVATE_KEY.includes('Your private key here'),
        preview: process.env.FIREBASE_PRIVATE_KEY ? 
          `${process.env.FIREBASE_PRIVATE_KEY.substring(0, 20)}...` : 
          'Not set'
      },
      
      // Webhook configuration
      NEXT_PUBLIC_BASE_URL: {
        exists: !!process.env.NEXT_PUBLIC_BASE_URL,
        value: process.env.NEXT_PUBLIC_BASE_URL || 'Not set'
      },
      VERCEL_URL: {
        exists: !!process.env.VERCEL_URL,
        value: process.env.VERCEL_URL || 'Not set'
      }
    };

    // Calculate overall status
    const criticalIssues = [];
    const warnings = [];

    if (!envStatus.OPENAI_API_KEY.configured) {
      criticalIssues.push('OpenAI API key not configured - AI summaries will not work');
    }

    if (!envStatus.LIVEKIT_API_KEY.configured) {
      criticalIssues.push('LiveKit API key not configured - video calls will not work');
    }

    if (!envStatus.LIVEKIT_API_SECRET.configured) {
      criticalIssues.push('LiveKit API secret not configured - video calls will not work');
    }

    if (!envStatus.FIREBASE_CLIENT_EMAIL.configured) {
      warnings.push('Firebase service account not fully configured - some server operations may fail');
    }

    const overallStatus = {
      criticalIssues,
      warnings,
      isConfigured: criticalIssues.length === 0,
      envStatus
    };

    return NextResponse.json(overallStatus);
  } catch (error) {
    console.error('Environment check error:', error);
    return NextResponse.json({ 
      error: 'Failed to check environment variables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
