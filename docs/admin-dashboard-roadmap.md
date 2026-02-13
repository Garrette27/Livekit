# Admin Dashboard Roadmap

This roadmap keeps the current architecture simple while making room for a future clinic-level admin console.

## Scope

- Manage doctor and patient accounts.
- View operational timeline and audit feed.
- Investigate consultation/session lifecycle issues.
- Apply account-level safety actions (disable role, revoke access, enforce reset).

## Data Contracts

- `users/{uid}`
- `consultations/{roomName}`
- `consultationSessions/{consultationSessionId}`
- `consultationSessions/{consultationSessionId}/events/{eventId}`
- `call-summaries/{consultationSessionId}`
- `audit-logs/{eventId}`
- `admin-activity-feed/{eventId}`

## Required Security Model

- Add custom claim: `admin: true`.
- Restrict admin feed and admin mutation endpoints to `admin` claim only.
- Keep direct client writes disabled for audit collections.

## Recommended API Surface

- `GET /api/admin/accounts?role=doctor|patient`
- `GET /api/admin/account/{uid}`
- `POST /api/admin/account/{uid}/disable`
- `POST /api/admin/account/{uid}/role-lock`
- `GET /api/admin/activity-feed`
- `GET /api/admin/session/{consultationSessionId}`

## UX Priorities

- Search by email, UID, room, consultation session id.
- Timeline view: joined, left, rejoined, admitted events.
- One-click pivot from timeline event to account detail and consultation summary.

## Rollout Strategy

1. Read-only admin feed page.
2. Account detail page with role/conflict diagnostics.
3. Controlled admin mutations with audit trail.
4. Multi-tenant support (clinic-level admin ownership) if needed.
