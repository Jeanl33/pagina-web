/* global window */
/**
 * Compositor de íconos: crea un ícono nuevo a partir de una descripción escrita.
 *
 *   "un maletín con una flecha hacia arriba"
 *   "un círculo con una persona dentro y un candado en la esquina superior derecha"
 *   "una nube rodeada de un marco circular"
 *
 * El resultado es un ícono de primera clase (mismo formato que los del catálogo)
 * con geometría propia: un elemento base más `parts` superpuestas y, opcionalmente,
 * un marco. Una vez creado se comporta como cualquier otro ícono: se puede colorear,
 * ajustar, seguir modificando con el panel de detalles y exportar.
 */
(function (window) {
  'use strict';

  var Search = window.IconSearch;
  var Customizer = window.Customizer;

  /** Conectores que separan elementos y, a la vez, insinúan dónde va el siguiente. */
  var CONNECTORS = [
    ['rodeado de', 'around'], ['rodeada de', 'around'], ['rodeado por', 'around'],
    ['rodeada por', 'around'], ['con un marco', 'around'],
    ['encima de', 'top'], ['arriba de', 'top'], ['por encima de', 'top'], ['sobre', 'top'],
    ['dentro de', 'center'], ['adentro de', 'center'], ['en el interior de', 'center'],
    ['debajo de', 'bottom'], ['abajo de', 'bottom'], ['por debajo de', 'bottom'],
    ['al lado de', 'right'], ['junto a', 'right'], ['a la par de', 'right'],
    ['ademas de', ''], ['junto con', ''], ['con', ''], ['mas', ''], ['y', '']
  ];

  /** Palabras que sólo describen ubicación o soporte: no son elementos por sí mismas. */
  var NOT_AN_ELEMENT = {
    cabeza: 1, cuerpo: 1, cara: 1, rostro: 1, lado: 1, esquina: 1, parte: 1, medio: 1,
    centro: 1, fondo: 1, frente: 1, atras: 1, encima: 1, debajo: 1, arriba: 1, abajo: 1,
    izquierda: 1, derecha: 1, superior: 1, inferior: 1, alrededor: 1, borde: 1,
    head: 1, body: 1, side: 1, corner: 1, top: 1, bottom: 1, left: 1, right: 1, around: 1
  };

  /**
   * En "una flecha hacia arriba", la palabra "arriba" forma parte del nombre del
   * elemento, no indica dónde colocarlo. Estos segmentos conservan sus palabras
   * de dirección y no aportan posición.
   */
  var DIRECTIONAL = /(^|\s)(flecha|flechas|arrow|arrows|triangulo|chevron|cursor|puntero)(\s|$)/;

  /** Umbral de confianza para aceptar que un segmento nombra un ícono real. */
  var MIN_SCORE_BASE = 40;
  var MIN_SCORE_PART = 45;

  // El texto normalizado sólo contiene [a-z0-9 ], así que "|" es un separador seguro.
  var MARK = '|';

  var counter = 0;

  function norm(text) { return Search.normalize(text); }

  /**
   * Parte la descripción en segmentos, conservando la pista de posición que
   * aportaba cada conector ("dentro de" -> centro, "encima de" -> arriba).
   */
  function segment(description) {
    var work = ' ' + norm(description) + ' ';
    var ordered = CONNECTORS.slice().sort(function (a, b) { return b[0].length - a[0].length; });

    for (var i = 0; i < ordered.length; i++) {
      var phrase = ' ' + ordered[i][0] + ' ';
      var marker = ' ' + MARK + ordered[i][1] + MARK + ' ';
      while (work.indexOf(phrase) !== -1) work = work.replace(phrase, marker);
    }

    var pieces = work.split(/\|([a-z]*)\|/);
    var segments = [];
    for (var p = 0; p < pieces.length; p += 2) {
      var text = (pieces[p] || '').trim();
      var hint = p === 0 ? null : ((pieces[p - 1] || '') || null);
      if (text) segments.push({ text: text, hint: hint });
    }
    return segments;
  }

  /** Limpia un segmento y comprueba que aún nombre algo concreto. */
  function meaningfulQuery(text) {
    var directional = DIRECTIONAL.test(text);
    var cleaned = Customizer.stripForSearch(text, directional);
    if (!cleaned) return null;
    if (directional) return cleaned;
    var tokens = cleaned.split(' ').filter(function (t) { return t && !NOT_AN_ELEMENT[t]; });
    if (!tokens.length) return null;
    return tokens.join(' ');
  }

  function frameFromSegment(text) {
    if (Customizer.matchedGroups(text).indexOf('frame') === -1) return null;
    if (text.indexOf('cuadrad') !== -1 || text.indexOf('square') !== -1) return { shape: 'square' };
    if (text.indexOf('redondead') !== -1 || text.indexOf('rounded') !== -1) return { shape: 'rounded' };
    return { shape: 'circle' };
  }

  var AUTO = ['top-right', 'bottom-right', 'top-left', 'bottom-left', 'top', 'bottom'];

  function nextAnchor(parts) {
    var used = {};
    for (var i = 0; i < parts.length; i++) used[parts[i].anchor] = 1;
    for (var a = 0; a < AUTO.length; a++) if (!used[AUTO[a]]) return AUTO[a];
    return 'top-right';
  }

  /**
   * @param {string} description Descripción en lenguaje natural.
   * @returns {Object|null} Composición, o `null` si no se reconoció el elemento base.
   */
  function create(description) {
    var raw = String(description || '').trim();
    if (!raw) return null;

    var segments = segment(raw);
    if (!segments.length) return null;

    var base = null;
    var parts = [];
    var partLabels = [];
    var styleClauses = [];
    var unknown = [];
    var frame = null;
    var keywords = {};

    var remember = function (text) {
      var tokens = norm(text).split(' ');
      for (var i = 0; i < tokens.length; i++) if (tokens[i].length > 2) keywords[tokens[i]] = 1;
    };

    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      var text = seg.text;

      // 1. ¿Es un marco? Envuelve al conjunto, no es un elemento suelto.
      var maybeFrame = frameFromSegment(text);
      if (maybeFrame || seg.hint === 'around') {
        frame = maybeFrame || { shape: 'circle' };
        remember(text);
        continue;
      }

      // 2. ¿Es un ajuste de estilo (punteado, relleno, rotado)? Se delega al motor
      //    de detalles, para que el usuario pueda quitarlo después desde el panel.
      var groups = Customizer.matchedGroups(text);
      if (groups.indexOf('stroke') !== -1 || groups.indexOf('transform') !== -1 ||
          groups.indexOf('effect') !== -1) {
        // Sólo se reenvían las palabras de estilo, no el segmento completo: así el
        // motor de detalles no vuelve a superponer el elemento que ya compusimos.
        var styleTerms = Customizer.matchedStyleTerms(text);
        for (var st = 0; st < styleTerms.length; st++) styleClauses.push(styleTerms[st]);
        if (!meaningfulQuery(text)) continue;
      }

      // 3. Elemento vectorial.
      var query = meaningfulQuery(text);
      if (!query) continue;

      var position = (DIRECTIONAL.test(text) ? null : Customizer.detectPosition(text)) ||
        (seg.hint && seg.hint !== 'around' ? seg.hint : null);

      if (!base) {
        var hit = Search.best(query, MIN_SCORE_BASE);
        if (hit) { base = hit.icon; remember(text); }
        else unknown.push(text);
        continue;
      }

      var partHit = Search.best(query, MIN_SCORE_PART);
      if (!partHit) { unknown.push(text); continue; }

      var anchor = position || nextAnchor(parts);
      parts.push({
        nodes: partHit.icon.d,
        anchor: anchor,
        scale: anchor === 'center' ? 0.46 : 0.5,
        cutout: true
      });
      partLabels.push(partHit.icon.l);
      remember(text);
    }

    if (!base) return null;

    counter += 1;
    var label = raw.charAt(0).toUpperCase() + raw.slice(1);
    var icon = {
      n: 'custom-' + Date.now().toString(36) + '-' + counter,
      l: label.length > 42 ? label.slice(0, 41) + '…' : label,
      c: 'Mis iconos',
      k: Object.keys(keywords).concat([norm(raw)]),
      d: base.d,
      custom: true,
      desc: raw,
      created: Date.now()
    };
    if (parts.length) icon.parts = parts;
    if (frame) icon.frame = frame;

    return {
      icon: icon,
      base: base,
      partLabels: partLabels,
      frame: frame,
      styleClauses: styleClauses,
      unknown: unknown
    };
  }

  /** Reconstruye un ícono guardado (localStorage) en un objeto utilizable. */
  function revive(stored) {
    if (!stored || !stored.n || !stored.d) return null;
    return {
      n: stored.n, l: stored.l, c: 'Mis iconos', k: stored.k || [], d: stored.d,
      parts: stored.parts, frame: stored.frame, custom: true,
      desc: stored.desc, created: stored.created
    };
  }

  /** Versión serializable (sin campos derivados en tiempo de ejecución). */
  function serialize(icon) {
    return {
      n: icon.n, l: icon.l, k: icon.k, d: icon.d,
      parts: icon.parts, frame: icon.frame, desc: icon.desc, created: icon.created
    };
  }

  window.IconComposer = {
    create: create,
    revive: revive,
    serialize: serialize,
    examples: [
      'un maletín con una flecha hacia arriba',
      'una persona con un engranaje encima',
      'un círculo con un rayo dentro',
      'una nube con un candado y un check',
      'un cerebro rodeado de un marco circular',
      'una lupa con un signo de dólar dentro'
    ]
  };
})(window);
