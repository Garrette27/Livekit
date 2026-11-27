import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { consultationBrowserFixture } from './helpers/consultation-browser-fixture.mjs';

test('the real room workspace fits phone, tablet and desktop widths with optional panels closed', async () => {
  const browser = await chromium.launch({ headless: true });
  mkdirSync('tmp/consultation-responsive', { recursive: true });
  const script = consultationBrowserFixture();
  try {
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [820, 1180], [1024, 768], [1280, 800]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.setContent('<html><head><style>*{box-sizing:border-box}body{margin:0}button{font:inherit}</style></head><body><div id="root"></div></body></html>');
      await page.addScriptTag({ content: script });
      const consent = page.getByRole('checkbox', { name: /Allow my microphone audio/ });
      await consent.waitFor();
      assert.equal(await consent.isChecked(), false, `${width}px: fresh join must not inherit transcription consent`);
      await page.getByRole('button', { name: 'Join consultation', exact: true }).click();
      await page.getByTestId('video-canvas').waitFor();
      const canvas = await page.getByTestId('video-canvas').boundingBox();
      assert.ok(canvas.width >= (width <= 1200 ? width - 1 : width - 121), `${width}px: panels must leave the video visible`);
      assert.equal(await page.getByTestId('transcription-state').getAttribute('data-active'), 'false');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${width}px: no horizontal page overflow`);
      await page.screenshot({ path: `tmp/consultation-responsive/closed-${width}.png` });
      if (width <= 1200) {
        await page.getByRole('button', { name: 'Open Waiting Queue' }).click();
        const sheet = page.getByRole('region', { name: 'Waiting Queue' });
        await sheet.waitFor();
        const bounds = await sheet.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${width}px: sheet fits screen`);
        await page.getByRole('button', { name: 'Close Waiting Queue' }).press('Escape');
        await expect(page.getByRole('button', { name: 'Open Waiting Queue' })).toBeFocused();
        await page.getByRole('button', { name: 'Open Session' }).click();
        await page.getByText('Invitation context', { exact: true }).click();
        await expect(page.getByText(/2 invited emails eligible/)).toBeVisible();
        await page.screenshot({ path: `tmp/consultation-responsive/details-${width}.png` });
        await page.getByRole('button', { name: 'Close Session' }).click();
      } else {
        await page.getByRole('button', { name: 'Expand Waiting Queue' }).click();
        await expect.poll(() => page.evaluate(() => {
          const canvas = document.querySelector('[data-testid="video-canvas"]').getBoundingClientRect();
          const panel = document.querySelector('.collapsible-sidebar').getBoundingClientRect();
          return canvas.left - panel.right;
        })).toBeGreaterThanOrEqual(-1);
        await page.getByRole('button', { name: 'Collapse Waiting Queue' }).click();
      }
      if (width === 390) {
        await page.evaluate(() => window.remountWorkspace());
        await consent.check();
        await page.getByRole('button', { name: 'Join consultation', exact: true }).click();
        await expect(page.getByTestId('transcription-state')).toHaveAttribute('data-active', 'true');
        await page.evaluate(() => window.remountWorkspace());
        await expect(consent).not.toBeChecked();
      }
      console.log(`Verified synthetic consultation workspace: ${width}×${height}`);
      await page.close();
    }
  } finally { await browser.close(); }
});
