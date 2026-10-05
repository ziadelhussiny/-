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

test('desktop header keeps the logo, search, actions, and category navigation in the reference order', async () => {
  const header = await readFile(path.join(root, 'sections', 'maliki-header.liquid'), 'utf8');
  const brand = header.match(/<a class="mk-header__brand"[\s\S]*?<\/a>/)?.[0] ?? '';

  assert.doesNotMatch(brand, /mk-header__tagline/);
  assert.match(brand, /section\.settings\.tagline/);
  assert.ok(header.indexOf('mk-header__brand') < header.indexOf('mk-header__search'));
  assert.ok(header.indexOf('mk-header__search') < header.indexOf('mk-header__actions'));
  assert.ok(header.indexOf('mk-header__actions') < header.indexOf('mk-header__category-nav'));
});

test('the storefront header exposes the reference search and utility navigation layers', async () => {
  const header = await readFile(path.join(root, 'sections', 'maliki-header.liquid'), 'utf8');

  assert.match(header, /class="mk-header__search"/);
  assert.match(header, /name="q"/);
  assert.match(header, /class="mk-header__category-nav"/);
  assert.match(header, /Wishlist/);
  assert.match(header, /Track Order/);
});

test('the Maliki header exposes an optional functional Shopify language switcher', async () => {
  const header = await readFile(path.join(root, 'sections', 'maliki-header.liquid'), 'utf8');
  const headerGroup = await readShopifyJson('sections/header-group.json');

  assert.match(header, /section\.settings\.show_language_switcher/);
  assert.match(header, /localization\.available_languages\.size\s*>\s*1/);
  assert.match(header, /form\s+'localization'/);
  assert.match(header, /name="language_code"/);
  assert.match(header, /"id":\s*"show_language_switcher"/);
  assert.equal(headerGroup.sections.maliki_header.settings.show_language_switcher, true);
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
      'maliki-seasonal-offer',
      'maliki-brand-story',
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

test('the home hero includes two calls to action and trust statistics', async () => {
  const hero = await readFile(path.join(root, 'sections', 'maliki-hero.liquid'), 'utf8');
  const home = await readShopifyJson('templates/index.json');
  const heroConfig = home.sections.hero;

  assert.match(hero, /secondary_button_label/);
  assert.match(hero, /for block in section\.blocks/);
  assert.equal(heroConfig.blocks && Object.keys(heroConfig.blocks).length, 3);
});

test('home fallback catalogue photography is large enough for crisp responsive cards', async () => {
  const names = [
    'maliki-catalog-seating.png',
    'maliki-catalog-tent.png',
    'maliki-catalog-rugs.png',
    'maliki-catalog-storage.png',
    'maliki-catalog-accessories.png',
  ];

  for (const name of names) {
    const source = await readFile(path.join(root, 'assets', name));
    assert.equal(source.toString('ascii', 1, 4), 'PNG', `${name} should be a PNG asset`);
    assert.ok(source.readUInt32BE(16) >= 1200, `${name} should be at least 1200px wide`);
    assert.ok(source.readUInt32BE(20) >= 800, `${name} should be at least 800px high`);
  }
});

test('heritage pattern is used on the three dark feature sections', async () => {
  const css = await readFile(path.join(root, 'assets', 'maliki.css'), 'utf8');
  const pattern = await readFile(path.join(root, 'assets', 'maliki-heritage-pattern.jpg'));

  assert.deepEqual([...pattern.subarray(0, 2)], [0xff, 0xd8]);
  assert.ok(pattern.byteLength < 1024 * 1024, 'pattern asset should stay below 1 MB');
  assert.match(css, /\.mk-values::before\s*\{[^}]*maliki-heritage-pattern\.jpg/s);
  assert.match(css, /\.mk-seasonal__inner\s*\{[^}]*maliki-heritage-pattern\.jpg/s);
  assert.match(css, /\.mk-newsletter\s*\{[^}]*maliki-heritage-pattern\.jpg/s);
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

test('every horizontal card rail uses side controls and hides its native scrollbar', async () => {
  const css = await readFile(path.join(root, 'assets', 'maliki.css'), 'utf8');

  for (const sectionName of ['maliki-products.liquid', 'maliki-testimonials.liquid']) {
    const source = await readFile(path.join(root, 'sections', sectionName), 'utf8');
    assert.match(source, /<maliki-carousel class="mk-carousel/);
    assert.match(source, /data-mk-scroll="-1"/);
    assert.match(source, /data-mk-track/);
    assert.match(source, /data-mk-scroll="1"/);
  }

  assert.match(css, /\.template-index \.mk-product-grid[^}]*scrollbar-width:\s*none/s);
  assert.match(css, /\.template-index \.mk-testimonial-grid[^}]*scrollbar-width:\s*none/s);
  assert.match(css, /\.mk-product-grid::-webkit-scrollbar[^}]*display:\s*none/s);
  assert.match(css, /\.mk-testimonial-grid::-webkit-scrollbar[^}]*display:\s*none/s);
});

test('category-related sections can link directly to Shopify collections', async () => {
  const categories = await readFile(path.join(root, 'sections', 'maliki-categories.liquid'), 'utf8');
  const products = await readFile(path.join(root, 'sections', 'maliki-products.liquid'), 'utf8');

  assert.match(categories, /block\.settings\.collection\.url/);
  assert.match(categories, /"type":\s*"collection",\s*"id":\s*"collection"/);
  assert.match(products, /section\.settings\.collection\.url/);
  assert.match(products, /"type":\s*"collection",\s*"id":\s*"collection"/);
});

test('mobile menu keeps aria state in sync and closes with Escape', async () => {
  const script = await readFile(path.join(root, 'assets', 'maliki.js'), 'utf8');
  assert.match(script, /setAttribute\('aria-expanded'/);
  assert.match(script, /event\.key === 'Escape'/);
});
