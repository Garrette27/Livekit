# Password Reset Email Template - Customized for Telehealth App

## Overview
This document provides a customized password reset email template that matches your telehealth application's branding and theme.

## Custom Email Template

### For Firebase Console → Authentication → Templates → Password reset

**Sender name:**
```
Telehealth Console
```

**From:**
```
noreply@livekit-5eef6.firebaseapp.com
```
⚠️ **IMPORTANT**: Do NOT edit this field! It's automatically set by Firebase and cannot be changed. If you see an error "Please enter a valid email" on this field, ignore it - this field is read-only and the error is a UI display issue.

**Reply to:**
```
support@yourdomain.com
```
*(Optional: Update with your support email)*

**Subject:**
```
Reset your Telehealth Console password
```

**Message (HTML-friendly text):**
```
Hello,

You requested to reset your password for your Telehealth Console account.

Click the link below to reset your password:

%LINK%

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

If you're having trouble, please contact our support team.

Thanks,
The Telehealth Console Team

---
Secure • Data Privacy Compliant • Professional Healthcare Platform
```

## Alternative Template (More Detailed)

**Subject:**
```
🔐 Password Reset Request - Telehealth Console
```

**Message:**
```
Hello,

We received a request to reset the password for your Telehealth Console account associated with %EMAIL%.

To reset your password, please click on the following link:

%LINK%

This password reset link will expire in 1 hour.

⚠️ Security Notice:
- If you did NOT request a password reset, please ignore this email
- Your account remains secure and your password has not been changed
- Never share this link with anyone
- Our team will never ask for your password

Need Help?
If you're experiencing issues or have questions, please contact our support team.

Best regards,
Telehealth Console Support Team

---
This is an automated message. Please do not reply to this email.
For support, visit our help center or contact support@yourdomain.com

Secure • HIPAA Compliant • Professional Healthcare Platform
```

## How to Apply in Firebase Console

1. **Go to Firebase Console**
   - Navigate to: https://console.firebase.google.com/
   - Select your project: `livekit-5eef6`

2. **Navigate to Templates**
   - Click on **Authentication** in the left sidebar
   - Click on the **Templates** tab
   - Under **Email** section, click on **Password reset**

3. **Customize the Template**
   - **Sender name**: Enter "Telehealth Console" or your preferred name
   - **From**: ⚠️ **DO NOT EDIT THIS FIELD** - It's automatically set by Firebase and shows `noreply@livekit-5eef6.firebaseapp.com`. If you see an error, ignore it - this field is read-only.
   - **Reply to**: (Optional) Enter your support email like `gjencomienda@gmail.com` or leave blank
   - **Subject**: Copy the subject from above
   - **Message**: Copy the message from above

4. **Save Changes**
   - Click **Save** at the bottom
   - Changes take effect immediately

## Custom Action URL (Optional)

If you want to redirect users to your custom password reset page instead of Firebase's default page:

1. **Go to Authentication → Settings**
2. **Authorized domains**: Make sure your domain is listed
3. **Customize action URL**: 
   - You can set a custom domain for password reset
   - This requires additional Firebase configuration
   - For most cases, the default Firebase URL works fine

## Template Variables

Firebase automatically replaces these variables:
- `%APP_NAME%` - Your app name (set in Firebase project settings)
- `%EMAIL%` - User's email address
- `%LINK%` - Password reset link (automatically generated)
- `%LINK%` - The actual clickable reset link

## Testing

After updating the template:

1. **Test Password Reset**
   - Go to `/patient/login` or `/doctor/login`
   - Click "Forgot password?"
   - Enter your email
   - Check your email inbox
   - Verify the email looks correct

2. **Check Email Formatting**
   - Verify sender name appears correctly
   - Check subject line
   - Ensure links work
   - Test on different email clients (Gmail, Outlook, etc.)

## Branding Consistency

Your app uses:
- **Patient theme**: Green (#059669, #dcfce7)
- **Doctor theme**: Blue (#2563eb, #1e40af)
- **Medical/Healthcare branding**
- **Professional, secure, privacy-focused messaging**

The email template above reflects these themes with:
- Professional healthcare language
- Security-focused messaging
- Clear, concise instructions
- Trust-building elements (HIPAA compliance, data privacy)

## Additional Customization Options

### Add Logo (Requires HTML Email)
If you upgrade to HTML email templates (requires Firebase Blaze plan), you can:
- Add your app logo
- Use your brand colors
- Include styled buttons
- Add footer with social links

### Multi-language Support
- Firebase supports multiple languages
- Go to **Templates** → **Template language**
- Select languages to support
- Customize templates for each language

## Support Email

Update the template with your actual support email:
- Replace `support@yourdomain.com` with your real support email
- Or remove the support email line if you don't have one yet
- Consider adding a help center URL instead

