/**
 * Genera src/data/icons.js a partir de:
 *   - node_modules/lucide-static/icon-nodes.json  (geometría vectorial oficial, 1815 íconos)
 *   - node_modules/lucide-static/tags.json        (tags en inglés de Lucide)
 *   - tools/lexicon/*.json                        (léxico semántico ES/EN curado)
 *   - tools/concepts.json + concept-aliases.json  (conceptos de negocio → íconos)
 *   - tools/es-en.json                            (diccionario ES→EN para expandir consultas)
 *
 * El catálogo completo se publica; los íconos con léxico curado se marcan con `p:1`
 * para que la búsqueda los prefiera ante empates.
 *
 * Uso: npm run build:icons
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const nodes = read('node_modules/lucide-static/icon-nodes.json');
const tags = read('node_modules/lucide-static/tags.json');
const pkg = read('node_modules/lucide-static/package.json');
const concepts = read('tools/concepts.json');
const conceptAliases = read('tools/concept-aliases.json');
const esEnRaw = read('tools/es-en.json');

const lexDir = path.join(root, 'tools/lexicon');
const lexicon = {};
for (const file of fs.readdirSync(lexDir).sort()) {
  if (!file.endsWith('.json')) continue;
  Object.assign(lexicon, JSON.parse(fs.readFileSync(path.join(lexDir, file), 'utf8')));
}

/** minúsculas, sin acentos, sin puntuación */
const norm = (s) =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const titleize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const errors = [];

// Los alias reutilizan la lista curada del concepto destino ("teamwork" -> "trabajo en equipo").
for (const [alias, target] of Object.entries(conceptAliases)) {
  if (!concepts[target]) { errors.push(`Alias "${alias}" apunta a concepto inexistente: ${target}`); continue; }
  if (concepts[alias]) { errors.push(`Alias "${alias}" colisiona con un concepto ya definido`); continue; }
  concepts[alias] = concepts[target];
}

for (const name of Object.keys(lexicon)) {
  if (!nodes[name]) errors.push(`Ícono inexistente en Lucide: ${name}`);
}
for (const [concept, list] of Object.entries(concepts)) {
  for (const n of list) if (!nodes[n]) errors.push(`Concepto "${concept}" apunta a ícono inexistente: ${n}`);
}

const icons = [];
for (const [name, geometry] of Object.entries(nodes)) {
  const curated = lexicon[name];
  const kw = new Set();
  if (curated) for (const term of curated.k) kw.add(norm(term));
  for (const term of tags[name] || []) kw.add(norm(term));
  const spaced = norm(name.replace(/-/g, ' '));
  kw.add(spaced);
  for (const token of spaced.split(' ')) if (token.length > 2) kw.add(token);

  const icon = {
    n: name,
    l: curated ? titleize(curated.k[0]) : titleize(spaced),
    c: curated ? curated.c : 'Catálogo',
    k: [...kw].filter(Boolean),
    d: geometry
  };
  if (curated) icon.p = 1;
  icons.push(icon);
}

if (errors.length) {
  console.error('Errores de datos:\n' + errors.join('\n'));
  process.exit(1);
}

icons.sort((a, b) => a.n.localeCompare(b.n));

const normConcepts = {};
for (const [k, v] of Object.entries(concepts)) normConcepts[norm(k)] = v;

const esEn = {};
for (const [term, equivalents] of Object.entries(esEnRaw)) {
  const key = norm(term);
  const values = [...new Set(equivalents.map(norm).filter(Boolean))];
  if (key && values.length) esEn[key] = values;
}

const out = `/**
 * ARCHIVO GENERADO — no editar a mano.
 * Fuente: tools/lexicon/*.json, tools/concepts.json, tools/es-en.json
 * Geometría vectorial: lucide-static ${pkg.version} (ISC License, https://lucide.dev)
 * Regenerar con: npm run build:icons
 */
window.ICONLAB_DATA = {
  source: 'lucide-static@${pkg.version}',
  icons: ${JSON.stringify(icons)},
  concepts: ${JSON.stringify(normConcepts)},
  esEn: ${JSON.stringify(esEn)}
};
`;

fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/icons.js'), out);

const curatedCount = icons.filter((i) => i.p).length;
console.log(
  `src/data/icons.js generado: ${icons.length} íconos (${curatedCount} con léxico curado ES/EN), ` +
  `${Object.keys(normConcepts).length} conceptos, ${Object.keys(esEn).length} términos ES→EN, ` +
  `${(out.length / 1024).toFixed(0)} KB`
);
