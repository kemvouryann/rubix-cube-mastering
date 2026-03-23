const BOARD_SIZE = 8;
const TRAY_SIZE = 3;

const SHAPES = [
  { name: "Dot", cells: [[0, 0]] },
  { name: "Line 2", cells: [[0, 0], [1, 0]] },
  { name: "Line 3", cells: [[0, 0], [1, 0], [2, 0]] },
  { name: "Line 4", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: "Tall 3", cells: [[0, 0], [0, 1], [0, 2]] },
  { name: "Tall 4", cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { name: "Square", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { name: "Big Square", cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
  { name: "L", cells: [[0, 0], [0, 1], [1, 1]] },
  { name: "Big L", cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  { name: "Corner", cells: [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]] },
  { name: "T", cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  { name: "Wide T", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1]] },
  { name: "Z", cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { name: "Stair", cells: [[0, 1], [1, 1], [1, 0], [2, 0]] }
];

const boardElement = document.getElementById("board");
const piecesElement = document.getElementById("pieces");
const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("best-score");
const comboElement = document.getElementById("combo");
const selectedPieceElement = document.getElementById("selected-piece");
const messageElement = document.getElementById("message");
const restartButton = document.getElementById("restart-btn");
const celebrationElement = document.getElementById("celebration");
const dragGhostElement = document.getElementById("drag-ghost");

let board = [];
let tray = [];
let selectedPieceId = null;
let score = 0;
let bestScore = Number(localStorage.getItem("tile-blast-best-score") || 0);
let combo = 1;
let gameOver = false;
let dragState = null;
let celebrationTimer = null;
let audioContext = null;
let hoveredCell = null;
let lastPlacedCells = [];

function makeBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function cloneCells(cells) {
  return cells.map(([x, y]) => [x, y]);
}

function makePiece() {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return {
    id: `${Date.now()}-${Math.random()}-${shape.name}`,
    name: shape.name,
    cells: cloneCells(shape.cells),
    used: false
  };
}

function refillTray() {
  tray = Array.from({ length: TRAY_SIZE }, () => makePiece());
  selectedPieceId = null;
}

function getSelectedPiece() {
  return tray.find((piece) => piece.id === selectedPieceId && !piece.used) || null;
}

function canPlace(piece, originX, originY) {
  return piece.cells.every(([dx, dy]) => {
    const x = originX + dx;
    const y = originY + dy;
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && board[y][x] === 0;
  });
}

function previewCells(piece, originX, originY) {
  if (!piece || !canPlace(piece, originX, originY)) {
    return [];
  }
  return piece.cells.map(([dx, dy]) => [originX + dx, originY + dy]);
}

function updateScore() {
  scoreElement.textContent = String(score);
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("tile-blast-best-score", String(bestScore));
  }
  bestScoreElement.textContent = String(bestScore);
  comboElement.textContent = `x${combo}`;
}

function setMessage(text) {
  messageElement.textContent = text;
}

function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  }

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(frequency, duration, type, volume, delay = 0) {
  if (!audioContext) {
    return;
  }

  const startAt = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.04);
}

function playPlaceSound() {
  ensureAudioContext();
  playTone(320, 0.14, "triangle", 0.03);
  playTone(420, 0.16, "triangle", 0.025, 0.03);
}

function playBlockedSound() {
  ensureAudioContext();
  playTone(180, 0.12, "sawtooth", 0.02);
}

function playLineClearSound(lineCount) {
  ensureAudioContext();
  playTone(520, 0.15, "triangle", 0.03);
  playTone(680, 0.18, "triangle", 0.035, 0.06);
  playTone(860, 0.22, "triangle", 0.04, 0.14);
  if (lineCount > 1) {
    playTone(1040, 0.26, "sine", 0.045, 0.24);
  }
}

function showCelebration(text) {
  celebrationElement.textContent = text;
  celebrationElement.classList.remove("show");
  void celebrationElement.offsetWidth;
  celebrationElement.classList.add("show");

  if (celebrationTimer) {
    clearTimeout(celebrationTimer);
  }

  celebrationTimer = setTimeout(() => {
    celebrationElement.classList.remove("show");
  }, 1200);
}

function clearLines() {
  const rows = [];
  const cols = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    if (board[y].every((value) => value === 1)) {
      rows.push(y);
    }
  }

  for (let x = 0; x < BOARD_SIZE; x += 1) {
    let full = true;
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      if (board[y][x] === 0) {
        full = false;
        break;
      }
    }
    if (full) {
      cols.push(x);
    }
  }

  rows.forEach((row) => {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      board[row][x] = 0;
    }
  });

  cols.forEach((col) => {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      board[y][col] = 0;
    }
  });

  const totalCleared = rows.length + cols.length;
  if (totalCleared > 0) {
    combo += 1;
    score += totalCleared * 10 * combo;
    setMessage(`Cleared ${totalCleared} line${totalCleared === 1 ? "" : "s"} with a x${combo} combo.`);
    playLineClearSound(totalCleared);
    showCelebration(totalCleared >= 2 ? "PUFECT!" : "NICE!");
  } else {
    combo = 1;
  }

  return totalCleared;
}

function placePiece(x, y) {
  const piece = getSelectedPiece();
  if (!piece || gameOver || !canPlace(piece, x, y)) {
    if (piece && !gameOver) {
      setMessage("That shape does not fit there.");
      playBlockedSound();
      render([[x, y]], true);
    }
    return;
  }

  piece.cells.forEach(([dx, dy]) => {
    board[y + dy][x + dx] = 1;
  });
  lastPlacedCells = piece.cells.map(([dx, dy]) => [x + dx, y + dy]);

  piece.used = true;
  selectedPieceId = null;
  score += piece.cells.length * 2;
  playPlaceSound();
  clearLines();

  if (tray.every((entry) => entry.used)) {
    refillTray();
    setMessage("Tray cleared. Three new pieces are ready.");
  } else {
    setMessage("Piece placed. Pick another piece.");
  }

  updateScore();
  render();
  checkGameOver();
}

function pieceSize(piece) {
  return {
    width: Math.max(...piece.cells.map(([x]) => x)) + 1,
    height: Math.max(...piece.cells.map(([, y]) => y)) + 1
  };
}

function renderBoard(preview = []) {
  const previewSet = new Set(preview.map(([x, y]) => `${x},${y}`));
  const placedSet = new Set(lastPlacedCells.map(([x, y]) => `${x},${y}`));
  boardElement.innerHTML = "";
  const selectedPiece = getSelectedPiece();
  const blockedSet = new Set();

  if (selectedPiece && preview.length === 1) {
    const [originX, originY] = preview[0];
    selectedPiece.cells.forEach(([dx, dy]) => {
      const x = originX + dx;
      const y = originY + dy;
      if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
        blockedSet.add(`${x},${y}`);
      }
    });
  }

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.x = String(x);
      button.dataset.y = String(y);

      if (board[y][x] === 1) {
        button.classList.add("filled");
      }

      if (placedSet.has(`${x},${y}`)) {
        button.classList.add("just-placed");
      }

      if (previewSet.has(`${x},${y}`)) {
        button.classList.add("preview");
      }

      if (blockedSet.has(`${x},${y}`) && !previewSet.has(`${x},${y}`)) {
        button.classList.add("blocked");
      }
      boardElement.appendChild(button);
    }
  }
}

function renderGhost(piece) {
  const size = pieceSize(piece);
  const active = new Set(piece.cells.map(([x, y]) => `${x},${y}`));

  dragGhostElement.innerHTML = "";
  dragGhostElement.classList.add("show");
  dragGhostElement.style.gridTemplateColumns = `repeat(${size.width}, 22px)`;
  dragGhostElement.style.gridTemplateRows = `repeat(${size.height}, 22px)`;

  for (let y = 0; y < size.height; y += 1) {
    for (let x = 0; x < size.width; x += 1) {
      const miniCell = document.createElement("div");
      miniCell.className = "mini-cell";
      if (active.has(`${x},${y}`)) {
        miniCell.classList.add("on");
      }
      dragGhostElement.appendChild(miniCell);
    }
  }
}

function hideGhost() {
  dragGhostElement.classList.remove("show");
  dragGhostElement.innerHTML = "";
}

function findBoardCell(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY);
  if (!target || !target.classList.contains("cell")) {
    return null;
  }

  return {
    x: Number(target.dataset.x),
    y: Number(target.dataset.y)
  };
}

function beginDrag(piece, event, pieceButton) {
  if (piece.used || gameOver) {
    return;
  }

  ensureAudioContext();
  selectedPieceId = piece.id;
  dragState = {
    pieceId: piece.id,
    sourceButton: pieceButton
  };
  pieceButton.classList.add("dragging");
  renderGhost(piece);
  moveDrag(event);
  setMessage(`Dragging ${piece.name}. Drop it on the board.`);
  render();
}

function moveDrag(event) {
  if (!dragState) {
    return;
  }

  dragGhostElement.style.transform = `translate(${event.clientX + 18}px, ${event.clientY + 18}px)`;
  const piece = getSelectedPiece();
  const cell = findBoardCell(event.clientX, event.clientY);

  if (!piece || !cell) {
    if (hoveredCell !== null) {
      hoveredCell = null;
    }
    render();
    return;
  }

  hoveredCell = { x: cell.x, y: cell.y };
  const validPreview = previewCells(piece, cell.x, cell.y);
  render(validPreview.length > 0 ? validPreview : [[cell.x, cell.y]], validPreview.length === 0);
}

function endDrag(event) {
  if (!dragState) {
    return;
  }

  const pieceButton = dragState.sourceButton;
  if (pieceButton) {
    pieceButton.classList.remove("dragging");
  }

  const hoveredCell = findBoardCell(event.clientX, event.clientY);
  const piece = getSelectedPiece();

  hideGhost();
  dragState = null;

  if (piece && hoveredCell) {
    placePiece(hoveredCell.x, hoveredCell.y);
  } else {
    setMessage(piece ? `Selected ${piece.name}. Click or drag it onto the board.` : "Choose a piece to start.");
    render();
  }
}

function renderPieces() {
  piecesElement.innerHTML = "";

  tray.forEach((piece) => {
    const pieceButton = document.createElement("button");
    pieceButton.type = "button";
    pieceButton.className = "piece";

    if (piece.id === selectedPieceId) {
      pieceButton.classList.add("selected");
    }

    if (piece.used) {
      pieceButton.classList.add("used");
      pieceButton.disabled = true;
    }

    pieceButton.addEventListener("click", () => {
      if (piece.used || gameOver) {
        return;
      }
      selectedPieceId = piece.id;
      setMessage(`Selected ${piece.name}. Click or drag it onto the board.`);
      render();
    });

    pieceButton.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || event.pointerType === "touch" || event.pointerType === "pen") {
        beginDrag(piece, event, pieceButton);
      }
    });

    const size = pieceSize(piece);
    const miniGrid = document.createElement("div");
    miniGrid.className = "mini-grid";
    miniGrid.style.gridTemplateColumns = `repeat(${size.width}, 20px)`;
    miniGrid.style.gridTemplateRows = `repeat(${size.height}, 20px)`;

    const active = new Set(piece.cells.map(([x, y]) => `${x},${y}`));
    for (let y = 0; y < size.height; y += 1) {
      for (let x = 0; x < size.width; x += 1) {
        const miniCell = document.createElement("div");
        miniCell.className = "mini-cell";
        if (active.has(`${x},${y}`)) {
          miniCell.classList.add("on");
        }
        miniGrid.appendChild(miniCell);
      }
    }

    pieceButton.appendChild(miniGrid);
    piecesElement.appendChild(pieceButton);
  });
}

function anyMovesLeft() {
  return tray.some((piece) => {
    if (piece.used) {
      return false;
    }

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (canPlace(piece, x, y)) {
          return true;
        }
      }
    }

    return false;
  });
}

function checkGameOver() {
  if (anyMovesLeft()) {
    gameOver = false;
    return;
  }

  gameOver = true;
  selectedPieceId = null;
  combo = 1;
  updateScore();
  setMessage("Game over. Press New Game to play again.");
  render();
}

function render(preview = [], invalid = false) {
  renderBoard(preview);
  renderPieces();
  const selectedPiece = getSelectedPiece();
  selectedPieceElement.textContent = selectedPiece ? selectedPiece.name : "None";
  if (!selectedPiece && !gameOver && !invalid && messageElement.textContent === "That shape does not fit there.") {
    setMessage("Choose a piece to continue.");
  }
}

function startGame() {
  board = makeBoard();
  tray = [];
  selectedPieceId = null;
  score = 0;
  combo = 1;
  gameOver = false;
  hoveredCell = null;
  lastPlacedCells = [];
  refillTray();
  updateScore();
  setMessage("Choose a piece to start.");
  hideGhost();
  render();
}

restartButton.addEventListener("click", startGame);
boardElement.addEventListener("pointermove", (event) => {
  const piece = getSelectedPiece();
  const cell = event.target.closest(".cell");

  if (!piece || !cell) {
    if (hoveredCell !== null) {
      hoveredCell = null;
      render();
    }
    return;
  }

  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  if (hoveredCell && hoveredCell.x === x && hoveredCell.y === y) {
    return;
  }

  hoveredCell = { x, y };
  const validPreview = previewCells(piece, x, y);
  render(validPreview.length > 0 ? validPreview : [[x, y]], validPreview.length === 0);
});
boardElement.addEventListener("pointerleave", () => {
  if (hoveredCell !== null) {
    hoveredCell = null;
    render();
  }
});
boardElement.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) {
    return;
  }

  placePiece(Number(cell.dataset.x), Number(cell.dataset.y));
});
window.addEventListener("pointermove", moveDrag);
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);

startGame();
