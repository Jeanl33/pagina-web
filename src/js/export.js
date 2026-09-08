/* global window, document, Image, Blob, ClipboardItem, navigator */
/**
 * Exportación: PNG con fondo transparente al portapapeles (para pegar en
 * PowerPoint con Ctrl+V) y descarga de SVG/PNG.
 *
 * El canvas nunca se pinta de fondo: sólo `clearRect` + `drawImage`, de modo
 * que el alfa del SVG se conserva íntegro en el PNG resultante.
 */
(function (window) {
  'use strict';

  var document = window.document;

  function svgToDataUri(svgString) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
  }

  /** Rasteriza el SVG en un canvas transparente de `px` x `px`. */
  function toPngBlob(svgString, px) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = px;
          canvas.height = px;
          var ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, px, px);
          ctx.drawImage(img, 0, 0, px, px);
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('El navegador no pudo generar el PNG.'));
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = function () { reject(new Error('No se pudo rasterizar el SVG.')); };
      img.src = svgToDataUri(svgString);
    });
  }

  function triggerDownload(blob, filename) {
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
  }

  function downloadSvg(svgString, filename) {
    triggerDownload(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }), filename);
  }

  function downloadPng(svgString, px, filename) {
    return toPngBlob(svgString, px).then(function (blob) {
      triggerDownload(blob, filename);
      return blob;
    });
  }

  function clipboardSupported() {
    return typeof ClipboardItem !== 'undefined' &&
      !!(navigator.clipboard && navigator.clipboard.write) &&
      window.isSecureContext !== false;
  }

  /**
   * Copia el PNG al portapapeles.
   * @returns {Promise<'clipboard'|'download'>} cómo terminó entregándose el archivo.
   */
  function copyPng(svgString, px, fallbackFilename) {
    if (!clipboardSupported()) {
      return downloadPng(svgString, px, fallbackFilename).then(function () { return 'download'; });
    }

    // Safari exige que el ClipboardItem se construya de forma síncrona con una
    // promesa de blob; Chrome y Firefox aceptan ambas formas.
    var viaPromise;
    try {
      viaPromise = navigator.clipboard.write([
        new ClipboardItem({ 'image/png': toPngBlob(svgString, px) })
      ]);
    } catch (err) {
      viaPromise = Promise.reject(err);
    }

    return viaPromise
      .then(function () { return 'clipboard'; })
      .catch(function () {
        return toPngBlob(svgString, px).then(function (blob) {
          return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            .then(function () { return 'clipboard'; });
        });
      })
      .catch(function () {
        return downloadPng(svgString, px, fallbackFilename).then(function () { return 'download'; });
      });
  }

  function safeFilename(parts, extension) {
    var base = parts
      .filter(Boolean)
      .join('-')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return (base || 'icono') + '.' + extension;
  }

  window.Exporter = {
    toPngBlob: toPngBlob,
    copyPng: copyPng,
    downloadPng: downloadPng,
    downloadSvg: downloadSvg,
    clipboardSupported: clipboardSupported,
    safeFilename: safeFilename
  };
})(window);
