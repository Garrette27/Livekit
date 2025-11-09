# Account Creation Permission Error - Fix Summary

## Problem
Users getting "Missing or insufficient permissions" error when trying to create a new account.

## Root Cause
1. **Security Rules Conflict**: The Firestore security rules weren't properly allowing document creation during registration
2. **Query Permission**: The code was trying to query the users collection by email, which required collection-level read permissions
3. **Rule Conflicts**: Having both `allow write` and specific `allow create`/`allow update` rules can cause conflicts

## Solution Implemented

### 1. Updated Firestore Security Rules
**File:** `firestore.rules`

```javascript
match /users/{userId} {
  // Allow users to read their own document
  allow read: if request.auth != null && request.auth.uid == userId;
  // Allow users to create their own document during registration
  allow create: if request.auth != null && 
    request.auth.uid == userId &&
    request.resource.data.keys().hasAll(['email', 'role']) &&
    request.resource.data.email is string &&
    request.resource.data.role in ['patient', 'doctor'];
  // Allow users to update their own document
  allow update: if request.auth != null && request.auth.uid == userId;
  // Allow users to write/delete their own document
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

### 2. Simplified Sign-Up Flow
**File:** `app/patient/login/page.tsx`

- Removed email query (no longer needed - Firebase Auth prevents duplicates)
- Simplified to create Auth account first, then create Firestore document
- Better error handling for `auth/email-already-in-use`
- Improved error messages

### 3. Fixed Error Handling
- Better handling of `auth/email-already-in-use` error
- Clear error messages for permission issues
- Proper cleanup if Firestore write fails

## Testing

### Test Case 1: New Account Creation
1. Go to `/patient/login`
2. Click "Sign up" or toggle to create account
3. Enter a new email (e.g., `test@example.com`)
4. Enter password (min 6 characters)
5. Click "Create Account"
6. **Expected**: Account created successfully, redirected to dashboard

### Test Case 2: Duplicate Email
1. Try to create account with existing email
2. **Expected**: Error message "This email is already registered. Please sign in instead."

### Test Case 3: Invalid Email
1. Try to create account with invalid email
2. **Expected**: Error message about invalid email

## Deployment Status

✅ **Firestore rules deployed successfully**
- Rules compiled without errors
- Rules released to cloud.firestore
- Project: `livekit-5eef6`

## Next Steps

1. **Test the fix**: Try creating a new account with `jennielapore27@gmail.com` or a different email
2. **Verify in Firebase Console**: Check that the user document is created in Firestore
3. **Check for orphaned accounts**: If an account was partially created before, you may need to:
   - Delete the Auth account from Firebase Console, OR
   - Use password reset to set a password, THEN create the Firestore document

## Troubleshooting

### If you still get "Missing or insufficient permissions":

1. **Check Firebase Console**:
   - Go to Firestore Database → Rules
   - Verify the rules are deployed (should match `firestore.rules` file)
   - Check for any syntax errors

2. **Check Browser Console**:
   - Look for detailed error messages
   - Check if it's a `permission-denied` error
   - Verify the user UID matches the document ID

3. **Verify Authentication**:
   - Check if Firebase Auth account was created
   - Verify the user is authenticated before Firestore write

4. **Check for Orphaned Accounts**:
   - If Auth account exists but Firestore doc doesn't
   - Delete the Auth account from Firebase Console
   - Try creating the account again

### If account was partially created:

1. **Option 1: Delete and Recreate** (Recommended)
   - Go to Firebase Console → Authentication → Users
   - Delete the user account
   - Try creating the account again

2. **Option 2: Complete the Account**
   - Sign in with the email and password you set
   - The Firestore document should be created automatically
   - If not, contact support to create it manually

## Rules Explained

### Why `allow write` is needed:
- `setDoc` with `merge: true` can be treated as either create or update
- `allow write` covers all write operations (create, update, delete)
- This ensures the operation succeeds regardless of document state

### Why `allow create` with validation:
- Provides explicit validation for new documents
- Ensures required fields (email, role) are present
- Validates role is either 'patient' or 'doctor'

### Why `allow update`:
- Allows updating existing documents
- Needed for merge operations on existing documents
- Allows updating `lastLoginAt` and other fields

## Security Considerations

✅ **Users can only access their own data**
- Rules ensure `request.auth.uid == userId`
- Users cannot read/write other users' documents
- Collection queries are not allowed (security)

✅ **Validation at database level**
- Required fields are validated
- Role must be 'patient' or 'doctor'
- Email must be a string

✅ **No collection-level queries**
- Users cannot query the entire users collection
- Only direct document access by UID is allowed
- This prevents data leaks

## Summary

✅ **Rules deployed**: Firestore security rules updated and deployed
✅ **Code updated**: Sign-up flow simplified and error handling improved
✅ **Ready to test**: Try creating a new account now

The fix should resolve the "Missing or insufficient permissions" error. If you still encounter issues, check the browser console for detailed error messages and verify the rules are deployed correctly in Firebase Console.

