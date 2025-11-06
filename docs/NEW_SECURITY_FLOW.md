# New Security Flow - Privacy-Compliant Invitation System

## Overview
This document outlines the new security flow that removes device ID, location, and browser from the dynamic link creation process, and instead stores this information only after user consent during registration.

## Flow Diagram

### 1. User Registration/Login Flow
```
Patient visits invitation link
    ↓
Check if user is registered (by email)
    ↓
If NOT registered:
    → Show registration form (email OR phone)
    → Show consent form for device/location/browser storage
    → User accepts consent
    → System captures device ID, location, browser
    → Store in user profile (users collection)
    ↓
If registered:
    → Check if consent given
    → If yes, verify device/location/browser match
    → If no, show consent form again
```

### 2. Doctor Creates Invitation Flow
```
Doctor creates room
    ↓
Doctor enters patient email (or phone)
    ↓
System checks if patient is registered
    ↓
If registered:
    → Create  to registered emailinvitation linked
    → System will auto-verify using stored device/location/browser
    ↓
If NOT registered:
    → Create invitation with email only
    → Patient will register when accessing link
    → After registration, system stores device info
```

### 3. Invitation Validation Flow
```
Patient accesses invitation link
    ↓
System extracts email from invitation token
    ↓
Check if user exists in users collection
    ↓
If user exists:
    → Verify current device/location/browser matches stored values
    → If match: Grant access
    → If mismatch: Deny access (security violation)
    ↓
If user doesn't exist:
    → Show registration form
    → Collect consent
    → Store device/location/browser
    → Create user profile
    → Grant access
```

## Data Structure

### User Profile (users collection)
```typescript
{
  email: string;
  phone?: string;
  consentGiven: boolean;
  consentGivenAt: Timestamp;
  deviceInfo: {
    deviceFingerprintHash: string;
    userAgent: string;
    platform: string;
    screenResolution: string;
    timezone: string;
  };
  locationInfo: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    ip: string; // Hashed for privacy
  };
  browserInfo: {
    name: string;
    version?: string;
  };
  registeredAt: Timestamp;
  lastLoginAt: Timestamp;
}
```

### Updated Invitation Structure
```typescript
{
  roomName: string;
  emailAllowed: string; // Only email required
  phoneAllowed?: string; // Optional phone
  expiresAt: Timestamp;
  maxUses: number;
  status: 'active' | 'used' | 'expired';
  // Removed: countryAllowlist, browserAllowlist, deviceBinding
  // System will auto-verify using registered user's info
}
```

## Implementation Steps

1. **Create User Registration Component**
   - Form for email/phone input
   - Consent checkbox for device/location/browser storage
   - API call to register user

2. **Create Registration API Endpoint**
   - `/api/user/register`
   - Accepts email/phone and consent
   - Captures device/location/browser info
   - Stores in users collection

3. **Update InvitationManager Component**
   - Remove country/browser/device fields
   - Only show email input (and optional phone)
   - Simplify form

4. **Update Invitation Creation API**
   - Remove country/browser/device requirements
   - Only require email
   - Link invitation to registered user if exists

5. **Update Invitation Validation API**
   - Check if user is registered
   - If registered, verify device/location/browser match
   - If not registered, redirect to registration

6. **Create Registration Page**
   - `/register` or `/invite/[token]/register`
   - Show consent form
   - Capture device info after consent

## Security Benefits

1. **Privacy Compliance**: Device/location/browser only stored after explicit consent
2. **Minimal PII in Links**: Links only contain email, no sensitive device info
3. **Automatic Verification**: System automatically verifies using stored user data
4. **Audit Trail**: All consent and access attempts are logged

## User Experience

1. **First Time User**:
   - Receives invitation link
   - Clicks link
   - Sees registration form
   - Accepts consent
   - Device info captured automatically
   - Access granted

2. **Returning User**:
   - Receives invitation link
   - Clicks link
   - System verifies device automatically
   - Access granted (if device matches)

3. **Doctor**:
   - Creates room
   - Enters patient email
   - Gets simple invitation link
   - No need to know device/location/browser

