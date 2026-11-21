// ---------------- LOCAL STORAGE HELPER ----------------
const storage = {
  get(key, defaultValue = null) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      console.warn('Storage read error for', key, e);
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage write error for', key, e);
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

// ---------------- TAB NAVIGATION ----------------
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

  storage.set('clock_active_tab', id);
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

// ---------------- FIXED SPACE DIGIT RENDERER (ORBITRON) ----------------
function setFixedDigits(element, str) {
  if (!element) return;
  // If children count matches string length, update individual character spans
  if (element.children.length === str.length) {
    for (let i = 0; i < str.length; i++) {
      const span = element.children[i];
      if (span.textContent !== str[i]) {
        span.textContent = str[i];
      }
    }
    return;
  }

  // Initial creation or length change (e.g. 12h vs 24h toggle)
  let html = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch >= '0' && ch <= '9') {
      html += '<span class="time-char time-digit">' + ch + '</span>';
    } else if (ch === ':' || ch === '.') {
      html += '<span class="time-char time-sep">' + ch + '</span>';
    } else if (ch === ' ') {
      html += '<span class="time-char time-space"> </span>';
    } else {
      html += '<span class="time-char time-letter">' + ch + '</span>';
    }
  }
  element.innerHTML = html;
}

// ---------------- LOCAL TIME ----------------
let is24HourFormat = storage.get('clock_hour_format', false);
let lastLocalTimeString = '';
let lastLocalDateString = '';

function updateLocalTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !is24HourFormat
  });

  const localEl = document.getElementById('localTime');
  if (localEl && (timeString !== lastLocalTimeString || localEl.children.length === 0)) {
    lastLocalTimeString = timeString;
    setFixedDigits(localEl, timeString);
  }

  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (dateString !== lastLocalDateString) {
    lastLocalDateString = dateString;
    const dateEl = document.getElementById('localDate');
    if (dateEl) {
      dateEl.textContent = dateString;
    }
  }
}

function toggleHourFormat() {
  is24HourFormat = !is24HourFormat;
  storage.set('clock_hour_format', is24HourFormat);
  const btn = document.getElementById('toggleFormatBtn');
  if (btn) {
    btn.textContent = is24HourFormat ? "Switch to 12-Hour Format (AM/PM)" : "Switch to 24-Hour Format";
  }
  lastLocalTimeString = '';
  lastWorldTimeString = '';
  updateLocalTime();
  updateWorldTime();
}

// Update format button text on load
const formatBtn = document.getElementById('toggleFormatBtn');
if (formatBtn) {
  formatBtn.textContent = is24HourFormat ? "Switch to 12-Hour Format (AM/PM)" : "Switch to 24-Hour Format";
}

updateLocalTime();
setInterval(updateLocalTime, 200);

// ---------------- WORLD TIME ----------------
const timezoneSelect = document.getElementById('timezoneSelect');
if (timezoneSelect) {
  const savedWorldTz = storage.get('clock_world_tz');
  if (savedWorldTz) {
    timezoneSelect.value = savedWorldTz;
  }
  timezoneSelect.addEventListener('change', () => {
    storage.set('clock_world_tz', timezoneSelect.value);
    lastWorldTimeString = '';
    lastWorldDateString = '';
    updateWorldTime();
  });
}

let lastWorldTimeString = '';
let lastWorldDateString = '';

function updateWorldTime() {
  const select = document.getElementById('timezoneSelect');
  if (!select) return;
  const tz = select.value;
  const now = new Date();

  try {
    const timeString = now.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !is24HourFormat
    });

    const worldTimeEl = document.getElementById('worldTime');
    if (worldTimeEl && (timeString !== lastWorldTimeString || worldTimeEl.children.length === 0)) {
      lastWorldTimeString = timeString;
      setFixedDigits(worldTimeEl, timeString);
    }

    const dateString = now.toLocaleDateString('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (dateString !== lastWorldDateString) {
      lastWorldDateString = dateString;
      const worldDateEl = document.getElementById('worldDate');
      if (worldDateEl) {
        worldDateEl.textContent = dateString;
      }
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
setInterval(updateWorldTime, 200);

// ---------------- MULTIPLE ALARMS (PERSISTED) ----------------
let alarms = storage.get('clock_alarms', []);
let isAlarmRinging = false;
let activeModalType = null; // 'alarm' or 'timer'
let currentlyRingingAlarm = null;
const lastTriggeredAlarms = new Set(); // Prevent re-triggering during the same minute

function format12Hour(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${pad(h12)}:${pad(m)} ${period}`;
}

function updateAlarmStatus() {
  const statusEl = document.getElementById('alarmStatus');
  if (!statusEl) return;

  const activeAlarms = alarms.filter(a => a.enabled);
  if (alarms.length === 0) {
    statusEl.textContent = 'No alarms configured';
    statusEl.className = 'status-msg';
  } else if (activeAlarms.length === 0) {
    statusEl.textContent = `${alarms.length} alarm(s) set (all disabled)`;
    statusEl.className = 'status-msg';
  } else {
    statusEl.textContent = `${activeAlarms.length} active alarm(s) running`;
    statusEl.className = 'status-msg active';
  }
}

function renderAlarmsList() {
  const container = document.getElementById('alarmsList');
  if (!container) return;

  if (alarms.length === 0) {
    container.innerHTML = '<div style="color: #8b949e; font-size: 0.9rem; padding: 10px 0;">No alarms added yet. Set a time above to add one.</div>';
    return;
  }

  container.innerHTML = alarms.map(alarm => {
    const formatted12 = format12Hour(alarm.time);
    const activeClass = alarm.enabled ? 'active' : 'inactive';
    const statusText = alarm.enabled ? 'Active' : 'Off';
    const itemDisabledClass = alarm.enabled ? '' : 'disabled';

    return `
      <div class="alarm-item ${itemDisabledClass}" data-id="${alarm.id}">
        <div class="alarm-info">
          <div class="alarm-time-text">${formatted12}</div>
          <div class="alarm-label-text">${escapeHtml(alarm.label)} &bull; ${alarm.time}</div>
        </div>
        <div class="alarm-actions">
          <button class="alarm-toggle ${activeClass}" onclick="toggleAlarm('${alarm.id}')" title="Toggle Alarm">
            ${statusText}
          </button>
          <button class="btn-delete" onclick="deleteAlarm('${alarm.id}')" title="Delete Alarm">
            &#10005;
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function saveAlarms() {
  storage.set('clock_alarms', alarms);
  renderAlarmsList();
  updateAlarmStatus();
}

function addAlarm() {
  const timeInput = document.getElementById('alarmTime');
  const labelInput = document.getElementById('alarmLabel');
  const val = timeInput ? timeInput.value : '';
  const label = labelInput ? labelInput.value.trim() : '';

  if (!val) {
    const statusEl = document.getElementById('alarmStatus');
    if (statusEl) {
      statusEl.textContent = 'Please choose a time for the alarm!';
      statusEl.className = 'status-msg warning';
    }
    return;
  }

  const newAlarm = {
    id: 'alarm_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
    time: val,
    label: label || `Alarm ${alarms.length + 1}`,
    enabled: true
  };

  alarms.push(newAlarm);
  saveAlarms();

  if (timeInput) timeInput.value = '';
  if (labelInput) labelInput.value = '';
  getAudioContext();
}

function setAlarm() {
  addAlarm();
}

function toggleAlarm(id) {
  const alarm = alarms.find(a => String(a.id) === String(id));
  if (alarm) {
    alarm.enabled = !alarm.enabled;
    saveAlarms();
  }
}

function deleteAlarm(id) {
  alarms = alarms.filter(a => String(a.id) !== String(id));
  saveAlarms();
}

function clearAllAlarms() {
  if (alarms.length === 0) return;
  alarms = [];
  saveAlarms();
}

function clearAlarm() {
  clearAllAlarms();
}

// Alarm check loop (every 1000ms)
setInterval(() => {
  if (alarms.length === 0 || isAlarmRinging) return;
  const now = new Date();
  const currentHHMM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const minuteKey = `${currentHHMM}_${now.toDateString()}`;

  for (const alarm of alarms) {
    if (alarm.enabled && alarm.time === currentHHMM) {
      const triggerKey = `${alarm.id}_${minuteKey}`;
      if (!lastTriggeredAlarms.has(triggerKey)) {
        lastTriggeredAlarms.add(triggerKey);
        triggerAlarm(alarm);
        break;
      }
    }
  }
}, 1000);

function triggerAlarm(alarm) {
  isAlarmRinging = true;
  activeModalType = 'alarm';
  currentlyRingingAlarm = alarm;
  startAlarmSound();

  const modal = document.getElementById('alarmModal');
  const title = document.getElementById('modalTitle');
  const msg = document.getElementById('modalMessage');
  const snoozeBtn = document.getElementById('snoozeAlertBtn');

  if (title) title.textContent = 'ALARM RINGING!';
  const formattedTime = format12Hour(alarm.time);
  if (msg) msg.textContent = `${alarm.label} (${formattedTime}) is ringing!`;
  if (snoozeBtn) snoozeBtn.style.display = 'inline-block';
  if (modal) modal.classList.remove('hidden');

  const statusEl = document.getElementById('alarmStatus');
  if (statusEl) {
    statusEl.textContent = `🔔 Alarm "${alarm.label}" is ringing!`;
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
  const snoozeTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const snoozedAlarm = {
    id: Date.now(),
    time: snoozeTime,
    label: currentlyRingingAlarm ? `Snooze: ${currentlyRingingAlarm.label}` : 'Snoozed Alarm',
    enabled: true,
    isSnooze: true
  };
  alarms.push(snoozedAlarm);
  saveAlarms();
}

function dismissRinging() {
  stopAlarmSound();
  isAlarmRinging = false;
  const modal = document.getElementById('alarmModal');
  if (modal) modal.classList.add('hidden');

  if (activeModalType === 'alarm') {
    if (currentlyRingingAlarm && currentlyRingingAlarm.isSnooze) {
      deleteAlarm(currentlyRingingAlarm.id);
    }
    currentlyRingingAlarm = null;
    updateAlarmStatus();
  }
}

// ---------------- STOPWATCH (PERSISTED) ----------------
let stopwatchMilliseconds = 0;
let stopwatchInterval = null;
let lapCounter = 0;
let lastLapMilliseconds = 0;
let stopwatchWallStartTime = null;
let stopwatchAccumulatedMs = 0;
let stopwatchLapsData = [];

function saveStopwatchState() {
  const isRunning = stopwatchInterval !== null;
  storage.set('clock_stopwatch', {
    isRunning,
    stopwatchWallStartTime,
    stopwatchAccumulatedMs: stopwatchMilliseconds,
    laps: stopwatchLapsData,
    lapCounter,
    lastLapMilliseconds
  });
}

function restoreStopwatchState() {
  const saved = storage.get('clock_stopwatch');
  if (!saved) return;

  stopwatchLapsData = saved.laps || [];
  lapCounter = saved.lapCounter || 0;
  lastLapMilliseconds = saved.lastLapMilliseconds || 0;

  const container = document.getElementById('stopwatchLaps');
  if (container) {
    container.innerHTML = '';
    for (const lap of stopwatchLapsData) {
      const lapEl = document.createElement('div');
      lapEl.className = 'lap-item';
      lapEl.innerHTML = `
        <span class="lap-number">Lap ${lap.number}</span>
        <span class="lap-split">${lap.split}</span>
        <span class="lap-total">${lap.total}</span>
      `;
      container.appendChild(lapEl);
    }
  }

  if (saved.isRunning && saved.stopwatchWallStartTime) {
    const elapsedSince = Date.now() - saved.stopwatchWallStartTime;
    stopwatchMilliseconds = (saved.stopwatchAccumulatedMs || 0) + elapsedSince;
    updateStopwatch();
    startStopwatch();
  } else if (saved.stopwatchAccumulatedMs > 0) {
    stopwatchMilliseconds = saved.stopwatchAccumulatedMs;
    updateStopwatch();
    const startBtn = document.getElementById('startStopwatchBtn');
    if (startBtn) startBtn.textContent = 'Resume';
  }
}

function updateStopwatch() {
  let totalSeconds = Math.floor(stopwatchMilliseconds / 1000);
  let hrs = Math.floor(totalSeconds / 3600);
  let mins = Math.floor((totalSeconds % 3600) / 60);
  let secs = totalSeconds % 60;
  let ms = Math.floor(stopwatchMilliseconds % 1000);
  const display = document.getElementById('stopwatchDisplay');
  if (display) {
    const str = `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
    setFixedDigits(display, str);
  }
}

function startStopwatch() {
  if (!stopwatchInterval) {
    let lastUpdate = performance.now();
    stopwatchWallStartTime = Date.now();
    stopwatchAccumulatedMs = stopwatchMilliseconds;

    stopwatchInterval = setInterval(() => {
      let now = performance.now();
      stopwatchMilliseconds += (now - lastUpdate);
      lastUpdate = now;
      updateStopwatch();
    }, 10);

    const startBtn = document.getElementById('startStopwatchBtn');
    if (startBtn) startBtn.textContent = 'Running...';
    saveStopwatchState();
  }
}

function stopStopwatch() {
  if (stopwatchInterval) {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
    const startBtn = document.getElementById('startStopwatchBtn');
    if (startBtn) startBtn.textContent = 'Resume';
    saveStopwatchState();
  }
}

function resetStopwatch() {
  stopStopwatch();
  stopwatchMilliseconds = 0;
  lapCounter = 0;
  lastLapMilliseconds = 0;
  stopwatchWallStartTime = null;
  stopwatchAccumulatedMs = 0;
  stopwatchLapsData = [];
  const display = document.getElementById('stopwatchDisplay');
  if (display) {
    setFixedDigits(display, '00:00:00.000');
  }
  const lapsContainer = document.getElementById('stopwatchLaps');
  if (lapsContainer) lapsContainer.innerHTML = '';
  const startBtn = document.getElementById('startStopwatchBtn');
  if (startBtn) startBtn.textContent = 'Start';
  saveStopwatchState();
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

  stopwatchLapsData.unshift({
    number: lapCounter,
    split: splitDisplay,
    total: currentTotal
  });

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
  saveStopwatchState();
}

// ---------------- TIMER (PERSISTED) ----------------
let timerInterval = null;
let timerRemainingMilliseconds = 5 * 60 * 1000;
let timerInitialMilliseconds = 5 * 60 * 1000;
let isTimerPaused = false;
let lastTimerDisplayString = '';
let timerTargetEndTime = null;

function saveTimerState() {
  const isRunning = timerInterval !== null;
  const hrs = parseInt(document.getElementById('timerHours')?.value || '0', 10) || 0;
  const mins = parseInt(document.getElementById('timerMinutes')?.value || '5', 10) || 0;
  const secs = parseInt(document.getElementById('timerSeconds')?.value || '0', 10) || 0;

  storage.set('clock_timer', {
    isRunning,
    isTimerPaused,
    timerRemainingMilliseconds,
    timerInitialMilliseconds,
    timerTargetEndTime,
    hours: hrs,
    minutes: mins,
    seconds: secs
  });
}

function restoreTimerState() {
  const saved = storage.get('clock_timer');
  if (!saved) return;

  if (document.getElementById('timerHours')) document.getElementById('timerHours').value = saved.hours ?? 0;
  if (document.getElementById('timerMinutes')) document.getElementById('timerMinutes').value = saved.minutes ?? 5;
  if (document.getElementById('timerSeconds')) document.getElementById('timerSeconds').value = saved.seconds ?? 0;

  timerInitialMilliseconds = saved.timerInitialMilliseconds || 5 * 60 * 1000;

  if (saved.isRunning && saved.timerTargetEndTime) {
    const remaining = saved.timerTargetEndTime - Date.now();
    if (remaining <= 0) {
      timerRemainingMilliseconds = 0;
      updateTimerDisplay();
      triggerTimerDone();
    } else {
      timerRemainingMilliseconds = remaining;
      updateTimerDisplay();
      startTimer();
    }
  } else if (saved.isTimerPaused && saved.timerRemainingMilliseconds > 0) {
    timerRemainingMilliseconds = saved.timerRemainingMilliseconds;
    isTimerPaused = true;
    updateTimerDisplay();
    const startBtn = document.getElementById('startTimerBtn');
    if (startBtn) startBtn.textContent = 'Resume';
  } else if (saved.timerRemainingMilliseconds > 0) {
    timerRemainingMilliseconds = saved.timerRemainingMilliseconds;
    updateTimerDisplay();
  }
}

function formatTimer(ms) {
  if (ms < 0) ms = 0;
  let totalSeconds = Math.floor(ms / 1000);
  let hrs = Math.floor(totalSeconds / 3600);
  let mins = Math.floor((totalSeconds % 3600) / 60);
  let secs = totalSeconds % 60;
  let millis = Math.floor(ms % 1000);
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  if (display) {
    const formatted = formatTimer(timerRemainingMilliseconds);
    if (formatted !== lastTimerDisplayString || display.children.length === 0) {
      lastTimerDisplayString = formatted;
      setFixedDigits(display, formatted);
    }
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
  timerTargetEndTime = null;
  const hrsEl = document.getElementById('timerHours');
  const minsEl = document.getElementById('timerMinutes');
  const secsEl = document.getElementById('timerSeconds');
  if (hrsEl) hrsEl.value = 0;
  if (minsEl) minsEl.value = minutes;
  if (secsEl) secsEl.value = 0;

  timerRemainingMilliseconds = minutes * 60 * 1000;
  timerInitialMilliseconds = timerRemainingMilliseconds;
  lastTimerDisplayString = '';
  updateTimerDisplay();
  const startBtn = document.getElementById('startTimerBtn');
  if (startBtn) startBtn.textContent = 'Start';
  saveTimerState();
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
    timerInitialMilliseconds = totalMs;
    isTimerPaused = false;
  }

  timerTargetEndTime = Date.now() + timerRemainingMilliseconds;
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
      timerTargetEndTime = null;
      updateTimerDisplay();
      if (startBtn) startBtn.textContent = 'Start';
      saveTimerState();
      triggerTimerDone();
    } else {
      updateTimerDisplay();
    }
  }, 10);

  saveTimerState();
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
    isTimerPaused = true;
    timerTargetEndTime = null;
    const startBtn = document.getElementById('startTimerBtn');
    if (startBtn) startBtn.textContent = 'Resume';
    saveTimerState();
  }
}

function resetTimer() {
  stopTimer();
  isTimerPaused = false;
  timerTargetEndTime = null;
  const inputMs = getTimerInputMilliseconds();
  timerRemainingMilliseconds = inputMs > 0 ? inputMs : 5 * 60 * 1000;
  timerInitialMilliseconds = timerRemainingMilliseconds;
  lastTimerDisplayString = '';
  updateTimerDisplay();
  const startBtn = document.getElementById('startTimerBtn');
  if (startBtn) startBtn.textContent = 'Start';
  saveTimerState();
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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

// Window unload listeners to ensure latest state is saved
window.addEventListener('beforeunload', () => {
  saveStopwatchState();
  saveTimerState();
});

// ---------------- INITIAL SETUPS ----------------
renderAlarmsList();
updateAlarmStatus();
restoreStopwatchState();
restoreTimerState();
updateStopwatch();
updateTimerDisplay();

// Restore active tab
const savedTab = storage.get('clock_active_tab', 'local');
showTab(savedTab);
