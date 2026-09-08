/* global window */
/**
 * Motor de personalización: interpreta instrucciones en lenguaje natural
 * (español o inglés) y las traduce a operaciones vectoriales concretas sobre
 * el ícono seleccionado.
 *
 * Estrategia en tres niveles:
 *   1. Reglas explícitas por grupo (marco, trazo, transformación, efecto, superposición).
 *   2. Extracción de texto literal ("ponle la letra A", 'texto "S/"').
 *   3. Respaldo semántico: si la frase nombra cualquier concepto del catálogo,
 *      ese ícono se superpone (p. ej. "agrégale un candado" -> lock).
 */
(function (window) {
  'use strict';

  var norm = function (s) { return window.IconSearch.normalize(s); };

  /* ---------------------------------------------------------------- posición */

  var POSITIONS = [
    ['esquina superior derecha', 'top-right'], ['parte superior derecha', 'top-right'],
    ['arriba a la derecha', 'top-right'], ['upper right', 'top-right'], ['top right', 'top-right'],
    ['esquina superior izquierda', 'top-left'], ['arriba a la izquierda', 'top-left'],
    ['upper left', 'top-left'], ['top left', 'top-left'],
    ['esquina inferior derecha', 'bottom-right'], ['abajo a la derecha', 'bottom-right'],
    ['lower right', 'bottom-right'], ['bottom right', 'bottom-right'],
    ['esquina inferior izquierda', 'bottom-left'], ['abajo a la izquierda', 'bottom-left'],
    ['lower left', 'bottom-left'], ['bottom left', 'bottom-left'],
    ['sobre la cabeza', 'top'], ['encima de la cabeza', 'top'], ['en la parte superior', 'top'],
    ['por encima', 'top'], ['encima', 'top'], ['arriba', 'top'], ['above', 'top'], ['on top', 'top'],
    ['en la parte inferior', 'bottom'], ['por debajo', 'bottom'], ['debajo', 'bottom'],
    ['abajo', 'bottom'], ['below', 'bottom'], ['underneath', 'bottom'],
    ['a la izquierda', 'left'], ['al lado izquierdo', 'left'], ['izquierda', 'left'], ['left side', 'left'],
    ['a la derecha', 'right'], ['al lado derecho', 'right'], ['derecha', 'right'], ['right side', 'right'],
    ['en el centro', 'center'], ['al centro', 'center'], ['en medio', 'center'], ['al medio', 'center'],
    ['dentro', 'center'], ['adentro', 'center'], ['inside', 'center'], ['centro', 'center'], ['center', 'center']
  ];

  function detectPosition(clause) {
    for (var i = 0; i < POSITIONS.length; i++) {
      if (clause.indexOf(POSITIONS[i][0]) !== -1) return POSITIONS[i][1];
    }
    return null;
  }

  /* -------------------------------------------------------------- coincidencia */

  /** ¿Aparece `phrase` en `clause` respetando límites de palabra? */
  function phraseIn(clause, phrase) {
    var idx = clause.indexOf(phrase);
    while (idx !== -1) {
      var okBefore = idx === 0 || clause[idx - 1] === ' ';
      var end = idx + phrase.length;
      var okAfter = end === clause.length || clause[end] === ' ';
      if (okBefore && okAfter) return true;
      idx = clause.indexOf(phrase, idx + 1);
    }
    return false;
  }

  function triggerScore(clause, triggers) {
    var best = 0;
    for (var i = 0; i < triggers.length; i++) {
      var t = triggers[i];
      if (!phraseIn(clause, t)) continue;
      var score = t.split(' ').length * 10 + t.length;
      if (score > best) best = score;
    }
    return best;
  }

  function degreesIn(clause, fallback) {
    var m = clause.match(/(-?\d{1,3})\s*(?:grados|degrees|deg)?/);
    if (m && m[1] !== undefined && m[0].trim() !== '') {
      var v = parseInt(m[1], 10);
      if (!isNaN(v) && Math.abs(v) <= 360) return v;
    }
    return fallback;
  }

  /* -------------------------------------------------------------------- reglas */

  var RULES = [
    /* --- Marcos --- */
    {
      id: 'frame-circle', group: 'frame', label: 'Marco circular',
      triggers: ['marco circular', 'marco redondo', 'circulo alrededor', 'circulo al rededor',
        'rodealo con un circulo', 'rodear con un circulo', 'encierralo en un circulo', 'encerrar en un circulo',
        'anillo alrededor', 'borde circular', 'circle frame', 'circular frame', 'circle around', 'ring around',
        'round frame', 'enclose in a circle'],
      apply: function (plan, ctx) { plan.frame = { shape: 'circle', dash: ctx.dashed }; }
    },
    {
      id: 'frame-square', group: 'frame', label: 'Marco cuadrado',
      triggers: ['marco cuadrado', 'cuadrado alrededor', 'recuadro', 'borde cuadrado', 'caja alrededor',
        'square frame', 'square around', 'box around', 'square border'],
      apply: function (plan, ctx) { plan.frame = { shape: 'square', dash: ctx.dashed }; }
    },
    {
      id: 'frame-rounded', group: 'frame', label: 'Marco redondeado',
      triggers: ['marco redondeado', 'esquinas redondeadas', 'borde redondeado', 'rounded frame',
        'rounded box', 'rounded border'],
      apply: function (plan, ctx) { plan.frame = { shape: 'rounded', dash: ctx.dashed }; }
    },

    /* --- Estilo de trazo --- */
    {
      id: 'dashed', group: 'stroke', label: 'Líneas punteadas',
      triggers: ['punteada', 'punteadas', 'punteado', 'punteados', 'discontinua', 'discontinuas',
        'entrecortada', 'entrecortadas', 'rayada', 'rayadas', 'con guiones', 'dashed', 'dotted', 'dashes'],
      apply: function (plan) { plan.base.dash = true; if (plan.frame) plan.frame.dash = true; }
    },
    {
      id: 'filled', group: 'stroke', label: 'Relleno sólido',
      triggers: ['relleno', 'rellena', 'rellenalo', 'rellenar', 'solido', 'solida', 'macizo',
        'filled', 'fill it', 'solid'],
      apply: function (plan) { plan.base.fill = true; }
    },
    {
      id: 'bolder', group: 'stroke', label: 'Trazo más grueso',
      triggers: ['mas grueso', 'mas gruesa', 'mas gruesas', 'engrosar', 'engruesa', 'trazo grueso',
        'linea gruesa', 'lineas gruesas', 'thicker', 'bolder', 'heavier stroke'],
      apply: function (plan) { plan.base.strokeScale = 1.45; }
    },
    {
      id: 'thinner', group: 'stroke', label: 'Trazo más delgado',
      triggers: ['mas delgado', 'mas delgada', 'mas fino', 'mas fina', 'trazo fino', 'linea fina',
        'lineas finas', 'thinner', 'lighter stroke', 'hairline'],
      apply: function (plan) { plan.base.strokeScale = 0.65; }
    },
    {
      id: 'faded', group: 'stroke', label: 'Trazo atenuado',
      triggers: ['atenuado', 'atenuada', 'tenue', 'translucido', 'semitransparente', 'opacidad',
        'faded', 'translucent', 'dimmed'],
      apply: function (plan) { plan.base.opacity = 0.55; }
    },

    /* --- Transformaciones --- */
    {
      id: 'rotate', group: 'transform', label: 'Rotación',
      triggers: ['rotalo', 'rotala', 'rotar', 'rota', 'girar', 'giralo', 'gira', 'inclinar', 'inclinalo',
        'inclina', 'rotate', 'tilt', 'turn it'],
      apply: function (plan, ctx) {
        var deg = degreesIn(ctx.clause, 45);
        plan.base.rotate = deg;
        ctx.label = 'Rotar ' + deg + '°';
      }
    },
    {
      id: 'flip-x', group: 'transform', label: 'Espejo horizontal',
      triggers: ['espejo', 'invertir horizontal', 'voltear horizontal', 'voltealo', 'voltear',
        'al reves', 'mirror', 'flip horizontal', 'flip it'],
      apply: function (plan) { plan.base.flipX = true; }
    },
    {
      id: 'flip-y', group: 'transform', label: 'Espejo vertical',
      triggers: ['de cabeza', 'invertir vertical', 'voltear vertical', 'upside down', 'flip vertical'],
      apply: function (plan) { plan.base.flipY = true; }
    },

    /* --- Efectos --- */
    {
      id: 'glow', group: 'effect', label: 'Resplandor',
      triggers: ['brillo', 'resplandor', 'halo', 'glow', 'shine'],
      apply: function (plan) { plan.effects.glow = true; }
    },
    {
      id: 'shadow', group: 'effect', label: 'Sombra',
      triggers: ['sombra', 'sombreado', 'shadow', 'drop shadow'],
      apply: function (plan) { plan.effects.shadow = true; }
    },

    /* --- Superposiciones con anclaje y escala propios --- */
    {
      id: 'speech-bubble', group: 'overlay', label: 'Bocadillo de diálogo',
      triggers: ['bocadillo', 'bocadillo de dialogo', 'globo de dialogo', 'globo de texto',
        'burbuja de dialogo', 'nube de dialogo', 'callout', 'speech bubble', 'chat bubble', 'thought bubble'],
      apply: function (plan, ctx) { addOverlay(plan, 'message-circle', resolveAnchor(plan, ctx, 'top-right'), 0.52); }
    },
    {
      id: 'dollar', group: 'overlay', label: 'Signo de dólar',
      triggers: ['signo de dolar', 'simbolo de dolar', 'signo dolar', 'dolar', 'dollar sign', 'dollar', 'money sign'],
      apply: function (plan, ctx) { addOverlay(plan, 'dollar-sign', resolveAnchor(plan, ctx, 'center'), 0.4); }
    },
    {
      id: 'euro', group: 'overlay', label: 'Signo de euro',
      triggers: ['signo de euro', 'simbolo de euro', 'euro sign', 'euro'],
      apply: function (plan, ctx) { addOverlay(plan, 'euro', resolveAnchor(plan, ctx, 'center'), 0.4); }
    },
    {
      id: 'percent', group: 'overlay', label: 'Signo de porcentaje',
      triggers: ['signo de porcentaje', 'simbolo de porcentaje', 'porcentaje', 'percent sign', 'percentage'],
      apply: function (plan, ctx) { addOverlay(plan, 'percent', resolveAnchor(plan, ctx, 'center'), 0.4); }
    },
    {
      id: 'check', group: 'overlay', label: 'Marca de verificación',
      triggers: ['check', 'palomita', 'visto bueno', 'chulo', 'marca de verificacion', 'tick',
        'checkmark', 'check mark', 'aprobado'],
      apply: function (plan, ctx) { addOverlay(plan, 'check', resolveAnchor(plan, ctx, 'bottom-right'), 0.48); }
    },
    {
      id: 'cross', group: 'overlay', label: 'Aspa de rechazo',
      triggers: ['equis', 'tache', 'aspa', 'cruz de rechazo', 'x mark', 'cross mark', 'rechazado'],
      apply: function (plan, ctx) { addOverlay(plan, 'x', resolveAnchor(plan, ctx, 'bottom-right'), 0.44); }
    },
    {
      id: 'plus', group: 'overlay', label: 'Signo más',
      triggers: ['signo mas', 'simbolo mas', 'signo de suma', 'plus sign', 'plus icon'],
      apply: function (plan, ctx) { addOverlay(plan, 'plus', resolveAnchor(plan, ctx, 'top-right'), 0.44); }
    },
    {
      id: 'warning', group: 'overlay', label: 'Alerta',
      triggers: ['signo de admiracion', 'exclamacion', 'advertencia', 'alerta', 'warning', 'exclamation'],
      apply: function (plan, ctx) { addOverlay(plan, 'triangle-alert', resolveAnchor(plan, ctx, 'top-right'), 0.48); }
    },
    {
      id: 'question', group: 'overlay', label: 'Signo de interrogación',
      triggers: ['signo de interrogacion', 'signo de pregunta', 'interrogacion', 'question mark'],
      apply: function (plan, ctx) { addOverlay(plan, 'circle-question-mark', resolveAnchor(plan, ctx, 'top-right'), 0.48); }
    },
    {
      id: 'dot', group: 'overlay', label: 'Punto de notificación',
      triggers: ['punto de notificacion', 'punto rojo', 'bolita', 'notification dot', 'badge dot'],
      apply: function (plan, ctx) {
        plan.overlays.push({
          nodes: [['circle', { cx: 12, cy: 12, r: 6 }]],
          anchor: resolveAnchor(plan, ctx, 'top-right'), scale: 0.34, cutout: true, fill: true
        });
      }
    }
  ];

  var RULES_BY_GROUP = {};
  for (var r = 0; r < RULES.length; r++) {
    (RULES_BY_GROUP[RULES[r].group] = RULES_BY_GROUP[RULES[r].group] || []).push(RULES[r]);
  }

  /** Posición explícita del usuario > posición sugerida por la regla > hueco libre. */
  function resolveAnchor(plan, ctx, preferred) {
    if (ctx.position) return ctx.position;
    var used = {};
    for (var i = 0; i < plan.overlays.length; i++) used[plan.overlays[i].anchor] = 1;
    for (var t = 0; t < plan.texts.length; t++) used[plan.texts[t].anchor] = 1;
    // Se registra en el contexto para que la etiqueta mostrada refleje la posición real.
    ctx.position = used[preferred] ? nextFreeAnchor(plan) : preferred;
    return ctx.position;
  }

  var AUTO_ANCHORS = ['top-right', 'bottom-right', 'top-left', 'bottom-left', 'top', 'bottom'];

  /** Reparte las superposiciones sin posición explícita para que no se encimen. */
  function nextFreeAnchor(plan) {
    var used = {};
    for (var i = 0; i < plan.overlays.length; i++) used[plan.overlays[i].anchor] = 1;
    for (var t = 0; t < plan.texts.length; t++) used[plan.texts[t].anchor] = 1;
    for (var a = 0; a < AUTO_ANCHORS.length; a++) if (!used[AUTO_ANCHORS[a]]) return AUTO_ANCHORS[a];
    return 'top-right';
  }

  function ruleById(id) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i].id === id) return RULES[i];
    return null;
  }

  function addOverlay(plan, iconName, anchor, scale) {
    var icon = window.IconSearch.byName(iconName);
    if (!icon) return false;
    plan.overlays.push({ nodes: icon.d, anchor: anchor, scale: scale, cutout: true });
    return true;
  }

  /* ---------------------------------------------------------- texto literal */

  var TEXT_KEYWORDS = /\b(?:texto|palabra|letra|letras|numero|número|cifra|escribe|escribir|escribele|pon el texto|label|text|word|letter|number)\s*(?:que\s+diga\s+)?[:=]?\s*["'“”]?([A-Za-z0-9$%€£¥&#@+\-/.]{1,8})["'“”]?/i;
  var QUOTED = /["'“”«]([^"'“”»]{1,10})["'“”»]/;

  function extractText(rawClause) {
    var q = rawClause.match(QUOTED);
    if (q && q[1].trim()) return q[1].trim();
    var m = rawClause.match(TEXT_KEYWORDS);
    if (m && m[1]) return m[1].trim();
    return null;
  }

  /* --------------------------------------------------- respaldo semántico */

  var FILLER = {
    agregale: 1, agrega: 1, agregar: 1, agregame: 1, anade: 1, anadele: 1, anadir: 1, anadele: 1,
    pon: 1, ponle: 1, poner: 1, coloca: 1, colocale: 1, colocar: 1, incluye: 1, incluir: 1,
    superpone: 1, superponer: 1, dibuja: 1, dibujar: 1, mete: 1, meter: 1, suma: 1, sumale: 1,
    quiero: 1, necesito: 1, hazle: 1, haz: 1, hacer: 1, tenga: 1, muestra: 1, mostrar: 1, sean: 1, sea: 1,
    add: 1, put: 1, place: 1, include: 1, draw: 1, make: 1, set: 1, overlay: 1, show: 1,
    icono: 1, iconito: 1, simbolo: 1, signo: 1, symbol: 1, icon: 1, sign: 1, pequeno: 1, pequena: 1,
    grande: 1, mini: 1, small: 1, big: 1, este: 1, esta: 1, ese: 1, esa: 1, mismo: 1
  };

  function stripForSearch(clause) {
    var tokens = clause.split(' ');
    var kept = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!t || FILLER[t]) continue;
      var isPosition = false;
      for (var p = 0; p < POSITIONS.length; p++) {
        if (POSITIONS[p][0].indexOf(' ') === -1 && POSITIONS[p][0] === t) { isPosition = true; break; }
      }
      if (isPosition) continue;
      kept.push(t);
    }
    return kept.join(' ');
  }

  /* --------------------------------------------------------------- parseo */

  function split(text) {
    return String(text || '')
      .split(/[,;\n]+|\s+y\s+|\s+and\s+|\s+\+\s+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  function build(clauses) {
    var plan = window.SvgBuilder.emptyPlan();
    var applied = [];
    var unknown = [];
    var normalized = clauses.map(norm);
    var dashRule = ruleById('dashed');
    var globalDash = normalized.some(function (c) { return triggerScore(c, dashRule.triggers) > 0; });

    for (var i = 0; i < clauses.length; i++) {
      var raw = clauses[i];
      var clause = normalized[i];
      var position = detectPosition(clause);
      var matchedHere = false;

      // Una regla como máximo por grupo, para que las instrucciones no se contradigan.
      for (var group in RULES_BY_GROUP) {
        if (!Object.prototype.hasOwnProperty.call(RULES_BY_GROUP, group)) continue;
        var candidates = RULES_BY_GROUP[group];
        var bestRule = null, bestScore = 0;
        for (var c = 0; c < candidates.length; c++) {
          var score = triggerScore(clause, candidates[c].triggers);
          if (score > bestScore) { bestScore = score; bestRule = candidates[c]; }
        }
        if (!bestRule) continue;
        var ctx = { clause: clause, raw: raw, position: position, dashed: globalDash, label: bestRule.label };
        bestRule.apply(plan, ctx);
        applied.push({ clause: raw, label: ctx.label, group: group, position: ctx.position });
        matchedHere = true;
      }

      // Texto literal ("la letra A", 'texto "S/"').
      var literal = extractText(raw);
      if (literal && !isJustPosition(literal)) {
        var textAnchor = position || (plan.overlays.length || plan.texts.length ? nextFreeAnchor(plan) : 'center');
        plan.texts.push({ value: literal, anchor: textAnchor, size: literal.length > 2 ? 6 : 9 });
        applied.push({ clause: raw, label: 'Texto “' + literal + '”', group: 'text', position: textAnchor });
        matchedHere = true;
      }

      // Respaldo semántico: cualquier concepto del catálogo puede superponerse.
      if (!matchedHere) {
        var query = stripForSearch(clause);
        var hit = query ? window.IconSearch.best(query, 45) : null;
        if (hit) {
          var fallbackAnchor = position || nextFreeAnchor(plan);
          addOverlay(plan, hit.icon.n, fallbackAnchor, fallbackAnchor === 'center' ? 0.42 : 0.5);
          applied.push({ clause: raw, label: hit.icon.l, group: 'overlay', position: fallbackAnchor });
        } else {
          unknown.push(raw);
        }
      }
    }

    return { plan: plan, applied: applied, unknown: unknown };
  }

  function isJustPosition(value) {
    var n = norm(value);
    for (var i = 0; i < POSITIONS.length; i++) if (POSITIONS[i][0] === n) return true;
    return false;
  }

  window.Customizer = {
    split: split,
    build: build,
    examples: [
      'Agrégale un bocadillo de diálogo sobre la cabeza',
      'Ponle un signo de dólar dentro del círculo',
      'Haz que las líneas del fondo sean punteadas',
      'Añádele un marco circular alrededor',
      'Agrégale un candado en la esquina superior derecha',
      'Ponle un check abajo a la derecha',
      'Rótalo 45 grados',
      'Agrégale una alerta arriba y un engranaje abajo'
    ]
  };
})(window);
