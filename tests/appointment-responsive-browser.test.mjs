import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { appointmentBrowserFixture } from './helpers/appointment-browser-fixture.mjs';

test('the real appointment workbench supports booking, stale-version recovery and cancellation at phone/tablet/desktop sizes', async () => {
  const script = appointmentBrowserFixture();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  mkdirSync('tmp/appointments', { recursive: true });
  try {
    for (const width of [320,820,1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.route('https://synthetic.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<html><head><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}</style></head><body><div id="root"></div></body></html>' }));
      await page.goto('https://synthetic.test/');
      await page.addScriptTag({ content: script });
      await page.getByLabel('Patient name').fill('Synthetic patient');
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Contact email (optional)')).toBeFocused();
      await page.getByLabel('Contact email (optional)').fill('patient@example.test');
      await page.getByLabel('Start date and time').fill('2026-11-28T10:00');
      await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Appointment booked' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Synthetic patient', exact: true })).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `tmp/appointments/workbench-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Reschedule appointment for Synthetic patient', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('Start date and time')).toHaveValue('2026-11-28T10:00');
      await page.getByLabel('Start date and time').fill('2026-11-28T11:00');
      await page.evaluate(() => { window.forceBookingConflict = true; });
      await page.getByRole('button', { name: 'Save reschedule', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('changed');
      await page.getByRole('button', { name: 'Reschedule appointment for Synthetic patient', exact: true }).click();
      await page.getByLabel('Start date and time').fill('2026-11-28T11:00');
      await page.getByRole('button', { name: 'Save reschedule', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Appointment rescheduled' })).toBeVisible();
      await page.getByRole('button', { name: 'Cancel appointment for Synthetic patient', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Appointment cancelled' })).toBeVisible();
      await expect(page.getByText(/Asia\/Manila.*Cancelled/)).toBeVisible();
      assert.ok((await page.evaluate(() => window.bookingRequests)).every((r) => r.url.startsWith('/api/doctor/appointments')));
      await page.close();
    }
  } finally { await browser.close(); }
});

test('Show more appends the next appointment page without replacing the first page', async () => {
  const script = appointmentBrowserFixture({ paged: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: script });
    await expect(page.getByRole('heading', { name: 'Synthetic 1', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show more appointments', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Synthetic 3', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Synthetic 1', exact: true })).toBeVisible();
    assert.equal(await page.getByRole('button', { name: 'Show more appointments', exact: true }).count(), 0);
  } finally { await browser.close(); }
});

test('a disabled deployment exposes no dead appointment form or booking actions', async () => {
  const script = appointmentBrowserFixture({ disabled: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({ content: script });
    await expect(page.getByText('Appointments are not enabled in this deployment.')).toBeVisible();
    assert.equal(await page.getByRole('button', { name: 'Book appointment', exact: true }).count(), 0);
  } finally { await browser.close(); }
});

async function mountedWorkbench(options = {}) {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage();
  await page.route('https://synthetic.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto('https://synthetic.test/');
  await page.addScriptTag({ content: appointmentBrowserFixture(options) });
  return { page, browser };
}
async function fillBooking(page) {
  await page.getByLabel('Patient name').fill('Synthetic patient');
  await page.getByLabel('Start date and time').fill('2026-11-28T10:00');
}
const flushedFrame = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('a stale cancellation loses its armed confirmation and requires reviewing the new version', async () => {
  const { page, browser } = await mountedWorkbench();
  try {
    await fillBooking(page);
    await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel appointment for Synthetic patient', exact: true }).click();
    await page.evaluate(() => { window.forceBookingConflict = true; });
    await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('changed');
    await expect(page.getByRole('button', { name: 'Confirm cancellation', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel appointment for Synthetic patient', exact: true })).toBeVisible();
  } finally { await browser.close(); }
});

test('disabling scheduling during a POST removes the booking form and actions immediately', async () => {
  const { page, browser } = await mountedWorkbench();
  try {
    await fillBooking(page);
    await page.evaluate(() => { window.disableBookingWrites = true; });
    await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
    await expect(page.getByText('Appointments are not enabled in this deployment.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Book appointment', exact: true })).toHaveCount(0);
  } finally { await browser.close(); }
});

test('an older refresh cannot replace a committed booking after the post-mutation refresh', async () => {
  const { page, browser } = await mountedWorkbench();
  try {
    await fillBooking(page);
    await page.evaluate(() => { window.deferNextBookingGet = true; });
    await page.getByRole('button', { name: 'Refresh list', exact: true }).click();
    await expect.poll(() => page.evaluate(() => typeof window.releaseOldBookingGet)).toBe('function');
    await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Synthetic patient', exact: true })).toBeVisible();
    await page.evaluate(() => window.releaseOldBookingGet());
    await flushedFrame(page);
    await expect(page.getByRole('heading', { name: 'Synthetic patient', exact: true })).toBeVisible();
  } finally { await browser.close(); }
});

test('direct doctor switches hide old data and drafts, including a delayed old response', async () => {
  for (const deferred of [true, false]) {
    const { page, browser } = await mountedWorkbench({ scopedPage: true });
    try {
      await expect(page.getByRole('heading', { name: 'Private A', exact: true })).toBeVisible();
      await page.getByLabel('Patient name').fill('Unsent A draft');
      await page.evaluate(() => { window.deferNextBookingGet = true; });
      await page.getByRole('button', { name: 'Refresh list', exact: true }).click();
      await expect.poll(() => page.evaluate(() => typeof window.releaseOldBookingGet)).toBe('function');
      await page.evaluate((wait) => { window.deferDoctorB = wait; window.switchDoctor('doctor-b'); }, deferred);
      await expect(page.getByRole('heading', { name: 'Private A', exact: true })).toHaveCount(0);
      if (deferred) {
        await expect.poll(() => page.evaluate(() => typeof window.resolveDoctorB)).toBe('function');
        await page.evaluate(() => window.resolveDoctorB());
      }
      await expect(page.getByRole('heading', { name: 'Private B', exact: true })).toBeVisible();
      await expect(page.getByLabel('Patient name')).toHaveValue('');
      await page.evaluate(() => window.releaseOldBookingGet());
      await flushedFrame(page);
      await expect(page.getByRole('heading', { name: 'Private A', exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Private B', exact: true })).toBeVisible();
    } finally { await browser.close(); }
  }
});
