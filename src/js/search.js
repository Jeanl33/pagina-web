/* global window */
/**
 * Motor de búsqueda semántica ES/EN.
 *
 * Combina tres señales:
 *   1. Conceptos: frases completas ("trabajo en equipo") mapeadas a listas curadas de íconos.
 *   2. Léxico: sinónimos ES/EN por ícono, con coincidencia exacta, por prefijo y difusa.
 *   3. Cobertura: qué proporción de los términos de la consulta quedó cubierta.
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
    kwPhrase: 60,        // un sinónimo contiene la consulta completa
    tokenExact: 44,      // token == sinónimo
    tokenWord: 30,       // token aparece como palabra dentro de un sinónimo
    tokenPrefix: 22,     // token es prefijo de un sinónimo
    tokenPartial: 12,    // token aparece como subcadena
    tokenFuzzy: 18,      // token a distancia de edición 1
    nameToken: 26,       // token coincide con el nombre técnico del ícono
    coverage: 30         // bonificación por cobertura de la consulta
  };

  var icons = [];
  var concepts = {};
  var conceptKeys = [];
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

  function init(data) {
    icons = (data && data.icons) || [];
    concepts = (data && data.concepts) || {};
    conceptKeys = Object.keys(concepts).sort(function (a, b) { return b.length - a.length; });
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
  function scoreIcon(icon, q, tokens, hits) {
    var score = 0;
    var covered = {};
    var k = icon.k;
    var hasExact = false;
    var hasPhrase = false;

    for (var i = 0; i < k.length; i++) {
      if (k[i] === q) { hasExact = true; break; }
      if (!hasPhrase && q.length >= 4 && k[i].indexOf(q) !== -1) hasPhrase = true;
    }
    if (hasExact) {
      score += W.kwExact;
      for (var c = 0; c < tokens.length; c++) covered[tokens[c]] = 1;
    } else if (hasPhrase) {
      score += W.kwPhrase;
    }

    for (var t = 0; t < tokens.length; t++) {
      var tok = tokens[t];
      var best = 0;
      for (var j = 0; j < k.length; j++) {
        var kw = k[j];
        var value = 0;
        if (kw === tok) value = W.tokenExact;
        else if (kw.indexOf(' ') !== -1 && containsWord(kw, tok)) value = W.tokenWord;
        else if (tok.length >= 4 && kw.indexOf(tok) === 0) value = W.tokenPrefix;
        else if (tok.length >= 5 && kw.length >= 5 && kw.indexOf(' ') === -1 && isNearMatch(kw, tok)) value = W.tokenFuzzy;
        else if (tok.length >= 5 && kw.indexOf(tok) !== -1) value = W.tokenPartial;
        if (value > best) best = value;
        if (best === W.tokenExact) break;
      }
      for (var n = 0; n < icon.nameTokens.length; n++) {
        if (icon.nameTokens[n] === tok && W.nameToken > best) best = W.nameToken;
      }
      if (best > 0) { score += best; covered[tok] = 1; }
    }

    if (score > 0 && tokens.length) {
      score += (Object.keys(covered).length / tokens.length) * W.coverage;
    }
    if (hits[icon.n]) score += hits[icon.n];
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
      var affinity = shared * 3 + (ic.c === top.c ? 1 : 0);
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
    var hits = conceptHits(q, tokens);

    var scored = [];
    for (var i = 0; i < icons.length; i++) {
      var s = scoreIcon(icons[i], q, tokens, hits);
      if (s > 0) scored.push({ icon: icons[i], score: s });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.icon.n.localeCompare(b.icon.n);
    });

    var min = options.min || 0;
    if (scored.length && scored.length < min) fill(scored, min);
    return scored.slice(0, limit);
  }

  /** Mejor coincidencia individual; usada por el motor de personalización. */
  function best(query, minScore) {
    var r = search(query, { limit: 1 });
    if (!r.length) return null;
    if (minScore && r[0].score < minScore) return null;
    return r[0];
  }

  function byName(name) { return indexByName[name] || null; }

  window.IconSearch = {
    init: init,
    search: search,
    best: best,
    byName: byName,
    normalize: normalize,
    tokenize: tokenize,
    all: function () { return icons; },
    termCount: function () {
      var n = 0;
      for (var i = 0; i < icons.length; i++) n += icons[i].k.length;
      return n;
    }
  };
})(window);
