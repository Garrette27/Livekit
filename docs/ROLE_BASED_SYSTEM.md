# Role-Based Authentication System

## Overview
This document explains how the system distinguishes between doctors and patients, and how role-based access control is implemented.

## User Roles

### Doctor
- **Authentication**: Logs in via Firebase Auth (Google OAuth)
- **Registration**: Automatically registered when they first log in
- **Role**: Set to `'doctor'` in user profile
- **Access**: 
  - Can create rooms
  - Can create invitations
  - Can access dashboard
  - Can view consultation history
  - Can join rooms directly (no invitation needed)

### Patient
- **Authentication**: No direct login required
- **Registration**: Registers via invitation link flow
- **Role**: Set to `'patient'` in user profile
- **Access**:
  - Can only access rooms via invitation links
  - Must register and provide consent before accessing
  - Device/location/browser info stored after consent

## Implementation

### 1. User Profile Structure

```typescript
interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  role: 'doctor' | 'patient';
  consentGiven: boolean; // Only for patients
  // ... device/location/browser info (only for patients with consent)
}
```

### 2. Doctor Registration Flow

**When a doctor logs in for the first time:**
1. Firebase Auth authenticates the user
2. System checks if user profile exists in Firestore
3. If not exists, create user profile with `role: 'doctor'`
4. Store doctor info (name, email from Firebase Auth)

**Implementation Location:**
- Add logic to `app/login/page.tsx` or create a middleware
- Check user profile after successful login
- Create/update user profile with doctor role

### 3. Patient Registration Flow

**When a patient accesses an invitation link:**
1. System checks if user is registered (by email)
2. If NOT registered:
   - Show `PatientRegistration` component
   - Collect email, phone (optional), and consent
   - Store device/location/browser info after consent
   - Create user profile with `role: 'patient'`
3. If registered:
   - Verify device/location/browser match stored values
   - Grant or deny access

**Implementation:**
- Component: `components/PatientRegistration.tsx`
- API: `app/api/user/register/route.ts`
- Integration: `app/invite/[token]/page.tsx`

### 4. Role Checking Utilities

**File: `lib/auth-utils.ts`**

```typescript
// Check if user is a doctor
const isDoctor = await isDoctor(user);

// Check if user is a patient
const isPatient = await isPatient(user);

// Get user role
const role = await getUserRole(user);

// Get full user profile
const profile = await getUserProfile(user);
```

### 5. Access Control

#### Frontend (Client-Side)
```typescript
import { isDoctor } from '@/lib/auth-utils';

const user = auth.currentUser;
const userIsDoctor = await isDoctor(user);

if (userIsDoctor) {
  // Show doctor-only features
  // Allow access to dashboard, invitation management, etc.
} else {
  // Redirect to patient flow or show error
}
```

#### Backend (API Routes)
```typescript
// In API routes, check user role before allowing actions
// Example: app/api/invite/create/route.ts

// TODO: Add authentication middleware
// const user = await getAuthenticatedUser(req);
// const userProfile = await getUserProfile(user);
// if (userProfile?.role !== 'doctor') {
//   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
// }
```

## Current Status

### ✅ Implemented
- User profile structure with role field
- Patient registration component with consent
- Patient registration API endpoint
- Invite page integration with registration flow
- Role checking utilities (`lib/auth-utils.ts`)
- Updated "How it works" section

### 🔄 To Be Implemented
1. **Doctor Auto-Registration on Login**
   - Add logic to create doctor profile when they first log in
   - Update `app/login/page.tsx` or create auth middleware

2. **API Route Authentication**
   - Add authentication middleware to protect doctor-only endpoints
   - Verify user role before allowing invitation creation

3. **Frontend Role-Based UI**
   - Hide/show features based on user role
   - Redirect patients away from doctor-only pages

4. **Firestore Security Rules**
   - Update rules to enforce role-based access
   - Ensure patients can only access their own data

## Example: Protecting Doctor-Only Pages

```typescript
// app/invitations/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { isDoctor } from '@/lib/auth-utils';
import { useRouter } from 'next/navigation';

export default function InvitationsPage() {
  const [user, setUser] = useState(null);
  const [isDoctorUser, setIsDoctorUser] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const doctor = await isDoctor(user);
        setIsDoctorUser(doctor);
        if (!doctor) {
          // Redirect non-doctors
          router.push('/');
        }
      } else {
        // Redirect unauthenticated users
        router.push('/login');
      }
    });

    return unsubscribe;
  }, [router]);

  if (!isDoctorUser) {
    return <div>Loading...</div>;
  }

  // Rest of component...
}
```

## Security Considerations

1. **Never trust client-side role checks alone**
   - Always verify roles on the server side
   - Use Firestore security rules as additional protection

2. **Patient data privacy**
   - Patients can only access their own profile
   - Device/location/browser info only stored after consent

3. **Doctor authentication**
   - Doctors must be authenticated via Firebase Auth
   - Role is set server-side, not client-side

## Next Steps

1. Implement doctor auto-registration on login
2. Add authentication middleware to API routes
3. Update Firestore security rules for role-based access
4. Add role-based UI restrictions on frontend
5. Test the complete flow end-to-end

