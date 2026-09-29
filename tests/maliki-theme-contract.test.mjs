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

async function readShopifyJson(relativePath) {
  const source = await readFile(path.join(root, relativePath), 'utf8');
  return JSON.parse(source.replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
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

test('desktop header keeps the logo, navigation, actions, and tagline in the reference order', async () => {
  const header = await readFile(path.join(root, 'sections', 'maliki-header.liquid'), 'utf8');
  const brand = header.match(/<a class="mk-header__brand"[\s\S]*?<\/a>/)?.[0] ?? '';

  assert.doesNotMatch(brand, /mk-header__tagline/);
  assert.match(header, /mk-header__actions[\s\S]*?section\.settings\.tagline/);
});

test('desktop composition leaves enough viewport gutter for carousel controls', async () => {
  const css = await readFile(path.join(root, 'assets', 'maliki.css'), 'utf8');
  assert.match(css, /--mk-page:\s*min\(1240px,\s*calc\(100vw\s*-\s*80px\)\)/);
  assert.match(css, /\.mk-header__inner\s*\{[^}]*width:\s*min\(1000px,\s*calc\(100vw\s*-\s*80px\)\)/s);
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

test('reference pages use the intended Shopify section structure exactly once', async () => {
  const expected = {
    'templates/index.json': [
      'maliki-hero',
      'maliki-icon-strip',
      'maliki-categories',
      'maliki-products',
      'maliki-promo-grid',
      'maliki-testimonials',
      'maliki-social-gallery',
      'maliki-newsletter',
    ],
    'templates/page.about-us.json': [
      'maliki-hero',
      'maliki-about-story',
      'maliki-values',
      'maliki-moments',
      'maliki-icon-strip',
    ],
    'templates/page.contact.json': [
      'maliki-hero',
      'maliki-contact-hub',
      'maliki-showroom',
      'maliki-icon-strip',
    ],
  };

  for (const [templatePath, expectedTypes] of Object.entries(expected)) {
    const template = await readShopifyJson(templatePath);
    const orderedSections = template.order.map((id) => template.sections[id]);
    assert.deepEqual(
      orderedSections.map((section) => section.type),
      expectedTypes,
      `${templatePath} should match the reference section sequence`,
    );
    assert.deepEqual(
      orderedSections.filter((section) => section.disabled === true),
      [],
      `${templatePath} should not disable a reference section`,
    );
  }
});

test('multiline design headings preserve their authored line breaks', async () => {
  const hero = await readFile(path.join(root, 'sections', 'maliki-hero.liquid'), 'utf8');
  const about = await readFile(path.join(root, 'sections', 'maliki-about-story.liquid'), 'utf8');

  assert.match(hero, /section\.settings\.heading\s*\|\s*newline_to_br/);
  assert.match(about, /section\.settings\.story_heading\s*\|\s*newline_to_br/);
});

test('category carousel movement respects LTR and RTL direction', async () => {
  const script = await readFile(path.join(root, 'assets', 'maliki.js'), 'utf8');
  assert.match(script, /getComputedStyle\(this\)\.direction/);
  assert.match(script, /directionFactor/);
});
