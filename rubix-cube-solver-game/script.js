import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.querySelector("#scene");
const filledCountEl = document.querySelector("#filled-count");
const entryStatusEl = document.querySelector("#entry-status");
const countsListEl = document.querySelector("#counts-list");
const cubeEditorEl = document.querySelector("#cube-editor");
const paletteEl = document.querySelector("#palette");
const solveBtn = document.querySelector("#solve-btn");
const clearBtn = document.querySelector("#clear-btn");
const rotateUpBtn = document.querySelector("#rotate-up");
const rotateDownBtn = document.querySelector("#rotate-down");
const rotateLeftBtn = document.querySelector("#rotate-left");
const rotateRightBtn = document.querySelector("#rotate-right");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08101d);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(4.5, 4.2, 6.2);
const cameraTarget = new THREE.Vector3(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = false;
controls.enableRotate = false;
controls.target.copy(cameraTarget);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(5, 8, 6);
scene.add(keyLight);

const fillLight = new THREE.PointLight(0x60a5fa, 10, 30, 2);
fillLight.position.set(-5, 3, -4);
scene.add(fillLight);

const cubeGroup = new THREE.Group();
scene.add(cubeGroup);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(3.6, 64),
  new THREE.MeshBasicMaterial({
    color: 0x5eead4,
    transparent: true,
    opacity: 0.08,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.4;
scene.add(floor);

const paletteMap = {
  U: 0xffffff,
  D: 0xfacc15,
  F: 0x22c55e,
  B: 0x2563eb,
  R: 0xef4444,
  L: 0xf97316,
  EMPTY: 0x334155,
};

const faceOrder = ["U", "R", "F", "D", "L", "B"];
const faceNames = {
  U: "Up",
  R: "Right",
  F: "Front",
  D: "Down",
  L: "Left",
  B: "Back",
};
const colorNames = {
  U: "White",
  D: "Yellow",
  F: "Green",
  B: "Blue",
  R: "Red",
  L: "Orange",
};

const cubies = [];
const stickerMeshes = [];
const spacing = 0.98;
const stickerOffset = 0.5;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const moveQueue = [];
const moveDurationMs = 2000;
const demoSolveSequence = ["R", "U", "R'", "U'", "F", "R", "U", "R'", "U'", "F'"];

let selectedColor = "U";
let cubeState = createBlankCubeState();
let turnInProgress = false;

function createBlankCubeState() {
  const state = {};

  faceOrder.forEach((face) => {
    state[face] = Array(9).fill("EMPTY");
    state[face][4] = face;
  });

  return state;
}

function makeSticker(colorKey, position, rotation) {
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.82),
    new THREE.MeshStandardMaterial({
      color: paletteMap[colorKey] ?? paletteMap.EMPTY,
      roughness: 0.2,
      metalness: 0.02,
    })
  );
  sticker.position.copy(position);
  sticker.rotation.set(rotation.x, rotation.y, rotation.z);
  return sticker;
}

function stickerIndex(face, x, y, z) {
  if (face === "F") return (1 - y) * 3 + (x + 1);
  if (face === "B") return (1 - y) * 3 + (1 - x);
  if (face === "U") return (z + 1) * 3 + (x + 1);
  if (face === "D") return (1 - z) * 3 + (x + 1);
  if (face === "R") return (1 - y) * 3 + (1 - z);
  if (face === "L") return (1 - y) * 3 + (z + 1);
  return 4;
}

function createCubie(x, y, z) {
  const cubie = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.96, 0.96, 0.96),
    new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.45,
      metalness: 0.08,
    })
  );
  cubie.add(body);

  if (y === 1) {
    const index = stickerIndex("U", x, y, z);
    const sticker = makeSticker(
      cubeState.U[index],
      new THREE.Vector3(0, stickerOffset, 0),
      new THREE.Euler(-Math.PI / 2, 0, 0)
    );
    sticker.userData.face = "U";
    sticker.userData.index = index;
    cubie.add(sticker);
    stickerMeshes.push(sticker);
  }
  if (y === -1) {
    const index = stickerIndex("D", x, y, z);
    const sticker = makeSticker(
      cubeState.D[index],
      new THREE.Vector3(0, -stickerOffset, 0),
      new THREE.Euler(Math.PI / 2, 0, 0)
    );
    sticker.userData.face = "D";
    sticker.userData.index = index;
    cubie.add(sticker);
    stickerMeshes.push(sticker);
  }
  if (z === 1) {
    const index = stickerIndex("F", x, y, z);
    const sticker = makeSticker(
      cubeState.F[index],
      new THREE.Vector3(0, 0, stickerOffset),
      new THREE.Euler(0, 0, 0)
    );
    sticker.userData.face = "F";
    sticker.userData.index = index;
    cubie.add(sticker);
    stickerMeshes.push(sticker);
  }
  if (z === -1) {
    const index = stickerIndex("B", x, y, z);
    const sticker = makeSticker(
      cubeState.B[index],
      new THREE.Vector3(0, 0, -stickerOffset),
      new THREE.Euler(0, Math.PI, 0)
    );
    sticker.userData.face = "B";
    sticker.userData.index = index;
    cubie.add(sticker);
    stickerMeshes.push(sticker);
  }
  if (x === 1) {
    const index = stickerIndex("R", x, y, z);
    const sticker = makeSticker(
      cubeState.R[index],
      new THREE.Vector3(stickerOffset, 0, 0),
      new THREE.Euler(0, Math.PI / 2, 0)
    );
    sticker.userData.face = "R";
    sticker.userData.index = index;
    cubie.add(sticker);
    stickerMeshes.push(sticker);
  }
  if (x === -1) {
    const index = stickerIndex("L", x, y, z);
    const sticker = makeSticker(
      cubeState.L[index],
      new THREE.Vector3(-stickerOffset, 0, 0),
      new THREE.Euler(0, -Math.PI / 2, 0)
    );
    sticker.userData.face = "L";
    sticker.userData.index = index;
    cubie.add(sticker);
    stickerMeshes.push(sticker);
  }

  cubie.position.set(x * spacing, y * spacing, z * spacing);
  cubeGroup.add(cubie);
  cubies.push(cubie);
}

function buildCube() {
  cubeGroup.clear();
  cubies.length = 0;
  stickerMeshes.length = 0;

  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        createCubie(x, y, z);
      }
    }
  }
}

function applyColorToSticker(face, index) {
  if (turnInProgress) return;
  if (!face || index === undefined) return;
  if (Number(index) === 4) return;
  cubeState[face][Number(index)] = selectedColor;
  renderEditor();
  buildCube();
  validateCubeEntry();
}

function renderEditor() {
  cubeEditorEl.innerHTML = "";

  faceOrder.forEach((face) => {
    const faceWrap = document.createElement("div");
    faceWrap.className = "face-editor";

    const label = document.createElement("div");
    label.className = "face-label";
    label.textContent = face;
    label.title = faceNames[face];

    const grid = document.createElement("div");
    grid.className = "face-grid";

    cubeState[face].forEach((colorKey, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sticker-button";
      button.dataset.face = face;
      button.dataset.index = String(index);
      button.dataset.color = colorKey;

      if (index === 4) {
        button.classList.add("center-sticker");
        button.disabled = true;
      }

      grid.append(button);
    });

    faceWrap.append(label, grid);
    cubeEditorEl.append(faceWrap);
  });
}

function getCounts() {
  const counts = { U: 0, D: 0, F: 0, B: 0, R: 0, L: 0 };
  let filled = 0;

  faceOrder.forEach((face) => {
    cubeState[face].forEach((colorKey) => {
      if (colorKey !== "EMPTY") filled += 1;
      if (colorKey in counts) counts[colorKey] += 1;
    });
  });

  return { counts, filled };
}

function renderCounts(counts) {
  countsListEl.innerHTML = "";

  faceOrder.forEach((face) => {
    const pill = document.createElement("div");
    pill.className = "count-pill";

    const name = document.createElement("div");
    name.className = "count-name";

    const swatch = document.createElement("span");
    swatch.className = "count-swatch";
    swatch.style.background = `#${paletteMap[face].toString(16).padStart(6, "0")}`;

    const label = document.createElement("span");
    label.textContent = colorNames[face];

    const value = document.createElement("strong");
    value.textContent = `${counts[face]}/9`;

    name.append(swatch, label);
    pill.append(name, value);
    countsListEl.append(pill);
  });
}

function validateCubeEntry() {
  const { counts, filled } = getCounts();
  const complete = filled === 54;
  const balanced = Object.values(counts).every((count) => count === 9);

  filledCountEl.textContent = `${filled} / 54`;
  renderCounts(counts);

  if (turnInProgress) {
    solveBtn.disabled = true;
    return;
  }

  if (!complete) {
    entryStatusEl.textContent = "Pick colors for every sticker.";
    solveBtn.disabled = true;
    return;
  }

  if (!balanced) {
    entryStatusEl.textContent = "Each color must appear exactly 9 times.";
    solveBtn.disabled = true;
    return;
  }

  entryStatusEl.textContent = "Cube entry complete. Ready to show solve.";
  solveBtn.disabled = false;
}

function setSelectedColor(colorKey) {
  selectedColor = colorKey;
  paletteEl.querySelectorAll(".color-chip").forEach((chip) => {
    chip.classList.toggle("selected", chip.dataset.color === colorKey);
  });
}

function handleEditorClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("sticker-button")) return;

  const { face, index } = target.dataset;
  if (!face || index === undefined) return;
  applyColorToSticker(face, Number(index));
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function rotateView(dx, dy) {
  if (turnInProgress) return;
  camera.position.x += dx;
  camera.position.y += dy;
  camera.lookAt(cameraTarget);
  controls.target.copy(cameraTarget);
  controls.update();
}

function handleSceneClick(event) {
  if (turnInProgress) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(stickerMeshes, false)[0];
  if (!hit) return;

  const { face, index } = hit.object.userData;
  applyColorToSticker(face, index);
}

function roundedCoord(value) {
  return Math.round(value / spacing);
}

function snapCubie(cubie) {
  cubie.position.set(
    roundedCoord(cubie.position.x) * spacing,
    roundedCoord(cubie.position.y) * spacing,
    roundedCoord(cubie.position.z) * spacing
  );

  const euler = new THREE.Euler().setFromQuaternion(cubie.quaternion, "XYZ");
  const step = Math.PI / 2;
  cubie.rotation.set(
    Math.round(euler.x / step) * step,
    Math.round(euler.y / step) * step,
    Math.round(euler.z / step) * step
  );
}

function cubiesForMove(move) {
  if (move[0] === "U") return cubies.filter((cubie) => roundedCoord(cubie.position.y) === 1);
  if (move[0] === "D") return cubies.filter((cubie) => roundedCoord(cubie.position.y) === -1);
  if (move[0] === "R") return cubies.filter((cubie) => roundedCoord(cubie.position.x) === 1);
  if (move[0] === "L") return cubies.filter((cubie) => roundedCoord(cubie.position.x) === -1);
  if (move[0] === "F") return cubies.filter((cubie) => roundedCoord(cubie.position.z) === 1);
  if (move[0] === "B") return cubies.filter((cubie) => roundedCoord(cubie.position.z) === -1);
  return [];
}

function axisForMove(move) {
  if (move[0] === "U" || move[0] === "D") return new THREE.Vector3(0, 1, 0);
  if (move[0] === "R" || move[0] === "L") return new THREE.Vector3(1, 0, 0);
  return new THREE.Vector3(0, 0, 1);
}

function angleForMove(move) {
  const prime = move.endsWith("'");
  const base = move[0];
  const map = {
    U: prime ? -1 : 1,
    D: prime ? 1 : -1,
    R: prime ? -1 : 1,
    L: prime ? 1 : -1,
    F: prime ? -1 : 1,
    B: prime ? 1 : -1,
  };
  return map[base] * (Math.PI / 2);
}

function performNextMove() {
  if (turnInProgress || moveQueue.length === 0) {
    if (!turnInProgress && moveQueue.length === 0) {
      entryStatusEl.textContent = "Solve playback complete.";
      validateCubeEntry();
    }
    return;
  }

  turnInProgress = true;
  validateCubeEntry();
  const move = moveQueue.shift();
  entryStatusEl.textContent = `Showing move: ${move}`;

  const selected = cubiesForMove(move);
  const axis = axisForMove(move);
  const angle = angleForMove(move);

  const pivot = new THREE.Group();
  scene.add(pivot);
  selected.forEach((cubie) => pivot.attach(cubie));

  const start = performance.now();

  function animateTurn(now) {
    const t = Math.min((now - start) / moveDurationMs, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    pivot.setRotationFromAxisAngle(axis, angle * eased);

    if (t < 1) {
      requestAnimationFrame(animateTurn);
      return;
    }

    while (pivot.children.length) {
      const cubie = pivot.children[0];
      cubeGroup.attach(cubie);
      snapCubie(cubie);
    }

    scene.remove(pivot);
    turnInProgress = false;
    performNextMove();
  }

  requestAnimationFrame(animateTurn);
}

function showSolvePlayback() {
  if (solveBtn.disabled || turnInProgress) return;
  moveQueue.length = 0;
  demoSolveSequence.forEach((move) => moveQueue.push(move));
  performNextMove();
}

function clearCube() {
  if (turnInProgress) return;
  moveQueue.length = 0;
  cubeState = createBlankCubeState();
  renderEditor();
  buildCube();
  validateCubeEntry();
}

paletteEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains("color-chip")) return;
  const colorKey = target.dataset.color;
  if (!colorKey) return;
  setSelectedColor(colorKey);
});

cubeEditorEl.addEventListener("click", handleEditorClick);
canvas.addEventListener("click", handleSceneClick);
solveBtn.addEventListener("click", showSolvePlayback);
clearBtn.addEventListener("click", clearCube);
rotateLeftBtn.addEventListener("click", () => rotateView(-0.5, 0));
rotateRightBtn.addEventListener("click", () => rotateView(0.5, 0));
rotateUpBtn.addEventListener("click", () => rotateView(0, 0.5));
rotateDownBtn.addEventListener("click", () => rotateView(0, -0.5));
window.addEventListener("resize", resize);

setSelectedColor(selectedColor);
renderEditor();
buildCube();
validateCubeEntry();
resize();

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
