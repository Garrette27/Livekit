# How to Deploy Firestore Security Rules

## Option 1: Using Firebase CLI (Recommended)

### Install Firebase CLI (if not installed):
```bash
npm install -g firebase-tools
```

### Login to Firebase:
```bash
firebase login
```

### Deploy Rules:
```bash
firebase deploy --only firestore:rules
```

## Option 2: Using gcloud CLI

Unfortunately, gcloud CLI doesn't have a direct command for deploying Firestore security rules. However, you can use the Firebase Admin API or deploy via the REST API.

### Using gcloud with Firebase Admin API:
```bash
# First, make sure you're authenticated
gcloud auth login

# Set your project
gcloud config set project livekit-5eef6

# Deploy rules using Firebase Admin API (requires service account)
# This is more complex and not recommended for rules deployment
```

## Option 3: Manual Deployment via Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `livekit-5eef6`
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the contents of `firestore.rules` file
5. Paste into the rules editor
6. Click **Publish**

## Option 4: Using Firebase CLI via npx (No Installation Required)

```bash
npx firebase-tools deploy --only firestore:rules
```

This will prompt you to login if not already authenticated.

## Current Rules to Deploy

The updated rules file (`firestore.rules`) includes:
- ✅ Fixed users collection rules to allow create operations
- ✅ Proper validation for user creation
- ✅ Maintains security by ensuring users can only create their own documents

## Verify Deployment

After deployment, test by:
1. Creating a new account at `/patient/login`
2. The "Missing or insufficient permissions" error should be resolved

## Troubleshooting

If you get authentication errors:
- Make sure you're logged in: `firebase login`
- Make sure the project is set: `firebase use livekit-5eef6`
- Check project ID in `.firebaserc` or `firebase.json`

