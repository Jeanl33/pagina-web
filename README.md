# IconLab — Íconos vectoriales listos para PowerPoint

Aplicación web que permite **buscar** un concepto en español o inglés, **crear** un ícono
nuevo describiéndolo cuando no existe, **personalizarlo** (color, grosor, tamaño y detalles
en lenguaje natural) y **exportarlo** como PNG con fondo transparente al portapapeles, para
pegarlo en PowerPoint con `Ctrl+V`.

100 % en el navegador: sin backend, sin claves de API y sin peticiones de red en tiempo de ejecución.

---

## Qué resuelve

| Necesidad | Cómo lo cubre IconLab |
|---|---|
| Encontrar el ícono correcto sin saber su nombre técnico | Búsqueda semántica ES/EN sobre los 1 815 íconos del catálogo, con 274 de ellos enriquecidos con léxico curado, 222 conceptos de negocio y 683 términos ES→EN |
| Que el ícono simplemente no exista | Compositor que crea uno nuevo a partir de una descripción escrita y lo guarda en «Mis íconos» |
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

Este repositorio se publica automáticamente en
**<https://jeanl33.github.io/pagina-web/>** con cada push
(`.github/workflows/deploy-pages.yml`).

### Búsqueda

Escribe una frase o un concepto: `persona hablando`, `trabajo en equipo`,
`crecimiento financiero`, `teamwork`, `supply chain`, `sostenibilidad`, `paraguas`, `montacargas`.
Siempre devuelve entre 6 y 12 alternativas; si la consulta es muy específica,
completa con los íconos más afines al primer resultado.

El motor combina cuatro señales (`src/js/search.js`):

1. **Conceptos** — frases de negocio mapeadas a listas curadas de íconos (`tools/concepts.json`).
2. **Léxico** — sinónimos ES/EN por ícono, con coincidencia exacta, por prefijo, por subcadena y difusa (distancia de edición 1, tolerante a erratas y plurales).
3. **Expansión ES→EN** — cada término en español se amplía con sus equivalentes en inglés
   (`tools/es-en.json`, 683 entradas con soporte de plurales). Esto es lo que permite que una
   consulta en español alcance también los ~1 540 íconos cuyo vocabulario original sólo
   existe en inglés, sin tener que traducir las 4 140 palabras del catálogo.
4. **Cobertura** — proporción de términos de la consulta efectivamente cubiertos.

Dos reglas de desempate evitan resultados sorprendentes:

- Cada término aporta **sólo su mejor coincidencia**, no la suma de todas: un ícono con
  muchos sinónimos largos no desplaza a otro cuyo sinónimo es exactamente la consulta.
- A igualdad de puntaje gana el **nombre más simple**: ante `check`, el ícono `check` vence
  a `book-open-check` o `calendar-check`.

Las coincidencias de frase exigen límite de palabra, de modo que `dado` no puntúa dentro
de `validado`.

### Crear un ícono que no existe

El bloque *«¿No está el ícono? Créalo describiéndolo»* compone geometría vectorial real a
partir de una frase (`src/js/compose.js`):

```
un maletín con una flecha hacia arriba
una persona con un engranaje encima
un círculo con un rayo dentro
una nube con un candado y un check
un cerebro rodeado de un marco circular
un escudo con una huella dentro, punteado
```

Cómo se interpreta:

1. La frase se parte por conectores que además indican posición: `con`, `y`, `dentro de`
   (centro), `encima de` / `sobre` (arriba), `debajo de` (abajo), `al lado de` (derecha),
   `rodeado de` (marco).
2. El primer segmento define el **elemento base**; los siguientes se superponen con recorte
   de máscara para que los trazos no choquen, repartiéndose entre las posiciones libres si
   no se indica ninguna.
3. Los segmentos que describen **estilo** (punteado, relleno, rotado, sombra) no se
   convierten en geometría: se envían al panel de detalles, donde se pueden quitar uno a uno.
4. Las palabras de dirección se respetan cuando forman parte del nombre del elemento:
   en *«una flecha hacia arriba»*, `arriba` es parte de la flecha, no una posición.

El ícono resultante es de primera clase: se colorea, se ajusta, se sigue modificando con el
panel de detalles y se exporta igual que cualquier otro. Además queda **guardado en «Mis
íconos»** (localStorage, sobrevive a recargas), es **localizable desde el buscador** por las
palabras de su descripción, y se puede eliminar individualmente o en bloque.

Si una búsqueda no devuelve nada, el estado vacío ofrece directamente crear el ícono con esa
consulta.

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
src/data/icons.js          GENERADO — geometría vectorial + léxico + conceptos + ES→EN
src/js/search.js           Motor de búsqueda semántica ES/EN
src/js/svg.js              Composición del SVG final (base, marco, máscaras, superposiciones)
src/js/compose.js          Creación de íconos nuevos desde una descripción escrita
src/js/customize.js        Interpretación de instrucciones en lenguaje natural
src/js/export.js           PNG transparente, portapapeles y descargas
src/js/app.js              Estado, renderizado y eventos
src/js/toast.js            Notificaciones
tools/lexicon/*.json       Léxico curado por dominio (editable a mano)
tools/concepts.json        Conceptos → listas de íconos
tools/concept-aliases.json Alias EN/ES que reutilizan un concepto existente
tools/es-en.json           Diccionario ES→EN para expandir las consultas
tools/build-icons.mjs      Generador de src/data/icons.js
tools/serve.mjs            Servidor estático de desarrollo
tests/e2e.mjs              Pruebas end-to-end en Chromium
.github/workflows/         Despliegue automático a GitHub Pages
```

Los scripts se cargan como `<script>` clásicos con espacios de nombres globales
(`window.IconSearch`, `window.SvgBuilder`, …) en lugar de módulos ES, de modo que
`index.html` funciona incluso abierto directamente desde el disco (`file://`),
sin servidor ni herramientas.

## Afinar la búsqueda

El catálogo ya incluye los 1 815 íconos de Lucide, así que no hay que “añadir íconos”:
lo que se afina es cómo se encuentran.

1. **Un término en español que no encuentra nada** → añádelo a `tools/es-en.json`
   con sus equivalentes en inglés.
2. **Un ícono que debería salir primero para un concepto de negocio** → añade o reordena
   la lista en `tools/concepts.json` (o `tools/concept-aliases.json` si es la traducción
   de un concepto existente).
3. **Un ícono que merece sinónimos ES/EN propios y prioridad de ranking** → añádelo al
   archivo de dominio correspondiente de `tools/lexicon/`; queda marcado como curado.
4. `npm run build:icons` — el generador valida que todos los nombres y referencias existan
   y falla con un mensaje explícito si algo no cuadra.

El archivo generado pesa ~726 KB (~166 KB comprimido, que es como lo sirve GitHub Pages).

Tras tocar `index.html` o los archivos de `src/js/`, ejecuta `npm run build:css`
para regenerar `assets/styles.css`.

## Pruebas

```bash
npm test
```

44 comprobaciones sobre Chromium: carga inicial y catálogo completo, relevancia de búsqueda
en español e inglés, vocabulario de cola larga (`paraguas`, `tortuga`, `hexágono`, `dado`,
`montacargas`), selección, paleta y hexadecimal libre, sliders, los cinco casos de
personalización de la especificación, eliminación de detalles, aviso de instrucción no
interpretada, creación de íconos por descripción (composición correcta, selección en el
editor, aparición en «Mis íconos», geometría añadida al SVG, persistencia tras recarga,
localización por búsqueda, eliminación y estado vacío con acción de crear), generación del
PNG (dimensiones, tipo MIME, esquinas con alfa 0 y 62 % de píxeles transparentes), copiado
al portapapeles, SVG bien formado, ausencia de desbordamiento horizontal en móvil, tablet y
escritorio, y ausencia de errores de consola.

## Créditos y licencia

Código bajo licencia MIT. La geometría vectorial proviene de
[Lucide](https://lucide.dev) (licencia ISC); el léxico semántico ES/EN, el mapa de conceptos
y el motor de personalización son propios de este repositorio.
