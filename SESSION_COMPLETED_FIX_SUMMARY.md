# Session Completed Status Fix - Summary

## Issue Description

The "session completed" status was not being updated in the patient's consultation history when clicking the "Leave Consultation" button on the top left of the patient video room (invite page). However, the doctor side worked correctly when using the "Leave Call" control in the doctor session control panel.

## Root Cause Analysis

### Investigation Findings

1. **Doctor Side (Working Correctly)**
   - Location: `app/room/[room]/doctor/page.tsx`
   - The `handleLeave` function properly updates the consultation status
   - Uses `/api/track-consultation` API endpoint with `action: 'leave'`
   - Consultation status is updated to `'completed'` in Firestore

2. **Patient Side - Room Page (Working Correctly)**
   - Location: `app/room/[room]/patient/page.tsx`
   - The "Leave Call" button (lines 1243-1298) properly calls `/api/track-consultation`
   - The `onDisconnected` handler (lines 1090-1131) also tracks consultation leave

3. **Patient Side - Invite Page (BROKEN)**
   - Location: `app/invite/[token]/page.tsx`
   - The `onLeaveClick` handler (lines 506-522) was **missing** the API call to track consultation leave
   - The `onDisconnected` handler (lines 466-483) was also **missing** the API call
   - Both handlers only redirected the user without updating the consultation status

### Technical Details

The `/api/track-consultation` endpoint:
- Accepts `action: 'leave'` to mark consultation as completed
- Updates the consultation document with:
  - `status: 'completed'`
  - `leftAt: timestamp`
  - `duration: calculated minutes`
  - Generates AI summary for completed consultations

## Solution Implemented

### Changes Made to `app/invite/[token]/page.tsx`

#### 1. Updated `onDisconnected` Handler (Lines 466-483)

**Before:**
```typescript
onDisconnected={() => {
  console.log('Patient disconnected from consultation');
  // Only redirected, no API call
  if (user?.uid || isAuthenticated) {
    router.push('/patient/dashboard');
  } else {
    // ... redirect logic
  }
}}
```

**After:**
```typescript
onDisconnected={async () => {
  console.log('Patient disconnected from consultation');
  
  // Track patient leaving consultation (only if in main consultation room, not waiting room)
  if (validationResult?.roomName && !validationResult.waitingRoomEnabled) {
    try {
      await fetch('/api/track-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: validationResult.roomName,
          action: 'leave',
          patientName: 'Patient',
          userId: user?.uid || 'anonymous',
          patientEmail: user?.email || validationResult.registeredEmail || invitationEmail || null
        })
      });
      console.log('✅ Patient leave tracked for room:', validationResult.roomName);
    } catch (error) {
      console.error('Error tracking patient leave:', error);
    }
  }
  
  // Then redirect...
}}
```

#### 2. Updated `onLeaveClick` Handler (Lines 506-522)

**Before:**
```typescript
onLeaveClick={() => {
  // Only redirected, no API call
  if (user?.uid || isAuthenticated) {
    router.push('/patient/dashboard');
  } else {
    // ... redirect logic
  }
}}
```

**After:**
```typescript
onLeaveClick={async () => {
  // Track patient leaving consultation (only if in main consultation room, not waiting room)
  if (validationResult?.roomName && !validationResult.waitingRoomEnabled) {
    try {
      await fetch('/api/track-consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: validationResult.roomName,
          action: 'leave',
          patientName: 'Patient',
          userId: user?.uid || 'anonymous',
          patientEmail: user?.email || validationResult.registeredEmail || invitationEmail || null
        })
      });
      console.log('✅ Patient leave tracked for room:', validationResult.roomName);
    } catch (error) {
      console.error('Error tracking patient leave:', error);
    }
  }
  
  // Then redirect...
}}
```

### Key Implementation Details

1. **Safety Check**: Added `!validationResult.waitingRoomEnabled` check to ensure we only track consultation leave when the patient is in the main consultation room, not the waiting room.

2. **Patient Information**: The API call includes:
   - `roomName`: The consultation room name
   - `action: 'leave'`: Indicates the patient is leaving
   - `patientName`: Defaults to 'Patient' (can be improved if patient name is stored)
   - `userId`: Patient's Firebase UID or 'anonymous'
   - `patientEmail`: Patient's email from various sources (user object, validation result, or invitation email)

3. **Error Handling**: Wrapped API calls in try-catch blocks to prevent errors from blocking the redirect flow.

## Expected Behavior After Fix

### When Patient Clicks "Leave Consultation" Button:
1. ✅ API call is made to `/api/track-consultation` with `action: 'leave'`
2. ✅ Consultation status is updated to `'completed'` in Firestore
3. ✅ Duration is calculated and stored
4. ✅ AI summary is generated for the completed consultation
5. ✅ Patient is redirected to dashboard or login page
6. ✅ Consultation appears in patient's history with "Session completed" status

### When Patient Gets Disconnected:
1. ✅ Same tracking occurs as above
2. ✅ Consultation is properly marked as completed
3. ✅ Patient is redirected appropriately

## Files Modified

- `app/invite/[token]/page.tsx`
  - Updated `onDisconnected` handler (lines ~466-483)
  - Updated `onLeaveClick` handler (lines ~506-522)

## Testing Recommendations

1. **Test Leave Button Click:**
   - Join consultation as patient via invite link
   - Click "Leave Consultation" button (top left)
   - Verify consultation appears in patient dashboard with "Session completed" status

2. **Test Disconnection:**
   - Join consultation as patient via invite link
   - Close browser tab or lose connection
   - Verify consultation is marked as completed in patient dashboard

3. **Test Waiting Room:**
   - Verify that leaving from waiting room does NOT trigger consultation tracking
   - Only main consultation room leave should be tracked

4. **Compare with Doctor Side:**
   - Verify both patient and doctor sides now work consistently
   - Both should update consultation status to completed

## Related Files (For Reference)

- `app/api/track-consultation/route.ts` - API endpoint that handles consultation tracking
- `app/room/[room]/patient/page.tsx` - Patient room page (already working correctly)
- `app/room/[room]/doctor/page.tsx` - Doctor room page (reference implementation)
- `app/invite/[token]/components/PatientLiveKitRoom.tsx` - Component that renders the leave button

## Notes

- The patient name is currently hardcoded as 'Patient' in the API call. This could be improved by storing the patient's name when they join the consultation.
- The fix ensures consistency between patient and doctor sides for consultation completion tracking.
- The safety check prevents tracking consultation leave from the waiting room, which is correct behavior.

---

**Date:** January 3, 2026  
**Issue:** Session completed status not updating in patient consultation history  
**Status:** ✅ Fixed

