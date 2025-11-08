# Fix: "Please enter a valid email" Error in Firebase Email Template

## Problem
You're seeing an error "A sender email is required" on the "From" field in Firebase Authentication → Templates → Password reset, and the Save button is grayed out.

## Solution

### ⚠️ Fix: Enter Full Email Address in "From" Field

The "From" field is showing as incomplete (`@livekit-5eef6.firebaseapp.com`). You need to enter the **full email address**.

### What to Do

1. **Fix the "From" Field**
   - Click on the "From" field
   - Enter the **complete email address**: `noreply@livekit-5eef6.firebaseapp.com`
   - Make sure you include `noreply@` at the beginning
   - The field should show: `noreply@livekit-5eef6.firebaseapp.com` (not just `@livekit-5eef6.firebaseapp.com`)

2. **Verify All Fields:**
   - ✅ **Sender name**: `Telehealth Console`
   - ✅ **From**: `noreply@livekit-5eef6.firebaseapp.com` (full email address)
   - ✅ **Reply to**: `gjencomienda@gmail.com` (optional, but you have it set)
   - ✅ **Subject**: `Reset your Telehealth Console password`
   - ✅ **Message**: Your custom message template

3. **Save the Template**
   - After entering the full email in the "From" field, the error should disappear
   - The "Save" button should become enabled (no longer grayed out)
   - Click "Save" at the bottom
   - The template will be saved successfully

## Why This Happens

Firebase uses a shared email service for all projects on the free (Spark) plan. The "From" address is automatically set to:
- Format: `noreply@[your-project-id].firebaseapp.com`
- Example: `noreply@livekit-5eef6.firebaseapp.com`

This cannot be changed on the free plan. To use a custom "From" address, you would need to:
- Upgrade to the Blaze (pay-as-you-go) plan
- Configure a custom domain
- Set up SMTP settings (requires additional configuration)

## What Users Will See

When users receive the password reset email:
- **From (Display Name)**: "Telehealth Console" (your sender name)
- **From (Email)**: `noreply@livekit-5eef6.firebaseapp.com` (Firebase's address)
- **Reply To**: `gjencomienda@gmail.com` (if you set it)

This is perfectly normal and works correctly.

## Steps to Fix

1. **Go to**: Authentication → Templates → Password reset

2. **Fix the "From" Field:**
   - Click on the "From" input field
   - Delete the incomplete `@livekit-5eef6.firebaseapp.com`
   - Type the **complete email address**: `noreply@livekit-5eef6.firebaseapp.com`
   - Make sure it's exactly: `noreply@livekit-5eef6.firebaseapp.com`

3. **Verify all fields are filled:**
   ```
   Sender name: Telehealth Console
   From: noreply@livekit-5eef6.firebaseapp.com (FULL email address)
   Reply to: gjencomienda@gmail.com
   Subject: Reset your Telehealth Console password
   Message: [Your custom message with %LINK%]
   ```

4. **Check for errors:**
   - The "A sender email is required" error should disappear
   - The "Save" button should become enabled (blue, not grayed out)

5. **Click "Save"**

6. **Test it:**
   - Go to your app's login page
   - Click "Forgot password?"
   - Enter an email
   - Check the email inbox
   - The email should be sent successfully

## Verification

After saving:
1. The template should save successfully
2. Password reset emails will work correctly
3. Users will receive emails from "Telehealth Console"
4. The error message on "From" field can be ignored

## Alternative: Hide the Error (Optional)

If the error message is distracting:
- The error is cosmetic and doesn't affect functionality
- You can proceed with saving and testing
- Firebase will send emails correctly regardless of this error message

## Need Custom "From" Address?

If you need a custom "From" email address (like `noreply@yourdomain.com`):
1. Upgrade to Firebase Blaze plan (pay-as-you-go)
2. Go to Authentication → Settings → SMTP settings
3. Configure custom SMTP server
4. This requires additional setup and email service configuration

For most use cases, the default Firebase email address works perfectly fine.

## Alternative Solutions if Still Not Working

### Option 1: Leave "From" Field as Default (Recommended)
The "From" field might be read-only on the Spark plan. Try this:
1. **Clear the "From" field completely** (delete everything)
2. **Click outside the field** - Firebase should auto-populate it
3. **Don't edit it** - leave it as Firebase sets it
4. **Only customize**: Sender name, Reply to, Subject, and Message
5. Try saving again

### Option 2: Reset to Default Template
1. Click "Reset to default" or "Restore default" button (if available)
2. This will restore the original Firebase template
3. Then customize only: Sender name, Reply to, Subject, Message
4. Leave "From" field untouched
5. Try saving

### Option 3: Try Without Customizing "From" Field
1. **Don't touch the "From" field at all**
2. Only fill in:
   - Sender name: `Telehealth Console`
   - Reply to: `gjencomienda@gmail.com`
   - Subject: `Reset your Telehealth Console password`
   - Message: (your template)
3. Leave "From" field completely alone
4. Try saving

### Option 4: Refresh and Try Again
- Refresh the page (F5 or Ctrl+R)
- Don't edit the "From" field
- Only customize the other fields
- Try saving

### Option 5: Clear Browser Cache
- Clear your browser cache
- Log out and log back into Firebase Console
- Don't edit the "From" field
- Try again

### Option 6: Try Different Browser
- Try a different browser (Chrome, Firefox, Edge)
- Sometimes browser-specific issues can occur

### Option 7: Check Firebase Status
- Check if Firebase is experiencing any issues
- Visit: https://status.firebase.google.com/

## Workaround: Save Without Customizing "From" Field

If the "From" field continues to cause issues, you can still customize the email template without editing it:

### What You Can Customize (These Will Work):
- ✅ **Sender name**: `Telehealth Console` - This is what users see!
- ✅ **Reply to**: `gjencomienda@gmail.com`
- ✅ **Subject**: `Reset your Telehealth Console password`
- ✅ **Message**: Your custom message template

### What You Should Leave Alone:
- ❌ **From**: Leave it as Firebase sets it (even if it shows an error)

### Result:
Even if the "From" field shows an error, users will still see:
- **From (Display Name)**: "Telehealth Console" ✅
- **From (Email)**: `noreply@livekit-5eef6.firebaseapp.com` (Firebase's default)
- **Reply To**: `gjencomienda@gmail.com` ✅

The "Sender name" is what matters most - that's what appears in the user's inbox!

## Summary

✅ **Action**: Leave "From" field untouched, only customize Sender name, Reply to, Subject, and Message  
✅ **Result**: Template will save (the "From" field error is cosmetic)  
✅ **Users see**: "Telehealth Console" as the sender name (this is what matters!)  
⚠️ **Note**: The "From" field error may be a Firebase UI bug - the template will still work correctly

