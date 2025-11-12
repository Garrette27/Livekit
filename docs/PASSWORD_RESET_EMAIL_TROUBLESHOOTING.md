# Password Reset Email Troubleshooting Guide

## Issue: Password Reset Email Not Received

If users are not receiving password reset emails even though the application shows a success message, follow these steps to diagnose and fix the issue.

## Step 1: Check Firebase Email Template Configuration

The most common cause is that the password reset email template is not properly configured in Firebase Console.

### How to Check and Fix:

1. **Go to Firebase Console**: https://console.firebase.google.com
2. **Select your project**
3. **Navigate to**: Authentication → Templates → Password reset
4. **Check the following**:
   - **From field**: Must have a sender email address configured
     - If the field shows "A sender email is required" or is grayed out, you need to configure it
   - **Subject**: Should have a subject line
   - **Body**: Should have the email template content

### How to Configure Sender Email:

1. In the Password reset template, click **Edit**
2. In the **From** field, you need to either:
   - Use Firebase's default sender (noreply@[project-id].firebaseapp.com)
   - Configure a custom domain and sender email
3. **Save** the template

**Note**: If you're using a custom domain, you need to verify it first in Firebase Console → Authentication → Templates → Settings.

## Step 2: Verify Email/Password Authentication is Enabled

1. Go to **Firebase Console** → **Authentication** → **Sign-in method**
2. Ensure **Email/Password** is enabled
3. If it's not enabled, click on it and enable it

## Step 3: Check Firebase Logs

Firebase logs can help identify if emails are being sent but failing, or if there are configuration issues.

### How to Check Firebase Logs:

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Select your Firebase project**
3. **Navigate to**: Logging → Logs Explorer
4. **Filter logs**:
   - Use the search bar to filter for: `firebase.auth` or `password reset`
   - Look for errors related to email sending

### Common Log Errors:

- **"Email template not configured"**: The password reset template needs a sender email
- **"Operation not allowed"**: Email/Password authentication might not be enabled
- **"Invalid sender"**: The sender email in the template is invalid

## Step 4: Check Spam/Junk Folder

Password reset emails often end up in spam folders. Ask users to:
1. Check their spam/junk folder
2. Check their email filters
3. Add the sender email to their contacts/whitelist

## Step 5: Verify User Account Status

Use the diagnostic tool to check if the user account is properly configured:

1. Go to: `https://your-domain.com/debug/password-reset`
2. Enter the user's email address
3. Check the results:
   - **User exists**: Should be `true`
   - **Has password provider**: Should be `true` (if user signed up with email/password)
   - **Email verified**: Check if email is verified

## Step 6: Check Application Logs

### Vercel Logs:

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Deployments** → Select a deployment → **Functions** tab
4. Look for logs from `/api/password-reset` endpoint
5. Check for any errors or warnings

### Browser Console:

1. Open browser developer tools (F12)
2. Go to **Console** tab
3. Try the password reset flow
4. Look for any error messages or warnings

## Step 7: Test Password Reset Flow

1. **Use a test email** that you have access to
2. **Request password reset** from the application
3. **Check the email** (including spam folder)
4. **Check Firebase Console** → Authentication → Users to see if the reset link was generated

## Common Issues and Solutions

### Issue: "Password reset email sent!" but no email received

**Possible Causes:**
1. Email template not configured (most common)
2. Email going to spam
3. Email provider blocking Firebase emails
4. Invalid email address

**Solutions:**
1. Configure email template in Firebase Console (see Step 1)
2. Check spam folder
3. Use a custom domain for email sending
4. Verify email address is correct

### Issue: "Operation not allowed" error

**Cause**: Email/Password authentication is not enabled or email template is not configured

**Solution**: 
1. Enable Email/Password in Firebase Console → Authentication → Sign-in method
2. Configure password reset email template (see Step 1)

### Issue: "User not found" error

**Cause**: The email address is not registered in Firebase Authentication

**Solution**: User needs to sign up first, or use the email address associated with their account

### Issue: "This account was created with Google Sign-In only"

**Cause**: User signed up with Google, not email/password

**Solution**: User should use Google Sign-In, or they need to set a password first (which requires additional setup)

## Advanced: Custom Email Domain Setup

If you want better email deliverability, you can configure a custom domain:

1. **Go to Firebase Console** → **Authentication** → **Templates** → **Settings**
2. **Add a custom domain** (requires domain verification)
3. **Update email templates** to use the custom domain
4. **Configure SPF/DKIM records** for your domain (Firebase will provide instructions)

## Testing Checklist

- [ ] Email template has a sender email configured
- [ ] Email/Password authentication is enabled
- [ ] User account exists and has password provider
- [ ] Checked spam/junk folder
- [ ] Verified email address is correct
- [ ] Checked Firebase logs for errors
- [ ] Checked Vercel logs for API errors
- [ ] Tested with a known working email address

## Still Not Working?

If none of the above steps resolve the issue:

1. **Check Firebase Status**: https://status.firebase.google.com
2. **Review Firebase Documentation**: https://firebase.google.com/docs/auth/admin/email-action-links
3. **Contact Support**: Provide the following information:
   - User email address (if privacy allows)
   - Timestamp of password reset attempt
   - Error messages from logs
   - Screenshot of email template configuration

## Additional Resources

- [Firebase Email Action Links Documentation](https://firebase.google.com/docs/auth/admin/email-action-links)
- [Firebase Authentication Templates](https://firebase.google.com/docs/auth/custom-email-handler)
- [Firebase Console](https://console.firebase.google.com)

