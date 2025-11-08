# Password Reset Setup Guide

## Overview

The application now supports "Forgot Password" functionality for both patient and doctor login pages. This guide explains how to set it up.

## Features Added

### 1. Patient Login (`/patient/login`)
- ✅ "Forgot password?" link on the login form
- ✅ Password reset email functionality
- ✅ Success message after sending reset email
- ✅ Error handling for disabled email/password authentication

### 2. Doctor Login (`/doctor/login`)
- ✅ Toggle between Google OAuth and Email/Password login
- ✅ "Forgot password?" link when using email login
- ✅ Password reset email functionality
- ✅ Email/password sign-up option for doctors
- ✅ Success message after sending reset email
- ✅ Error handling for disabled email/password authentication

## Firebase Console Setup

To enable password reset functionality, you need to enable Email/Password authentication in Firebase Console:

### Steps:

1. **Go to Firebase Console**
   - Visit https://console.firebase.google.com/
   - Select your project (livekit-5eef6)

2. **Navigate to Sign-in Method**
   - In the left sidebar, click on **Authentication**
   - You should see several tabs at the top: **Users**, **Sign-in method**, **Templates**, **Usage**, **Settings**
   - **Important**: Click on the **"Sign-in method"** tab (NOT the Templates tab)
   - If you don't see the tabs, make sure you're in the Authentication section

3. **Add Email/Password Provider**
   - In the **Sign-in method** tab, you'll see your current providers (currently only "Google")
   - Look for the blue button **"Add new provider"** (usually on the right side of the providers list)
   - Click **"Add new provider"** button
   - A dialog will open showing a list of available providers
   - Scroll down or look for **"Email/Password"** in the list
   - Click on **"Email/Password"** to select it

4. **Enable Email/Password Authentication**
   - After clicking "Email/Password", a settings dialog will open
   - Toggle the **"Enable"** switch to ON (it should turn blue/active)
   - **Optional**: You can also enable "Email link (passwordless sign-in)" if you want that feature
   - Click **"Save"** at the bottom of the dialog

5. **Verify It's Enabled**
   - After saving, the dialog will close
   - You should now see "Email/Password" in the providers list (alongside Google)
   - It should show "Enabled" status with a green checkmark
   - The provider is now active and ready to use

6. **Configure Password Reset Email (Optional)**
   - Go to the **Templates** tab (where you currently are)
   - You can customize the password reset email template
   - The template you see is the one that will be used
   - You can customize the sender name, subject, and message

7. **Authorized Domains**
   - Go to **Authentication** → **Settings** → **Authorized domains**
   - Make sure your domain is listed
   - For local development, `localhost` should be included by default

## Error: `auth/operation-not-allowed`

If you see this error:
```
Firebase: Error (auth/operation-not-allowed)
```

This means Email/Password authentication is not enabled in Firebase Console. Follow the steps above to enable it.

## How It Works

### For Patients:
1. Patient clicks "Forgot password?" on the login page
2. Enter email address
3. Click "Send Reset Link"
4. Firebase sends a password reset email
5. Patient clicks the link in the email
6. Patient sets a new password
7. Patient can now sign in with the new password

### For Doctors:
1. Doctor selects "Email" login method
2. Doctor clicks "Forgot password?" link
3. Enter email address
4. Click "Send Reset Link"
5. Firebase sends a password reset email
6. Doctor clicks the link in the email
7. Doctor sets a new password
8. Doctor can now sign in with the new password

## Security Considerations

1. **Rate Limiting**: Firebase automatically rate-limits password reset requests to prevent abuse
2. **Email Verification**: The reset link expires after a certain time (configurable in Firebase)
3. **Secure Links**: Reset links are cryptographically secure and single-use
4. **Error Messages**: Error messages don't reveal whether an email exists in the system (for security)

## Testing

### Test Password Reset Flow:
1. Go to `/patient/login` or `/doctor/login`
2. Click "Forgot password?"
3. Enter a valid email address
4. Check your email for the reset link
5. Click the link and set a new password
6. Try signing in with the new password

### Test Error Handling:
1. Try resetting password for a non-existent email (should show appropriate error)
2. Try resetting when email/password auth is disabled (should show helpful error message)

## Troubleshooting

### Password reset email not received:
- Check spam folder
- Verify email address is correct
- Check Firebase Console → Authentication → Users to see if email exists
- Verify email/password authentication is enabled
- Check Firebase Console → Authentication → Templates for email configuration

### Reset link doesn't work:
- Check if link has expired (usually 1 hour)
- Verify the link wasn't already used
- Check browser console for errors
- Verify authorized domains in Firebase Console

### `auth/operation-not-allowed` error:
- Enable Email/Password authentication in Firebase Console
- Wait a few minutes for changes to propagate
- Refresh the page and try again

## Additional Notes

- Password reset emails are sent by Firebase automatically
- You can customize the email template in Firebase Console
- The reset link redirects to a Firebase-hosted page by default
- You can customize the redirect URL in Firebase Console → Authentication → Settings → Authorized domains
- For production, configure a custom domain for password reset emails

