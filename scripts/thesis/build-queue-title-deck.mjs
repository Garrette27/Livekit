/** Build an editable, source-grounded rehearsal deck and validate its package. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUNTIME = process.env.TELECONSOLE_RUNTIME || 'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1123-915-0_26.1123.915.0_x64__3k8sg7r9htsxt/dependencies';
const SKILL = process.env.TELECONSOLE_PRESENTATION_SKILL || 'C:/Users/garre/.codex/plugins/cache/openai-primary-runtime/presentations/26.1123.11515/skills/presentations';
process.env.RUNTIME_NODE_MODULES ||= path.join(RUNTIME, 'node/node_modules');
process.env.RUNTIME_NODE ||= process.execPath;
const require = createRequire(path.join(RUNTIME, 'node/node_modules/artifact-loader.cjs'));
const { Presentation, PresentationFile } = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL, 'container_tools/artifact_tool_utils.mjs')).href);
const build = path.join(ROOT, 'tmp/queue-title-deck');
const output = path.join(ROOT, 'docs/thesis-defense/TeleConsole-Waiting-Queue-and-Title-Defense.pptx');
await fs.mkdir(build, { recursive: true });
const content = JSON.parse(await fs.readFile(path.join(ROOT, 'docs/thesis-defense/panel-demo-slides.json'), 'utf8'));
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const ink = '#173141', teal = '#126B78', muted = '#4C6570', light = '#EAF2F3';

function text(slide, value, left, top, width, height, size = 22, bold = false, color = ink) {
  const shape = slide.shapes.add({ geometry: 'textbox', position: { left, top, width, height },
    fill: 'none', line: { fill: 'none', width: 0 } });
  shape.text = value;
  shape.text.style = { typeface: 'Arial', fontSize: `${size}pt`, bold, color, wrap: 'square', autoFit: 'none', insets: 0 };
  return shape;
}
function node(slide, value, left, top, width, height) {
  const shape = slide.shapes.add({ geometry: 'rect', position: { left, top, width, height },
    fill: light, line: { fill: teal, width: 1.5 } });
  shape.text = value;
  shape.text.style = { typeface: 'Arial', fontSize: '20pt', bold: true, color: ink,
    alignment: 'center', verticalAlignment: 'middle', autoFit: 'none', insets: 8 };
  return shape;
}
function link(slide, from, to, fromSide = 'right', toSide = 'left') {
  slide.shapes.connect(from, to, { kind: 'elbow', fromSide, toSide,
    line: { fill: teal, width: 2.5 }, tail: { type: 'triangle', width: 'med', length: 'med' } });
}
function rows(slide, values, y = 190, step = 99, labelWidth = 330, size = 22) {
  values.forEach(([label, body], i) => {
    text(slide, label, 72, y + i * step, labelWidth - 20, 76, size - 2, true, teal);
    text(slide, body, 72 + labelWidth, y + i * step, 1136 - labelWidth, 76, size);
  });
}

for (const [index, item] of content.slides.entries()) {
  const slide = deck.slides.add();
  slide.background.fill = '#FFFFFF';
  slide.speakerNotes.text = item.notes;
  if (item.kind === 'cover') {
    text(slide, 'TeleConsole', 72, 102, 1136, 130, 68, true, teal);
    text(slide, content.official_title, 72, 266, 1100, 230, 25);
    text(slide, item.subtitle, 72, 561, 1136, 70, 25, true);
  } else {
    text(slide, item.title, 72, 60, 1136, 100, 34, true);
    if (item.kind === 'flow') {
      const a = node(slide, 'Signed\ninvitation', 72, 190, 250, 85);
      const b = node(slide, 'Server\nvalidation', 390, 190, 330, 85);
      const c = node(slide, 'Verified allowlist\ngrant', 775, 190, 245, 85);
      const d = node(slide, 'Other accepted\nvisitors wait', 390, 405, 330, 85);
      const e = node(slide, 'Doctor\nadmission', 775, 405, 245, 85);
      const f = node(slide, 'Visible\npreflight\nthen Join', 1060, 292, 165, 136);
      link(slide, a, b); link(slide, b, c); link(slide, b, d, 'bottom', 'top');
      link(slide, d, e); link(slide, c, f, 'right', 'top'); link(slide, e, f, 'right', 'bottom');
    } else if (item.kind === 'race') {
      const values = item.table;
      const table = slide.tables.add({ rows: values.length, columns: 3, left: 72, top: 190,
        width: 1136, height: 365, columnWidths: [285, 245, 606], values });
      for (let r = 0; r < values.length; r++) for (let c = 0; c < 3; c++) {
        const cell = table.getCell(r, c);
        cell.fill = r === 0 ? teal : (r % 2 ? '#F2F6F6' : '#FFFFFF');
        cell.text.style = { typeface: 'Arial', fontSize: '20pt', color: r === 0 ? '#FFFFFF' : ink, bold: r === 0, insets: 12 };
      }
    } else if (item.kind === 'number') {
      text(slide, item.number, 72, 176, 300, 180, 100, true, teal);
      text(slide, item.label, 410, 205, 765, 105, 27);
      rows(slide, item.rows, 365, 77, 360, 20);
    } else if (item.steps) {
      item.steps.forEach((line, i) => text(slide, line, 72, 185 + i * 78, 1136, 65, 23));
    } else if (item.number) {
      text(slide, item.lead, 72, 190, 1136, 95, 27);
      text(slide, item.number, 72, 317, 1136, 130, 68, true, teal);
      text(slide, item.label, 72, 478, 1136, 90, 28);
    } else {
      if (item.lead) text(slide, item.lead, 72, 170, 1136, 70, 25, true, teal);
      rows(slide, item.rows, item.lead ? 280 : 190, item.lead ? 100 : 99);
    }
    if (item.bottom) text(slide, item.bottom, 72, 618, 1136, 55, 16, true, muted);
  }
  text(slide, `${content.date}    Source ${content.baseline}    ${index + 1}`, 72, 684, 1136, 24, 10, false, muted);
  const png = await deck.export({ slide, format: 'png', scale: 1.25 });
  await fs.writeFile(path.join(build, `slide-${String(index + 1).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
}
const stamp = Date.now();
// The finalizer atomically links its validated file. Windows cannot hard-link
// over the WSL UNC bridge, so validate on native temporary storage, then copy.
const validationWorkspace = await fs.mkdtemp(path.join(tmpdir(), 'teleconsole-queue-deck-'));
const candidatePath = path.join(validationWorkspace, `candidate-${stamp}.pptx`);
const finalPath = path.join(validationWorkspace, 'output', `validated-${stamp}.pptx`);
await fs.mkdir(path.dirname(finalPath), { recursive: true });
await (await PresentationFile.exportPptx(deck)).save(candidatePath);
const result = await finalizePresentation({
  workspaceDir: validationWorkspace, candidatePath, finalPath,
  explicitTotalSlideCount: 14, requiredNativeTableOwnerSlides: [7], requiredNativeChartOwnerSlides: [],
  pythonExecutable: path.join(RUNTIME, 'python/python.exe'),
  integrityValidatorPath: path.join(SKILL, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(SKILL, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit', '--require-native-table-slide', '7'],
  fontPolicy: { basis: 'design', families: ['Arial'] }, verifyArtifactToolImport: true,
  receiptPath: path.join(validationWorkspace, 'validation.json'),
});
await fs.copyFile(path.join(validationWorkspace, 'validation.json'), path.join(build, 'validation.json'));
await fs.copyFile(finalPath, output);
// Source-native PDF export supplies the offline slide handout.
const pdf = await deck.export({ format: 'pdf' });
await fs.writeFile(path.join(ROOT, 'docs/thesis-defense/TeleConsole-Waiting-Queue-and-Title-Slides.pdf'), new Uint8Array(await pdf.arrayBuffer()));
console.log(JSON.stringify({ slides: content.slides.length, output, validation: result }, null, 2));
