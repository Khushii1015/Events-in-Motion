// =====================================================
// Study Dashboard — DOM manipulation, events and BOM
// =====================================================

const $ = (id) => document.getElementById(id);
const ORIGINAL_TITLE = document.title;

// ---------- Event log + toast helpers ----------
function log(message) {
  const li = document.createElement('li');
  li.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  $('log').prepend(li);
  while ($('log').children.length > 8) {
    $('log').lastElementChild.remove();
  }
}

let toastTimer;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

// =====================================================
// 1. TIME — live clock, greeting and accent colour
// =====================================================
function updateClock() {
  const now = new Date();
  const hour = now.getHours();
  $('clock').textContent = now.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  }) + ' · ' + now.toLocaleTimeString();

  let period, greeting;
  if (hour < 12)      { period = 'morning';   greeting = 'Good morning ☀️'; }
  else if (hour < 18) { period = 'afternoon'; greeting = 'Good afternoon 🌤️'; }
  else                { period = 'evening';   greeting = 'Good evening 🌙'; }

  $('greeting').textContent = greeting;
  document.body.dataset.period = period; // CSS changes accent colour
}
updateClock();
setInterval(updateClock, 1000);

// =====================================================
// 2. THEME — button click or "T" key, saved in localStorage
// =====================================================
function setTheme(dark) {
  document.body.classList.toggle('dark', dark);
  $('theme-btn').innerHTML = dark
    ? '☀️ Light mode <kbd>T</kbd>'
    : '🌙 Dark mode <kbd>T</kbd>';
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
}

function toggleTheme(source) {
  const dark = !document.body.classList.contains('dark');
  setTheme(dark);
  log(`${source} → ${dark ? 'dark' : 'light'} theme`);
}

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
setTheme(savedTheme
  ? savedTheme === 'dark'
  : window.matchMedia('(prefers-color-scheme: dark)').matches);

$('theme-btn').addEventListener('click', () => toggleTheme('click'));

// =====================================================
// 3. MOUSE + TOUCH — spotlight and click ripples
// =====================================================
const card = $('spotlight-card');

function moveSpotlight(clientX, clientY) {
  const rect = card.getBoundingClientRect();
  const x = Math.round(clientX - rect.left);
  const y = Math.round(clientY - rect.top);
  card.style.setProperty('--x', x + 'px');
  card.style.setProperty('--y', y + 'px');
  $('mx').textContent = x;
  $('my').textContent = y;
  return { x, y };
}

card.addEventListener('mousemove', (e) => moveSpotlight(e.clientX, e.clientY));

card.addEventListener('mouseleave', () => {
  card.style.setProperty('--x', '-200px');
  card.style.setProperty('--y', '-200px');
});

card.addEventListener('touchmove', (e) => {
  const touch = e.touches[0];
  moveSpotlight(touch.clientX, touch.clientY);
  e.preventDefault(); // stop the page scrolling while dragging on the card
}, { passive: false });

card.addEventListener('click', (e) => {
  const { x, y } = moveSpotlight(e.clientX, e.clientY);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  card.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
  log(`click → ripple at (${x}, ${y})`);
});

// =====================================================
// 4. TIME + KEYBOARD — focus timer (setInterval)
// =====================================================
const FOCUS_SECONDS = 25 * 60;
let remaining = FOCUS_SECONDS;
let timerId = null;

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderTimer() {
  $('timer').textContent = formatTime(remaining);
  $('timer').classList.toggle('running', timerId !== null);
  // BOM: show the countdown in the browser tab
  document.title = timerId ? `⏱ ${formatTime(remaining)} – Study` : ORIGINAL_TITLE;
}

function toggleTimer(source) {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    $('start-btn').textContent = 'Resume';
    log(`${source} → timer paused`);
  } else {
    timerId = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timerId);
        timerId = null;
        remaining = FOCUS_SECONDS;
        $('start-btn').textContent = 'Start';
        toast('🎉 Focus session complete!');
        log('timer → session complete');
      }
      renderTimer();
    }, 1000);
    $('start-btn').textContent = 'Pause';
    log(`${source} → timer started`);
  }
  renderTimer();
}

function resetTimer(source) {
  clearInterval(timerId);
  timerId = null;
  remaining = FOCUS_SECONDS;
  $('start-btn').textContent = 'Start';
  renderTimer();
  log(`${source} → timer reset`);
}

$('start-btn').addEventListener('click', () => toggleTimer('click'));
$('reset-btn').addEventListener('click', () => resetTimer('click'));

// =====================================================
// 5. DOM — task list (create, update, remove elements)
// =====================================================
const list = $('task-list');

function updateTaskCount() {
  const total = list.children.length;
  const done = list.querySelectorAll('.done').length;
  $('task-count').textContent = total === 0
    ? 'No tasks yet'
    : `${done} of ${total} done`;
}

function removeTask(li, source) {
  li.classList.add('removing');
  setTimeout(() => {
    li.remove();
    updateTaskCount();
  }, 250);
  log(`${source} → deleted "${li.textContent}"`);
}

function addTask(text) {
  const li = document.createElement('li');
  li.textContent = text;

  // Click: mark complete
  li.addEventListener('click', () => {
    li.classList.toggle('done');
    updateTaskCount();
    log(`click → "${text}" ${li.classList.contains('done') ? 'completed' : 'reopened'}`);
  });

  // Double-click: delete
  li.addEventListener('dblclick', () => removeTask(li, 'dblclick'));

  // Touch: swipe left to delete
  let startX = 0;
  li.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  li.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -60) removeTask(li, 'swipe');
  });

  list.appendChild(li);
  updateTaskCount();
  log(`submit → added "${text}"`);
}

$('task-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('task-input');
  const text = input.value.trim();
  if (!text) {
    toast('Type a task first');
    return;
  }
  addTask(text);
  input.value = '';
});

// =====================================================
// 6. KEYBOARD — global shortcuts
// =====================================================
document.addEventListener('keydown', (e) => {
  const typing = e.target.tagName === 'INPUT';

  if (typing) {
    if (e.key === 'Escape') {
      e.target.blur();
      log('Escape → left the input');
    }
    return; // don't trigger shortcuts while typing
  }

  switch (e.key.toLowerCase()) {
    case 't':
      toggleTheme('key T');
      break;
    case ' ':
      e.preventDefault(); // stop page scroll / button activation
      toggleTimer('key Space');
      break;
    case 'r':
      resetTimer('key R');
      break;
    case '/':
      e.preventDefault();
      $('task-input').focus();
      log('key / → focused task input');
      break;
  }
});

// =====================================================
// 7. WINDOW / BOM — resize, scroll, online, visibility
// =====================================================
function updateWindowInfo() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  $('viewport').textContent = `${w} × ${h}`;
  $('screen').textContent = `${screen.width} × ${screen.height}`;
  $('lang').textContent = navigator.language;
  $('url').textContent = location.protocol === 'file:' ? 'local file' : location.host + location.pathname;

  // Layout switches to one column on narrow windows
  const compact = w < 700;
  document.body.classList.toggle('compact', compact);
  $('layout').textContent = compact ? 'Compact (1 column)' : 'Wide (2 columns)';
}

function updateOnlineStatus() {
  const online = navigator.onLine;
  $('online').textContent = online ? '🟢 Online' : '🔴 Offline';
  $('online').classList.toggle('offline', !online);
}

updateWindowInfo();
updateOnlineStatus();

let resizeTimer;
window.addEventListener('resize', () => {
  updateWindowInfo();
  clearTimeout(resizeTimer); // debounce so the log isn't flooded
  resizeTimer = setTimeout(() => {
    log(`resize → ${window.innerWidth} × ${window.innerHeight}`);
  }, 300);
});

window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const percent = max > 0 ? (window.scrollY / max) * 100 : 0;
  $('progress-bar').style.width = percent + '%';
});

window.addEventListener('online', () => {
  updateOnlineStatus();
  toast('Back online');
  log('online → connection restored');
});

window.addEventListener('offline', () => {
  updateOnlineStatus();
  toast('You are offline');
  log('offline → connection lost');
});

// Change the tab title when the user switches away
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!timerId) document.title = '👀 Come back and study!';
    log('visibilitychange → tab hidden');
  } else {
    renderTimer();
    log('visibilitychange → tab visible');
    toast('Welcome back!');
  }
});

log('load → page ready');
