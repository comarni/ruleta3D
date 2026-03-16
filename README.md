# 🎰 Ruleta 3D — Spin the Wheel

Demo interactiva de ruleta tipo casino construida con **Three.js puro** (sin frameworks, sin bundler).
Reemplaza herramientas como spinthewheel.io con una experiencia 3D inmersiva y personalizable.

---

## Características

| Función | Detalle |
|---|---|
| Ruleta 3D | Disco metálico con sectores coloreados + separadores dorados |
| Texto en sectores | Etiquetas canvas 2D proyectadas sobre cada sector |
| Bola de ruleta | Órbita independiente, frena con la ruleta |
| Animación de giro | Easing `easeOutBack` para efecto de inercia real |
| Selección aleatoria | Uniforme (o ponderada con campo `weight`) |
| UI lateral | Añadir / eliminar / resetear nombres en tiempo real |
| Persistencia | Los nombres se guardan en `localStorage` |
| Modal ganador | Overlay con nombre ganador + glow en el sector |
| Iluminación | HemiLight + DirectionalLight + SpotLight de casino + PointLight |
| Responsive | Sidebar lateral en desktop, panel inferior en móvil |

---

## Estructura del proyecto

```
threejs-demo/
├── index.html   ← HTML con UI overlay completa
├── style.css    ← Tema "casino futurista"
├── main.js      ← Lógica Three.js completa (5 módulos)
└── README.md    ← Este archivo
```

### Módulos dentro de `main.js`

```
① initScene      — renderer, cámara, luces, partículas, loop
② rouletteModel  — createRoulette(), sectores, textos, bola
③ rouletteLogic  — spinToIndex(), getRandomWinnerIndex(), easing
④ itemsStore     — addItem(), removeItem(), localStorage
⑤ ui             — DOM, eventos, rebuildRoulette(), modales
```

---

## Ejecutar localmente

> `index.html` **no puede abrirse directamente** (necesita servidor HTTP para módulos ES6).

### Opción A — VS Code + Live Server (recomendado)
1. Instala la extensión **Live Server**.
2. Click derecho sobre `index.html` → **Open with Live Server**.
3. Abre `http://localhost:5500`.

### Opción B — Node.js
```bash
npx serve .
# → http://localhost:3000
```

### Opción C — Python 3
```bash
python -m http.server 8080
# → http://localhost:8080
```

---

## Publicar en GitHub Pages

### Paso 1 — Crear repositorio en GitHub
1. Ve a [github.com/new](https://github.com/new).
2. Nombre: `ruleta-3d` (o el que prefieras).
3. Visibilidad: **Público**.
4. NO marques "Initialize with README".
5. Clic en **Create repository**.

### Paso 2 — Subir el código
```bash
cd threejs-demo

git init
git add .
git commit -m "feat: ruleta 3D casino con Three.js"

git remote add origin https://github.com/<tu-usuario>/ruleta-3d.git
git push -u origin main
```

### Paso 3 — Activar GitHub Pages
1. En el repo: **Settings → Pages**.
2. Source: **Deploy from a branch**.
3. Branch: **main** / Folder: **/ (root)**.
4. **Save**.

Tu ruleta estará en:
```
https://<tu-usuario>.github.io/ruleta-3d/
```

---

## Personalización

### Cambiar colores de los sectores
En `main.js`, array `SECTOR_COLORS`:
```js
const SECTOR_COLORS = [
  0xc0392b, 0x1a5276, 0x1e8449, // ... añade o cambia colores hex
];
```

### Cambiar velocidad y duración del giro
En el evento del botón "Tirar ruleta":
```js
spinToIndex(roulette, winnerIdx, items, {
  duration:        5800,   // ms → más alto = giro más largo
  extraRotations:  7,      // más vueltas antes de carar
});
```

### Añadir pesos (probabilidades diferentes)
Los items admiten un campo `weight` opcional:
```js
items = [
  { label: 'Alice', weight: 3 },  // 3x más probable
  { label: 'Bob',   weight: 1 },
  { label: 'Carol', weight: 2 },
];
```
La función `getRandomWinnerIndex` lo detecta automáticamente.

### Cambiar tamaño de la ruleta
En `createRoulette()`:
```js
const RADIUS    = 4.0;   // radio del disco (unidades Three.js)
const THICKNESS = 0.55;  // altura del cilindro
```

### Cambiar la cámara
```js
camera.position.set(0, 6.5, 11); // x, y (altura), z (distancia)
camera.fov = 52;                  // campo de visión
```

---

## Tecnologías usadas

- [Three.js r163](https://threejs.org/) — motor 3D WebGL
- [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls) — control de cámara
- Canvas 2D API — textos en los sectores (`CanvasTexture`)
- `localStorage` — persistencia de participantes
- HTML5 · CSS3 · ES2022 Modules — sin bundler ni frameworks

---

## Licencia

MIT — libre para usar, modificar y distribuir.
