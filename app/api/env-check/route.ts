import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Environment variables check requested');
    
    const envCheck = {
      FIREBASE_PROJECT_ID: {
        exists: !!process.env.FIREBASE_PROJECT_ID,
        value: process.env.FIREBASE_PROJECT_ID ? '***SET***' : 'NOT SET',
        length: process.env.FIREBASE_PROJECT_ID?.length || 0
      },
      FIREBASE_CLIENT_EMAIL: {
        exists: !!process.env.FIREBASE_CLIENT_EMAIL,
        value: process.env.FIREBASE_CLIENT_EMAIL ? '***SET***' : 'NOT SET',
        length: process.env.FIREBASE_CLIENT_EMAIL?.length || 0
      },
      FIREBASE_PRIVATE_KEY: {
        exists: !!process.env.FIREBASE_PRIVATE_KEY,
        value: process.env.FIREBASE_PRIVATE_KEY ? '***SET***' : 'NOT SET',
        length: process.env.FIREBASE_PRIVATE_KEY?.length || 0,
        startsWith: process.env.FIREBASE_PRIVATE_KEY?.startsWith('-----BEGIN PRIVATE KEY-----') || false
      },
      OPENAI_API_KEY: {
        exists: !!process.env.OPENAI_API_KEY,
        value: process.env.OPENAI_API_KEY ? '***SET***' : 'NOT SET',
        length: process.env.OPENAI_API_KEY?.length || 0,
        startsWith: process.env.OPENAI_API_KEY?.startsWith('sk-') || false
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
          (envCheck.FIREBASE_PRIVATE_KEY.startsWith ? '✅ OK' : '⚠️ Set but format may be incorrect') : 
          '❌ Required for Firebase Admin',
        OPENAI_API_KEY: envCheck.OPENAI_API_KEY.exists ? 
          (envCheck.OPENAI_API_KEY.startsWith ? '✅ OK' : '⚠️ Set but format may be incorrect') : 
          '⚠️ Optional - needed for AI summaries'
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
