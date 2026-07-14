// MergeUp -- classic 2048-style tile merge. Difficulty scales naturally with
// the genre: the grid fills up and options narrow as your score climbs.

const SIZE = 4;
const STORAGE_KEY = "mergeup.best";
function loadBest() { return parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10); }
function saveBest(v) { localStorage.setItem(STORAGE_KEY, String(v)); }

let grid, score, best = loadBest(), over = false, won = false;

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function emptyCells(g) {
  const cells = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (g[r][c] === 0) cells.push([r, c]);
  return cells;
}

function spawnTile(g) {
  const cells = emptyCells(g);
  if (!cells.length) return;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  g[r][c] = Math.random() < 0.9 ? 2 : 4;
}

// Slides one row left, compacting and merging each equal pair exactly once.
function slideRowLeft(row) {
  const filtered = row.filter(v => v !== 0);
  const merged = [];
  let gained = 0;
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const v = filtered[i] * 2;
      merged.push(v);
      gained += v;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i += 1;
    }
  }
  while (merged.length < row.length) merged.push(0);
  return { row: merged, gained };
}

function transpose(g) {
  return g[0].map((_, c) => g.map(row => row[c]));
}

function move(direction) {
  if (over) return false;
  let working = grid.map(r => r.slice());
  let gained = 0;
  const applyLeft = (g) => {
    const out = [];
    for (const row of g) {
      const { row: newRow, gained: g2 } = slideRowLeft(row);
      out.push(newRow);
      gained += g2;
    }
    return out;
  };

  if (direction === "left") {
    working = applyLeft(working);
  } else if (direction === "right") {
    working = applyLeft(working.map(r => r.slice().reverse())).map(r => r.reverse());
  } else if (direction === "up") {
    working = transpose(applyLeft(transpose(working)));
  } else if (direction === "down") {
    working = transpose(applyLeft(transpose(working).map(r => r.slice().reverse())).map(r => r.reverse()));
  }

  const changed = JSON.stringify(working) !== JSON.stringify(grid);
  if (changed) {
    grid = working;
    score += gained;
    if (score > best) { best = score; saveBest(best); }
    if (grid.some(row => row.some(v => v === 2048)) && !won) won = true;
    spawnTile(grid);
    if (!hasMovesLeft(grid)) over = true;
  }
  return changed;
}

function hasMovesLeft(g) {
  if (emptyCells(g).length > 0) return true;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = g[r][c];
      if (c + 1 < SIZE && g[r][c + 1] === v) return true;
      if (r + 1 < SIZE && g[r + 1][c] === v) return true;
    }
  }
  return false;
}

function newGame() {
  grid = emptyGrid();
  score = 0;
  over = false;
  won = false;
  spawnTile(grid);
  spawnTile(grid);
  render();
}

const app = document.getElementById("app");
function render() {
  let html = `
    <div class="eyebrow">MergeUp</div>
    <h1>MergeUp</h1>
    <div class="sub">Swipe or use arrow keys. Merge matching tiles. Reach 2048.</div>
    <div class="stat-row">
      <div class="stat"><div class="num">${score}</div><div class="label">Score</div></div>
      <div class="stat"><div class="num">${best}</div><div class="label">Best</div></div>
    </div>
    <div class="grid">
  `;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      html += `<div class="cell" data-v="${v}">${v || ""}</div>`;
    }
  }
  html += `</div>`;
  if (over || won) {
    html += `<div class="overlay"><div>${won && !over ? "You reached 2048!" : "Game Over"}</div>
      <button class="btn" id="retryBtn">${won && !over ? "Keep going / New game" : "New game"}</button></div>`;
  } else {
    html += `<div class="hint">Arrow keys or swipe to play.</div>`;
  }
  app.innerHTML = html;
  const retry = document.getElementById("retryBtn");
  if (retry) retry.addEventListener("click", () => { if (won && !over) { won = false; render(); } else newGame(); });
}

document.addEventListener("keydown", (e) => {
  const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  if (map[e.key]) { e.preventDefault(); move(map[e.key]); render(); }
});

let touchStart = null;
document.addEventListener("touchstart", (e) => { touchStart = e.touches[0]; }, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.clientX;
  const dy = e.changedTouches[0].clientY - touchStart.clientY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  move(dir);
  render();
  touchStart = null;
}, { passive: true });

newGame();

(function selfCheck() {
  const check = (cond, msg) => { if (!cond) console.error("MergeUp self-check FAILED:", msg); };
  check(JSON.stringify(slideRowLeft([2, 2, 2, 2]).row) === JSON.stringify([4, 4, 0, 0]), "double pair merge");
  check(JSON.stringify(slideRowLeft([2, 0, 2, 4]).row) === JSON.stringify([4, 4, 0, 0]), "compact then merge");
  check(JSON.stringify(slideRowLeft([4, 4, 4, 4]).row) === JSON.stringify([8, 8, 0, 0]), "no triple-merge");
  check(slideRowLeft([2, 2, 2, 2]).gained === 8, "score gained matches merges (4+4)");
  check(!hasMovesLeft([[2,4,2,4],[4,2,4,2],[2,4,2,4],[4,2,4,2]]), "full checkerboard has no moves");
  check(hasMovesLeft([[2,2,2,2],[4,4,4,4],[2,2,2,2],[4,4,4,4]]), "adjacent equal pairs still have a move");
  console.log("MergeUp self-check passed.");
})();
