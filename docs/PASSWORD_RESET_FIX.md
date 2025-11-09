# Password Reset Email Fix - Diagnostic and Solution Guide

## Problem
Users are not receiving password reset emails even though the application shows a success message.

## Root Causes Identified

1. **User doesn't exist in Firebase Auth** - User may only exist in Firestore but not in Firebase Authentication
2. **Account created with Google Sign-In only** - User has no email/password provider
3. **Email template not configured** - Firebase password reset email template may not be set up
4. **Email/Password provider not enabled** - The sign-in method may be disabled
5. **Poor error handling** - Client-side code doesn't provide detailed error information

## Solutions Implemented

### 1. Created Password Reset Diagnostic API Endpoint

**File:** `app/api/password-reset/route.ts`

This endpoint provides:
- **GET `/api/password-reset?email=user@example.com`** - Check user status in Firebase Auth
  - Returns: user existence, email/password provider status, account details
- **POST `/api/password-reset`** - Validate user before sending reset email
  - Validates user exists and has password provider
  - Returns detailed error messages

### 2. Enhanced Error Handling in Login Pages

**Files:**
- `app/patient/login/page.tsx`
- `app/doctor/login/page.tsx`

**Improvements:**
- Checks user status via API before attempting to send email
- Provides specific error messages:
  - User not found
  - No password provider (Google-only account)
  - Invalid email
  - Too many requests (rate limiting)
  - Network errors
- Better logging for debugging

### 3. Enhanced Firebase Admin SDK

**File:** `lib/firebase-admin.ts`

**Added:**
- `getFirebaseAdminAuth()` function to access Firebase Admin Auth
- Proper initialization and error handling
- Reuses existing Firebase Admin app instance

### 4. Created Diagnostic Tool

**File:** `app/debug/password-reset/page.tsx`

A web-based diagnostic tool that:
- Checks user status in Firebase Auth
- Shows detailed user information
- Provides troubleshooting guidance
- Lists common issues and solutions

## How to Use

### For Users Experiencing Issues

1. **Try the diagnostic tool:**
   - Go to: `https://your-domain.com/debug/password-reset`
   - Enter the email address
   - Check the results to see what's wrong

2. **Common scenarios:**
   - **User not found:** Sign up first, then try password reset
   - **No password provider:** Use Google Sign-In instead
   - **Email not received:** Check spam folder, verify email template in Firebase Console

### For Developers/Admins

1. **Check Firebase Console:**
   - Go to Firebase Console → Authentication → Sign-in method
   - Ensure "Email/Password" is enabled
   - Go to Authentication → Templates → Password reset
   - Verify email template is configured with:
     - Sender name
     - Subject line
     - Message body (must include `%LINK%` placeholder)

2. **Check server logs:**
   - Look for password reset API calls in Vercel logs
   - Check for Firebase Auth errors
   - Verify Firebase Admin is properly configured

3. **Test the diagnostic endpoint:**
   ```bash
   curl "https://your-domain.com/api/password-reset?email=user@example.com"
   ```

## Firebase Console Configuration

### Step 1: Enable Email/Password Provider

1. Go to Firebase Console
2. Navigate to **Authentication** → **Sign-in method**
3. Click on **Email/Password**
4. Enable it and click **Save**

### Step 2: Configure Password Reset Email Template

1. Go to **Authentication** → **Templates** → **Password reset**
2. Configure the following:
   - **Sender name:** `Telehealth Console` (or your app name)
   - **From:** Leave as default (`noreply@your-project.firebaseapp.com`)
   - **Reply to:** Your support email (optional)
   - **Subject:** `Reset your Telehealth Console password`
   - **Message:** Your custom message with `%LINK%` placeholder

**Example message template:**
```
Hello,

You requested to reset your password for your Telehealth Console account.

Click the link below to reset your password:
%LINK%

If you didn't request this, you can safely ignore this email. Your password will remain unchanged.

This link will expire in 1 hour.

Best regards,
Telehealth Console Team
```

3. Click **Save**

### Step 3: Verify Email Template is Saved

- The template should save without errors
- If you see "A sender email is required" error, try:
  - Leaving the "From" field as default (don't edit it)
  - Only customize: Sender name, Reply to, Subject, and Message
  - The error may be cosmetic and won't affect functionality

## Testing

### Test Password Reset Flow

1. **Test with existing user:**
   - Use an email that exists in Firebase Auth
   - Ensure the user has email/password provider (not just Google)
   - Try password reset
   - Check email inbox (and spam folder)

2. **Test with non-existent user:**
   - Use an email that doesn't exist
   - Should show: "No account found with this email address"

3. **Test with Google-only user:**
   - Use an email that was created with Google Sign-In only
   - Should show: "This account was created with Google Sign-In"

4. **Test diagnostic tool:**
   - Go to `/debug/password-reset`
   - Enter various email addresses
   - Verify the results match Firebase Auth

## Troubleshooting

### Issue: "Password reset email sent!" but no email received

**Possible causes:**
1. Email template not configured in Firebase Console
2. Email went to spam folder
3. Email provider blocking Firebase emails
4. User doesn't actually exist in Firebase Auth

**Solutions:**
1. Check Firebase Console → Authentication → Templates → Password reset
2. Check spam/junk folder
3. Verify user exists using diagnostic tool: `/debug/password-reset`
4. Check Vercel logs for errors

### Issue: "User not found" error

**Cause:** User doesn't exist in Firebase Authentication (only in Firestore or not at all)

**Solution:**
- User needs to sign up first
- If user exists in Firestore but not Auth, they need to create an account

### Issue: "This account was created with Google Sign-In"

**Cause:** User only has Google provider, no email/password provider

**Solution:**
- User should use Google Sign-In instead
- Or create a new account with email/password

### Issue: "Password reset is not enabled"

**Cause:** Email/Password provider is not enabled in Firebase Console

**Solution:**
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable "Email/Password"
3. Save changes

### Issue: API endpoint returns 500 error

**Cause:** Firebase Admin not configured properly

**Solution:**
1. Check environment variables:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
2. Verify Firebase Admin credentials are correct
3. Check Vercel logs for detailed error messages

## Logging

### Client-side logs

The login pages now log:
- Password reset attempts
- User status checks
- Error details (code, message, email)
- Success confirmations

### Server-side logs

The API endpoint logs:
- User lookup attempts
- User found/not found
- Provider information
- Error details

### Where to find logs

- **Vercel:** Dashboard → Your Project → Logs
- **Browser Console:** Open DevTools → Console tab
- **Firebase Console:** Authentication → Users (for user information)

## Next Steps

1. **Test the diagnostic tool:** Visit `/debug/password-reset` and test with the affected email
2. **Check Firebase Console:** Verify email template is configured
3. **Check server logs:** Look for any errors in Vercel logs
4. **Verify user exists:** Use the diagnostic tool to check if user exists in Firebase Auth
5. **Check email provider:** Verify emails aren't being blocked or sent to spam

## Summary

The password reset functionality has been improved with:
- ✅ Better error handling and user feedback
- ✅ Diagnostic API endpoint for troubleshooting
- ✅ Enhanced logging for debugging
- ✅ Web-based diagnostic tool
- ✅ Specific error messages for common issues

Users will now see clear error messages explaining why password reset failed, and administrators can use the diagnostic tools to troubleshoot issues quickly.

