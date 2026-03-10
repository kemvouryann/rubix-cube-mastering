import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";

  const moveButtons = document.querySelectorAll("[data-move]");
  const canvas = document.querySelector("#scene");
  const scrambleBtn = document.querySelector("#scramble-btn");
  const resetBtn = document.querySelector("#reset-btn");

  const rotateUpBtn = document.querySelector("#rotate-up");
  const rotateDownBtn = document.querySelector("#rotate-down");
  const rotateLeftBtn = document.querySelector("#rotate-left");
  const rotateRightBtn = document.querySelector("#rotate-right");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 8;

  const camera = new THREE.OrthographicCamera(
    (-frustumSize * aspect) / 2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    100
  );
  camera.position.set(2.8, 0, 8);
  camera.lookAt(-1.8, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.mouseButtons.LEFT = null;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.minDistance = 6;
  controls.maxDistance = 24;
  controls.target.set(-1.8, 0, 0);
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 1.9));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
  keyLight.position.set(8, 12, 10);
  scene.add(keyLight);

  const cubeGroup = new THREE.Group();
  scene.add(cubeGroup);

  const cubies = [];
  const stickerMeshes = [];
  const spacing = 1.0;
  const stickerOffset = 0.5;

  const colors = {
    U: 0xffffff,
    D: 0xfacc15,
    F: 0x22c55e,
    B: 0x2563eb,
    R: 0xef4444,
    L: 0xf97316,
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function roundedCoord(value) {
    return Math.round(value / spacing);
  }

  function createGanTexture(colorHex) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = `#${colorHex.toString(16).padStart(6, "0")}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = 128;
    const centerY = 128;
    const radius = 72;
    const count = 8;

    ctx.font = "bold 24px Arial";

    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      ctx.fillText("GAN", x, y);
    }

    ctx.font = "bold 88px Arial";
    ctx.fillText("GAN", centerX, centerY);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  function makeSticker(face, color, position, rotation, meta) {
    const geometry = new THREE.PlaneGeometry(0.86, 0.86);

    const materialConfig = {
      color,
      roughness: 0.16,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    };

    if (face === "F" && meta.row === 1 && meta.col === 1) {
      materialConfig.map = createGanTexture(color);
    }

    const material = new THREE.MeshPhysicalMaterial(materialConfig);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    mesh.userData.face = face;
    mesh.userData.row = meta.row;
    mesh.userData.col = meta.col;
    stickerMeshes.push(mesh);
    return mesh;
  }

  function stickerGrid(face, x, y, z) {
    if (face === "F") return { row: 1 - y, col: x + 1 };
    if (face === "B") return { row: 1 - y, col: 1 - x };
    if (face === "U") return { row: z + 1, col: x + 1 };
    if (face === "D") return { row: 1 - z, col: x + 1 };
    if (face === "R") return { row: 1 - y, col: 1 - z };
    if (face === "L") return { row: 1 - y, col: z + 1 };
    return { row: 1, col: 1 };
  }

  function createCubie(x, y, z) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.96, 0.96),
      new THREE.MeshPhysicalMaterial({
        color: 0x141414,
        roughness: 0.28,
        metalness: 0.03,
        clearcoat: 0.22,
        clearcoatRoughness: 0.12,
      })
    );
    group.add(body);

    if (y === 1) {
      group.add(
        makeSticker(
          "U",
          colors.U,
          new THREE.Vector3(0, stickerOffset, 0),
          new THREE.Euler(-Math.PI / 2, 0, 0),
          stickerGrid("U", x, y, z)
        )
      );
    }

    if (y === -1) {
      group.add(
        makeSticker(
          "D",
          colors.D,
          new THREE.Vector3(0, -stickerOffset, 0),
          new THREE.Euler(Math.PI / 2, 0, 0),
          stickerGrid("D", x, y, z)
        )
      );
    }

    if (z === 1) {
      group.add(
        makeSticker(
          "F",
          colors.F,
          new THREE.Vector3(0, 0, stickerOffset),
          new THREE.Euler(0, 0, 0),
          stickerGrid("F", x, y, z)
        )
      );
    }

    if (z === -1) {
      group.add(
        makeSticker(
          "B",
          colors.B,
          new THREE.Vector3(0, 0, -stickerOffset),
          new THREE.Euler(0, Math.PI, 0),
          stickerGrid("B", x, y, z)
        )
      );
    }

    if (x === 1) {
      group.add(
        makeSticker(
          "R",
          colors.R,
          new THREE.Vector3(stickerOffset, 0, 0),
          new THREE.Euler(0, Math.PI / 2, 0),
          stickerGrid("R", x, y, z)
        )
      );
    }

    if (x === -1) {
      group.add(
        makeSticker(
          "L",
          colors.L,
          new THREE.Vector3(-stickerOffset, 0, 0),
          new THREE.Euler(0, -Math.PI / 2, 0),
          stickerGrid("L", x, y, z)
        )
      );
    }

    group.position.set(x * spacing, y * spacing, z * spacing);
    cubeGroup.add(group);
    cubies.push(group);
  }

  function buildCube() {
    cubies.length = 0;
    stickerMeshes.length = 0;
    cubeGroup.clear();

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          createCubie(x, y, z);
        }
      }
    }
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
    if (move[0] === "U") return cubies.filter((c) => roundedCoord(c.position.y) === 1);
    if (move[0] === "D") return cubies.filter((c) => roundedCoord(c.position.y) === -1);
    if (move[0] === "R") return cubies.filter((c) => roundedCoord(c.position.x) === 1);
    if (move[0] === "L") return cubies.filter((c) => roundedCoord(c.position.x) === -1);
    if (move[0] === "F") return cubies.filter((c) => roundedCoord(c.position.z) === 1);
    if (move[0] === "B") return cubies.filter((c) => roundedCoord(c.position.z) === -1);
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

  let turning = false;
  const queue = [];

  function enqueueMove(move) {
    queue.push(move);
  }

  function performNextMove() {
    if (turning || queue.length === 0) return;

    turning = true;
    const move = queue.shift();
    const selected = cubiesForMove(move);
    const axis = axisForMove(move);
    const angle = angleForMove(move);

    const pivot = new THREE.Group();
    scene.add(pivot);
    selected.forEach((cubie) => pivot.attach(cubie));

    const duration = 180;
    const start = performance.now();

    function animate(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      pivot.setRotationFromAxisAngle(axis, angle * eased);

      if (t < 1) {
        requestAnimationFrame(animate);
        return;
      }

      while (pivot.children.length) {
        const cubie = pivot.children[0];
        cubeGroup.attach(cubie);
        snapCubie(cubie);
      }

      scene.remove(pivot);
      turning = false;
      performNextMove();
    }

    requestAnimationFrame(animate);
  }

  function scrambleCube() {
    const moves = ["U", "U'", "R", "R'", "F", "F'", "L", "L'", "D", "D'", "B", "B'"];
    for (let i = 0; i < 20; i += 1) {
      enqueueMove(moves[Math.floor(Math.random() * moves.length)]);
    }
    performNextMove();
  }

  function resetCube() {
    queue.length = 0;
    turning = false;
    buildCube();
  }

  function setPointer(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickSticker(clientX, clientY) {
    setPointer(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(stickerMeshes, false);
    return hits[0] || null;
  }

  function moveFromSticker(face, row, col, dx, dy) {
    const horizontal = Math.abs(dx) >= Math.abs(dy);

    if (face === "F") {
      if (horizontal) {
        if (row === 0) return dx > 0 ? "U" : "U'";
        if (row === 1) return dx > 0 ? "F" : "F'";
        return dx > 0 ? "D'" : "D";
      }
      if (col === 0) return dy > 0 ? "L'" : "L";
      if (col === 1) return dy > 0 ? "F" : "F'";
      return dy > 0 ? "R" : "R'";
    }

    if (face === "U") {
      if (horizontal) {
        if (row === 0) return dx > 0 ? "B'" : "B";
        if (row === 1) return dx > 0 ? "U" : "U'";
        return dx > 0 ? "F" : "F'";
      }
      if (col === 0) return dy > 0 ? "L'" : "L";
      if (col === 1) return dy > 0 ? "U" : "U'";
      return dy > 0 ? "R" : "R'";
    }

    if (face === "R") {
      if (!horizontal) {
        if (col === 0) return dy > 0 ? "F" : "F'";
        if (col === 1) return dy > 0 ? "R" : "R'";
        return dy > 0 ? "B'" : "B";
      }
      if (row === 0) return dx > 0 ? "U" : "U'";
      if (row === 1) return dx > 0 ? "R" : "R'";
      return dx > 0 ? "D'" : "D";
    }

    return null;
  }

  let draggingFace = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let turnedThisDrag = false;

  renderer.domElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  renderer.domElement.addEventListener("pointerdown", (event) => {
    if (turning) return;
    if (event.button === 2) return;

    dragStartX = event.clientX;
    dragStartY = event.clientY;
    turnedThisDrag = false;

    const hit = pickSticker(event.clientX, event.clientY);
    draggingFace = hit ? hit.object.userData : null;
  });

  window.addEventListener("pointermove", (event) => {
    if (!draggingFace || turnedThisDrag || turning) return;

    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;

    if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;

    const move = moveFromSticker(
      draggingFace.face,
      draggingFace.row,
      draggingFace.col,
      dx,
      dy
    );

    if (move) {
      enqueueMove(move);
      performNextMove();
      turnedThisDrag = true;
    }
  });

  window.addEventListener("pointerup", () => {
    draggingFace = null;
    turnedThisDrag = false;
  });

  scrambleBtn.addEventListener("click", scrambleCube);
  resetBtn.addEventListener("click", resetCube);

  moveButtons.forEach((button) => {
    button.addEventListener("click", () => {
      enqueueMove(button.dataset.move);
      performNextMove();
    });
  });

  function rotateView(dx, dy) {
    camera.position.x += dx;
    camera.position.y += dy;
    camera.lookAt(-1.8, 0, 0);
    controls.target.set(-1.8, 0, 0);
    controls.update();
  }

  rotateLeftBtn.addEventListener("click", () => rotateView(-0.4, 0));
  rotateRightBtn.addEventListener("click", () => rotateView(0.4, 0));
  rotateUpBtn.addEventListener("click", () => rotateView(0, 0.4));
  rotateDownBtn.addEventListener("click", () => rotateView(0, -0.4));

  window.addEventListener("resize", () => {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 8;

    camera.left = (-frustumSize * aspect) / 2;
    camera.right = (frustumSize * aspect) / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  buildCube();

  function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  tick();
