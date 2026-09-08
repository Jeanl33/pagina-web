/**
 * Genera src/data/icons.js a partir de:
 *   - node_modules/lucide-static/icon-nodes.json  (geometría vectorial oficial)
 *   - node_modules/lucide-static/tags.json        (tags en inglés de Lucide)
 *   - tools/lexicon/*.json                        (léxico semántico ES/EN curado)
 *   - tools/concepts.json                         (mapa de conceptos → íconos)
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
    .replace(/\s+/g, ' ')
    .trim();

const titleize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const errors = [];
const icons = [];

for (const [name, meta] of Object.entries(lexicon)) {
  if (!nodes[name]) { errors.push(`Ícono inexistente en Lucide: ${name}`); continue; }
  const kw = new Set();
  for (const term of meta.k) kw.add(norm(term));
  for (const term of tags[name] || []) kw.add(norm(term));
  kw.add(norm(name.replace(/-/g, ' ')));
  icons.push({
    n: name,
    l: titleize(meta.k[0]),
    c: meta.c,
    k: [...kw].filter(Boolean),
    d: nodes[name],
  });
}

// Los alias reutilizan la lista curada del concepto destino (p. ej. "teamwork" -> "trabajo en equipo").
for (const [alias, targetRaw] of Object.entries(conceptAliases)) {
  const target = targetRaw;
  if (!concepts[target]) { errors.push(`Alias "${alias}" apunta a concepto inexistente: ${target}`); continue; }
  if (concepts[alias]) { errors.push(`Alias "${alias}" colisiona con un concepto ya definido`); continue; }
  concepts[alias] = concepts[target];
}

for (const [concept, list] of Object.entries(concepts)) {
  for (const n of list) if (!lexicon[n]) errors.push(`Concepto "${concept}" apunta a ícono no catalogado: ${n}`);
}

if (errors.length) {
  console.error('Errores de datos:\n' + errors.join('\n'));
  process.exit(1);
}

icons.sort((a, b) => a.n.localeCompare(b.n));

const normConcepts = {};
for (const [k, v] of Object.entries(concepts)) normConcepts[norm(k)] = v;

const out = `/**
 * ARCHIVO GENERADO — no editar a mano.
 * Fuente: tools/lexicon/*.json + tools/concepts.json
 * Geometría vectorial: lucide-static ${pkg.version} (ISC License, https://lucide.dev)
 * Regenerar con: npm run build:icons
 */
window.ICONLAB_DATA = {
  source: 'lucide-static@${pkg.version}',
  icons: ${JSON.stringify(icons)},
  concepts: ${JSON.stringify(normConcepts)}
};
`;

fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/icons.js'), out);

const kwTotal = icons.reduce((a, i) => a + i.k.length, 0);
console.log(
  `src/data/icons.js generado: ${icons.length} íconos, ${kwTotal} términos, ` +
  `${Object.keys(normConcepts).length} conceptos, ${(out.length / 1024).toFixed(1)} KB`
);
