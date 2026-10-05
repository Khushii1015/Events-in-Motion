// =====================================================
// Letter Garden
// Type to grow a plant. Each letter is a leaf, each word
// becomes a flower. DOM manipulation + events + BOM.
// =====================================================

const $ = (id) => document.getElementById(id);

const body = document.body;
const stage = $('stage');
const plant = $('plant');
const stem = $('stem');
const pot = $('pot');
const hiddenInput = $('hidden-input');

const STEP = 18;            // vertical space each leaf takes on the stem
const MAX_CHARS = 80;       // the plant stops growing after this
const IDLE_MS = 12000;      // plant falls asleep after 12s of no input
const STORE_KEY = 'letter-garden';
const VOWELS = 'aeiou';
const PETAL_COLORS = ['#ef7aa8', '#f2a849', '#b39dfa', '#f87171', '#fcd34d', '#7dd3c0'];

// ---------- State ----------
let text = '';              // everything typed, e.g. "hello world "
let health = 100;           // 0–100
let plantedAt = Date.now();
let nodes = [];             // one DOM node per character in `text`
let lastActive = Date.now();
let asleep = false;
let hiddenAt = null;
let period = null;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const yFor = (i) => 16 + i * STEP;

// ---------- Small helpers ----------
function log(message) {
  // Shows the latest event under the poster so every interaction is visible
  $('ticker').textContent = `› ${message}`;
}

let toastTimer;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function currentWord() {
  const parts = text.split(' ');
  return parts[parts.length - 1];
}

function lastBloomedWord() {
  const words = text.trim().split(' ');
  return words[words.length - 1] || '';
}

function formatAgo(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

function formatDuration(seconds) {
  const s = Math.round(seconds);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

// =====================================================
// DOM: creating leaves and flowers
// =====================================================
function makeLeaf(ch, index, animate) {
  const leaf = document.createElement('span');
  leaf.className = 'leaf ' + (index % 2 === 0 ? 'right' : 'left');
  if (VOWELS.includes(ch)) leaf.classList.add('vowel');
  if (animate) leaf.classList.add('grow');
  leaf.textContent = ch;
  leaf.style.bottom = yFor(index) + 'px';
  leaf.style.setProperty('--tilt', (18 + Math.random() * 22).toFixed(1) + 'deg');
  plant.appendChild(leaf);
  return leaf;
}

function makeFlower(word, index, bloomNumber, animate) {
  const flower = document.createElement('div');
  flower.className = 'flower ' + (index % 2 === 0 ? 'right' : 'left');
  if (animate) flower.classList.add('bloom');
  flower.title = word;
  flower.style.bottom = (yFor(index) - 20) + 'px';
  flower.style.setProperty('--petal', PETAL_COLORS[bloomNumber % PETAL_COLORS.length]);

  // One petal per letter (at least 5, at most 10)
  const count = clamp(word.length, 5, 10);
  for (let k = 0; k < count; k++) {
    const petal = document.createElement('span');
    petal.className = 'petal';
    petal.textContent = word[k % word.length];
    petal.style.setProperty('--a', (360 / count) * k + 'deg');
    flower.appendChild(petal);
  }
  const core = document.createElement('span');
  core.className = 'core';
  flower.appendChild(core);

  plant.appendChild(flower);
  return flower;
}

// Rebuild every node from `text` (used when loading a saved garden)
function renderAll() {
  nodes.forEach((n) => n.remove());
  nodes = [];
  let word = '';
  let blooms = 0;
  for (const ch of text) {
    if (ch === ' ') {
      nodes.push(makeFlower(word, nodes.length, blooms++, false));
      word = '';
    } else {
      nodes.push(makeLeaf(ch, nodes.length, false));
      word += ch;
    }
  }
}

// =====================================================
// Updating the interface
// =====================================================
function updateLayout() {
  const n = nodes.length;
  const stemHeight = n ? yFor(n - 1) + 28 : 0;
  stem.style.height = stemHeight + 'px';

  // Shrink the plant if it's taller than the window allows
  const available = stage.clientHeight - 86 - 30;
  const needed = stemHeight + 50;
  const scale = needed > available ? Math.max(0.3, available / needed) : 1;
  plant.style.setProperty('--scale', scale.toFixed(3));

  $('empty-hint').classList.toggle('hidden', n > 0);
}

function updateWord() {
  // Giant outlined word in the background = the word being typed
  const word = currentWord() || lastBloomedWord() || 'type';
  const big = $('bigword');
  big.textContent = word;
  const len = Math.max(word.length, 3);
  big.style.fontSize = `min(24vw, ${Math.round(150 / len)}vw, 60vh)`;

  const caption = $('caption-text');
  caption.textContent = text || 'your words will grow here';
  caption.classList.toggle('placeholder', !text);
}

function updateVitals() {
  health = clamp(health, 0, 100);

  // Wilt starts once health drops below 65
  const wilt = clamp((65 - health) / 65, 0, 1);
  body.style.setProperty('--wilt', wilt.toFixed(2));

  let mood, color, emoji;
  if (health > 70)      { mood = 'thriving'; color = '#3f9d4a'; emoji = '🌿'; }
  else if (health > 40) { mood = 'content';  color = '#d9a520'; emoji = '🌱'; }
  else if (health > 15) { mood = 'thirsty';  color = '#e07a2e'; emoji = '🍂'; }
  else                  { mood = 'wilting';  color = '#c2453b'; emoji = '🥀'; }
  if (asleep) mood = 'asleep';

  $('mood').textContent = mood;
  $('health-bar').style.width = health + '%';
  $('health-bar').style.background = color;

  // BOM: the browser tab shows the plant's mood
  if (!document.hidden) document.title = `${emoji} ${mood} · Letter Garden`;

  $('stat-letters').textContent = text.replace(/ /g, '').length;
  $('stat-blooms').textContent = (text.match(/ /g) || []).length;
  $('stat-age').textContent = formatAgo(Date.now() - plantedAt);
  $('stat-time').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  $('stat-window').textContent = `${window.innerWidth} × ${window.innerHeight}`;
}

function update() {
  updateLayout();
  updateWord();
  updateVitals();
  save();
}

// =====================================================
// Actions
// =====================================================
function addLetter(ch, source) {
  if (text.length >= MAX_CHARS) {
    toast('Fully grown! Press Space to bloom or Esc to replant');
    return;
  }
  text += ch;
  nodes.push(makeLeaf(ch, nodes.length, true));
  health += 1.5;
  update();
  log(`${source} → leaf "${ch.toUpperCase()}" grew`);
}

function bloom(source) {
  const word = currentWord();
  if (!word) {
    toast('Type a word first, then press Space to bloom it');
    return;
  }
  const bloomNumber = (text.match(/ /g) || []).length;
  text += ' ';
  nodes.push(makeFlower(word, nodes.length, bloomNumber, true));
  health += 6;
  update();

  const big = $('bigword');
  big.classList.remove('flash');
  void big.offsetWidth; // restart the animation
  big.classList.add('flash');

  log(`${source} → "${word}" bloomed into a flower`);
}

function removeLast(source) {
  if (!nodes.length) {
    toast('Nothing left to drop');
    return;
  }
  const node = nodes.pop();
  const ch = text.slice(-1);
  text = text.slice(0, -1);

  node.classList.remove('grow', 'bloom');
  node.classList.add('falling');
  node.addEventListener('animationend', () => node.remove(), { once: true });

  update();
  log(ch === ' ' ? `${source} → a flower fell off` : `${source} → leaf "${ch.toUpperCase()}" fell off`);
}

let wetTimer;
function water(source) {
  const height = stage.clientHeight;
  for (let i = 0; i < 28; i++) {
    const drop = document.createElement('span');
    drop.className = 'drop';
    drop.style.left = 50 + (Math.random() - 0.5) * 36 + '%';
    drop.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
    drop.style.setProperty('--fall', height + 30 + 'px');
    drop.addEventListener('animationend', () => drop.remove());
    $('rain').appendChild(drop);
  }
  pot.classList.add('wet');
  clearTimeout(wetTimer);
  wetTimer = setTimeout(() => pot.classList.remove('wet'), 1800);

  health += 22;
  update();
  log(`${source} → watered (+22 health)`);
}

function pet(e) {
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement('span');
    heart.className = 'heart';
    heart.textContent = '♥';
    heart.style.left = e.clientX - 8 + 'px';
    heart.style.top = e.clientY - 12 + 'px';
    heart.style.setProperty('--dx', (Math.random() - 0.5) * 60 + 'px');
    heart.style.animationDelay = i * 0.12 + 's';
    heart.addEventListener('animationend', () => heart.remove());
    body.appendChild(heart);
  }
  plant.classList.remove('perk');
  void plant.offsetWidth;
  plant.classList.add('perk');

  health += 8;
  update();
  log('click → you petted the plant (+8 health)');
}

function replant() {
  if (!nodes.length) return;
  // BOM: window.confirm dialog
  if (!window.confirm('Pull up this plant and start over?')) {
    log('Esc → replant cancelled');
    return;
  }
  nodes.forEach((n) => n.remove());
  nodes = [];
  text = '';
  health = 100;
  plantedAt = Date.now();
  update();
  log('Esc → replanted a fresh seed');
}

// =====================================================
// Sun follows the pointer, plant leans toward it
// =====================================================
function setSun(x, y) {
  body.style.setProperty('--sx', x + 'px');
  body.style.setProperty('--sy', y + 'px');
  const center = window.innerWidth / 2;
  const lean = clamp((x - center) / center, -1, 1) * 14;
  plant.style.setProperty('--lean', lean.toFixed(2));
}

function sunHome() {
  // On narrow screens, keep the sun below the status card
  const narrow = window.innerWidth < 640;
  setSun(window.innerWidth - (narrow ? 70 : 110), narrow ? 260 : 130);
}

// =====================================================
// Idle / activity (time)
// =====================================================
function activity() {
  lastActive = Date.now();
  if (asleep) {
    asleep = false;
    body.classList.remove('asleep');
    updateVitals();
    log('activity → the plant woke up');
  }
}

function setPeriod() {
  const h = new Date().getHours();
  const p = h >= 5 && h < 11 ? 'morning'
          : h < 17 ? 'day'
          : h < 20 ? 'evening'
          : 'night';
  if (p !== period) {
    if (period) log(`time → it's now ${p}`);
    period = p;
    body.dataset.period = p;
  }
}

// =====================================================
// BOM: localStorage save / load
// =====================================================
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      text, health: Math.round(health), plantedAt, savedAt: Date.now()
    }));
  } catch (e) { /* storage unavailable — the page still works */ }
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    text = String(data.text || '')
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .replace(/ {2,}/g, ' ')
      .replace(/^ /, '')
      .slice(0, MAX_CHARS);
    health = Number(data.health) || 100;
    plantedAt = Number(data.plantedAt) || Date.now();
    // The plant got thirsty while the page was closed
    const awaySeconds = (Date.now() - (Number(data.savedAt) || Date.now())) / 1000;
    health -= Math.min(awaySeconds * 0.5, 70);
    return text.length > 0;
  } catch (e) {
    return false;
  }
}

// =====================================================
// EVENT LISTENERS
// =====================================================

// ---- Keyboard ----
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  // Letters typed into the mobile input are handled by its "input" event
  if (e.target === hiddenInput && e.key.length === 1) return;

  activity();
  const key = e.key;

  if (/^[a-z]$/i.test(key)) {
    addLetter(key.toLowerCase(), 'keydown');
  } else if (key === ' ') {
    e.preventDefault(); // stop the page from scrolling
    bloom('Space');
  } else if (key === 'Backspace') {
    e.preventDefault();
    removeLast('Backspace');
  } else if (key === 'Enter') {
    e.preventDefault();
    water('Enter');
  } else if (key === 'Escape') {
    if (document.activeElement === hiddenInput) hiddenInput.blur();
    replant();
  }
});

// ---- Mobile typing through a hidden input ----
$('type-btn').addEventListener('click', () => {
  hiddenInput.focus();
  log('tap → keyboard opened');
});

hiddenInput.addEventListener('input', () => {
  for (const ch of hiddenInput.value.toLowerCase()) {
    if (/[a-z]/.test(ch)) addLetter(ch, 'tap');
    else if (ch === ' ') bloom('tap Space');
  }
  hiddenInput.value = '';
  activity();
});

// ---- Mouse ----
window.addEventListener('mousemove', (e) => {
  setSun(e.clientX, e.clientY);
  activity();
});

document.documentElement.addEventListener('mouseleave', () => {
  sunHome();
  log('mouseleave → the sun went back to its corner');
});

plant.addEventListener('click', (e) => { activity(); pet(e); });
pot.addEventListener('click', (e) => { activity(); pet(e); });

// ---- Touch ----
let touchStart = null;

window.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
  setSun(t.clientX, t.clientY);
  activity();
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  setSun(t.clientX, t.clientY);
}, { passive: true });

window.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  if (dy > 90 && Math.abs(dx) < 70) removeLast('swipe down'); // shake off a leaf
  touchStart = null;
});

// ---- Window: resize ----
let resizeTimer;
window.addEventListener('resize', () => {
  updateLayout();   // plant rescales to fit the new window
  updateVitals();
  sunHome();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    log(`resize → ${window.innerWidth} × ${window.innerHeight}, plant rescaled`);
  }, 300);
});

// ---- Window: leaving the tab wilts the plant ----
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    document.title = '🥀 Your plant misses you…';
  } else if (hiddenAt) {
    const away = (Date.now() - hiddenAt) / 1000;
    hiddenAt = null;
    health -= Math.min(away * 1.5, 50);
    update();
    if (away >= 2) toast(`You were gone ${formatDuration(away)}. Your plant wilted.`);
    log(`visibilitychange → back after ${formatDuration(away)}, plant wilted`);
  }
});

window.addEventListener('beforeunload', save);

// =====================================================
// Time: runs every second
// =====================================================
let ticks = 0;
setInterval(() => {
  health -= 0.45; // the plant slowly gets thirsty

  if (!asleep && Date.now() - lastActive > IDLE_MS) {
    asleep = true;
    body.classList.add('asleep');
    log('idle 12s → the plant dozed off');
  }

  setPeriod();
  updateVitals();
  if (++ticks % 5 === 0) save();
}, 1000);

// =====================================================
// Start
// =====================================================
const restored = load();
renderAll();
setPeriod();
sunHome();
update();

if (restored) {
  toast('Welcome back — your garden was saved');
  log('load → garden restored from localStorage');
} else {
  log('load → a fresh seed is planted. Start typing!');
}
