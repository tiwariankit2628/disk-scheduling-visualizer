/* =====================================================
   DISK SCHEDULING ALGORITHM VISUALIZER — script.js
   Algorithms: FCFS, SSTF, SCAN, C-SCAN
   Author: Student Project
   ===================================================== */

"use strict";

// =====================================================
// GLOBAL STATE
// =====================================================
const state = {
  diskSize:    200,
  headPos:     53,
  direction:   'right',    // 'left' or 'right'
  requests:    [98,183,37,122,14,124,65,67],
  results:     {},          // { fcfs:{...}, sstf:{...}, ... }
  activeAlgos: { fcfs:true, sstf:true, scan:true, cscan:true },
  currentVizAlgo: 'fcfs',

  // Animation state
  anim: {
    isPlaying: false,
    step: 0,
    timer: null,
    speed: 600,        // ms per step
  }
};

// Chart instances (Chart.js)
let seekPathChartInst = null;
let compareBarChartInst = null;
let throughputChartInst = null;

// Canvas animation frame
let canvasAnimFrame = null;

// =====================================================
// ALGORITHM COLORS
// =====================================================
const ALGO_COLORS = {
  fcfs:  '#00d4ff',
  sstf:  '#00ff88',
  scan:  '#ffb830',
  cscan: '#a855f7',
};

// =====================================================
// ON PAGE LOAD — START LOADER, THEN SHOW APP
// =====================================================
window.addEventListener('load', () => {
  // After 2 seconds, hide loader and show app
  setTimeout(() => {
    document.getElementById('loader').classList.add('hide');
    document.getElementById('app').style.display = 'flex';
    // Small delay so display:flex kicks in before animation
    setTimeout(() => {
      document.getElementById('app').classList.remove('app-hidden');
      updateQueueTags();
      updateDiskRange();
    }, 50);
  }, 1800);
});

// =====================================================
// SECTION NAVIGATION
// =====================================================
function showSection(name) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active-section'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('section-' + name).classList.add('active-section');
  document.querySelector(`[data-section="${name}"]`).classList.add('active');

  const sectionNames = { input:'Configure', visualize:'Visualize', compare:'Compare' };
  document.getElementById('topbar-section-name').textContent = sectionNames[name] || name;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// =====================================================
// INPUT HELPERS
// =====================================================
function updateDiskRange() {
  const ds = parseInt(document.getElementById('diskSize').value) || 200;
  document.getElementById('diskRangeHint').textContent = ds - 1;
}

function updateQueueTags() {
  const raw = document.getElementById('reqQueue').value;
  const tags = parsedRequests(raw);
  const container = document.getElementById('queueTags');
  container.innerHTML = tags.map(t => `<span class="queue-tag">${t}</span>`).join('');
  document.getElementById('queueCountHint').textContent = `${tags.length} request${tags.length!==1?'s':''} in queue`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reqQueue').addEventListener('input', updateQueueTags);
});

function parsedRequests(str) {
  return str.split(',')
    .map(s => parseInt(s.trim()))
    .filter(n => !isNaN(n) && n >= 0);
}

function setDirection(dir) {
  state.direction = dir;
  document.getElementById('dir-right').classList.toggle('active', dir === 'right');
  document.getElementById('dir-left').classList.toggle('active', dir === 'left');
}

function toggleAlgo(name) {
  state.activeAlgos[name] = !state.activeAlgos[name];
  document.getElementById(`acard-${name}`).classList.toggle('active', state.activeAlgos[name]);
}

// =====================================================
// RANDOM INPUT GENERATOR
// =====================================================
function generateRandom() {
  const diskSize = [100, 200, 300, 500][Math.floor(Math.random() * 4)];
  const numReqs  = 6 + Math.floor(Math.random() * 7); // 6–12 requests
  const head     = Math.floor(Math.random() * diskSize);
  const reqs     = Array.from({ length: numReqs }, () => Math.floor(Math.random() * diskSize));
  const dirs     = ['left','right'];

  document.getElementById('diskSize').value   = diskSize;
  document.getElementById('headPos').value    = head;
  document.getElementById('reqQueue').value   = reqs.join(',');
  setDirection(dirs[Math.floor(Math.random() * 2)]);
  updateDiskRange();
  updateQueueTags();
}

// =====================================================
// RESET
// =====================================================
function resetAll() {
  document.getElementById('diskSize').value   = 200;
  document.getElementById('headPos').value    = 53;
  document.getElementById('reqQueue').value   = '98,183,37,122,14,124,65,67';
  setDirection('right');
  updateDiskRange();
  updateQueueTags();

  state.results = {};
  state.activeAlgos = { fcfs:true, sstf:true, scan:true, cscan:true };
  ['fcfs','sstf','scan','cscan'].forEach(a => {
    document.getElementById(`acard-${a}`).classList.add('active');
    document.getElementById(`badge-${a}`).classList.remove('has-result');
  });

  document.getElementById('resultCards').innerHTML = '';
  document.getElementById('compareTableBody').innerHTML =
    '<tr><td colspan="6" class="table-empty">Run simulation first</td></tr>';
  document.getElementById('bestAlgoName').textContent = '—';
  document.getElementById('bestAlgoReason').textContent = 'Run simulation to see results';

  if (seekPathChartInst)   { seekPathChartInst.destroy();   seekPathChartInst   = null; }
  if (compareBarChartInst) { compareBarChartInst.destroy(); compareBarChartInst = null; }
  if (throughputChartInst) { throughputChartInst.destroy(); throughputChartInst = null; }

  clearTrackCanvas();
}



// =====================================================
// ALGORITHM IMPLEMENTATIONS
// =====================================================

/**
 * FCFS — First Come First Serve
 * Process requests in the exact order they arrive.
 * Returns: { sequence, totalSeek }
 */
function fcfs(head, requests) {
  const sequence = [head, ...requests];
  let totalSeek = 0;
  for (let i = 1; i < sequence.length; i++) {
    totalSeek += Math.abs(sequence[i] - sequence[i - 1]);
  }
  return { sequence, totalSeek };
}

/**
 * SSTF — Shortest Seek Time First
 * At each step, pick the request closest to the current head position.
 */
function sstf(head, requests) {
  const pending = [...requests];
  const sequence = [head];
  let current = head;
  let totalSeek = 0;

  while (pending.length > 0) {
    // Find index of closest request
    let minDist = Infinity;
    let minIdx  = -1;
    for (let i = 0; i < pending.length; i++) {
      const dist = Math.abs(pending[i] - current);
      if (dist < minDist) { minDist = dist; minIdx = i; }
    }
    current = pending[minIdx];
    totalSeek += minDist;
    sequence.push(current);
    pending.splice(minIdx, 1);
  }

  return { sequence, totalSeek };
}

/**
 * SCAN — Elevator Algorithm
 * Head moves in one direction servicing requests, then reverses.
 * Scans to the end of the disk before reversing.
 */
function scan(head, requests, diskSize, direction) {
  const max = diskSize - 1;
  const lower = requests.filter(r => r < head).sort((a,b) => a - b);
  const upper = requests.filter(r => r >= head).sort((a,b) => a - b);

  let sequence = [head];
  let totalSeek = 0;

  if (direction === 'right') {
    // Service upper side, go to end, then service lower in reverse
    [...upper].forEach(r => {
      sequence.push(r);
      totalSeek += Math.abs(r - sequence[sequence.length - 2]);
    });
    if (upper.length > 0 || lower.length > 0) {
      const end = max;
      totalSeek += Math.abs(end - sequence[sequence.length - 1]);
      sequence.push(end);
    }
    [...lower].reverse().forEach(r => {
      sequence.push(r);
      totalSeek += Math.abs(r - sequence[sequence.length - 2]);
    });
  } else {
    // Service lower side, go to 0, then service upper
    [...lower].reverse().forEach(r => {
      sequence.push(r);
      totalSeek += Math.abs(r - sequence[sequence.length - 2]);
    });
    if (upper.length > 0 || lower.length > 0) {
      totalSeek += Math.abs(0 - sequence[sequence.length - 1]);
      sequence.push(0);
    }
    [...upper].forEach(r => {
      sequence.push(r);
      totalSeek += Math.abs(r - sequence[sequence.length - 2]);
    });
  }

  return { sequence, totalSeek };
}

/**
 * C-SCAN — Circular SCAN
 * Moves in one direction only. After reaching the end, jumps to start (0) and continues.
 * The jump is counted as zero seek time.
 */
function cscan(head, requests, diskSize, direction) {
  const max = diskSize - 1;
  const lower = requests.filter(r => r < head).sort((a,b) => a - b);
  const upper = requests.filter(r => r >= head).sort((a,b) => a - b);

  let sequence = [head];
  let totalSeek = 0;

  if (direction === 'right') {
    // Service upper, jump to 0, service lower
    [...upper].forEach(r => {
      sequence.push(r);
      totalSeek += Math.abs(r - sequence[sequence.length - 2]);
    });
    if (lower.length > 0) {
      // Jump to max then to 0 (counted as movement)
      totalSeek += Math.abs(max - sequence[sequence.length - 1]);
      sequence.push(max);
      totalSeek += max; // max to 0
      sequence.push(0);
      [...lower].forEach(r => {
        sequence.push(r);
        totalSeek += Math.abs(r - sequence[sequence.length - 2]);
      });
    }
  } else {
    // Service lower (descending), jump to max, service upper (descending from max)
    [...lower].reverse().forEach(r => {
      sequence.push(r);
      totalSeek += Math.abs(r - sequence[sequence.length - 2]);
    });
    if (upper.length > 0) {
      totalSeek += Math.abs(0 - sequence[sequence.length - 1]);
      sequence.push(0);
      totalSeek += max;
      sequence.push(max);
      [...upper].reverse().forEach(r => {
        sequence.push(r);
        totalSeek += Math.abs(r - sequence[sequence.length - 2]);
      });
    }
  }

  return { sequence, totalSeek };
}

// =====================================================
// RUN SIMULATION — MAIN ENTRY POINT
// =====================================================
function runSimulation() {
  // Read inputs
  const diskSize  = parseInt(document.getElementById('diskSize').value)  || 200;
  const headPos   = parseInt(document.getElementById('headPos').value)   || 0;
  const reqRaw    = document.getElementById('reqQueue').value;
  const direction = state.direction;
  const requests  = parsedRequests(reqRaw);

  // Basic validation
  if (requests.length === 0) {
    alert('Please enter at least one request in the queue.');
    return;
  }
  if (headPos < 0 || headPos >= diskSize) {
    alert(`Head position must be between 0 and ${diskSize - 1}.`);
    return;
  }
  for (const r of requests) {
    if (r < 0 || r >= diskSize) {
      alert(`Request ${r} is out of disk range (0–${diskSize-1}).`);
      return;
    }
  }

  // Update global state
  state.diskSize  = diskSize;
  state.headPos   = headPos;
  state.requests  = requests;
  state.results   = {};

  // Run selected algorithms
  if (state.activeAlgos.fcfs)  state.results.fcfs  = fcfs(headPos, requests);
  if (state.activeAlgos.sstf)  state.results.sstf  = sstf(headPos, requests);
  if (state.activeAlgos.scan)  state.results.scan  = scan(headPos, requests, diskSize, direction);
  if (state.activeAlgos.cscan) state.results.cscan = cscan(headPos, requests, diskSize, direction);

  // Attach metadata to results
  const keys = Object.keys(state.results);
  keys.forEach(algo => {
    const r = state.results[algo];
    r.name       = algo.toUpperCase().replace('CSCAN','C-SCAN');
    r.movements  = r.sequence.length - 1;
    r.throughput = (requests.length / r.totalSeek).toFixed(4);
    // Mark badges
    document.getElementById(`badge-${algo}`).classList.add('has-result');
  });

  // Render outputs
  renderResultCards();
  renderCompareSection();

  // Switch to Visualize tab and set first available algo
  const firstAlgo = keys[0] || 'fcfs';
  state.currentVizAlgo = firstAlgo;
  showSection('visualize');
  activateVizTab(firstAlgo);

  // Update disk range labels
  document.getElementById('vizDiskSize').textContent = diskSize - 1;
  document.getElementById('trackLabelMid').textContent = Math.floor(diskSize / 2);
  document.getElementById('trackLabelMax').textContent = diskSize - 1;
}

// =====================================================
// RENDER RESULT CARDS (in Visualize section)
// =====================================================
function renderResultCards() {
  const container = document.getElementById('resultCards');
  container.innerHTML = '';

  Object.keys(state.results).forEach(algo => {
    const r = state.results[algo];
    const card = document.createElement('div');
    card.className = `result-card ${algo}`;
    card.innerHTML = `
      <div class="result-card-title">${r.name}</div>
      <div class="result-stat">
        <span class="result-stat-label">Total Seek Time</span>
        <span class="result-stat-value">${r.totalSeek} tracks</span>
      </div>
      <div class="result-stat">
        <span class="result-stat-label">Movements</span>
        <span class="result-stat-value">${r.movements}</span>
      </div>
      <div class="result-stat">
        <span class="result-stat-label">Throughput</span>
        <span class="result-stat-value">${r.throughput} req/track</span>
      </div>
      <div class="result-seq">
        <div class="result-seq-label">SEEK SEQUENCE</div>
        <div class="result-seq-value">${r.sequence.join(' → ')}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

// =====================================================
// VISUALIZATION TAB SWITCHING
// =====================================================
function selectVizTab(algo) {
  if (!state.results[algo]) return;
  state.currentVizAlgo = algo;
  activateVizTab(algo);
}

function activateVizTab(algo) {
  // Tab UI
  document.querySelectorAll('.viz-tab').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById(`tab-${algo}`);
  if (tab) tab.classList.add('active');

  // Label
  const names = { fcfs:'FCFS', sstf:'SSTF', scan:'SCAN', cscan:'C-SCAN' };
  document.getElementById('currentAlgoLabel').textContent =
    `${names[algo]} — Head Movement`;
  document.getElementById('currentAlgoLabel').style.color = ALGO_COLORS[algo];

  // Stop any running animation
  stopAnimation();
  state.anim.step = 0;
  updateStepLabel();

  // Draw initial frame
  drawTrackCanvas(0);

  // Render seek path chart
  renderSeekPathChart(algo);
}

// =====================================================
// DISK TRACK CANVAS — ANIMATION
// =====================================================
function clearTrackCanvas() {
  const canvas = document.getElementById('diskTrackCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawTrackCanvas(step) {
  const algo = state.currentVizAlgo;
  const result = state.results[algo];
  if (!result) return;

  const canvas = document.getElementById('diskTrackCanvas');
  // Resize canvas to match display
  canvas.width  = canvas.offsetWidth;
  canvas.height = 140;

  const ctx    = canvas.getContext('2d');
  const W      = canvas.width;
  const H      = canvas.height;
  const seq    = result.sequence;
  const disk   = state.diskSize;
  const color  = ALGO_COLORS[algo];
  const steps  = Math.min(step, seq.length - 1);

  ctx.clearRect(0, 0, W, H);

  // Track line (background)
  const trackY = H / 2;
  const padX   = 40;
  const trackW = W - padX * 2;

  // Background track
  ctx.strokeStyle = '#1f2d4a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(padX, trackY);
  ctx.lineTo(W - padX, trackY);
  ctx.stroke();

  // Track ticks
  ctx.fillStyle = '#2e4070';
  for (let i = 0; i <= 10; i++) {
    const x = padX + (i / 10) * trackW;
    ctx.beginPath();
    ctx.moveTo(x, trackY - 8);
    ctx.lineTo(x, trackY + 8);
    ctx.strokeStyle = '#2e4070';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Helper: track number → x position
  function tx(track) {
    return padX + (track / (disk - 1)) * trackW;
  }

  // Draw all request markers (unvisited = dim)
  const visited = new Set(seq.slice(0, steps + 1));
  result.sequence.slice(1).forEach(r => {
    const x = tx(r);
    ctx.beginPath();
    ctx.arc(x, trackY, 5, 0, Math.PI * 2);
    ctx.fillStyle = visited.has(r) ? color + 'cc' : '#2e4070';
    ctx.fill();
    ctx.strokeStyle = visited.has(r) ? color : '#1f2d4a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Draw path so far (step-by-step line)
  if (steps >= 1) {
    ctx.beginPath();
    ctx.moveTo(tx(seq[0]), trackY);
    // Animate each step as a zigzag below/above track
    const zigZag = 28;
    for (let i = 1; i <= steps; i++) {
      const x1 = tx(seq[i-1]);
      const x2 = tx(seq[i]);
      const yOff = (i % 2 === 0) ? -zigZag : zigZag;
      ctx.lineTo(x2, trackY + yOff);
      ctx.lineTo(x2, trackY);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Draw HEAD (current position)
  if (steps < seq.length) {
    const headX = tx(seq[steps]);
    // Head line (vertical indicator)
    ctx.beginPath();
    ctx.moveTo(headX, 8);
    ctx.lineTo(headX, H - 8);
    ctx.strokeStyle = '#ffffff55';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Head circle
    ctx.beginPath();
    ctx.arc(headX, trackY, 9, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Head label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(seq[steps], headX, trackY + 24);

    // HEAD label above
    ctx.fillStyle = color;
    ctx.font = '9px Orbitron, monospace';
    ctx.fillText('HEAD', headX, trackY - 18);
  }
}

// =====================================================
// SEEK PATH CHART (Chart.js line chart)
// =====================================================
function renderSeekPathChart(algo) {
  const result = state.results[algo];
  if (!result) return;

  const seq   = result.sequence;
  const color = ALGO_COLORS[algo];

  const labels = seq.map((_, i) => `Step ${i}`);
  const data   = seq.map(v => v);

  if (seekPathChartInst) { seekPathChartInst.destroy(); }

  const ctx = document.getElementById('seekPathChart').getContext('2d');
  seekPathChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Head Position',
        data,
        borderColor: color,
        backgroundColor: color + '22',
        pointBackgroundColor: color,
        pointRadius: 5,
        pointHoverRadius: 8,
        borderWidth: 2,
        fill: false,
        tension: 0.1,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { labels: { color: '#8899bb', font: { family: 'Rajdhani' } } },
        tooltip: {
          callbacks: {
            label: ctx => ` Track: ${ctx.raw}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#4a5878', font: { family: 'Share Tech Mono', size: 10 } },
          grid:  { color: '#1f2d4a' }
        },
        y: {
          title: { display: true, text: 'Track Number', color: '#4a5878' },
          min: 0, max: state.diskSize,
          ticks: { color: '#4a5878', font: { family: 'Share Tech Mono', size: 10 } },
          grid:  { color: '#1f2d4a' }
        }
      }
    }
  });
}

// =====================================================
// ANIMATION CONTROLS
// =====================================================
function togglePlay() {
  if (state.anim.isPlaying) stopAnimation();
  else startAnimation();
}

function startAnimation() {
  const result = state.results[state.currentVizAlgo];
  if (!result) return;

  // If at end, restart
  if (state.anim.step >= result.sequence.length - 1) {
    state.anim.step = 0;
  }

  state.anim.isPlaying = true;
  document.getElementById('playPauseBtn').textContent = '⏸';

  function tick() {
    if (!state.anim.isPlaying) return;
    const res = state.results[state.currentVizAlgo];
    if (state.anim.step < res.sequence.length - 1) {
      state.anim.step++;
      updateStepLabel();
      drawTrackCanvas(state.anim.step);
      state.anim.timer = setTimeout(tick, state.anim.speed);
    } else {
      stopAnimation();
    }
  }
  tick();
}

function stopAnimation() {
  state.anim.isPlaying = false;
  document.getElementById('playPauseBtn').textContent = '▶';
  clearTimeout(state.anim.timer);
}

function animNext() {
  const result = state.results[state.currentVizAlgo];
  if (!result) return;
  stopAnimation();
  if (state.anim.step < result.sequence.length - 1) {
    state.anim.step++;
    updateStepLabel();
    drawTrackCanvas(state.anim.step);
  }
}

function animPrev() {
  if (!state.results[state.currentVizAlgo]) return;
  stopAnimation();
  if (state.anim.step > 0) {
    state.anim.step--;
    updateStepLabel();
    drawTrackCanvas(state.anim.step);
  }
}

function updateStepLabel() {
  const result = state.results[state.currentVizAlgo];
  const total  = result ? result.sequence.length - 1 : 0;
  document.getElementById('stepCurrent').textContent = state.anim.step;
  document.getElementById('stepTotal').textContent   = total;
}

function updateSpeed() {
  const raw = parseInt(document.getElementById('animSpeed').value) || 600;
  // Invert: higher slider = faster = lower interval
  state.anim.speed = 1600 - raw;
}

// =====================================================
// COMPARE SECTION RENDERING
// =====================================================
function renderCompareSection() {
  renderCompareTable();
  renderCompareBarChart();
  renderThroughputChart();
  renderBestAlgoBanner();
}

function renderBestAlgoBanner() {
  const keys = Object.keys(state.results);
  if (keys.length === 0) return;

  // Best = lowest total seek time
  let bestAlgo = keys[0];
  let bestSeek = state.results[bestAlgo].totalSeek;
  for (const k of keys) {
    if (state.results[k].totalSeek < bestSeek) {
      bestSeek = state.results[k].totalSeek;
      bestAlgo = k;
    }
  }

  const r = state.results[bestAlgo];
  document.getElementById('bestAlgoName').textContent   = r.name;
  document.getElementById('bestAlgoName').style.color   = ALGO_COLORS[bestAlgo];
  document.getElementById('bestAlgoReason').textContent =
    `Minimum total seek time: ${r.totalSeek} tracks | Throughput: ${r.throughput} req/track`;
}

function renderCompareTable() {
  const keys = Object.keys(state.results);
  if (keys.length === 0) return;

  // Find best (lowest seek)
  let minSeek = Infinity;
  keys.forEach(k => { if (state.results[k].totalSeek < minSeek) minSeek = state.results[k].totalSeek; });

  const tbody = document.getElementById('compareTableBody');
  tbody.innerHTML = '';

  keys.forEach(algo => {
    const r    = state.results[algo];
    const best = r.totalSeek === minSeek;
    const tr   = document.createElement('tr');
    if (best) tr.classList.add('row-best');
    tr.innerHTML = `
      <td><span class="algo-name-cell ${algo}">${r.name}</span></td>
      <td style="font-size:0.72rem; color:#8899bb; max-width:200px; word-break:break-all">
        ${r.sequence.slice(0,10).join(' → ')}${r.sequence.length > 10 ? ' …' : ''}
      </td>
      <td>${r.totalSeek}</td>
      <td>${r.movements}</td>
      <td>${r.throughput}</td>
      <td><span class="status-pill ${best ? 'status-best' : 'status-ok'}">${best ? '★ BEST' : 'OK'}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCompareBarChart() {
  const keys = Object.keys(state.results);
  if (!keys.length) return;

  if (compareBarChartInst) compareBarChartInst.destroy();

  const ctx = document.getElementById('compareBarChart').getContext('2d');
  compareBarChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: keys.map(k => state.results[k].name),
      datasets: [{
        label: 'Total Seek Time (tracks)',
        data:  keys.map(k => state.results[k].totalSeek),
        backgroundColor: keys.map(k => ALGO_COLORS[k] + '88'),
        borderColor:     keys.map(k => ALGO_COLORS[k]),
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8899bb', font: { family: 'Rajdhani' } } }
      },
      scales: {
        x: {
          ticks: { color: '#8899bb', font: { family: 'Rajdhani', size: 12 } },
          grid:  { color: '#1f2d4a' }
        },
        y: {
          title: { display: true, text: 'Seek Time (tracks)', color: '#4a5878' },
          ticks: { color: '#4a5878', font: { family: 'Share Tech Mono', size: 10 } },
          grid:  { color: '#1f2d4a' }
        }
      }
    }
  });
}

function renderThroughputChart() {
  const keys = Object.keys(state.results);
  if (!keys.length) return;

  if (throughputChartInst) throughputChartInst.destroy();

  const ctx = document.getElementById('throughputChart').getContext('2d');
  throughputChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: keys.map(k => state.results[k].name),
      datasets: [{
        label: 'Throughput (req/seek-track)',
        data:  keys.map(k => parseFloat(state.results[k].throughput)),
        backgroundColor: keys.map(k => ALGO_COLORS[k] + '66'),
        borderColor:     keys.map(k => ALGO_COLORS[k]),
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8899bb', font: { family: 'Rajdhani' } } }
      },
      scales: {
        x: {
          ticks: { color: '#8899bb', font: { family: 'Rajdhani', size: 12 } },
          grid:  { color: '#1f2d4a' }
        },
        y: {
          title: { display: true, text: 'Throughput', color: '#4a5878' },
          ticks: { color: '#4a5878', font: { family: 'Share Tech Mono', size: 10 } },
          grid:  { color: '#1f2d4a' }
        }
      }
    }
  });
}

// =====================================================
// WINDOW RESIZE — redraw canvas
// =====================================================
window.addEventListener('resize', () => {
  if (state.results[state.currentVizAlgo]) {
    drawTrackCanvas(state.anim.step);
  }
});

// =====================================================
// INIT QUEUE TAGS ON LOAD (after DOM ready)
// =====================================================
setTimeout(() => {
  updateQueueTags();
  updateDiskRange();
}, 100);