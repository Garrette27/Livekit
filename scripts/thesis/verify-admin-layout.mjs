/** Render the real grant-form JSX/CSS with synthetic values and measure reflow. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { chromium } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
const output = new URL('tmp/admin-layout/', root);
mkdirSync(output, { recursive: true });
const current = readFileSync(new URL('app/admin/page.tsx', root), 'utf8');
const baseline = execFileSync('git', ['show', 'eb3b187:app/admin/page.tsx'], { encoding: 'utf8' });

function fixture(source) {
  const parsed = ts.createSourceFile('admin.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let form, css;
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(parsed) === 'form') form = node.getText(parsed);
    if (ts.isNoSubstitutionTemplateLiteral(node) && node.text.includes('.grant-row')) css = node.text;
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(form && css, 'Exercise the actual grant form and its styles');
  const exports = {};
  runInNewContext(ts.transpileModule(`export const view = () => (${form});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports, require, email: 'synthetic-clinician@example.test', clinicId: 'north-clinic', callerClinic: 'north-clinic',
    role: 'admin', level: 'super_admin', busy: null, setEmail() {}, setClinicId() {}, setRole() {}, change() {},
  });
  return `<style>*{box-sizing:border-box}body{margin:0;font-family:Arial}main{max-width:960px;margin:auto;padding:32px}input,select{display:block}${css}@media(max-width:640px){main{padding:14px}.card{padding:16px}}</style><main><section class="card">${renderToStaticMarkup(React.createElement(exports.view))}</section></main>`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const cases = [];
const headerCases = [];
try {
  for (const width of [320, 700, 1000]) {
    await page.setViewportSize({ width, height: 700 });
    await page.setContent(fixture(current));
    const overflow = await page.locator('.grant-row').evaluate((form) => {
      const card = form.parentElement.getBoundingClientRect();
      return [...form.querySelectorAll('input,select,button')].some((item) => {
        const rect = item.getBoundingClientRect();
        const label = item.closest('label')?.getBoundingClientRect();
        return rect.left < card.left || rect.right > card.right || Boolean(label && rect.right > label.right + 1);
      });
    });
    assert.equal(overflow, false, `Grant controls overflow at ${width} CSS pixels`);
    cases.push({ width, overflow });
    await page.screenshot({ path: new URL(`current-${width}.png`, output).pathname, fullPage: true });
  }
  await page.setViewportSize({ width: 700, height: 700 });
  await page.setContent(fixture(baseline));
  const oldOverflow = await page.locator('.grant-row').evaluate((form) => {
    const card = form.parentElement.getBoundingClientRect();
    return [...form.querySelectorAll('input,select,button')].some((item) => {
      const rect = item.getBoundingClientRect();
      const label = item.closest('label')?.getBoundingClientRect();
      return rect.right > card.right || Boolean(label && rect.right > label.right + 1);
    });
  });
  assert.equal(oldOverflow, true, 'The original form must reproduce the reported narrow-layout defect');
  const headerSource = readFileSync(new URL('components/doctor/DoctorAppHeader.tsx', root), 'utf8');
  const record = { exports: {} };
  runInNewContext(ts.transpileModule(headerSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports: record.exports, module: record,
    require(name) {
      if (name === 'next/navigation') return { usePathname: () => '/admin' };
      if (name === '@/lib/firebase') return { auth: null };
      if (name === '@/lib/auth/workspace-client') return { fetchWorkspaceAccess() { throw new Error('SSR must not perform auth IO'); } };
      return require(name);
    },
  });
  const header = renderToStaticMarkup(React.createElement(record.exports.default, {
    title: 'Administration', subtitle: 'Clinic administrator · abcdefghijklmnopqrstuvwxyzabcdefghijklmn',
    user: { uid: 'synthetic-user', email: 'synthetic@example.test', displayName: 'Synthetic owner' },
    navLink: { href: '/doctor/invitations', label: 'Invitations' },
  })).replace(/:global\(([^)]+)\)/g, '$1');
  for (const width of [320, 700]) {
    await page.setViewportSize({ width, height: 700 });
    await page.setContent(`<style>${readFileSync(new URL('app/globals.css', root), 'utf8')}</style>${header}`);
    const clipped = await page.locator('.doctor-title-box, .doctor-title, .doctor-subtitle').evaluateAll((nodes) => nodes.some((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left < 0 || rect.right > innerWidth + 1;
    }));
    assert.equal(clipped, false, `Long clinic title clipped at ${width} pixels`);
    headerCases.push({ width, clipped });
    await page.screenshot({ path: new URL(`header-${width}.png`, output).pathname, fullPage: true });
  }
  const report = { scope: 'Real source JSX/CSS, synthetic isolated browser fixture; not authenticated production acceptance', baselineOverflowAt700: oldOverflow, cases, headerCases };
  writeFileSync(new URL('report.json', output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
