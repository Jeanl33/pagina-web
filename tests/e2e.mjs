/**
 * Pruebas end-to-end de IconLab sobre Chromium (Playwright).
 *
 *   npm test
 *
 * Levanta un servidor estático sobre el repositorio y valida búsqueda,
 * personalización, exportación con transparencia y comportamiento responsivo.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const TYPES = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));

/** Usa el Chromium que trae Playwright; si no está, busca uno preinstalado. */
async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (err) {
    const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
    const candidate = fs.existsSync(base)
      ? fs.readdirSync(base)
          .filter((d) => d.startsWith('chromium-'))
          .map((d) => path.join(base, d, 'chrome-linux', 'chrome'))
          .find((f) => fs.existsSync(f))
      : null;
    if (!candidate) throw err;
    return chromium.launch({ executablePath: candidate });
  }
}

const browser = await launchChromium();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

let passed = 0;
let failed = 0;
const check = (label, cond, extra = '') => {
  if (cond) passed++; else failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label + (extra ? ' :: ' + extra : ''));
};

// 1. Carga inicial
const initialCards = await page.locator('#results button').count();
check('estado inicial con 6-12 resultados', initialCards >= 6 && initialCards <= 12, initialCards + ' tarjetas');
check('ícono preseleccionado en el panel', await page.locator('#preview svg').count() === 1);
check('catálogo completo cargado', Number(await page.locator('#stat-icons').textContent()) >= 1815,
  await page.locator('#stat-icons').textContent());

// 2. Búsqueda ES y EN
for (const [q, expectMin] of [['persona hablando',6],['crecimiento financiero',6],['teamwork',6],['sostenibilidad',6],['inteligencia artificial',6]]) {
  await page.fill('#search-input', q);
  await page.waitForTimeout(220);
  const n = await page.locator('#results button').count();
  const first = await page.locator('#results button').first().getAttribute('title');
  check(`búsqueda "${q}"`, n >= expectMin && n <= 12, `${n} resultados, top=${first}`);
}

// 2b. Vocabulario de cola larga que antes no existía
for (const [q, expected] of [['paraguas','umbrella'],['tortuga','turtle'],['hexagono','hexagon'],['dado','dice'],['montacargas','forklift']]) {
  await page.fill('#search-input', q);
  await page.waitForTimeout(220);
  const titles = await page.locator('#results button').evaluateAll(els => els.map(e => e.title));
  check(`cola larga "${q}"`, titles.some(t => t.includes(expected)), titles.slice(0,3).join(' | '));
}

// 3. Selección
await page.fill('#search-input', 'persona hablando');
await page.waitForTimeout(220);
await page.locator('#results button').first().click();
check('selección abre el ícono en el panel', (await page.locator('#preview-name').textContent()).includes('message-circle'));

// 4. Color, trazo, tamaño
await page.locator('#palette button').nth(2).click();
let stroke = await page.getAttribute('#preview svg', 'stroke');
check('paleta cambia el color', stroke === '#10B981', stroke);
await page.fill('#color-hex', '#FF0054');
await page.dispatchEvent('#color-hex', 'change');
stroke = await page.getAttribute('#preview svg', 'stroke');
check('hex libre aplica color', stroke === '#FF0054', stroke);
await page.locator('#stroke-range').fill('3.5');
check('slider de grosor', (await page.getAttribute('#preview svg','stroke-width')) === '3.5');
await page.locator('#size-range').fill('256');
check('slider de tamaño', (await page.getAttribute('#preview svg','width')) === '256');

// 5. Detalles personalizados
const detailCases = [
  ['Agrégale un bocadillo de diálogo sobre la cabeza', 1],
  ['Ponle un signo de dólar dentro del círculo', 1],
  ['Haz que las líneas del fondo sean punteadas', 1],
  ['Añádele un marco circular alrededor', 1],
  ['Agrégale un candado en la esquina superior derecha y ponle un check abajo a la derecha', 2],
];
for (const [text, minChips] of detailCases) {
  await page.fill('#details-input', text);
  await page.click('#details-apply');
  await page.waitForTimeout(120);
  const chips = await page.locator('#details-chips span > span').allTextContents();
  const svg = await page.locator('#preview').innerHTML();
  check(`detalle "${text.slice(0,42)}…"`, chips.length >= minChips && svg.includes('<svg'), chips.join(' | '));
}

// dashed / frame realmente presentes en el SVG
await page.fill('#details-input', 'marco circular punteado');
await page.click('#details-apply');
let svg = await page.locator('#preview').innerHTML();
check('marco circular renderizado', svg.includes('<circle') && svg.includes('stroke-dasharray'), '');

// quitar chip
await page.fill('#details-input', 'un candado arriba, una estrella abajo');
await page.click('#details-apply');
let before = await page.locator('#details-chips > span').count();
await page.locator('#details-chips button').first().click();
let after = await page.locator('#details-chips > span').count();
check('quitar un detalle desde el chip', after === before - 1, `${before} -> ${after}`);

// instrucción no reconocida
await page.fill('#details-input', 'zzzz qqqq');
await page.click('#details-apply');
check('avisa instrucción no interpretada', (await page.locator('#details-feedback').textContent()).includes('No se pudo interpretar'));
await page.click('#details-clear');

// 5b. Creación de íconos desde una descripción
const compositions = [
  ['un maletín con una flecha hacia arriba', ['briefcase', 'Subida']],
  ['un círculo con un rayo dentro', ['(circle)', 'Rapidez']],
  ['un cerebro rodeado de un marco circular', ['brain', 'Marco circular']],
];
for (const [description, mustMention] of compositions) {
  await page.fill('#compose-input', description);
  await page.click('#compose-btn');
  await page.waitForTimeout(200);
  const summary = (await page.locator('#compose-feedback').textContent()) || '';
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const ok = mustMention.every(m => norm(summary).toLowerCase().includes(norm(m).toLowerCase()));
  const preview = await page.locator('#preview').innerHTML();
  check(`crear "${description.slice(0,34)}…"`, ok && preview.includes('<svg'), summary.trim().slice(0, 90));
}

check('el ícono creado queda seleccionado en el editor',
  (await page.locator('#preview-name').textContent()).includes('custom-'));
check('los íconos creados aparecen en "Mis íconos"',
  (await page.locator('#my-icons > div').count()) === 3);

// El ícono compuesto aporta geometría propia (base + marco/añadidos)
const composedSvg = await page.evaluate(() => document.querySelector('#preview svg').outerHTML);
check('la composición añade geometría al SVG', composedSvg.includes('<circle') && composedSvg.length > 400);

// Persistencia entre recargas
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check('los íconos creados sobreviven a la recarga',
  (await page.locator('#my-icons > div').count()) === 3);

// Los íconos creados son localizables por el buscador
await page.fill('#search-input', 'maletin flecha');
await page.waitForTimeout(250);
const foundCustom = await page.locator('#results button').evaluateAll(els => els.map(e => e.title));
check('el ícono creado es localizable por búsqueda', foundCustom.some(t => t.includes('custom-')), foundCustom[0]);

// Eliminación
await page.locator('#my-icons > div').first().locator('button[aria-label="Eliminar ícono creado"]').click();
await page.waitForTimeout(150);
check('se puede eliminar un ícono creado', (await page.locator('#my-icons > div').count()) === 2);

// Estado vacío que ofrece crear
await page.fill('#search-input', 'zzzqqqxyz');
await page.waitForTimeout(250);
check('el estado vacío ofrece crear el ícono',
  (await page.locator('#empty-state button').count()) === 1);

await page.fill('#search-input', 'persona hablando');
await page.waitForTimeout(250);
await page.locator('#results button').first().click();

// 6. Exportación (con el trazo por defecto)
await page.locator('#stroke-range').fill('2');
await page.locator('#size-range').fill('128');
await page.fill('#details-input', 'marco circular y un signo de dólar dentro');
await page.click('#details-apply');
const png = await page.evaluate(async () => {
  const svg = document.querySelector('#preview svg').outerHTML;
  const blob = await window.Exporter.toPngBlob(svg, 512);
  const bitmap = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = c.getContext('2d'); g.drawImage(bitmap, 0, 0);
  const d = g.getImageData(0, 0, bitmap.width, bitmap.height).data;
  let opaque = 0, transparent = 0;
  for (let i = 3; i < d.length; i += 4) (d[i] > 250 ? opaque++ : (d[i] === 0 ? transparent++ : 0));
  const at = (x, y) => d[(y * bitmap.width + x) * 4 + 3];
  const corners = [at(2,2), at(bitmap.width-3,2), at(2,bitmap.height-3), at(bitmap.width-3,bitmap.height-3)];
  return { type: blob.type, size: blob.size, w: bitmap.width, h: bitmap.height, opaque, transparent, corners, total: d.length/4 };
});
check('PNG generado a 512px', png.w === 512 && png.h === 512 && png.type === 'image/png', JSON.stringify(png).slice(0,140));
check('PNG con fondo transparente',
  png.corners.every(a => a === 0) && png.transparent / png.total > 0.5 && png.opaque > 500,
  `esquinas alfa=${png.corners.join(',')} transp=${(100*png.transparent/png.total).toFixed(1)}% tinta=${png.opaque}`);

const clip = await page.evaluate(async () => {
  try {
    const svg = document.querySelector('#preview svg').outerHTML;
    const r = await window.Exporter.copyPng(svg, 512, 'x.png');
    return r;
  } catch (e) { return 'error:' + e.message; }
});
check('copyPng resuelve al portapapeles', clip === 'clipboard', String(clip));

const svgOut = await page.evaluate(() => document.querySelector('#preview svg').outerHTML);
check('SVG exportable bien formado', svgOut.startsWith('<svg') && svgOut.endsWith('</svg>'));

// 7. Responsive
for (const [w,h,label] of [[390,844,'móvil'],[820,1180,'tablet'],[1440,1000,'escritorio']]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(150);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`sin desbordamiento horizontal (${label})`, !overflow);
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.waitForTimeout(200);
check('sin errores de consola', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();

console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
