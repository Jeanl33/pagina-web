/* global window, document, localStorage */
/**
 * Orquestador de la interfaz: estado, renderizado y eventos.
 */
(function (window) {
  'use strict';

  var document = window.document;
  var Search = window.IconSearch;
  var Builder = window.SvgBuilder;
  var Customizer = window.Customizer;
  var Composer = window.IconComposer;
  var Exporter = window.Exporter;
  var Toast = window.Toast;

  var STORAGE_KEY = 'iconlab:v1';
  var CUSTOM_KEY = 'iconlab:custom:v1';
  var MIN_RESULTS = 6;
  var MAX_RESULTS = 12;

  var PALETTE = [
    { name: 'Azul corporativo', hex: '#1D4ED8' },
    { name: 'Celeste', hex: '#38BDF8' },
    { name: 'Verde', hex: '#10B981' },
    { name: 'Naranja', hex: '#F97316' },
    { name: 'Púrpura', hex: '#8B5CF6' },
    { name: 'Rojo', hex: '#EF4444' },
    { name: 'Ámbar', hex: '#F59E0B' },
    { name: 'Teal', hex: '#14B8A6' },
    { name: 'Rosa', hex: '#EC4899' },
    { name: 'Slate', hex: '#64748B' },
    { name: 'Grafito', hex: '#1E293B' },
    { name: 'Blanco', hex: '#FFFFFF' }
  ];

  var SUGGESTIONS = [
    'persona hablando', 'trabajo en equipo', 'crecimiento financiero', 'transformación digital',
    'ahorro de costos', 'inteligencia artificial', 'sostenibilidad', 'gestión de riesgos',
    'customer experience', 'supply chain'
  ];

  var state = {
    query: '',
    results: [],
    selected: null,
    color: '#38BDF8',
    strokeWidth: 2,
    size: 128,
    clauses: [],
    parsed: null,
    exportPx: 1024,
    custom: []
  };

  var el = {};

  /* ------------------------------------------------------------ persistencia */

  function loadPreferences() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (isHex(saved.color)) state.color = saved.color.toUpperCase();
      if (saved.strokeWidth >= 0.5 && saved.strokeWidth <= 4) state.strokeWidth = saved.strokeWidth;
      if (saved.size >= 32 && saved.size <= 512) state.size = saved.size;
      if (saved.exportPx) state.exportPx = saved.exportPx;
    } catch (err) { /* preferencias no disponibles: se usan los valores por defecto */ }
  }

  function savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        color: state.color, strokeWidth: state.strokeWidth, size: state.size, exportPx: state.exportPx
      }));
    } catch (err) { /* almacenamiento no disponible: se ignora */ }
  }

  function isHex(value) { return /^#[0-9a-fA-F]{6}$/.test(String(value || '')); }

  /** Los íconos creados por el usuario viven en localStorage y se registran en el buscador. */
  function loadCustomIcons() {
    var stored = [];
    try {
      stored = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
    } catch (err) { stored = []; }
    if (!Array.isArray(stored)) stored = [];

    state.custom = [];
    for (var i = 0; i < stored.length; i++) {
      var icon = Composer.revive(stored[i]);
      if (!icon) continue;
      Search.register(icon);
      state.custom.push(icon);
    }
  }

  function saveCustomIcons() {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(state.custom.map(Composer.serialize)));
      return true;
    } catch (err) {
      Toast.error('No se pudieron guardar tus íconos (almacenamiento del navegador lleno o bloqueado).');
      return false;
    }
  }

  /* --------------------------------------------------------------- plantillas */

  function currentPlan() {
    return state.parsed ? state.parsed.plan : Builder.emptyPlan();
  }

  function buildCurrentSvg(size) {
    if (!state.selected) return '';
    return Builder.build({
      icon: state.selected,
      color: state.color,
      strokeWidth: state.strokeWidth,
      size: size || state.size,
      plan: currentPlan()
    });
  }

  /* -------------------------------------------------------------- renderizado */

  function renderSuggestions() {
    el.suggestions.innerHTML = '';
    SUGGESTIONS.forEach(function (term) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = term;
      chip.className =
        'rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 ' +
        'transition hover:border-sky-600 hover:text-sky-300';
      chip.addEventListener('click', function () {
        el.searchInput.value = term;
        runSearch(term);
      });
      el.suggestions.appendChild(chip);
    });
  }

  function renderPalette() {
    el.palette.innerHTML = '';
    PALETTE.forEach(function (swatch) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.title = swatch.name + ' · ' + swatch.hex;
      btn.setAttribute('aria-label', swatch.name);
      btn.dataset.hex = swatch.hex;
      btn.style.backgroundColor = swatch.hex;
      btn.className =
        'aspect-square w-full rounded-lg border-2 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-500/60 ' +
        (state.color.toUpperCase() === swatch.hex ? 'border-white' : 'border-slate-700');
      btn.addEventListener('click', function () { setColor(swatch.hex); });
      el.palette.appendChild(btn);
    });
  }

  function renderResults() {
    el.results.innerHTML = '';
    if (!state.results.length) {
      el.results.classList.add('hidden');
      el.emptyState.classList.remove('hidden');
      el.emptyState.innerHTML = '';
      var message = document.createElement('p');
      message.textContent = state.query
        ? 'Sin resultados para “' + state.query + '”.'
        : 'Escribe un concepto para ver alternativas de íconos.';
      el.emptyState.appendChild(message);

      if (state.query) {
        var cta = document.createElement('button');
        cta.type = 'button';
        cta.textContent = 'Crear un ícono para “' + state.query + '”';
        cta.className =
          'mt-3 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500';
        cta.addEventListener('click', function () {
          el.composeInput.value = state.query;
          el.composeInput.focus();
          composeIcon();
        });
        el.emptyState.appendChild(cta);
      }
      el.resultsMeta.textContent = '';
      return;
    }
    el.results.classList.remove('hidden');
    el.emptyState.classList.add('hidden');
    el.resultsMeta.textContent = state.results.length + ' alternativas';

    // Varios íconos pueden compartir término principal ("Crecimiento" para
    // trending-up y sprout): en ese caso se añade el nombre técnico debajo.
    var labelCount = {};
    state.results.forEach(function (result) {
      labelCount[result.icon.l] = (labelCount[result.icon.l] || 0) + 1;
    });
    state.results.forEach(function (result) {
      el.results.appendChild(iconCard(result.icon, {
        removable: !!result.icon.custom,
        disambiguate: labelCount[result.icon.l] > 1
      }));
    });
  }

  /** Tarjeta de ícono reutilizada por los resultados y por "Mis íconos". */
  function iconCard(icon, options) {
    options = options || {};
    var selected = state.selected && state.selected.n === icon.n;
    var card = document.createElement('div');
    card.className = 'relative';

    var button = document.createElement('button');
    button.type = 'button';
    button.title = (icon.desc || icon.l) + ' · ' + icon.n;
    button.className =
      'group flex w-full flex-col items-center gap-2 rounded-xl border p-3 transition focus:outline-none focus:ring-2 focus:ring-sky-500/50 ' +
      (selected
        ? 'border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-900/30'
        : 'border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-800/60');
    button.innerHTML =
      '<span class="grid h-10 w-10 place-items-center">' +
      Builder.build({ icon: icon, color: state.color, strokeWidth: 1.9, size: 34 }) +
      '</span>' +
      '<span class="w-full truncate text-center text-[11px] leading-tight text-slate-400 group-hover:text-slate-200">' +
      escapeHtml(icon.l) + '</span>' +
      (options.disambiguate
        ? '<span class="w-full truncate text-center text-[10px] leading-none text-slate-600">' +
          escapeHtml(icon.n) + '</span>'
        : '');
    button.addEventListener('click', function () { selectIcon(icon); });
    card.appendChild(button);

    if (options.removable) {
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Eliminar ícono creado');
      remove.title = 'Eliminar';
      remove.className =
        'absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-slate-700 ' +
        'bg-slate-950 text-xs text-slate-400 transition hover:border-rose-500 hover:text-rose-400';
      remove.textContent = '\u00d7';
      remove.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteCustomIcon(icon.n);
      });
      card.appendChild(remove);
    }
    return card;
  }

  function renderMyIcons() {
    var section = document.getElementById('my-icons-section');
    el.myIcons.innerHTML = '';
    if (!state.custom.length) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    for (var i = state.custom.length - 1; i >= 0; i--) {
      el.myIcons.appendChild(iconCard(state.custom[i], { removable: true }));
    }
  }

  function renderComposeExamples() {
    el.composeExamples.innerHTML = '';
    Composer.examples.forEach(function (example) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = example;
      chip.className =
        'rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-400 ' +
        'transition hover:border-sky-600 hover:text-sky-300';
      chip.addEventListener('click', function () {
        el.composeInput.value = example;
        composeIcon();
      });
      el.composeExamples.appendChild(chip);
    });
  }

  function renderPreview() {
    if (!state.selected) {
      el.preview.innerHTML = '<p class="px-4 text-center text-sm text-slate-500">Selecciona un ícono de los resultados.</p>';
      el.previewName.textContent = '';
      setExportEnabled(false);
      return;
    }
    var svg = buildCurrentSvg();
    el.preview.innerHTML = svg;
    var node = el.preview.querySelector('svg');
    if (node) {
      node.style.maxWidth = '100%';
      node.style.maxHeight = '240px';
    }
    el.previewName.textContent = state.selected.l + ' · ' + state.selected.n;
    setExportEnabled(true);
  }

  function renderDetails() {
    el.detailsChips.innerHTML = '';
    el.detailsFeedback.innerHTML = '';
    if (!state.parsed) return;

    state.parsed.applied.forEach(function (entry, index) {
      var chip = document.createElement('span');
      chip.className =
        'inline-flex items-center gap-1.5 rounded-full border border-sky-700/60 bg-sky-950/60 px-2.5 py-1 text-[11px] text-sky-200';
      chip.innerHTML =
        '<span></span>' +
        '<button type="button" class="text-sky-400 transition hover:text-white" aria-label="Quitar detalle">&times;</button>';
      chip.querySelector('span').textContent =
        entry.label + (entry.position ? ' · ' + positionLabel(entry.position) : '');
      chip.querySelector('button').addEventListener('click', function () { removeClause(entry.clause, index); });
      el.detailsChips.appendChild(chip);
    });

    if (state.parsed.unknown.length) {
      var warn = document.createElement('p');
      warn.className = 'rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-amber-200';
      warn.textContent = 'No se pudo interpretar: “' + state.parsed.unknown.join('”, “') +
        '”. Prueba nombrando un elemento concreto (candado, flecha, engranaje, marco circular, punteado…).';
      el.detailsFeedback.appendChild(warn);
    }
    if (!state.parsed.applied.length && !state.parsed.unknown.length) {
      var hint = document.createElement('p');
      hint.className = 'text-slate-500';
      hint.textContent = 'Ejemplos: ' + Customizer.examples.slice(0, 3).join(' · ');
      el.detailsFeedback.appendChild(hint);
    }
  }

  var POSITION_LABELS = {
    center: 'centro', top: 'arriba', bottom: 'abajo', left: 'izquierda', right: 'derecha',
    'top-right': 'sup. derecha', 'top-left': 'sup. izquierda',
    'bottom-right': 'inf. derecha', 'bottom-left': 'inf. izquierda'
  };
  function positionLabel(key) { return POSITION_LABELS[key] || key; }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function setExportEnabled(enabled) {
    [el.btnCopyPng, el.btnDownloadSvg, el.btnDownloadPng].forEach(function (button) {
      button.disabled = !enabled;
    });
  }

  /* ------------------------------------------------------------------ acciones */

  function runSearch(query) {
    state.query = query;
    state.results = query ? Search.search(query, { limit: MAX_RESULTS, min: MIN_RESULTS }) : [];
    renderResults();
  }

  function selectIcon(icon) {
    state.selected = icon;
    renderResults();
    renderMyIcons();
    renderPreview();
  }

  /** Crea un ícono a partir de la descripción escrita y lo abre en el editor. */
  function composeIcon() {
    var description = el.composeInput.value.trim();
    el.composeFeedback.innerHTML = '';
    if (!description) { el.composeInput.focus(); return; }

    var result = Composer.create(description);
    if (!result) {
      feedback(el.composeFeedback, 'amber',
        'No se reconoció ningún elemento en “' + description + '”. ' +
        'Nombra objetos concretos: «un maletín con una flecha hacia arriba».');
      Toast.error('No se pudo componer el ícono.');
      return;
    }

    Search.register(result.icon);
    state.custom.push(result.icon);
    saveCustomIcons();
    renderMyIcons();

    // Los ajustes de estilo mencionados al crear se aplican con el motor de
    // detalles, para que el usuario pueda quitarlos después uno por uno.
    if (result.styleClauses.length) {
      el.detailsInput.value = result.styleClauses.join(', ');
      state.clauses = Customizer.split(el.detailsInput.value);
      state.parsed = Customizer.build(state.clauses);
    } else {
      clearDetails();
    }

    selectIcon(result.icon);
    renderDetails();

    // Se muestra también el nombre técnico: dos íconos distintos pueden compartir
    // el mismo término principal en español (p. ej. "Negocio").
    var summary = 'Base: ' + result.base.l + ' (' + result.base.n + ')';
    if (result.partLabels.length) summary += ' · Añadidos: ' + result.partLabels.join(', ');
    if (result.frame) summary += ' · Marco ' + (result.frame.shape === 'circle' ? 'circular' : result.frame.shape);
    feedback(el.composeFeedback, 'sky', summary);

    if (result.unknown.length) {
      feedback(el.composeFeedback, 'amber',
        'No se interpretó: “' + result.unknown.join('”, “') + '”. Se omitió esa parte.');
    }
    Toast.success('Ícono creado y guardado en “Mis íconos”.');
    el.composeInput.value = '';
  }

  function feedback(container, tone, text) {
    var tones = {
      sky: 'border-sky-800/60 bg-sky-950/40 text-sky-200',
      amber: 'border-amber-700/50 bg-amber-950/40 text-amber-200'
    };
    var node = document.createElement('p');
    node.className = 'rounded-lg border px-3 py-2 ' + (tones[tone] || tones.sky);
    node.textContent = text;
    container.appendChild(node);
  }

  function deleteCustomIcon(name) {
    for (var i = 0; i < state.custom.length; i++) {
      if (state.custom[i].n !== name) continue;
      state.custom.splice(i, 1);
      break;
    }
    Search.unregister(name);
    saveCustomIcons();
    if (state.selected && state.selected.n === name) {
      state.selected = null;
      clearDetails();
    }
    runSearch(state.query);
    renderMyIcons();
    renderPreview();
    Toast.info('Ícono eliminado.');
  }

  function clearCustomIcons() {
    if (!state.custom.length) return;
    if (!window.confirm('¿Eliminar los ' + state.custom.length + ' íconos que creaste? No se puede deshacer.')) return;
    for (var i = 0; i < state.custom.length; i++) Search.unregister(state.custom[i].n);
    var removedSelected = state.selected && state.selected.custom;
    state.custom = [];
    saveCustomIcons();
    if (removedSelected) { state.selected = null; clearDetails(); }
    runSearch(state.query);
    renderMyIcons();
    renderPreview();
    Toast.info('Se eliminaron tus íconos creados.');
  }

  function setColor(hex) {
    if (!isHex(hex)) return;
    state.color = hex.toUpperCase();
    el.colorPicker.value = state.color;
    el.colorHex.value = state.color;
    savePreferences();
    renderPalette();
    renderResults();
    renderPreview();
  }

  function applyDetails() {
    state.clauses = Customizer.split(el.detailsInput.value);
    state.parsed = Customizer.build(state.clauses);
    renderDetails();
    renderPreview();
    if (state.parsed.applied.length) {
      Toast.success(state.parsed.applied.length + ' detalle(s) aplicado(s) al ícono.');
    } else if (state.parsed.unknown.length) {
      Toast.error('No se reconoció ninguna instrucción.');
    }
  }

  function removeClause(clause, index) {
    var target = state.clauses.indexOf(clause);
    if (target === -1) target = Math.min(index, state.clauses.length - 1);
    if (target < 0) return;
    state.clauses.splice(target, 1);
    el.detailsInput.value = state.clauses.join(', ');
    state.parsed = Customizer.build(state.clauses);
    renderDetails();
    renderPreview();
  }

  function clearDetails() {
    state.clauses = [];
    state.parsed = null;
    el.detailsInput.value = '';
    renderDetails();
    renderPreview();
  }

  function exportFilename(extension) {
    return Exporter.safeFilename(
      ['iconlab', state.selected ? state.selected.n : 'icono', state.color.replace('#', '')],
      extension
    );
  }

  function copyPng() {
    if (!state.selected) return;
    var svg = buildCurrentSvg(state.exportPx);
    Exporter.copyPng(svg, state.exportPx, exportFilename('png'))
      .then(function (mode) {
        if (mode === 'clipboard') {
          Toast.success('Copiado. Pega en PowerPoint con Ctrl+V (fondo transparente).');
        } else {
          Toast.info('Tu navegador no permite copiar imágenes: se descargó el PNG transparente.');
        }
      })
      .catch(function (err) {
        Toast.error('No se pudo copiar el ícono: ' + err.message);
      });
  }

  function downloadSvg() {
    if (!state.selected) return;
    Exporter.downloadSvg(buildCurrentSvg(), exportFilename('svg'));
    Toast.success('SVG descargado.');
  }

  function downloadPng() {
    if (!state.selected) return;
    Exporter.downloadPng(buildCurrentSvg(state.exportPx), state.exportPx, exportFilename('png'))
      .then(function () { Toast.success('PNG transparente descargado (' + state.exportPx + ' px).'); })
      .catch(function (err) { Toast.error('No se pudo generar el PNG: ' + err.message); });
  }

  /* -------------------------------------------------------------------- eventos */

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function bindEvents() {
    var debounced = debounce(function (value) { runSearch(value); }, 120);
    el.searchInput.addEventListener('input', function (e) { debounced(e.target.value); });
    el.searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && state.results.length) selectIcon(state.results[0].icon);
    });

    el.colorPicker.addEventListener('input', function (e) { setColor(e.target.value); });
    el.colorHex.addEventListener('change', function (e) {
      var value = e.target.value.trim();
      if (value && value[0] !== '#') value = '#' + value;
      if (isHex(value)) setColor(value);
      else { el.colorHex.value = state.color; Toast.error('Formato hexadecimal inválido (usa #RRGGBB).'); }
    });

    el.strokeRange.addEventListener('input', function (e) {
      state.strokeWidth = parseFloat(e.target.value);
      el.strokeValue.textContent = state.strokeWidth.toFixed(2);
      savePreferences();
      renderPreview();
    });

    el.sizeRange.addEventListener('input', function (e) {
      state.size = parseInt(e.target.value, 10);
      el.sizeValue.textContent = state.size + ' px';
      savePreferences();
      renderPreview();
    });

    el.exportScale.addEventListener('change', function (e) {
      state.exportPx = parseInt(e.target.value, 10);
      savePreferences();
    });

    el.composeBtn.addEventListener('click', composeIcon);
    el.composeInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); composeIcon(); }
    });
    el.myIconsClear.addEventListener('click', clearCustomIcons);

    el.detailsApply.addEventListener('click', applyDetails);
    el.detailsClear.addEventListener('click', clearDetails);
    el.detailsInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); applyDetails(); }
    });

    el.btnCopyPng.addEventListener('click', copyPng);
    el.btnDownloadSvg.addEventListener('click', downloadSvg);
    el.btnDownloadPng.addEventListener('click', downloadPng);
  }

  /* ----------------------------------------------------------------------- init */

  function cacheElements() {
    var ids = {
      searchInput: 'search-input', suggestions: 'suggestions', results: 'results',
      resultsMeta: 'results-meta', emptyState: 'empty-state', preview: 'preview',
      previewName: 'preview-name', palette: 'palette', colorPicker: 'color-picker',
      colorHex: 'color-hex', strokeRange: 'stroke-range', strokeValue: 'stroke-value',
      sizeRange: 'size-range', sizeValue: 'size-value', detailsInput: 'details-input',
      detailsApply: 'details-apply', detailsClear: 'details-clear', detailsChips: 'details-chips',
      detailsFeedback: 'details-feedback', btnCopyPng: 'btn-copy-png',
      btnDownloadSvg: 'btn-download-svg', btnDownloadPng: 'btn-download-png',
      exportScale: 'export-scale', statIcons: 'stat-icons', statCurated: 'stat-curated',
      composeInput: 'compose-input', composeBtn: 'compose-btn',
      composeExamples: 'compose-examples', composeFeedback: 'compose-feedback',
      myIcons: 'my-icons', myIconsClear: 'my-icons-clear'
    };
    for (var key in ids) {
      if (Object.prototype.hasOwnProperty.call(ids, key)) el[key] = document.getElementById(ids[key]);
    }
  }

  function init() {
    if (!window.ICONLAB_DATA) {
      window.alert('No se pudo cargar el catálogo de íconos (src/data/icons.js).');
      return;
    }
    cacheElements();
    loadPreferences();
    Search.init(window.ICONLAB_DATA);

    loadCustomIcons();
    el.statIcons.textContent = Search.all().length;
    el.statCurated.textContent = Search.curatedCount();
    el.colorPicker.value = state.color;
    el.colorHex.value = state.color;
    el.strokeRange.value = state.strokeWidth;
    el.strokeValue.textContent = state.strokeWidth.toFixed(2);
    el.sizeRange.value = state.size;
    el.sizeValue.textContent = state.size + ' px';
    el.exportScale.value = String(state.exportPx);
    el.detailsInput.placeholder = 'Ej.: ' + Customizer.examples[0].toLowerCase() + ', ' +
      Customizer.examples[3].toLowerCase();

    renderSuggestions();
    renderComposeExamples();
    renderPalette();
    renderMyIcons();
    bindEvents();

    // Estado inicial útil en lugar de una pantalla vacía.
    var seed = SUGGESTIONS[1];
    el.searchInput.value = seed;
    runSearch(seed);
    if (state.results.length) selectIcon(state.results[0].icon);
    renderDetails();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
