/**
 * main.js — Ruleta 3D Casino
 * ═══════════════════════════════════════════════════════════════
 * Módulos lógicos (todo en un archivo para máxima portabilidad):
 *
 *  ① initScene        — renderer, cámara, luces, loop
 *  ② rouletteModel    — geometrías y materiales de la ruleta
 *  ③ rouletteLogic    — animación de giro, easing, bola
 *  ④ itemsStore       — estado de items + localStorage
 *  ⑤ ui               — DOM, eventos, integración
 * ═══════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ═══════════════════════════════════════════════════════════════
   ① initScene — escena, cámara, renderer, luces, loop
═══════════════════════════════════════════════════════════════ */

const container = document.getElementById('canvas-container');

// ── Renderer ────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
container.appendChild(renderer.domElement);

// ── Escena ──────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050310, 0.028);

// ── Cámara ──────────────────────────────────────────────────
const SIDEBAR_W = 280; // debe coincidir con --sidebar-w en CSS
const camera = new THREE.PerspectiveCamera(
  52,
  container.clientWidth / container.clientHeight,
  0.1, 120
);
camera.position.set(0, 6.5, 11);
camera.lookAt(0, 0, 0);

// ── OrbitControls (solo para inspección manual, limitado) ───
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping    = true;
controls.dampingFactor    = 0.07;
controls.enablePan        = false;
controls.minDistance      = 6;
controls.maxDistance      = 20;
controls.maxPolarAngle    = Math.PI * 0.45; // no pasar por debajo del disco
controls.minPolarAngle    = Math.PI * 0.12;
controls.target.set(0, 0, 0);

// ── Luces ────────────────────────────────────────────────────
// Luz hemisférica (cielo oscuro, suelo cálido)
const hemiLight = new THREE.HemisphereLight(0x1a1060, 0x302000, 0.7);
scene.add(hemiLight);

// Luz direccional principal (simula spotlight de casino)
const dirLight = new THREE.DirectionalLight(0xfff0cc, 2.8);
dirLight.position.set(4, 12, 6);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near   = 0.5;
dirLight.shadow.camera.far    = 40;
dirLight.shadow.camera.left   = -8;
dirLight.shadow.camera.right  = 8;
dirLight.shadow.camera.top    = 8;
dirLight.shadow.camera.bottom = -8;
scene.add(dirLight);

// Luz de relleno azul-violeta
const fillLight = new THREE.DirectionalLight(0x5533ff, 0.8);
fillLight.position.set(-6, 4, -4);
scene.add(fillLight);

// Punto de luz dorado bajo el disco (reflejo en suelo)
const underLight = new THREE.PointLight(0xf0c040, 1.5, 10);
underLight.position.set(0, -1.8, 0);
scene.add(underLight);

// Ambiente puntual sobre la ruleta (como un spotlight de casino)
const spotTop = new THREE.SpotLight(0xffffff, 3.5, 22, Math.PI * 0.18, 0.35, 1.5);
spotTop.position.set(0, 14, 0);
spotTop.target.position.set(0, 0, 0);
spotTop.castShadow = true;
scene.add(spotTop);
scene.add(spotTop.target);

// ── Partículas de fondo (estrellas) ─────────────────────────
const STAR_COUNT = 2000;
const starPos = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  const phi   = Math.acos(2 * Math.random() - 1);
  const theta = Math.random() * Math.PI * 2;
  const r     = 25 + Math.random() * 35;
  starPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
  starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
  starPos[i*3+2] = r * Math.cos(phi);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0x9988ff, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.7 });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ── Suelo reflectante ────────────────────────────────────────
const floorGeo = new THREE.CircleGeometry(14, 64);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x0a0820,
  roughness: 0.3,
  metalness: 0.6,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.6;
floor.receiveShadow = true;
scene.add(floor);

/* ═══════════════════════════════════════════════════════════════
   ② rouletteModel — geometrías, materiales, texto Canvas2D
═══════════════════════════════════════════════════════════════ */

/**
 * Paleta de colores alternos para los sectores.
 * Se repite cíclicamente si hay más items que colores.
 */
const SECTOR_COLORS = [
  0xc0392b, 0x1a5276, 0x1e8449, 0x9b59b6,
  0xd35400, 0x117a65, 0x2471a3, 0x7d6608,
  0x641e16, 0x154360, 0x0e6655, 0x4a235a,
];

/**
 * Crea una textura Canvas2D con el texto del sector.
 * @param {string} text
 * @param {number} color - hex color del fondo del sector
 */
function makeTextTexture(text, color) {
  const size = 512;
  const cv   = document.createElement('canvas');
  cv.width   = size;
  cv.height  = size;
  const ctx  = cv.getContext('2d');

  // Fondo transparente
  ctx.clearRect(0, 0, size, size);

  // Texto centrado
  const maxW   = size * 0.85;
  let fontSize = 88;
  ctx.font = `bold ${fontSize}px Segoe UI, sans-serif`;

  // Reducir fuente si el texto es demasiado largo
  while (ctx.measureText(text).width > maxW && fontSize > 32) {
    fontSize -= 4;
    ctx.font = `bold ${fontSize}px Segoe UI, sans-serif`;
  }

  ctx.fillStyle    = '#ffffff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor  = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur   = 14;
  ctx.fillText(text, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

/**
 * createRoulette(scene, items)
 * Construye toda la ruleta 3D y la añade a la escena.
 * Devuelve { group, wheelMesh, ballMesh, sectors }
 */
function createRoulette(scene, items) {
  const N = items.length;
  if (N < 2) return null;

  const group = new THREE.Group();
  group.position.y = 0;

  // ── Disco base metálico ──────────────────────────────────
  const RADIUS       = 4.0;   // radio del disco
  const THICKNESS    = 0.55;  // altura del cilindro
  const BASE_RADIUS  = 4.25;  // radio de la peana

  // Peana (ligeramente mayor, aspecto casino)
  const baseGeo = new THREE.CylinderGeometry(BASE_RADIUS, BASE_RADIUS + 0.15, THICKNESS * 0.5, 64);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.3, metalness: 0.9 });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = -THICKNESS * 0.5;
  baseMesh.castShadow   = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // ── Sectores coloreados (geometría de "torta") ───────────
  const sectors = [];
  const anglePerSector = (Math.PI * 2) / N;

  for (let i = 0; i < N; i++) {
    const startAngle  = i * anglePerSector;
    const centerAngle = startAngle + anglePerSector / 2;
    const color       = SECTOR_COLORS[i % SECTOR_COLORS.length];

    // Geometría de sector: CylinderGeometry con openEnded + thetaStart/Length
    const sGeo = new THREE.CylinderGeometry(
      RADIUS, RADIUS,        // top/bottom radius
      THICKNESS,             // altura
      32,                    // segmentos radiales (suavidad)
      1,                     // segmentos de altura
      false,                 // openEnded
      startAngle,            // thetaStart
      anglePerSector         // thetaLength
    );
    const sMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.35,
    });
    const sMesh = new THREE.Mesh(sGeo, sMat);
    sMesh.castShadow   = true;
    sMesh.receiveShadow = true;
    group.add(sMesh);

    // ── Plano con textura de texto sobre el sector ─────────
    // Lo posicionamos en el radio medio del sector, un poco por encima del disco
    const textR = RADIUS * 0.62; // distancia al centro del plano de texto
    const textGeo = new THREE.PlaneGeometry(1.55, 1.55);
    const textMat = new THREE.MeshBasicMaterial({
      map: makeTextTexture(items[i].label, color),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const textMesh = new THREE.Mesh(textGeo, textMat);

    // Posición: centrado angularmente en el sector
    textMesh.position.set(
      textR * Math.sin(centerAngle),
      THICKNESS / 2 + 0.02,          // justo encima del disco
      textR * Math.cos(centerAngle)
    );
    textMesh.rotation.x = -Math.PI / 2; // tumbado (mirando hacia arriba)
    // Rotar para que el texto "lea" desde fuera hacia el centro
    textMesh.rotation.z = -centerAngle;

    group.add(textMesh);

    // ── Separador (línea blanca entre sectores) ───────────
    const sepGeo = new THREE.BoxGeometry(0.04, THICKNESS + 0.05, RADIUS);
    const sepMat = new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.2, metalness: 0.8 });
    const sepMesh = new THREE.Mesh(sepGeo, sepMat);
    sepMesh.position.set(
      (RADIUS / 2) * Math.sin(startAngle),
      0,
      (RADIUS / 2) * Math.cos(startAngle)
    );
    sepMesh.rotation.y = -startAngle;
    group.add(sepMesh);

    sectors.push({ item: items[i], startAngle, centerAngle, color, mesh: sMesh });
  }

  // ── Círculo central (cubo de casino) ────────────────────
  const hubGeo = new THREE.CylinderGeometry(0.38, 0.38, THICKNESS + 0.12, 32);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.1, metalness: 1 });
  const hubMesh = new THREE.Mesh(hubGeo, hubMat);
  hubMesh.castShadow = true;
  group.add(hubMesh);

  // ── Anillo exterior decorativo ───────────────────────────
  const ringGeo = new THREE.TorusGeometry(RADIUS + 0.12, 0.1, 12, 80);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xf0c040, roughness: 0.1, metalness: 1 });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = THICKNESS / 2;
  group.add(ringMesh);

  // Segundo anillo en la base
  const ring2 = ringMesh.clone();
  ring2.position.y = -THICKNESS / 2;
  group.add(ring2);

  // ── Bola de ruleta ───────────────────────────────────────
  const BALL_ORBIT = RADIUS + 0.35; // radio de la órbita de la bola
  const ballGeo  = new THREE.SphereGeometry(0.22, 24, 24);
  const ballMat  = new THREE.MeshStandardMaterial({
    color: 0xf5f5f0,
    roughness: 0.08,
    metalness: 0.9,
    envMapIntensity: 1.2,
  });
  const ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.castShadow = true;
  // Posición inicial de la bola (borde exterior, encima del disco)
  ballMesh.position.set(BALL_ORBIT, THICKNESS / 2 + 0.25, 0);

  // La bola es hija del grupo para que siga la ruleta,
  // pero su rotación se controla de forma independiente
  // (se extrae del group y se añade a la escena directamente)
  scene.add(ballMesh); // NO dentro del group: se mueve independientemente

  // Referencia al wheelMesh (el grupo completo, el "disco que rota")
  const wheelMesh = group; // el group en sí rota; podría referirse al disco interior

  scene.add(group);

  return {
    group,
    wheelMesh,  // referencia al group que rota
    ballMesh,
    sectors,
    BALL_ORBIT,
    THICKNESS,
    RADIUS,
  };
}

/* ═══════════════════════════════════════════════════════════════
   ③ rouletteLogic — animación de giro, easing, bola
═══════════════════════════════════════════════════════════════ */

/**
 * Easing: cubicOut — desacelera suavemente al final
 * t en [0,1] → valor en [0,1]
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Easing: back-out — ligero rebote al final para mayor dramatismo
 */
function easeOutBack(t, overshoot = 1.4) {
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * getRandomWinnerIndex(items)
 * Probabilidad uniforme (o ponderada si item.weight existe).
 */
function getRandomWinnerIndex(items) {
  const hasWeights = items.some(i => i.weight && i.weight > 0);
  if (!hasWeights) {
    return Math.floor(Math.random() * items.length);
  }
  // Selección ponderada
  const totalW = items.reduce((s, i) => s + (i.weight || 1), 0);
  let rand     = Math.random() * totalW;
  for (let i = 0; i < items.length; i++) {
    rand -= (items[i].weight || 1);
    if (rand <= 0) return i;
  }
  return items.length - 1;
}

/**
 * Estado de la animación (objeto mutable compartido)
 */
const animState = {
  spinning:        false,
  idleRotSpeed:    0.003,   // rad/frame durante idle
  currentAngle:    0,       // ángulo actual del disco (en Y)
  ballAngle:       0,       // ángulo orbital de la bola (independiente)
  ballSpeed:       0.025,   // rad/frame de la bola
};

/**
 * spinToIndex(roulette, index, items, options)
 * Anima el giro de la ruleta hasta que el sector `index` quede
 * apuntando hacia la "marca" (parte superior = Z+).
 * Devuelve una Promise que resuelve con el item ganador.
 *
 * La "marca" de referencia está en Z positivo (frente a la cámara),
 * equivale a ángulo 0. El sector queda bajo el puntero (#wheel-pointer).
 */
function spinToIndex(roulette, index, items, options = {}) {
  return new Promise((resolve) => {
    const {
      duration      = 5500,   // ms totales de la animación
      extraRotations = 6,     // vueltas completas antes de caer
    } = options;

    const N             = items.length;
    const anglePerSector = (Math.PI * 2) / N;

    // Ángulo del CENTRO del sector ganador en la geometría local
    // (el disco THREE.CylinderGeometry construye los sectores
    //  con thetaStart hacia +Z en el plano XZ)
    const sectorCenter = roulette.sectors[index].centerAngle;

    // Para que el sector quede bajo la marca (Y rotation = 0 ≡ "arriba"),
    // necesitamos que la rotación del grupo lleve sectorCenter a 0.
    // rotTarget = -sectorCenter + 2π*extraRotations + corrección de vuelta actual
    const startAngle  = animState.currentAngle;
    const normalizeTarget = (Math.PI * 2 - sectorCenter) % (Math.PI * 2);
    const totalRotation   = Math.PI * 2 * extraRotations + normalizeTarget
      + Math.ceil((startAngle - normalizeTarget) / (Math.PI * 2)) * Math.PI * 2;

    const targetAngle = startAngle + totalRotation;
    const startTime   = performance.now();

    animState.spinning  = true;
    animState.ballSpeed = 0.12; // bola gira rápido al inicio

    function animateFrame(now) {
      const elapsed = now - startTime;
      const t       = Math.min(elapsed / duration, 1); // [0,1]
      const tEased  = easeOutBack(t, 1.1);

      // Ángulo del disco
      const angle = startAngle + (targetAngle - startAngle) * tEased;
      animState.currentAngle = angle;
      roulette.group.rotation.y = angle;

      // Velocidad orbital de la bola: rápida al inicio, frena con la ruleta
      const speedFactor = 1 - easeOutCubic(t);
      animState.ballSpeed = 0.005 + speedFactor * 0.11;

      if (t < 1) {
        requestAnimationFrame(animateFrame);
      } else {
        // ── Animación terminada ─────────────────────────
        animState.currentAngle = targetAngle % (Math.PI * 2);
        roulette.group.rotation.y = animState.currentAngle;
        animState.spinning  = false;
        animState.ballSpeed = 0.004; // bola casi quieta

        // Posicionar la bola exactamente en el sector ganador
        const finalBallAngle = -(animState.currentAngle + sectorCenter - Math.PI * 2 * 0.5);
        animState.ballAngle  = finalBallAngle;

        resolve(items[index]);
      }
    }

    requestAnimationFrame(animateFrame);
  });
}

/* ═══════════════════════════════════════════════════════════════
   ④ itemsStore — estado de items + localStorage
═══════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'roulette3d_items';

/** Estado global de items */
let items = [];

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) items = JSON.parse(raw);
  } catch (e) { /* ignorar */ }
  if (!Array.isArray(items) || items.length === 0) {
    // Valores de demostración
    items = [
      { label: 'Alice' },
      { label: 'Bob' },
      { label: 'Carol' },
      { label: 'David' },
      { label: 'Eva' },
      { label: 'Frank' },
    ];
  }
}

function saveItems() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* ignorar */ }
}

function addItem(label) {
  const trimmed = label.trim().slice(0, 24);
  if (!trimmed) return false;
  items.push({ label: trimmed });
  saveItems();
  return true;
}

function removeItem(index) {
  items.splice(index, 1);
  saveItems();
}

function resetItems() {
  items = [];
  saveItems();
}

/* ═══════════════════════════════════════════════════════════════
   ⑤ ui — DOM, eventos, integración con la lógica
═══════════════════════════════════════════════════════════════ */

// ── Referencias DOM ──────────────────────────────────────────
const nameInput       = document.getElementById('name-input');
const btnAdd          = document.getElementById('btn-add');
const btnSpin         = document.getElementById('btn-spin');
const btnReset        = document.getElementById('btn-reset');
const namesList       = document.getElementById('names-list');
const countNum        = document.getElementById('count-num');
const winnerOverlay   = document.getElementById('winner-overlay');
const winnerName      = document.getElementById('winner-name');
const btnCloseWinner  = document.getElementById('btn-close-winner');
const toast           = document.getElementById('toast');
const toastMsg        = document.getElementById('toast-msg');

/** Referencia mutable a la ruleta actual */
let roulette = null;

/** Muestra un toast temporal */
function showToast(msg, duration = 2800) {
  toastMsg.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

/** Renderiza la lista de nombres en el sidebar */
function renderNamesList() {
  namesList.innerHTML = '';
  countNum.textContent = items.length;

  items.forEach((item, i) => {
    const color  = SECTOR_COLORS[i % SECTOR_COLORS.length];
    const hexStr = '#' + color.toString(16).padStart(6, '0');

    const li = document.createElement('li');
    li.className = 'name-item';
    li.innerHTML = `
      <span class="name-swatch" style="background:${hexStr}"></span>
      <span class="name-label" title="${item.label}">${item.label}</span>
      <button class="btn-delete" data-i="${i}" title="Eliminar">✕</button>
    `;
    namesList.appendChild(li);
  });

  // Delegación de eventos para los botones de eliminar
  namesList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      removeItem(Number(btn.dataset.i));
      rebuildRoulette();
    });
  });
}

/**
 * Destruye la ruleta actual y construye una nueva con los items actuales.
 * Se llama cada vez que cambia la lista.
 */
function rebuildRoulette() {
  // Eliminar grupo anterior + bola anterior de la escena
  if (roulette) {
    scene.remove(roulette.group);
    scene.remove(roulette.ballMesh);
    // Liberar geometrías y materiales
    roulette.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    if (roulette.ballMesh.geometry) roulette.ballMesh.geometry.dispose();
    if (roulette.ballMesh.material) roulette.ballMesh.material.dispose();
    roulette = null;
  }

  renderNamesList();

  if (items.length >= 2) {
    roulette = createRoulette(scene, items);
    animState.spinning  = false;
    animState.ballSpeed = 0.005;
  }
}

/** Muestra el modal del ganador */
function showWinner(item, sectorColor) {
  winnerName.textContent = item.label;
  winnerOverlay.classList.remove('hidden');

  // Brillo en el canvas
  container.classList.add('winner-glow');

  // Pequeña animación de brillo al sector ganador (cambio temporal de material)
  if (roulette) {
    const sectorIdx = items.findIndex(it => it.label === item.label);
    if (sectorIdx >= 0) {
      const sectorEntry = roulette.sectors[sectorIdx];
      const origColor = sectorEntry.mesh.material.color.getHex();
      sectorEntry.mesh.material.emissive.setHex(0xf0c040);
      sectorEntry.mesh.material.emissiveIntensity = 0.6;
      setTimeout(() => {
        sectorEntry.mesh.material.emissive.setHex(0x000000);
        sectorEntry.mesh.material.emissiveIntensity = 0;
      }, 2500);
    }
  }
}

/** Oculta el modal del ganador */
function hideWinner() {
  winnerOverlay.classList.add('hidden');
  container.classList.remove('winner-glow');
}

/** Bloquea / desbloquea controles durante el giro */
function setUILocked(locked) {
  btnSpin.disabled  = locked;
  btnAdd.disabled   = locked;
  btnReset.disabled = locked;
  nameInput.disabled = locked;
  namesList.querySelectorAll('.btn-delete').forEach(b => b.disabled = locked);
  if (locked) {
    document.getElementById('spin-label').textContent = '⏳ Girando…';
  } else {
    document.getElementById('spin-label').textContent = '🎲 Tirar ruleta';
  }
}

// ── Eventos ──────────────────────────────────────────────────

/** Añadir nombre */
function handleAdd() {
  const ok = addItem(nameInput.value);
  if (ok) {
    nameInput.value = '';
    rebuildRoulette();
  } else {
    showToast('Escribe un nombre válido primero.');
  }
  nameInput.focus();
}
btnAdd.addEventListener('click', handleAdd);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleAdd(); });

/** Vaciar lista */
btnReset.addEventListener('click', () => {
  if (items.length === 0) return;
  resetItems();
  rebuildRoulette();
});

/** Tirar la ruleta */
btnSpin.addEventListener('click', async () => {
  if (animState.spinning) return;
  if (items.length < 2) {
    showToast('Añade al menos 2 participantes para girar.');
    return;
  }

  const winnerIdx = getRandomWinnerIndex(items);
  setUILocked(true);

  const winnerItem = await spinToIndex(roulette, winnerIdx, items, {
    duration:       5800,
    extraRotations: 5 + Math.floor(Math.random() * 4),
  });

  setUILocked(false);
  showWinner(winnerItem);
});

/** Cerrar modal de ganador */
btnCloseWinner.addEventListener('click', hideWinner);
winnerOverlay.addEventListener('click', e => {
  if (e.target === winnerOverlay) hideWinner();
});

/* ═══════════════════════════════════════════════════════════════
   LOOP DE ANIMACIÓN PRINCIPAL
═══════════════════════════════════════════════════════════════ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta   = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  // ── Idle: rotación lenta del disco cuando no está girando ──
  if (!animState.spinning && roulette) {
    animState.currentAngle += animState.idleRotSpeed;
    roulette.group.rotation.y = animState.currentAngle;
  }

  // ── Animación de la bola ────────────────────────────────
  if (roulette) {
    // La bola orbita en sentido contrario a la ruleta
    animState.ballAngle -= animState.ballSpeed;

    const BALL_ORBIT = roulette.BALL_ORBIT;
    const THICKNESS  = roulette.THICKNESS;

    // Altura de la bola: oscila levemente (efecto rebote físico simple)
    const ballHeight = animState.spinning
      ? THICKNESS / 2 + 0.25 + Math.abs(Math.sin(elapsed * 12)) * 0.08
      : THICKNESS / 2 + 0.22;

    roulette.ballMesh.position.set(
      BALL_ORBIT * Math.sin(animState.ballAngle),
      ballHeight,
      BALL_ORBIT * Math.cos(animState.ballAngle)
    );

    // Rotación propia de la bola (rueda sobre sí misma)
    roulette.ballMesh.rotation.z += animState.ballSpeed * 3;
  }

  // ── Luces pulsantes ─────────────────────────────────────
  underLight.intensity = 1.2 + Math.sin(elapsed * 1.8) * 0.4;

  // ── Estrellas ───────────────────────────────────────────
  stars.rotation.y += delta * 0.006;

  controls.update();
  renderer.render(scene, camera);
}

/* ═══════════════════════════════════════════════════════════════
   RESIZE
═══════════════════════════════════════════════════════════════ */
function onResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
window.addEventListener('resize', onResize);

/* ═══════════════════════════════════════════════════════════════
   INICIALIZACIÓN
═══════════════════════════════════════════════════════════════ */
loadItems();
rebuildRoulette();
animate();
