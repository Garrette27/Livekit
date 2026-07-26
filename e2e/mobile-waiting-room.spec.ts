import { expect, test } from '@playwright/test';

interface JsonBody {
  [key: string]: unknown;
}

function parseRequestBody(rawBody: string | null): JsonBody {
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as JsonBody;
  } catch {
    const params = new URLSearchParams(rawBody);
    return Object.fromEntries(params.entries());
  }
}

function waitingRoomValidationPayload(waitingPatientId: string) {
  return {
    success: true,
    invitationId: 'invite_mobile_e2e',
    roomName: 'mobile-room',
    liveKitToken: 'e2e-fake-livekit-token',
    waitingRoomEnabled: true,
    waitingRoomToken: true,
    waitingPatientId,
    registeredEmail: 'patient@example.com',
  };
}

function consultationValidationPayload(waitingPatientId: string) {
  return {
    success: true,
    invitationId: 'invite_mobile_e2e',
    roomName: 'mobile-room',
    liveKitToken: 'e2e-fake-livekit-token',
    waitingRoomEnabled: false,
    waitingRoomToken: false,
    waitingPatientId,
    registeredEmail: 'patient@example.com',
  };
}

test.describe('Mobile Waiting Room Lifecycle', () => {
  const inviteToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnZpdGF0aW9uSWQiOiJpbnZpdGVfbW9iaWxlX2UyZSIsInJvb21OYW1lIjoibW9iaWxlLXJvb20iLCJleHAiOjQwNzA5MDg4MDAsImlhdCI6MTcwNDA2NzIwMCwib25lVXNlIjpmYWxzZX0.signature';

  test('marks waiting entry left on back and allows forward navigation recovery', async ({ context, page }) => {
    const markedLeftIds: string[] = [];
    const waitingPatientId = 'waiting_invite_mobile_e2e_first';

    await context.route('**/api/invite/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(waitingRoomValidationPayload(waitingPatientId)),
      });
    });

    await context.route('**/api/waiting-room/check-admission', async (route, request) => {
      const body = parseRequestBody(request.postData());
      expect(body.accessToken).toBe('e2e-fake-livekit-token');
      const resolvedWaitingPatientId =
        typeof body.waitingPatientId === 'string' && body.waitingPatientId.trim().length > 0
          ? body.waitingPatientId
          : waitingPatientId;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          admitted: false,
          status: 'waiting',
          waitingPatientId: resolvedWaitingPatientId,
        }),
      });
    });

    await context.route('**/api/waiting-room/mark-left', async (route, request) => {
      const body = parseRequestBody(request.postData());
      expect(body.accessToken).toBe('e2e-fake-livekit-token');
      const markedWaitingPatientId =
        typeof body.waitingPatientId === 'string' ? body.waitingPatientId : waitingPatientId;
      markedLeftIds.push(markedWaitingPatientId);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          waitingPatientId: markedWaitingPatientId,
          status: 'left',
        }),
      });
    });

    await page.goto(`/invite/${inviteToken}?__e2e_no_livekit=1`);
    await expect(page.getByText("You're in the Waiting Room")).toBeVisible();

    await page.goBack();
    await expect.poll(() => markedLeftIds.includes(waitingPatientId)).toBeTruthy();

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/invite/${inviteToken}`));
    await expect(page.getByText("You're in the Waiting Room")).toBeVisible();
  });

  test('tracks patient leave on tab close in admitted consultation mode', async ({ context }) => {
    const waitingPatientId = 'waiting_invite_mobile_e2e_admitted';
    const trackedActions: string[] = [];
    const markedLeftIds: string[] = [];
    const page = await context.newPage();

    await context.route('**/api/invite/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(consultationValidationPayload(waitingPatientId)),
      });
    });

    await context.route('**/api/track-consultation', async (route, request) => {
      const body = parseRequestBody(request.postData());
      const action = typeof body.action === 'string' ? body.action : 'unknown';
      trackedActions.push(action);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          consultationSessionId: 'sess_mobile_e2e',
          action,
        }),
      });
    });

    await context.route('**/api/waiting-room/mark-left', async (route, request) => {
      const body = parseRequestBody(request.postData());
      expect(body.accessToken).toBe('e2e-fake-livekit-token');
      const markedWaitingPatientId =
        typeof body.waitingPatientId === 'string' ? body.waitingPatientId : waitingPatientId;
      markedLeftIds.push(markedWaitingPatientId);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          waitingPatientId: markedWaitingPatientId,
          status: 'left',
        }),
      });
    });

    await page.goto(`/invite/${inviteToken}?__e2e_no_livekit=1`);
    await expect(page.getByTestId('e2e-consultation-placeholder')).toBeVisible();
    await expect.poll(() => trackedActions.includes('join')).toBeTruthy();

    await page.close({ runBeforeUnload: true });

    await expect.poll(() => trackedActions.includes('leave')).toBeTruthy();
    await expect.poll(() => markedLeftIds.includes(waitingPatientId)).toBeTruthy();
  });

  test('shows access denied when waiting patient is revoked/removed by doctor', async ({ context, page }) => {
    const waitingPatientId = 'waiting_invite_mobile_e2e_revoked';

    await context.route('**/api/invite/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(waitingRoomValidationPayload(waitingPatientId)),
      });
    });

    await context.route('**/api/waiting-room/check-admission', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          admitted: false,
          status: 'rejected',
          waitingPatientId,
          error: 'You were rejected by the doctor. Please request a new invite if needed.',
        }),
      });
    });

    await page.goto(`/invite/${inviteToken}?__e2e_no_livekit=1`);
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(
      page.getByText('You were rejected by the doctor. Please request a new invite if needed.')
    ).toBeVisible();
  });

  test('shows access denied when waiting patient state is left', async ({ context, page }) => {
    const waitingPatientId = 'waiting_invite_mobile_e2e_left';

    await context.route('**/api/invite/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(waitingRoomValidationPayload(waitingPatientId)),
      });
    });

    await context.route('**/api/waiting-room/check-admission', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          admitted: false,
          status: 'left',
          waitingPatientId,
          error: 'You left the waiting room. Please reopen the invitation link to rejoin.',
        }),
      });
    });

    await page.goto(`/invite/${inviteToken}?__e2e_no_livekit=1`);
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(
      page.getByText('You left the waiting room. Please reopen the invitation link to rejoin.')
    ).toBeVisible();
  });
});
