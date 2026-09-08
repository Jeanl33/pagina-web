/* global window */
/**
 * Motor de búsqueda semántica ES/EN sobre el catálogo completo de Lucide.
 *
 * Combina cuatro señales:
 *   1. Conceptos: frases de negocio ("trabajo en equipo") mapeadas a listas curadas.
 *   2. Léxico: sinónimos ES/EN por ícono, con coincidencia exacta, prefijo, subcadena y difusa.
 *   3. Expansión ES→EN: cada término en español se amplía con sus equivalentes en inglés,
 *      de modo que una consulta en español alcanza también los 1560 íconos cuyo
 *      vocabulario original sólo existe en inglés.
 *   4. Cobertura: qué proporción de los términos de la consulta quedó cubierta.
 *
 * Nunca hace peticiones de red: todo el índice vive en src/data/icons.js.
 */
(function (window) {
  'use strict';

  var STOPWORDS = {
    de: 1, del: 1, la: 1, el: 1, los: 1, las: 1, un: 1, una: 1, unos: 1, unas: 1, y: 1, o: 1,
    a: 1, al: 1, en: 1, con: 1, para: 1, por: 1, que: 1, se: 1, su: 1, sus: 1, lo: 1, es: 1,
    icono: 1, iconos: 1, icon: 1, icons: 1, imagen: 1, simbolo: 1, logo: 1,
    the: 1, of: 1, for: 1, and: 1, or: 1, an: 1, to: 1, in: 1, on: 1, with: 1, at: 1, is: 1
  };

  var W = {
    conceptExact: 200,   // la consulta es exactamente un concepto
    conceptPhrase: 130,  // la consulta contiene un concepto
    kwExact: 120,        // un sinónimo es idéntico a la consulta
    kwPhrase: 60,        // un sinónimo contiene la consulta completa como palabra
    tokenExact: 44,      // término == sinónimo
    tokenWord: 30,       // término aparece como palabra dentro de un sinónimo
    tokenPrefix: 22,     // término es prefijo de un sinónimo
    tokenPartial: 12,    // término aparece como subcadena
    tokenFuzzy: 18,      // término a distancia de edición 1
    nameToken: 26,       // término coincide con el nombre técnico del ícono
    coverage: 30,        // bonificación por cobertura de la consulta
    curated: 20,         // preferencia por íconos con léxico ES/EN curado
    translated: 0.82,    // factor aplicado a los equivalentes traducidos
    phraseTranslated: 0.95
  };

  var icons = [];
  var concepts = {};
  var conceptKeys = [];
  var esEn = {};
  var esEnPhrases = [];
  var indexByName = {};

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(normalized) {
    var out = [];
    var parts = normalized.split(' ');
    for (var i = 0; i < parts.length; i++) {
      var t = parts[i];
      if (t.length < 2 || STOPWORDS[t]) continue;
      out.push(t);
    }
    // Si todo eran stopwords, conserva los tokens originales para no devolver vacío.
    if (!out.length) {
      for (var j = 0; j < parts.length; j++) if (parts[j]) out.push(parts[j]);
    }
    return out;
  }

  /** Distancia de edición acotada a 1 (suficiente para erratas y plurales). */
  function isNearMatch(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a === b) return true;
    var la = a.length, lb = b.length, i = 0, j = 0, diff = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++diff > 1) return false;
      if (la > lb) i++;
      else if (lb > la) j++;
      else { i++; j++; }
    }
    return true;
  }

  function containsWord(haystack, word) {
    var idx = haystack.indexOf(word);
    while (idx !== -1) {
      var before = idx === 0 || haystack[idx - 1] === ' ';
      var afterPos = idx + word.length;
      var after = afterPos === haystack.length || haystack[afterPos] === ' ';
      if (before && after) return true;
      idx = haystack.indexOf(word, idx + 1);
    }
    return false;
  }

  /**
   * Amplía la consulta con los equivalentes en inglés de cada término en español.
   * Devuelve términos ponderados agrupados por el token original que los originó,
   * para que la cobertura siga midiéndose sobre lo que el usuario realmente escribió.
   */
  /** Busca en el diccionario ES→EN tolerando plurales ("paneles" -> "panel"). */
  function lookup(token) {
    if (esEn[token]) return esEn[token];
    if (token.length > 4 && token.slice(-2) === 'es' && esEn[token.slice(0, -2)]) return esEn[token.slice(0, -2)];
    if (token.length > 3 && token.slice(-1) === 's' && esEn[token.slice(0, -1)]) return esEn[token.slice(0, -1)];
    return null;
  }

  function expand(q, tokens) {
    var terms = [];
    var seen = {};
    var push = function (term, weight, group) {
      var key = term + '#' + group;
      if (!term || seen[key]) return;
      seen[key] = 1;
      terms.push({ t: term, w: weight, g: group });
    };

    for (var i = 0; i < tokens.length; i++) {
      push(tokens[i], 1, i);
      var direct = lookup(tokens[i]);
      if (direct) for (var d = 0; d < direct.length; d++) push(direct[d], W.translated, i);
    }

    // Frases del diccionario ("tarjeta de credito", "base de datos") sobre la consulta completa.
    for (var p = 0; p < esEnPhrases.length; p++) {
      var phrase = esEnPhrases[p];
      if (q.indexOf(phrase) === -1) continue;
      var equivalents = esEn[phrase];
      for (var e = 0; e < equivalents.length; e++) {
        var words = equivalents[e].split(' ');
        for (var w = 0; w < words.length; w++) push(words[w], W.phraseTranslated, tokens.length + p);
      }
    }

    return terms;
  }

  function init(data) {
    icons = (data && data.icons) || [];
    concepts = (data && data.concepts) || {};
    esEn = (data && data.esEn) || {};
    conceptKeys = Object.keys(concepts).sort(function (a, b) { return b.length - a.length; });
    esEnPhrases = Object.keys(esEn).filter(function (k) { return k.indexOf(' ') !== -1; });
    indexByName = {};
    for (var i = 0; i < icons.length; i++) {
      icons[i].nameTokens = icons[i].n.split('-');
      indexByName[icons[i].n] = icons[i];
    }
    return icons.length;
  }

  /**
   * Puntúa un ícono frente a la consulta.
   *
   * Cada término aporta únicamente su mejor coincidencia (no la suma de todas
   * las que existan), para que un ícono con muchos sinónimos largos no desplace
   * a otro cuyo sinónimo es exactamente la consulta.
   */
  function scoreIcon(icon, q, terms, groupCount, hits) {
    var score = 0;
    var covered = {};
    var k = icon.k;
    var hasExact = false;
    var hasPhrase = false;

    for (var i = 0; i < k.length; i++) {
      if (k[i] === q) { hasExact = true; break; }
      // Con límite de palabra: "dado" no debe puntuar dentro de "validado".
      if (!hasPhrase && q.length >= 4 && containsWord(k[i], q)) hasPhrase = true;
    }
    if (hasExact) {
      score += W.kwExact;
      for (var c = 0; c < terms.length; c++) covered[terms[c].g] = 1;
    } else if (hasPhrase) {
      score += W.kwPhrase;
    }

    for (var t = 0; t < terms.length; t++) {
      var term = terms[t].t;
      var best = 0;
      for (var j = 0; j < k.length; j++) {
        var kw = k[j];
        var value = 0;
        if (kw === term) value = W.tokenExact;
        else if (kw.indexOf(' ') !== -1 && containsWord(kw, term)) value = W.tokenWord;
        else if (term.length >= 4 && kw.indexOf(term) === 0) value = W.tokenPrefix;
        else if (term.length >= 5 && kw.length >= 5 && kw.indexOf(' ') === -1 && isNearMatch(kw, term)) value = W.tokenFuzzy;
        else if (term.length >= 5 && kw.indexOf(term) !== -1) value = W.tokenPartial;
        if (value > best) best = value;
        if (best === W.tokenExact) break;
      }
      for (var n = 0; n < icon.nameTokens.length; n++) {
        if (icon.nameTokens[n] === term && W.nameToken > best) best = W.nameToken;
      }
      if (best > 0) { score += best * terms[t].w; covered[terms[t].g] = 1; }
    }

    if (score > 0 && groupCount) {
      score += (Object.keys(covered).length / groupCount) * W.coverage;
    }
    if (hits[icon.n]) score += hits[icon.n];
    if (score > 0 && icon.p) score += W.curated;
    return score;
  }

  /** Puntajes provenientes del mapa de conceptos. */
  function conceptHits(q, tokens) {
    var hits = {};
    var add = function (name, value) { hits[name] = (hits[name] || 0) + value; };

    for (var i = 0; i < conceptKeys.length; i++) {
      var key = conceptKeys[i];
      var base = 0;
      if (q === key) base = W.conceptExact;
      else if (key.indexOf(' ') !== -1 && q.indexOf(key) !== -1) base = W.conceptPhrase;
      else if (key.indexOf(' ') === -1 && containsWord(q, key)) base = W.conceptPhrase * 0.8;
      else if (tokens.length === 1 && key.indexOf(' ') === -1 && isNearMatch(key, tokens[0]) && key.length >= 5) base = W.conceptPhrase * 0.55;
      if (!base) continue;

      var list = concepts[key];
      for (var j = 0; j < list.length; j++) add(list[j], base * (1 - j * 0.07));
    }
    return hits;
  }

  /**
   * Garantiza un mínimo de alternativas: completa con los íconos más parecidos
   * al mejor resultado (sinónimos compartidos y misma categoría).
   */
  function fill(scored, min) {
    var seen = {};
    for (var i = 0; i < scored.length; i++) seen[scored[i].icon.n] = 1;

    var top = scored[0].icon;
    var topKw = {};
    for (var k = 0; k < top.k.length; k++) topKw[top.k[k]] = 1;

    var candidates = [];
    for (var j = 0; j < icons.length; j++) {
      var ic = icons[j];
      if (seen[ic.n]) continue;
      var shared = 0;
      for (var m = 0; m < ic.k.length; m++) if (topKw[ic.k[m]]) shared++;
      var affinity = shared * 3 + (ic.c === top.c && top.c !== 'Catálogo' ? 1 : 0) + (ic.p ? 1 : 0);
      if (affinity > 0) candidates.push({ icon: ic, affinity: affinity });
    }
    candidates.sort(function (a, b) {
      if (b.affinity !== a.affinity) return b.affinity - a.affinity;
      return a.icon.n.localeCompare(b.icon.n);
    });
    for (var c = 0; c < candidates.length && scored.length < min; c++) {
      scored.push({ icon: candidates[c].icon, score: 0.5, filler: true });
    }
  }

  function search(query, options) {
    options = options || {};
    var limit = options.limit || 12;
    var q = normalize(query);
    if (!q) return [];
    var tokens = tokenize(q);
    var terms = expand(q, tokens);
    var hits = conceptHits(q, tokens);

    var scored = [];
    for (var i = 0; i < icons.length; i++) {
      var s = scoreIcon(icons[i], q, terms, tokens.length, hits);
      if (s > 0) scored.push({ icon: icons[i], score: s });
    }
    // A igualdad de puntaje gana el ícono de nombre más simple: ante "check",
    // `check` debe vencer a `book-open-check` o `calendar-check`.
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var da = a.icon.nameTokens.length, db = b.icon.nameTokens.length;
      if (da !== db) return da - db;
      if (a.icon.n.length !== b.icon.n.length) return a.icon.n.length - b.icon.n.length;
      return a.icon.n.localeCompare(b.icon.n);
    });

    var min = options.min || 0;
    if (scored.length && scored.length < min) fill(scored, min);
    return scored.slice(0, limit);
  }

  /** Mejor coincidencia individual; usada por los motores de personalización y composición. */
  function best(query, minScore) {
    var r = search(query, { limit: 1 });
    if (!r.length) return null;
    if (minScore && r[0].score < minScore) return null;
    return r[0];
  }

  function byName(name) { return indexByName[name] || null; }

  /** Registra un ícono creado por el usuario para que sea localizable como cualquier otro. */
  function register(icon) {
    if (!icon || !icon.n) return null;
    icon.nameTokens = icon.n.split('-');
    if (!indexByName[icon.n]) icons.push(icon);
    else {
      for (var i = 0; i < icons.length; i++) if (icons[i].n === icon.n) { icons[i] = icon; break; }
    }
    indexByName[icon.n] = icon;
    return icon;
  }

  function unregister(name) {
    if (!indexByName[name]) return;
    delete indexByName[name];
    for (var i = 0; i < icons.length; i++) {
      if (icons[i].n === name) { icons.splice(i, 1); return; }
    }
  }

  window.IconSearch = {
    init: init,
    search: search,
    best: best,
    byName: byName,
    register: register,
    unregister: unregister,
    normalize: normalize,
    tokenize: tokenize,
    all: function () { return icons; },
    curatedCount: function () {
      var n = 0;
      for (var i = 0; i < icons.length; i++) if (icons[i].p) n++;
      return n;
    },
    termCount: function () {
      var n = 0;
      for (var i = 0; i < icons.length; i++) n += icons[i].k.length;
      return n;
    }
  };
})(window);
