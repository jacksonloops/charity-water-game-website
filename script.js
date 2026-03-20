// ============================================================
//  Water Quest – Pipe Puzzle  |  charity: water theme
// ============================================================

const GRID_SIZE = 5;
const SOURCE = { r: 0, c: 0 };
const WELL   = { r: 4, c: 4 };

// Pipe types: [top, right, bottom, left] — 1 = open, 0 = closed
const PIPE_TYPES = {
  straight: [1, 0, 1, 0],
  elbow:    [0, 1, 1, 0],
  tee:      [1, 1, 1, 0],
};

// Level presets — null cells get random pipes assigned
const LEVELS = [
  {
    time: 60,
    preset: [
      [null,               null,               null,               null,               null              ],
      [null,               {t:'elbow',  r:1},  {t:'straight',r:0}, {t:'elbow',  r:0},  null              ],
      [{t:'straight',r:1}, {t:'tee',   r:2},  {t:'straight',r:0}, {t:'tee',   r:1},  {t:'straight',r:1}],
      [null,               {t:'elbow',  r:0},  {t:'straight',r:0}, {t:'elbow',  r:3},  null              ],
      [null,               null,               null,               null,               null              ],
    ]
  },
  {
    time: 50,
    preset: [
      [null,               {t:'elbow',  r:1},  {t:'straight',r:1}, {t:'elbow',  r:2},  null              ],
      [{t:'straight',r:0}, {t:'tee',   r:0},  {t:'tee',    r:2},  {t:'tee',   r:0},  {t:'straight',r:0}],
      [null,               {t:'straight',r:0},{t:'elbow',  r:2},  {t:'straight',r:0}, null              ],
      [{t:'elbow', r:1},   {t:'straight',r:1},{t:'tee',    r:3},  {t:'elbow',  r:3},  null              ],
      [null,               null,               {t:'straight',r:0}, null,               null              ],
    ]
  },
  {
    time: 45,
    preset: [
      [null,               {t:'straight',r:1},{t:'tee',    r:1},  {t:'straight',r:1}, null              ],
      [{t:'elbow', r:1},   {t:'tee',   r:0},  {t:'tee',    r:2},  {t:'tee',   r:1},  {t:'elbow',  r:2}],
      [{t:'straight',r:0},{t:'tee',   r:3},  {t:'elbow',  r:0},  {t:'tee',   r:1},  {t:'straight',r:0}],
      [{t:'elbow', r:0},   {t:'straight',r:1},{t:'tee',    r:3},  {t:'straight',r:1},{t:'elbow',   r:3}],
      [null,               null,               {t:'straight',r:0}, null,               null              ],
    ]
  }
];

let grid = [];
let gameActive = false;
let moves = 0;
let timerVal = 60;
let timerInterval = null;
let currentLevel = 0;

// ─── Rotation helpers ────────────────────────────────────────
function rotatePorts(ports, steps) {
  let p = [...ports];
  for (let i = 0; i < steps; i++) p = [p[3], p[0], p[1], p[2]];
  return p;
}

function getConnections(cell) {
  return rotatePorts(PIPE_TYPES[cell.type], cell.rotation);
}

// ─── SVG builders ────────────────────────────────────────────
function buildPipeSVG(cell, lit) {
  const [T, R, B, L] = getConnections(cell);
  const cx = 50, cy = 50;
  const half = 11;

  const pipeColor = lit ? '#1C1C1C' : '#999999';

  let paths = [];
  if (T) paths.push(`M${cx-half},${cy} L${cx-half},0 L${cx+half},0 L${cx+half},${cy} Z`);
  if (B) paths.push(`M${cx-half},${cy} L${cx-half},100 L${cx+half},100 L${cx+half},${cy} Z`);
  if (L) paths.push(`M${cx},${cy-half} L0,${cy-half} L0,${cy+half} L${cx},${cy+half} Z`);
  if (R) paths.push(`M${cx},${cy-half} L100,${cy-half} L100,${cy+half} L${cx},${cy+half} Z`);
  paths.push(`M${cx-half},${cy-half} h${half*2} v${half*2} h${-half*2} Z`);

  const d = paths.join(' ');

  let flowLines = '';
  if (lit) {
    const fc = '#FFC907';
    if (T) flowLines += `<line x1="${cx}" y1="0"  x2="${cx}" y2="${cy}" stroke="${fc}" stroke-width="5" stroke-opacity="0.7" class="pipe-water-flow"/>`;
    if (B) flowLines += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="100" stroke="${fc}" stroke-width="5" stroke-opacity="0.7" class="pipe-water-flow"/>`;
    if (L) flowLines += `<line x1="0"  y1="${cy}" x2="${cx}" y2="${cy}" stroke="${fc}" stroke-width="5" stroke-opacity="0.7" class="pipe-water-flow"/>`;
    if (R) flowLines += `<line x1="${cx}" y1="${cy}" x2="100" y2="${cy}" stroke="${fc}" stroke-width="5" stroke-opacity="0.7" class="pipe-water-flow"/>`;
  }

  const filterId = `glow_${Math.random().toString(36).slice(2,7)}`;
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      ${lit ? `<defs><filter id="${filterId}"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` : ''}
      <path d="${d}" fill="${pipeColor}" ${lit ? `filter="url(#${filterId})"` : ''}/>
      ${flowLines}
    </svg>`;
}

function buildSourceSVG() {
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="36" y="28" width="28" height="32" rx="5" fill="#FFC907"/>
      <rect x="44" y="60" width="12" height="16" rx="3" fill="#FFC907"/>
      <rect x="26" y="24" width="48" height="8" rx="4" fill="#1C1C1C"/>
      <rect x="44" y="76" width="12" height="6" rx="3" fill="#1C1C1C"/>
    </svg>`;
}

function buildWellSVG(lit) {
  const body  = lit ? '#1C1C1C' : '#888888';
  const top   = lit ? '#2E2E2E' : '#AAAAAA';
  const water = lit ? '#FFC907' : '#CCCCCC';
  const roof  = lit ? '#FFC907' : '#BBBBBB';
  const pole  = lit ? '#1C1C1C' : '#999999';
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="25" y="52" width="50" height="28" rx="4" fill="${body}"/>
      <ellipse cx="50" cy="52" rx="25" ry="8" fill="${top}"/>
      <ellipse cx="50" cy="56" rx="18" ry="5" fill="${water}"/>
      <polygon points="15,48 50,22 85,48" fill="${roof}"/>
      <rect x="47" y="20" width="6" height="30" fill="${pole}"/>
    </svg>`;
}

// ─── BFS flood-fill ──────────────────────────────────────────
function computeFlow() {
  const visited = Array.from({length: GRID_SIZE}, () => Array(GRID_SIZE).fill(false));
  const queue = [{ r: SOURCE.r, c: SOURCE.c }];
  visited[SOURCE.r][SOURCE.c] = true;

  // Source opens right (idx 1) and down (idx 2)
  // Well  accepts top (idx 0) and left (idx 3)
  const directions = [
    { dr: -1, dc:  0, fromIdx: 0, toIdx: 2 },
    { dr:  0, dc:  1, fromIdx: 1, toIdx: 3 },
    { dr:  1, dc:  0, fromIdx: 2, toIdx: 0 },
    { dr:  0, dc: -1, fromIdx: 3, toIdx: 1 },
  ];

  while (queue.length) {
    const { r, c } = queue.shift();
    const cell = grid[r][c];
    const ports = cell.isSource ? [0, 1, 1, 0]
                : cell.isWell   ? [1, 0, 0, 1]
                : getConnections(cell);

    for (const { dr, dc, fromIdx, toIdx } of directions) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) continue;
      if (visited[nr][nc]) continue;
      const nb = grid[nr][nc];
      const nPorts = nb.isSource ? [0, 1, 1, 0]
                   : nb.isWell   ? [1, 0, 0, 1]
                   : getConnections(nb);
      if (ports[fromIdx] && nPorts[toIdx]) {
        visited[nr][nc] = true;
        queue.push({ r: nr, c: nc });
      }
    }
  }
  return visited;
}

// ─── Render ──────────────────────────────────────────────────
function render(flowMap) {
  const gridEl = document.getElementById('game-grid');
  gridEl.innerHTML = '';

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = grid[r][c];
      const lit  = flowMap ? flowMap[r][c] : false;
      const div  = document.createElement('div');
      div.className = 'grid-cell';

      if (cell.isSource) {
        div.classList.add('special', 'source');
        div.innerHTML = buildSourceSVG() + `<span class="cell-label">SOURCE</span>`;
      } else if (cell.isWell) {
        div.classList.add('special', 'well');
        div.innerHTML = buildWellSVG(lit) + `<span class="cell-label">WELL</span>`;
      } else {
        if (lit) div.classList.add('connected');
        div.innerHTML = buildPipeSVG(cell, lit);
        div.addEventListener('click', () => {
          if (!gameActive) return;
          cell.rotation = (cell.rotation + 1) % 4;
          moves++;
          document.getElementById('moves').textContent = moves;
          const flow = computeFlow();
          render(flow);
          checkWin(flow);
        });
      }
      gridEl.appendChild(div);
    }
  }
}

// ─── Win check ───────────────────────────────────────────────
function checkWin(flowMap) {
  if (flowMap[WELL.r][WELL.c]) {
    endGame(true);
  }
}

// ─── Build grid ──────────────────────────────────────────────
function buildGrid(level) {
  const preset = LEVELS[level % LEVELS.length].preset;
  const types = Object.keys(PIPE_TYPES);
  grid = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      if (r === SOURCE.r && c === SOURCE.c) {
        grid[r][c] = { isSource: true };
      } else if (r === WELL.r && c === WELL.c) {
        grid[r][c] = { isWell: true };
      } else {
        const p = preset[r][c];
        grid[r][c] = p
          ? { type: p.t, rotation: p.r }
          : { type: types[Math.floor(Math.random() * types.length)], rotation: Math.floor(Math.random() * 4) };
      }
    }
  }
}

// ─── Timer ───────────────────────────────────────────────────
function startTimer() {
  clearInterval(timerInterval);
  const el = document.getElementById('timer');
  el.classList.remove('urgent');
  timerInterval = setInterval(() => {
    timerVal--;
    el.textContent = timerVal;
    if (timerVal <= 10) el.classList.add('urgent');
    if (timerVal <= 0) endGame(false);
  }, 1000);
}

// ─── Game flow ───────────────────────────────────────────────
function startGame() {
  document.getElementById('win-overlay').classList.add('hidden');
  document.getElementById('lose-overlay').classList.add('hidden');
  document.getElementById('message-bar').classList.add('hidden');

  moves = 0;
  document.getElementById('moves').textContent = '0';
  document.getElementById('level').textContent = currentLevel + 1;

  timerVal = LEVELS[currentLevel % LEVELS.length].time;
  document.getElementById('timer').textContent = timerVal;
  document.getElementById('timer').classList.remove('urgent');

  buildGrid(currentLevel);
  gameActive = true;
  startTimer();
  render(computeFlow());

  document.getElementById('start-btn').disabled = true;
  document.getElementById('reset-btn').disabled = false;
}

function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = rect.height;

  const COLORS = ['#FFC907','#1C1C1C','#E6B400','#4A4A4A','#FFF3B0','#888888','#ffffff'];
  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 40,
    r: 4 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 3,
    vy: 2.5 + Math.random() * 3,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.2,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }));

  let frame;
  let startTime = null;
  const DURATION = 2000;

  function draw(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.rot += p.vr;
      p.vy += 0.06; // gravity
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - elapsed / DURATION);
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      }
      ctx.restore();
    });

    if (elapsed < DURATION) {
      frame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}

function endGame(won) {
  gameActive = false;
  clearInterval(timerInterval);
  render(computeFlow());

  if (won) {
    document.getElementById('win-moves').textContent = moves;
    const overlay = document.getElementById('win-overlay');
    const card    = document.getElementById('win-card');

    // Reset card state
    card.style.opacity = '0';
    card.style.transform = 'scale(0.7)';
    card.classList.remove('animate-in');

    overlay.classList.remove('hidden');
    const stopConfetti = launchConfetti();

    // After confetti runs, pop in the card
    setTimeout(() => {
      stopConfetti();
      card.classList.add('animate-in');
    }, 1800);

  } else {
    document.getElementById('lose-overlay').classList.remove('hidden');
  }
  document.getElementById('start-btn').disabled = false;
  document.getElementById('reset-btn').disabled = true;
}

// ─── Button wiring ────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('reset-btn').addEventListener('click', () => { currentLevel = currentLevel; startGame(); });
document.getElementById('next-level-btn').addEventListener('click', () => { currentLevel++; startGame(); });
document.getElementById('retry-btn').addEventListener('click', () => { startGame(); });

// ─── Preview on load ─────────────────────────────────────────
buildGrid(0);
render(null);