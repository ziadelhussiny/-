import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arabicPattern = /[\u0600-\u06ff]/u;

async function malikiSectionFiles() {
  const entries = await readdir(path.join(root, 'sections'));
  return entries.filter((name) => name.startsWith('maliki-') && name.endsWith('.liquid'));
}

test('the header group stays pinned to the top while the page scrolls', async () => {
  const css = await readFile(path.join(root, 'assets', 'maliki.css'), 'utf8');
  assert.match(css, /#header-group\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s);
});

test('the original Maliki logo is the header and footer fallback', async () => {
  for (const section of ['maliki-header.liquid', 'maliki-footer.liquid']) {
    const source = await readFile(path.join(root, 'sections', section), 'utf8');
    assert.match(source, /'maliki-logo\.jpg'\s*\|\s*asset_url/);
    assert.doesNotMatch(source, /mk-brand-mark/);
  }
});

test('Maliki storefront defaults contain no Arabic copy', async () => {
  const sectionNames = await malikiSectionFiles();
  const files = [
    ...sectionNames.map((name) => path.join(root, 'sections', name)),
    path.join(root, 'templates', 'index.json'),
    path.join(root, 'templates', 'page.about-us.json'),
    path.join(root, 'templates', 'page.contact.json'),
    path.join(root, 'sections', 'header-group.json'),
    path.join(root, 'sections', 'footer-group.json'),
  ];

  const offending = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (arabicPattern.test(source)) offending.push(path.relative(root, file));
  }

  assert.deepEqual(offending, []);
});

test('every Maliki section exposes both LTR and RTL direction options', async () => {
  const sectionNames = await malikiSectionFiles();
  const missing = [];

  for (const name of sectionNames) {
    const source = await readFile(path.join(root, 'sections', name), 'utf8');
    const hasDirection = /"id"\s*:\s*"direction"/.test(source);
    const hasLtr = /"value"\s*:\s*"ltr"/.test(source);
    const hasRtl = /"value"\s*:\s*"rtl"/.test(source);
    if (!hasDirection || !hasLtr || !hasRtl) missing.push(name);
  }

  assert.deepEqual(missing, []);
});
