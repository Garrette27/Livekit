# Frontend Separation Proposal - Doctor vs Patient

## Recommendation: ✅ YES, Separate Dashboards and Sign-In

### Why Separate?

**Benefits:**
1. **Clear User Experience**: Each role sees only relevant features
2. **Better Security**: Patients can't accidentally access doctor features
3. **Easier Maintenance**: Clear separation of concerns
4. **Scalability**: Easy to add role-specific features
5. **Professional Appearance**: More polished, healthcare-appropriate UI

**Considerations:**
- Patients don't necessarily need sign-in to join consultations (current flow works)
- But patients might benefit from viewing their consultation history
- Keep invitation link flow as primary method for patients

## Proposed Structure

### Route Structure
```
/                          → Landing page (role detection)
/doctor/login              → Doctor sign-in (Firebase Auth)
/doctor/dashboard          → Doctor dashboard (consultations, invitations, summaries)
/doctor/invitations        → Invitation management
/patient/login             → Patient sign-in (optional, for viewing history)
/patient/dashboard         → Patient dashboard (consultation history, summaries)
/invite/[token]            → Patient invitation link (no sign-in required)
/room/[room]               → Video consultation room
```

### User Flows

#### Doctor Flow
1. Visit `/doctor/login`
2. Sign in with Google (Firebase Auth)
3. Redirected to `/doctor/dashboard`
4. Can create rooms, invitations, view summaries

#### Patient Flow (Two Options)

**Option A: Invitation Link Only (Current - Recommended)**
1. Receive invitation link
2. Click link → `/invite/[token]`
3. Register if first time (no sign-in needed)
4. Join consultation
5. No dashboard access (simpler)

**Option B: With Patient Portal (Enhanced)**
1. Receive invitation link
2. Click link → `/invite/[token]`
3. Register if first time
4. Join consultation
5. **Optional**: Sign in at `/patient/login` to view history
6. Access `/patient/dashboard` to see past consultations

## Implementation Plan

### Phase 1: Separate Doctor Dashboard (High Priority)
- Move current `/dashboard` to `/doctor/dashboard`
- Add role protection
- Keep doctor-only features

### Phase 2: Create Patient Dashboard (Optional but Recommended)
- Create `/patient/dashboard`
- Show patient's consultation history
- Show consultation summaries
- Simple, clean UI

### Phase 3: Separate Sign-In Pages
- `/doctor/login` - Current login page
- `/patient/login` - Optional patient sign-in (email/password or simple auth)

### Phase 4: Landing Page with Role Detection
- Detect if user is logged in
- Redirect to appropriate dashboard
- Show different options for doctors vs patients

## Recommended Approach

**For Your Use Case:**
1. **Keep invitation link flow as primary** - Patients don't need sign-in to join
2. **Add optional patient portal** - For patients who want to view history
3. **Separate doctor dashboard** - Full separation for doctors
4. **Role-based routing** - Auto-redirect based on user role

This gives you:
- ✅ Clean separation
- ✅ Better UX
- ✅ Maintains simplicity (patients can still just use links)
- ✅ Adds value (patients can optionally view history)

