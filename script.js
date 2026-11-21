// Tab navigation
function showTab(id) {
  const tabs = document.querySelectorAll('.section');
  const buttons = document.querySelectorAll('.tab-button');
  tabs.forEach(tab => tab.classList.remove('active'));
  buttons.forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });

  const activeTab = document.getElementById(id);
  if (activeTab) {
    activeTab.classList.add('active');
  }

  const activeBtn = document.querySelector(`.tab-button[data-tab="${id}"]`) ||
                    document.querySelector(`.tab-button[onclick*="'${id}'"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-selected', 'true');
  }
}

// ---------------- AUDIO CHIME SYSTEM (Web Audio API) ----------------
let audioCtx = null;
let alarmAudioInterval = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(frequency, duration, type = 'sine', volume = 0.25) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    console.error("Audio playback error:", err);
  }
}

function startAlarmSound() {
  stopAlarmSound();
  const ring = () => {
    playTone(880, 0.12, 'square', 0.2);
    setTimeout(() => playTone(1174, 0.16, 'square', 0.2), 140);
  };
  ring();
  alarmAudioInterval = setInterval(ring, 800);
}

function stopAlarmSound() {
  if (alarmAudioInterval) {
    clearInterval(alarmAudioInterval);
    alarmAudioInterval = null;
  }
}

function testSound() {
  getAudioContext();
  playTone(880, 0.12, 'square', 0.2);
  setTimeout(() => playTone(1174, 0.18, 'square', 0.2), 140);
}

// ---------------- LOCAL TIME ----------------
let is24HourFormat = false;

function updateLocalTime() {
  const now = new Date();
  const localEl = document.getElementById('localTime');
  if (localEl) {
    localEl.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !is24HourFormat
    });
  }

  const dateEl = document.getElementById('localDate');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

function toggleHourFormat() {
  is24HourFormat = !is24HourFormat;
  const btn = document.getElementById('toggleFormatBtn');
  if (btn) {
    btn.textContent = is24HourFormat ? "Switch to 12-Hour Format (AM/PM)" : "Switch to 24-Hour Format";
  }
  updateLocalTime();
  updateWorldTime();
}

// Immediately initialize local time (no 1-second blank flash)
updateLocalTime();
setInterval(updateLocalTime, 250);

// ---------------- WORLD TIME ----------------
const timezoneSelect = document.getElementById('timezoneSelect');
if (timezoneSelect) {
  timezoneSelect.addEventListener('change', updateWorldTime);
}

function updateWorldTime() {
  const select = document.getElementById('timezoneSelect');
  if (!select) return;
  const tz = select.value;
  const now = new Date();

  try {
    const worldTimeEl = document.getElementById('worldTime');
    if (worldTimeEl) {
      worldTimeEl.textContent = now.toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !is24HourFormat
      });
    }

    const worldDateEl = document.getElementById('worldDate');
    if (worldDateEl) {
      worldDateEl.textContent = now.toLocaleDateString('en-US', {
        timeZone: tz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    const worldOffsetEl = document.getElementById('worldOffset');
    if (worldOffsetEl) {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(now);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      worldOffsetEl.textContent = tzPart ? `Timezone: ${tz} (${tzPart.value})` : `Timezone: ${tz}`;
    }
  } catch (err) {
    console.error("World time error:", err);
  }
}

updateWorldTime();
setInterval(updateWorldTime, 250);

// ---------------- ALARM ----------------
let alarmTime = null; // Stored as "HH:MM" (24-hour format)
let isAlarmRinging = false;
let activeModalType = null; // 'alarm' or 'timer'
let lastAlarmMinuteTriggered = null;

function setAlarm() {
  const alarmInput = document.getElementById('alarmTime');
  const val = alarmInput ? alarmInput.value : '';
  const statusEl = document.getElementById('alarmStatus');

  if (!val) {
    if (statusEl) {
      statusEl.textContent = 'Please select a valid time first!';
      statusEl.className = 'status-msg warning';
    }
    return;
  }

  alarmTime = val;
  lastAlarmMinuteTriggered = null;

  const [h, m] = val.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const formatted12 = `${pad(h12)}:${pad(m)} ${period}`;

  if (statusEl) {
    statusEl.textContent = `Alarm set for ${formatted12} (${val})`;
    statusEl.className = 'status-msg active';
  }

  getAudioContext(); // Initialize audio on user interaction
}

function clearAlarm() {
  alarmTime = null;
  lastAlarmMinuteTriggered = null;
  const alarmInput = document.getElementById('alarmTime');
  if (alarmInput) alarmInput.value = '';
  const statusEl = document.getElementById('alarmStatus');
  if (statusEl) {
    statusEl.textContent = 'No alarm set';
    statusEl.className = 'status-msg';
  }
}

setInterval(() => {
  if (alarmTime && !isAlarmRinging) {
    const now = new Date();
    const currentHHMM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if (currentHHMM === alarmTime && lastAlarmMinuteTriggered !== currentHHMM) {
      lastAlarmMinuteTriggered = currentHHMM;
      triggerAlarm();
    }
  }
}, 1000);

function triggerAlarm() {
  isAlarmRinging = true;
  activeModalType = 'alarm';
  startAlarmSound();

  const modal = document.getElementById('alarmModal');
  const title = document.getElementById('modalTitle');
  const msg = document.getElementById('modalMessage');
  const snoozeBtn = document.getElementById('snoozeAlertBtn');

  if (title) title.textContent = 'ALARM RINGING!';
  if (msg) msg.textContent = `Alarm for ${alarmTime} is going off!`;
  if (snoozeBtn) snoozeBtn.style.display = 'inline-block';
  if (modal) modal.classList.remove('hidden');

  const statusEl = document.getElementById('alarmStatus');
  if (statusEl) {
    statusEl.textContent = '🔔 Alarm is ringing!';
    statusEl.className = 'status-msg triggered';
  }
}

function snoozeAlarm() {
  stopAlarmSound();
  isAlarmRinging = false;
  const modal = document.getElementById('alarmModal');
  if (modal) modal.classList.add('hidden');

  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  alarmTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  lastAlarmMinuteTriggered = null;

  const alarmInput = document.getElementById('alarmTime');
  if (alarmInput) alarmInput.value = alarmTime;

  const h = now.getHours();
  const m = now.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;

  const statusEl = document.getElementById('alarmStatus');
  if (statusEl) {
    statusEl.textContent = `Snoozed! Next alarm at ${pad(h12)}:${pad(m)} ${period}`;
    statusEl.className = 'status-msg active';
  }
}

function dismissRinging() {
  stopAlarmSound();
  isAlarmRinging = false;
  const modal = document.getElementById('alarmModal');
  if (modal) modal.classList.add('hidden');

  if (activeModalType === 'alarm') {
    alarmTime = null;
    const statusEl = document.getElementById('alarmStatus');
    if (statusEl) {
      statusEl.textContent = 'Alarm dismissed';
      statusEl.className = 'status-msg';
    }
  }
}

// ---------------- STOPWATCH ----------------
let stopwatchMilliseconds = 0;
let stopwatchInterval = null;
let lapCounter = 0;
let lastLapMilliseconds = 0;

function updateStopwatch() {
  let ms = Math.floor(stopwatchMilliseconds % 1000);
  let totalSeconds = Math.floor(stopwatchMilliseconds / 1000);
  let hrs = Math.floor(totalSeconds / 3600);
  let mins = Math.floor((totalSeconds % 3600) / 60);
  let secs = totalSeconds % 60;
  const display = document.getElementById('stopwatchDisplay');
  if (display) {
    display.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
  }
}

function startStopwatch() {
  if (!stopwatchInterval) {
    let lastUpdate = performance.now();
    stopwatchInterval = setInterval(() => {
      let now = performance.now();
      stopwatchMilliseconds += (now - lastUpdate);
      lastUpdate = now;
      updateStopwatch();
    }, 10);
    const startBtn = document.getElementById('startStopwatchBtn');
    if (startBtn) startBtn.textContent = 'Running...';
  }
}

function stopStopwatch() {
  if (stopwatchInterval) {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
    const startBtn = document.getElementById('startStopwatchBtn');
    if (startBtn) startBtn.textContent = 'Resume';
  }
}

function resetStopwatch() {
  stopStopwatch();
  stopwatchMilliseconds = 0;
  lapCounter = 0;
  lastLapMilliseconds = 0;
  updateStopwatch();
  const lapsContainer = document.getElementById('stopwatchLaps');
  if (lapsContainer) lapsContainer.innerHTML = '';
  const startBtn = document.getElementById('startStopwatchBtn');
  if (startBtn) startBtn.textContent = 'Start';
}

function lapStopwatch() {
  if (stopwatchMilliseconds === 0) return;
  lapCounter++;
  const currentTotal = document.getElementById('stopwatchDisplay').textContent;
  const splitMs = stopwatchMilliseconds - lastLapMilliseconds;
  lastLapMilliseconds = stopwatchMilliseconds;

  const splitSecs = Math.floor(splitMs / 1000);
  const sMins = Math.floor(splitSecs / 60);
  const sSecs = splitSecs % 60;
  const sMs = Math.floor(splitMs % 1000);
  const splitDisplay = `+${pad(sMins)}:${pad(sSecs)}.${pad(sMs, 3)}`;

  const lapEl = document.createElement('div');
  lapEl.className = 'lap-item';
  lapEl.innerHTML = `
    <span class="lap-number">Lap ${lapCounter}</span>
    <span class="lap-split">${splitDisplay}</span>
    <span class="lap-total">${currentTotal}</span>
  `;
  const container = document.getElementById('stopwatchLaps');
  if (container) {
    container.insertBefore(lapEl, container.firstChild);
  }
}

// ---------------- TIMER ----------------
let timerInterval = null;
let timerRemainingMilliseconds = 5 * 60 * 1000;
let isTimerPaused = false;

function formatTimer(ms) {
  if (ms < 0) ms = 0;
  let totalSeconds = Math.floor(ms / 1000);
  let hrs = Math.floor(totalSeconds / 3600);
  let mins = Math.floor((totalSeconds % 3600) / 60);
  let secs = totalSeconds % 60;
  let millis = Math.floor(ms % 1000);
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
  }
  return `${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  if (display) {
    display.textContent = formatTimer(timerRemainingMilliseconds);
  }
}

function getTimerInputMilliseconds() {
  const hrs = parseInt(document.getElementById('timerHours')?.value || '0', 10) || 0;
  const mins = parseInt(document.getElementById('timerMinutes')?.value || '0', 10) || 0;
  const secs = parseInt(document.getElementById('timerSeconds')?.value || '0', 10) || 0;
  return ((hrs * 3600) + (mins * 60) + secs) * 1000;
}

function setTimerPreset(minutes) {
  stopTimer();
  isTimerPaused = false;
  const hrsEl = document.getElementById('timerHours');
  const minsEl = document.getElementById('timerMinutes');
  const secsEl = document.getElementById('timerSeconds');
  if (hrsEl) hrsEl.value = 0;
  if (minsEl) minsEl.value = minutes;
  if (secsEl) secsEl.value = 0;

  timerRemainingMilliseconds = minutes * 60 * 1000;
  updateTimerDisplay();
  const startBtn = document.getElementById('startTimerBtn');
  if (startBtn) startBtn.textContent = 'Start';
}

function startTimer() {
  getAudioContext();

  if (isTimerPaused && timerRemainingMilliseconds > 0) {
    // Resuming from pause
    isTimerPaused = false;
  } else {
    // Starting fresh from inputs
    const totalMs = getTimerInputMilliseconds();
    if (totalMs <= 0) {
      alert("Please enter a time greater than 0.");
      return;
    }
    timerRemainingMilliseconds = totalMs;
    isTimerPaused = false;
  }

  updateTimerDisplay();
  clearInterval(timerInterval);

  const startBtn = document.getElementById('startTimerBtn');
  if (startBtn) startBtn.textContent = 'Running...';

  let lastUpdate = performance.now();
  timerInterval = setInterval(() => {
    let now = performance.now();
    let elapsed = now - lastUpdate;
    lastUpdate = now;
    timerRemainingMilliseconds -= elapsed;

    if (timerRemainingMilliseconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerRemainingMilliseconds = 0;
      isTimerPaused = false;
      updateTimerDisplay();
      if (startBtn) startBtn.textContent = 'Start';
      triggerTimerDone();
    } else {
      updateTimerDisplay();
    }
  }, 10);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    isTimerPaused = true;
    const startBtn = document.getElementById('startTimerBtn');
    if (startBtn) startBtn.textContent = 'Resume';
  }
}

function resetTimer() {
  stopTimer();
  isTimerPaused = false;
  const inputMs = getTimerInputMilliseconds();
  timerRemainingMilliseconds = inputMs > 0 ? inputMs : 5 * 60 * 1000;
  updateTimerDisplay();
  const startBtn = document.getElementById('startTimerBtn');
  if (startBtn) startBtn.textContent = 'Start';
}

function lapTimer() {
  const time = document.getElementById('timerDisplay')?.textContent;
  const container = document.getElementById('timerLaps');
  if (time && container) {
    const lap = document.createElement('div');
    lap.className = 'lap-item';
    lap.textContent = time;
    container.insertBefore(lap, container.firstChild);
  }
}

function triggerTimerDone() {
  activeModalType = 'timer';
  startAlarmSound();
  const modal = document.getElementById('alarmModal');
  const title = document.getElementById('modalTitle');
  const msg = document.getElementById('modalMessage');
  const snoozeBtn = document.getElementById('snoozeAlertBtn');

  if (title) title.textContent = "TIME'S UP!";
  if (msg) msg.textContent = "Countdown timer has reached zero!";
  if (snoozeBtn) snoozeBtn.style.display = 'none';
  if (modal) modal.classList.remove('hidden');
}

// ---------------- UTILS ----------------
function pad(num, size = 2) {
  return Math.floor(Math.abs(num)).toString().padStart(size, '0');
}

// Initial setups
updateStopwatch();
updateTimerDisplay();
