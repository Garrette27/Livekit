import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { livekitDeviceBrowserFixture } from './helpers/livekit-device-browser-fixture.mjs';

// Reintroducing a bottom inset alongside LiveKit's computed top clips the options.
test('LiveKit device options remain readable, reachable and selectable at desktop and phone widths', async () => {
  const script = livekitDeviceBrowserFixture();
  const css = readFileSync('app/globals.css', 'utf8') + readFileSync('node_modules/@livekit/components-styles/dist/general/index.css', 'utf8');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const evidenceDirectory = process.env.LIVEKIT_DEVICE_EVIDENCE_DIR ?? mkdtempSync(join(tmpdir(), 'livekit-device-menu-'));
  mkdirSync(evidenceDirectory, { recursive: true });
  const measurements = [];
  try {
    for (const [width, height] of [[1280, 800], [390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width <= 390 });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://device-fixture.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body><div id="root"></div></body></html>' }));
      await page.goto('https://device-fixture.test/');
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: script });
      for (const [kind, label, chosenId] of [['audioinput', 'USB conference microphone with a long descriptive device name', 'mic-two'], ['videoinput', 'External camera with a long descriptive device name', 'camera-two']]) {
        const trigger = page.locator(`.lk-button-group:has([data-lk-source="${kind === 'audioinput' ? 'microphone' : 'camera'}"]) .lk-button-menu`);
        await trigger.waitFor();
        await trigger.focus();
        await trigger.press('Enter');
        await expect(trigger).toHaveAttribute('aria-pressed', 'true');
        const option = page.getByRole('button', { name: label, exact: true });
        await expect(option).toBeVisible();
        const geometry = await option.evaluate(button => {
          const menu = button.closest('.lk-device-menu');
          const list = button.closest('ul');
          const item = button.closest('li');
          const bounds = element => { const r = element.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom}; };
          const rect = button.getBoundingClientRect();
          return {button: bounds(button), item: bounds(item), list: bounds(list), menu: bounds(menu), hit: button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)), background: getComputedStyle(button).backgroundColor};
        });
        await page.screenshot({ path: join(evidenceDirectory, `${kind}-${width}.png`) });
        assert.ok(geometry.menu.height >= geometry.list.height, `${width}px ${kind}: popup contains the device list: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.button.y >= geometry.menu.y && geometry.button.bottom <= geometry.menu.bottom, `${width}px ${kind}: the complete option is inside the popup`);
        assert.ok(geometry.menu.x >= 0 && geometry.menu.right <= width && geometry.menu.y >= 0 && geometry.menu.bottom <= height, `${width}px ${kind}: popup fits viewport`);
        assert.ok(geometry.hit, `${width}px ${kind}: device option is not clipped or covered`);
        assert.notEqual(geometry.background, 'rgb(37, 99, 235)', 'device choices must not inherit the toolbar button override');
        measurements.push({width, height, kind, ...geometry});
        // The actual upstream controls use normal Tab stops and native button activation.
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await expect(option).toBeFocused();
        await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(kind => window.syntheticRoom.getActiveDevice(kind), kind)).toBe(chosenId);
        await expect(trigger).toHaveAttribute('aria-pressed', 'false');
        await expect(option).toBeHidden();
        await expect(trigger.locator('..').locator(`li[id="${chosenId}"]`)).toHaveAttribute('aria-selected', 'true');
        await trigger.click();
        await expect(option).toBeVisible();
        const firstOption = trigger.locator('..').locator('.lk-device-menu button').first();
        if (width <= 390) await firstOption.tap();
        else await firstOption.click();
        await expect.poll(() => page.evaluate(kind => window.syntheticRoom.getActiveDevice(kind), kind)).toBe(kind === 'audioinput' ? 'mic-one' : 'camera-one');
        await expect(option).toBeHidden();
        await trigger.press('Space');
        await expect(option).toBeVisible();
        await page.locator('p').click();
        await expect(option).toBeHidden();
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: page does not overflow horizontally`);
      assert.deepEqual(errors, []);
      await page.close();
    }
    writeFileSync(join(evidenceDirectory, 'measurements.json'), JSON.stringify(measurements, null, 2));
    console.log(`Synthetic device-menu evidence: ${evidenceDirectory}`);
  } finally { await browser.close(); }
});
