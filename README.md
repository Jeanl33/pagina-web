# IconLab — Íconos vectoriales listos para PowerPoint

Aplicación web que permite **buscar** un concepto en español o inglés, **personalizarlo**
(color, grosor, tamaño y detalles descritos en lenguaje natural) y **exportarlo** como PNG
con fondo transparente al portapapeles, para pegarlo en PowerPoint con `Ctrl+V`.

100 % en el navegador: sin backend, sin claves de API y sin peticiones de red en tiempo de ejecución.

---

## Qué resuelve

| Necesidad | Cómo lo cubre IconLab |
|---|---|
| Encontrar el ícono correcto sin saber su nombre técnico | Búsqueda semántica ES/EN sobre 255 íconos, 3 757 términos y 222 conceptos curados |
| Ajustar el ícono al arte de la presentación | Paleta corporativa + selector hexadecimal libre, grosor de trazo y tamaño |
| Modificar el ícono más allá de su forma original | Motor de personalización que interpreta instrucciones escritas y superpone o transforma elementos vectoriales |
| Pegar en PowerPoint sin recuadro blanco | PNG rasterizado sobre canvas transparente y copiado al portapapeles como `image/png` |

---

## Uso

```bash
npm install     # sólo para desarrollo (Tailwind, generador de datos y pruebas)
npm run dev     # http://localhost:5173
```

Para desplegar basta con servir el repositorio como sitio estático
(GitHub Pages, Netlify, Vercel, S3, IIS…). No hay paso de compilación en producción:
`assets/styles.css` y `src/data/icons.js` están versionados.

### Búsqueda

Escribe una frase o un concepto: `persona hablando`, `trabajo en equipo`,
`crecimiento financiero`, `teamwork`, `supply chain`, `sostenibilidad`.
Siempre devuelve entre 6 y 12 alternativas; si la consulta es muy específica,
completa con los íconos más afines al primer resultado.

El motor combina tres señales (`src/js/search.js`):

1. **Conceptos** — frases completas mapeadas a listas curadas de íconos (`tools/concepts.json`).
2. **Léxico** — sinónimos ES/EN por ícono, con coincidencia exacta, por prefijo, por subcadena y difusa (distancia de edición 1, tolerante a erratas y plurales).
3. **Cobertura** — proporción de términos de la consulta efectivamente cubiertos.

Cada término aporta **sólo su mejor coincidencia**, no la suma de todas: así un ícono con
muchos sinónimos largos no desplaza a otro cuyo sinónimo es exactamente la consulta.

### Detalles personalizados

El campo *«Agregar o modificar detalles a este ícono»* acepta instrucciones en lenguaje
natural, separadas por coma o por «y»:

```
Agrégale un bocadillo de diálogo sobre la cabeza
Ponle un signo de dólar dentro del círculo
Haz que las líneas del fondo sean punteadas
Añádele un marco circular alrededor
Agrégale un candado en la esquina superior derecha y un check abajo a la derecha
Rótalo 45 grados y ponle sombra
```

`src/js/customize.js` las resuelve en tres niveles:

1. **Reglas explícitas** agrupadas por familia — marco (circular, cuadrado, redondeado),
   trazo (punteado, relleno, más grueso, más fino, atenuado), transformación (rotar N grados,
   espejo horizontal/vertical), efecto (resplandor, sombra) y superposiciones con anclaje
   propio (bocadillo, dólar, euro, porcentaje, check, aspa, alerta, interrogación, punto de
   notificación). Se aplica **una regla por familia y cláusula**, de modo que instrucciones
   distintas no se contradicen.
2. **Texto literal** — `ponle la letra A`, `texto "S/"`, `el número 3`.
3. **Respaldo semántico** — cualquier concepto del catálogo puede superponerse aunque no
   exista una regla para él: *«agrégale un candado»* reutiliza el propio motor de búsqueda
   y coloca el ícono `lock`.

Las posiciones se leen de la frase (`sobre la cabeza`, `esquina superior derecha`, `dentro`,
`abajo a la derecha`…). Si no se indica ninguna, las superposiciones se reparten
automáticamente entre las esquinas libres para que no se encimen. Cada detalle aplicado
aparece como una etiqueta removible; lo que no se pudo interpretar se informa explícitamente.

Bajo el capó, la superposición recorta el trazo base con una máscara circular para que las
líneas no choquen, y compensa el `stroke-width` por el factor de escala, de modo que el
grosor visual se mantiene constante en el ícono base, el marco y los añadidos.

### Exportación

| Botón | Resultado |
|---|---|
| **Copiar para PPTX (PNG)** | `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])` — pegar con `Ctrl+V` en PowerPoint |
| **Descargar SVG** | Vector con todas las modificaciones aplicadas |
| **Descargar PNG** | Mismo PNG transparente, como archivo |

La resolución es configurable (512 / 1024 / 2048 / 4096 px). El canvas nunca se pinta de
fondo — sólo `clearRect` + `drawImage` — por lo que el alfa del SVG se conserva íntegro.
Si el navegador no permite escribir imágenes en el portapapeles (contexto no seguro o
Firefox con la API deshabilitada), la aplicación descarga el PNG automáticamente y lo avisa
en un toast, en vez de fallar en silencio.

---

## Estructura

```
index.html                 Interfaz (Tailwind, tema oscuro, responsiva)
assets/styles.css          Tailwind compilado y versionado (sin CDN)
src/input.css              Fuente de Tailwind + trama de transparencia y sliders
src/data/icons.js          GENERADO — geometría vectorial + léxico + conceptos
src/js/search.js           Motor de búsqueda semántica ES/EN
src/js/svg.js              Composición del SVG final (base, marco, máscaras, superposiciones)
src/js/customize.js        Interpretación de instrucciones en lenguaje natural
src/js/export.js           PNG transparente, portapapeles y descargas
src/js/app.js              Estado, renderizado y eventos
src/js/toast.js            Notificaciones
tools/lexicon/*.json       Léxico curado por dominio (editable a mano)
tools/concepts.json        Conceptos → listas de íconos
tools/concept-aliases.json Alias EN/ES que reutilizan un concepto existente
tools/build-icons.mjs      Generador de src/data/icons.js
tools/serve.mjs            Servidor estático de desarrollo
tests/e2e.mjs              Pruebas end-to-end en Chromium
```

Los scripts se cargan como `<script>` clásicos con espacios de nombres globales
(`window.IconSearch`, `window.SvgBuilder`, …) en lugar de módulos ES, de modo que
`index.html` funciona incluso abierto directamente desde el disco (`file://`),
sin servidor ni herramientas.

## Ampliar el catálogo

1. Añade el ícono y sus sinónimos ES/EN en el archivo de dominio correspondiente de
   `tools/lexicon/` (el nombre debe existir en [Lucide](https://lucide.dev)).
2. Si es una frase de negocio recurrente, agrégala a `tools/concepts.json`
   (o a `tools/concept-aliases.json` si es la traducción de un concepto ya existente).
3. `npm run build:icons` — el generador valida que todos los nombres y referencias existan
   y falla con un mensaje explícito si algo no cuadra.

Tras tocar `index.html` o los archivos de `src/js/`, ejecuta `npm run build:css`
para regenerar `assets/styles.css`.

## Pruebas

```bash
npm test
```

29 comprobaciones sobre Chromium: carga inicial, relevancia de búsqueda en español e inglés,
selección, paleta y hexadecimal libre, sliders, los cinco casos de personalización de la
especificación, eliminación de detalles, aviso de instrucción no interpretada, generación
del PNG (dimensiones, tipo MIME, esquinas con alfa 0 y 62 % de píxeles transparentes),
copiado al portapapeles, SVG bien formado, ausencia de desbordamiento horizontal en móvil,
tablet y escritorio, y ausencia de errores de consola.

## Créditos y licencia

Código bajo licencia MIT. La geometría vectorial proviene de
[Lucide](https://lucide.dev) (licencia ISC); el léxico semántico ES/EN, el mapa de conceptos
y el motor de personalización son propios de este repositorio.
