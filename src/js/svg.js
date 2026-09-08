/* global window */
/**
 * Construcción del SVG final a partir del ícono base y del plan de personalización.
 *
 * Todo se compone dentro del lienzo nativo de Lucide (24 x 24) para que los
 * trazos, los marcos y las superposiciones mantengan proporciones coherentes.
 */
(function (window) {
  'use strict';

  var VIEW = 24;
  var CENTER = VIEW / 2;

  /** Puntos de anclaje para las superposiciones, en coordenadas del lienzo 24x24. */
  var ANCHORS = {
    center: { x: 12, y: 12, scale: 0.42 },
    top: { x: 12, y: 3.4, scale: 0.44 },
    bottom: { x: 12, y: 20.6, scale: 0.44 },
    left: { x: 3.4, y: 12, scale: 0.44 },
    right: { x: 20.6, y: 12, scale: 0.44 },
    'top-right': { x: 18.4, y: 5.6, scale: 0.5 },
    'top-left': { x: 5.6, y: 5.6, scale: 0.5 },
    'bottom-right': { x: 18.4, y: 18.4, scale: 0.5 },
    'bottom-left': { x: 5.6, y: 18.4, scale: 0.5 }
  };

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function attrs(map) {
    var out = '';
    for (var key in map) {
      if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
      var v = map[key];
      if (v === null || v === undefined || v === '') continue;
      out += ' ' + key + '="' + escapeXml(v) + '"';
    }
    return out;
  }

  /** Serializa los nodos de Lucide (`[tag, attrs][]`) a marcado SVG. */
  function nodesToMarkup(nodes) {
    var out = '';
    for (var i = 0; i < nodes.length; i++) {
      out += '<' + nodes[i][0] + attrs(nodes[i][1]) + '/>';
    }
    return out;
  }

  function round(n) { return Math.round(n * 1000) / 1000; }

  function anchorOf(name) { return ANCHORS[name] || ANCHORS['top-right']; }

  function emptyPlan() {
    return {
      base: { dash: false, fill: false, rotate: 0, flipX: false, flipY: false, strokeScale: 1, opacity: 1 },
      frame: null,
      overlays: [],
      texts: [],
      effects: { glow: false, shadow: false }
    };
  }

  /**
   * @param {Object} options
   * @param {Object} options.icon  Ícono del catálogo ({ n, d, ... }).
   * @param {string} options.color Color hexadecimal.
   * @param {number} options.strokeWidth
   * @param {number} options.size  Lado en píxeles del SVG resultante.
   * @param {Object} [options.plan] Plan de personalización.
   * @returns {string} SVG serializado.
   */
  function build(options) {
    var icon = options.icon;
    if (!icon) return '';
    var plan = options.plan || emptyPlan();
    var color = options.color || '#38BDF8';
    var sw = Number(options.strokeWidth) || 2;
    var size = Number(options.size) || 128;

    sw = sw * (plan.base.strokeScale || 1);

    var hasEffects = plan.effects.glow || plan.effects.shadow;
    var pad = hasEffects ? 3.5 : 1.5;
    var viewBox = round(-pad) + ' ' + round(-pad) + ' ' + round(VIEW + pad * 2) + ' ' + round(VIEW + pad * 2);

    // El marco obliga a encoger el ícono base para que quepa dentro.
    var shrink = plan.frame ? 0.64 : 1;
    var baseSw = sw / shrink;

    var transforms = [];
    if (plan.base.rotate || plan.base.flipX || plan.base.flipY || shrink !== 1) {
      transforms.push('translate(' + CENTER + ' ' + CENTER + ')');
      if (plan.base.rotate) transforms.push('rotate(' + round(plan.base.rotate) + ')');
      var sx = (plan.base.flipX ? -1 : 1) * shrink;
      var sy = (plan.base.flipY ? -1 : 1) * shrink;
      transforms.push('scale(' + round(sx) + ' ' + round(sy) + ')');
      transforms.push('translate(' + -CENTER + ' ' + -CENTER + ')');
    }

    var defs = '';
    var maskShapes = '';
    for (var m = 0; m < plan.overlays.length; m++) {
      var ov = plan.overlays[m];
      if (!ov.cutout) continue;
      var a = anchorOf(ov.anchor);
      var scale = ov.scale || a.scale;
      maskShapes += '<circle cx="' + round(a.x) + '" cy="' + round(a.y) + '" r="' +
        round(CENTER * scale * 0.92 + sw * 0.42) + '" fill="black"/>';
    }
    for (var tt = 0; tt < plan.texts.length; tt++) {
      var ta = anchorOf(plan.texts[tt].anchor);
      maskShapes += '<circle cx="' + round(ta.x) + '" cy="' + round(ta.y) + '" r="' +
        round(plan.texts[tt].size * 0.75) + '" fill="black"/>';
    }

    var maskId = 'iconlab-cut';
    if (maskShapes) {
      defs += '<mask id="' + maskId + '" maskUnits="userSpaceOnUse" x="' + round(-pad) + '" y="' + round(-pad) +
        '" width="' + round(VIEW + pad * 2) + '" height="' + round(VIEW + pad * 2) + '">' +
        '<rect x="' + round(-pad) + '" y="' + round(-pad) + '" width="' + round(VIEW + pad * 2) +
        '" height="' + round(VIEW + pad * 2) + '" fill="white"/>' + maskShapes + '</mask>';
    }

    var filterId = 'iconlab-fx';
    if (hasEffects) {
      var fx = '';
      if (plan.effects.glow) {
        fx += '<feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="blur"/>' +
          '<feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>';
      }
      if (plan.effects.shadow) {
        fx += '<feDropShadow dx="0.55" dy="0.75" stdDeviation="0.5" flood-color="#000000" flood-opacity="0.35"/>';
      }
      defs += '<filter id="' + filterId + '" x="-25%" y="-25%" width="150%" height="150%">' + fx + '</filter>';
    }

    var baseDash = plan.base.dash ? round(baseSw * 1.9) + ' ' + round(baseSw * 1.35) : null;
    var baseGroup =
      '<g' + attrs({
        'stroke-width': round(baseSw),
        'stroke-dasharray': baseDash,
        fill: plan.base.fill ? color : 'none',
        'fill-opacity': plan.base.fill ? 0.18 : null,
        opacity: plan.base.opacity !== 1 ? plan.base.opacity : null,
        transform: transforms.length ? transforms.join(' ') : null
      }) + '>' + nodesToMarkup(icon.d) + '</g>';

    if (maskShapes) baseGroup = '<g mask="url(#' + maskId + ')">' + baseGroup + '</g>';

    var frameMarkup = '';
    if (plan.frame) {
      var fDash = plan.frame.dash ? round(sw * 1.9) + ' ' + round(sw * 1.35) : null;
      var common = { 'stroke-width': round(sw), 'stroke-dasharray': fDash, fill: 'none' };
      if (plan.frame.shape === 'circle') {
        frameMarkup = '<circle' + attrs(Object.assign({ cx: CENTER, cy: CENTER, r: round(CENTER - sw * 0.55) }, common)) + '/>';
      } else {
        var inset = round(sw * 0.55);
        var side = round(VIEW - sw * 1.1);
        frameMarkup = '<rect' + attrs(Object.assign({
          x: inset, y: inset, width: side, height: side,
          rx: plan.frame.shape === 'rounded' ? 5 : 0
        }, common)) + '/>';
      }
    }

    var overlayMarkup = '';
    for (var o = 0; o < plan.overlays.length; o++) {
      var overlay = plan.overlays[o];
      var anc = anchorOf(overlay.anchor);
      var s = overlay.scale || anc.scale;
      var tx = round(anc.x - CENTER * s);
      var ty = round(anc.y - CENTER * s);
      overlayMarkup += '<g' + attrs({
        transform: 'translate(' + tx + ' ' + ty + ') scale(' + round(s) + ')',
        'stroke-width': round(sw / s),
        'stroke-dasharray': overlay.dash ? round((sw / s) * 1.9) + ' ' + round((sw / s) * 1.35) : null,
        fill: overlay.fill ? color : 'none',
        opacity: overlay.opacity || null
      }) + '>' + nodesToMarkup(overlay.nodes) + '</g>';
    }

    var textMarkup = '';
    for (var x = 0; x < plan.texts.length; x++) {
      var txt = plan.texts[x];
      var tAnchor = anchorOf(txt.anchor);
      textMarkup += '<text' + attrs({
        x: round(tAnchor.x), y: round(tAnchor.y),
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-size': round(txt.size),
        'font-weight': 700,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: color, stroke: 'none'
      }) + '>' + escapeXml(txt.value) + '</text>';
    }

    var content = baseGroup + frameMarkup + overlayMarkup + textMarkup;
    if (hasEffects) content = '<g filter="url(#' + filterId + ')">' + content + '</g>';

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="' + viewBox + '" fill="none" stroke="' + escapeXml(color) +
      '" stroke-width="' + round(sw) + '" stroke-linecap="round" stroke-linejoin="round">' +
      (defs ? '<defs>' + defs + '</defs>' : '') + content + '</svg>';
  }

  window.SvgBuilder = {
    build: build,
    emptyPlan: emptyPlan,
    anchors: ANCHORS,
    escapeXml: escapeXml
  };
})(window);
