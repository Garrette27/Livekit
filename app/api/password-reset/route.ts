import { NextResponse, NextRequest } from 'next/server';
import { getFirebaseAdminAuth } from '../../../lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || !email.trim()) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if Firebase Admin is configured
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.error('Firebase Admin not configured');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Password reset service not configured',
          details: 'Firebase Admin credentials are missing'
        },
        { status: 500 }
      );
    }

    try {
      const auth = getFirebaseAdminAuth();
      
      if (!auth) {
        console.error('Firebase Admin Auth not initialized');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Password reset service not available',
            details: 'Firebase Admin Auth could not be initialized. Please check server configuration.'
          },
          { status: 500 }
        );
      }
      
      // Check if user exists
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(normalizedEmail);
        console.log('User found in Firebase Auth:', {
          uid: userRecord.uid,
          email: userRecord.email,
          emailVerified: userRecord.emailVerified,
          providerData: userRecord.providerData.map(p => p.providerId)
        });
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          console.log('User not found in Firebase Auth:', normalizedEmail);
          return NextResponse.json(
            { 
              success: false, 
              error: 'No account found with this email address',
              details: 'The email address is not registered in Firebase Authentication. You may need to sign up first.',
              code: 'USER_NOT_FOUND'
            },
            { status: 404 }
          );
        }
        throw error;
      }

      // Check if user has email/password provider
      const hasEmailPassword = userRecord.providerData.some(
        provider => provider.providerId === 'password'
      );

      if (!hasEmailPassword) {
        console.log('User does not have email/password provider:', {
          email: normalizedEmail,
          providers: userRecord.providerData.map(p => p.providerId)
        });
        return NextResponse.json(
          { 
            success: false, 
            error: 'This account was created with Google Sign-In',
            details: 'Please use Google Sign-In to access your account, or contact support to enable password reset.',
            code: 'NO_PASSWORD_PROVIDER'
          },
          { status: 400 }
        );
      }

      // User exists and has password provider - client will send email
      console.log('User validated for password reset:', {
        email: normalizedEmail,
        uid: userRecord.uid,
        hasPasswordProvider: true
      });
      
      return NextResponse.json({
        success: true,
        message: 'User validated. Password reset email can be sent.',
        email: normalizedEmail,
        userExists: true,
        hasPasswordProvider: true
      });

    } catch (error: any) {
      console.error('Password reset error:', {
        error: error.message,
        code: error.code,
        email: normalizedEmail
      });

      // Handle specific Firebase Auth errors
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'No account found with this email address',
            code: 'USER_NOT_FOUND'
          },
          { status: 404 }
        );
      }

      if (error.code === 'auth/invalid-email') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid email address',
            code: 'INVALID_EMAIL'
          },
          { status: 400 }
        );
      }

      if (error.code === 'auth/operation-not-allowed') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Password reset is not enabled',
            details: 'Email/Password authentication may not be enabled in Firebase Console',
            code: 'OPERATION_NOT_ALLOWED'
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to process password reset',
          details: error.message || 'Unknown error',
          code: error.code || 'UNKNOWN_ERROR'
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Password reset API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking user status
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      return NextResponse.json(
        { 
          error: 'Firebase Admin not configured',
          configured: false
        },
        { status: 500 }
      );
    }

    try {
      const auth = getFirebaseAdminAuth();
      
      if (!auth) {
        return NextResponse.json(
          { 
            error: 'Firebase Admin Auth not initialized',
            configured: false
          },
          { status: 500 }
        );
      }
      
      const userRecord = await auth.getUserByEmail(email.toLowerCase().trim());
      
      const hasEmailPassword = userRecord.providerData.some(
        provider => provider.providerId === 'password'
      );

      return NextResponse.json({
        exists: true,
        email: userRecord.email,
        uid: userRecord.uid,
        emailVerified: userRecord.emailVerified,
        hasPasswordProvider: hasEmailPassword,
        providers: userRecord.providerData.map(p => p.providerId),
        createdAt: userRecord.metadata.creationTime,
        lastSignIn: userRecord.metadata.lastSignInTime
      });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json({
          exists: false,
          email: email
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('User status check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check user status',
        details: error.message
      },
      { status: 500 }
    );
  }
}

