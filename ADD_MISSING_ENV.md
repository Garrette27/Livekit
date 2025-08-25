# Add Missing Environment Variable

## Issue
The LiveKit webhook test is failing with the error:
```
"Failed to parse URL from livekit-frontend-r897wspea-garrette27s-projects.vercel.app/api/webhook"
```

## Root Cause
The `NEXT_PUBLIC_BASE_URL` environment variable is missing, which is needed for proper webhook URL construction.

## Solution

### Add to Vercel Environment Variables:

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`livekit-frontend-tau`)
3. Go to **Settings** → **Environment Variables**
4. Add this new variable:
   - **Name**: `NEXT_PUBLIC_BASE_URL`
   - **Value**: `https://livekit-frontend-tau.vercel.app`
   - **Environment**: Production, Preview, Development (select all)
5. Click **Save**
6. **Redeploy** your application

### Add to Local .env.local (if testing locally):

```env
NEXT_PUBLIC_BASE_URL=https://livekit-frontend-tau.vercel.app
```

## Expected Result

After adding this environment variable and redeploying:

1. **LiveKit Webhook Test** should work without URL parsing errors
2. **Environment Check** should show `NEXT_PUBLIC_BASE_URL` as configured
3. **Both webhook tests** should generate proper AI summaries

## Current Status

✅ **OpenAI API Key**: Configured  
✅ **LiveKit Credentials**: Configured  
✅ **Firebase**: Configured  
❌ **NEXT_PUBLIC_BASE_URL**: Missing (causing webhook URL errors)

## Test After Fix

1. Go to `/test` page
2. Click "Check Environment" - should show all green
3. Click "Test LiveKit Webhook" - should work without errors
4. Check dashboard for AI-generated summaries
