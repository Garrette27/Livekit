import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Environment variables check requested');
    
    const envCheck = {
      FIREBASE_PROJECT_ID: {
        exists: !!process.env.FIREBASE_PROJECT_ID,
        value: process.env.FIREBASE_PROJECT_ID ? '***SET***' : 'NOT SET',
        length: process.env.FIREBASE_PROJECT_ID?.length || 0,
        preview: process.env.FIREBASE_PROJECT_ID ? process.env.FIREBASE_PROJECT_ID.substring(0, 10) + '...' : 'N/A'
      },
      FIREBASE_CLIENT_EMAIL: {
        exists: !!process.env.FIREBASE_CLIENT_EMAIL,
        value: process.env.FIREBASE_CLIENT_EMAIL ? '***SET***' : 'NOT SET',
        length: process.env.FIREBASE_CLIENT_EMAIL?.length || 0,
        preview: process.env.FIREBASE_CLIENT_EMAIL ? process.env.FIREBASE_CLIENT_EMAIL.substring(0, 20) + '...' : 'N/A'
      },
      FIREBASE_PRIVATE_KEY: {
        exists: !!process.env.FIREBASE_PRIVATE_KEY,
        value: process.env.FIREBASE_PRIVATE_KEY ? '***SET***' : 'NOT SET',
        length: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
        startsWith: process.env.FIREBASE_PRIVATE_KEY?.startsWith('-----BEGIN PRIVATE KEY-----') || false,
        endsWith: process.env.FIREBASE_PRIVATE_KEY?.includes('-----END PRIVATE KEY-----') || false,
        hasNewlines: process.env.FIREBASE_PRIVATE_KEY?.includes('\\n') || false
      },
      OPENAI_API_KEY: {
        exists: !!process.env.OPENAI_API_KEY,
        value: process.env.OPENAI_API_KEY ? '***SET***' : 'NOT SET',
        length: process.env.OPENAI_API_KEY?.length || 0,
        startsWith: process.env.OPENAI_API_KEY?.startsWith('sk-') || false
      },
      NEXT_PUBLIC_LIVEKIT_URL: {
        exists: !!process.env.NEXT_PUBLIC_LIVEKIT_URL,
        value: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'NOT SET',
        length: process.env.NEXT_PUBLIC_LIVEKIT_URL?.length || 0
      }
    };
    
    const allRequired = envCheck.FIREBASE_PROJECT_ID.exists && 
                       envCheck.FIREBASE_CLIENT_EMAIL.exists && 
                       envCheck.FIREBASE_PRIVATE_KEY.exists;
    
    console.log('Environment check results:', envCheck);
    
    return NextResponse.json({
      success: allRequired,
      message: allRequired ? 'All required environment variables are set' : 'Some required environment variables are missing',
      envCheck,
      recommendations: {
        FIREBASE_PROJECT_ID: envCheck.FIREBASE_PROJECT_ID.exists ? '✅ OK' : '❌ Required for Firebase Admin',
        FIREBASE_CLIENT_EMAIL: envCheck.FIREBASE_CLIENT_EMAIL.exists ? '✅ OK' : '❌ Required for Firebase Admin',
        FIREBASE_PRIVATE_KEY: envCheck.FIREBASE_PRIVATE_KEY.exists ? 
          (envCheck.FIREBASE_PRIVATE_KEY.startsWith && envCheck.FIREBASE_PRIVATE_KEY.endsWith ? '✅ OK' : '⚠️ Set but format may be incorrect') : 
          '❌ Required for Firebase Admin',
        OPENAI_API_KEY: envCheck.OPENAI_API_KEY.exists ? 
          (envCheck.OPENAI_API_KEY.startsWith ? '✅ OK' : '⚠️ Set but format may be incorrect') : 
          '⚠️ Optional - needed for AI summaries',
        NEXT_PUBLIC_LIVEKIT_URL: envCheck.NEXT_PUBLIC_LIVEKIT_URL.exists ? '✅ OK' : '⚠️ Required for LiveKit connection'
      },
      deploymentInfo: {
        platform: process.env.VERCEL ? 'Vercel' : 'Unknown',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Environment check error:', error);
    return NextResponse.json({ 
      error: 'Environment check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
