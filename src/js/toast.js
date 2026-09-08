/* global window, document */
/**
 * Notificaciones efímeras (toasts) de confirmación y error.
 */
(function (window) {
  'use strict';

  var ROOT_ID = 'toast-root';
  var ICONS = {
    success: '<path d="M20 6 9 17l-5-5"/>',
    error: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
  };
  var TONES = {
    success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100',
    error: 'border-rose-500/40 bg-rose-950/90 text-rose-100',
    info: 'border-sky-500/40 bg-sky-950/90 text-sky-100'
  };

  var MAX_VISIBLE = 3;

  function show(message, type, timeout) {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    var tone = TONES[type] || TONES.info;

    // Evita que una ráfaga de acciones tape la interfaz.
    while (root.children.length >= MAX_VISIBLE) root.removeChild(root.firstChild);

    var el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.className =
      'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ' +
      'translate-y-2 opacity-0 transition duration-200 ease-out ' + tone;
    el.innerHTML =
      '<svg viewBox="0 0 24 24" class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" ' +
      'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[type] || ICONS.info) + '</svg>' +
      '<span class="leading-snug"></span>';
    el.querySelector('span').textContent = message;

    root.appendChild(el);
    // Fuerza reflow para que la transición de entrada se dispare.
    void el.offsetHeight;
    el.classList.remove('translate-y-2', 'opacity-0');

    window.setTimeout(function () {
      el.classList.add('translate-y-2', 'opacity-0');
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }, timeout || 3200);
  }

  window.Toast = {
    success: function (m, t) { show(m, 'success', t); },
    error: function (m, t) { show(m, 'error', t || 4500); },
    info: function (m, t) { show(m, 'info', t); }
  };
})(window);
