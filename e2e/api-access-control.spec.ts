import { expect, test } from '@playwright/test';

const protectedRequests = [
  { method: 'get', path: '/api/doctor/history' },
  { method: 'get', path: '/api/patient/consultations' },
  { method: 'get', path: '/api/patient/pending-waiting-room' },
  { method: 'get', path: '/api/invite/get-link?roomName=security-test' },
  { method: 'get', path: '/api/waiting-room/list' },
  { method: 'post', path: '/api/doctor-access', data: {} },
  { method: 'post', path: '/api/invite/create', data: {} },
  { method: 'post', path: '/api/invite/revoke', data: {} },
  { method: 'post', path: '/api/link-patient-consultations', data: {} },
  { method: 'post', path: '/api/summary/generate', data: {} },
  { method: 'post', path: '/api/token', data: {} },
  {
    method: 'post',
    path: '/api/track-consultation',
    data: { roomName: 'security-test', action: 'join' },
  },
  { method: 'post', path: '/api/track-doctor-presence', data: {} },
  { method: 'post', path: '/api/user/role-conflict', data: {} },
  { method: 'post', path: '/api/waiting-room/admit', data: {} },
  {
    method: 'post',
    path: '/api/waiting-room/check-admission',
    data: { invitationId: 'security-test' },
  },
  {
    method: 'post',
    path: '/api/waiting-room/mark-left',
    data: { waitingPatientId: 'security-test' },
  },
  { method: 'post', path: '/api/waiting-room/reject', data: {} },
] as const;

test.describe('API access control', () => {
  for (const protectedRequest of protectedRequests) {
    test(`${protectedRequest.method.toUpperCase()} ${protectedRequest.path} rejects anonymous callers`, async ({
      request,
    }) => {
      const response = protectedRequest.method === 'get'
        ? await request.get(protectedRequest.path)
        : await request.post(protectedRequest.path, { data: protectedRequest.data });

      expect(response.status()).toBe(401);
      await expect(response.json()).resolves.toMatchObject({ success: false });
    });
  }
});
