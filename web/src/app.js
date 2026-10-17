import { loadDemoData, formatDate, formatPercent } from './data.js';
import { translations } from './i18n.js';

const state = { language: 'vi', theme: document.documentElement.dataset.theme || 'light', data: null, zone: null, row: null };
const $ = (selector) => document.querySelector(selector);

function applyTranslations() {
  document.documentElement.lang = state.language;
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const value = translations[state.language][element.dataset.i18n];
    if (value) element.textContent = value;
  });
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('ev-warning-theme', theme); } catch (_) {}
}

function getZoneRows(zone) {
  return state.data.predictions.filter((item) => item.zone_id === zone);
}

function renderSelectors() {
  const zones = [...new Set(state.data.predictions.map((item) => item.zone_id))].sort((a, b) => Number(a) - Number(b));
  const zoneSelect = $('#zoneSelect');
  zoneSelect.innerHTML = zones.map((zone) => `<option value="${zone}">TAZ ${zone}</option>`).join('');
  state.zone = state.zone || zones[0];
  zoneSelect.value = state.zone;
  renderTimes();
}

function renderTimes() {
  const rows = getZoneRows(state.zone);
  const timeSelect = $('#timeSelect');
  timeSelect.innerHTML = rows.map((item, index) => `<option value="${index}">${formatDate(item.observation_time, state.language)}</option>`).join('');
  state.row = Math.max(0, Math.min(state.row || 0, rows.length - 1));
  timeSelect.value = String(state.row);
  renderPrediction();
}

function renderPrediction() {
  const rows = getZoneRows(state.zone);
  const row = rows[state.row] || rows[0];
  if (!row) return;
  const probability = row.lstm_probability;
  const isRisk = probability >= 0.5;
  $('#currentRate').textContent = formatPercent(row.current_rate);
  $('#targetRate').textContent = formatPercent(row.target_rate_next_hour);
  $('#probability').textContent = probability.toFixed(2);
  $('#probabilityRingText').textContent = formatPercent(probability);
  $('#probabilityMeter').style.width = `${probability * 100}%`;
  $('#probabilityRing').style.setProperty('--progress', `${probability * 360}deg`);
  $('#riskLabel').textContent = isRisk ? (state.language === 'vi' ? 'CẦN THEO DÕI' : 'WATCH') : (state.language === 'vi' ? 'BÌNH THƯỜNG' : 'NORMAL');
  $('#riskLabel').classList.toggle('is-risk', isRisk);
  $('#predictionMessage').textContent = isRisk
    ? (state.language === 'vi' ? `Khu vực ${state.zone} có nguy cơ gần đầy trong giờ kế tiếp.` : `Area ${state.zone} may become near-full in the next hour.`)
    : (state.language === 'vi' ? `Chưa thấy tín hiệu cần cảnh báo cho giờ kế tiếp.` : `No alert signal is indicated for the next hour.`);
  renderTrend(rows);
}

function renderTrend(rows) {
  const width = 720; const height = 220; const pad = 22;
  const points = rows.map((item, index) => {
    const x = pad + (index / Math.max(1, rows.length - 1)) * (width - pad * 2);
    const y = height - pad - item.lstm_probability * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const current = rows[state.row] || rows[0];
  const index = Math.max(0, rows.indexOf(current));
  const currentX = pad + (index / Math.max(1, rows.length - 1)) * (width - pad * 2);
  const currentY = height - pad - current.lstm_probability * (height - pad * 2);
  $('#trendChart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="presentation"><line class="grid-line" x1="${pad}" y1="${height - pad - (height - pad * 2) * .8}" x2="${width - pad}" y2="${height - pad - (height - pad * 2) * .8}"/><polyline class="trend-line" points="${points}"/><circle class="trend-point" cx="${currentX}" cy="${currentY}" r="5"/><text class="threshold-text" x="${width - 92}" y="${height - pad - (height - pad * 2) * .8 - 8}">80%</text></svg>`;
}

function renderMetrics() {
  const rows = [...state.data.metrics].sort((a, b) => b.pr_auc - a.pr_auc);
  $('#metricsBody').innerHTML = rows.map((item, index) => `<tr class="${item.model === 'LSTM' ? 'is-primary' : ''}"><td><span class="rank">0${index + 1}</span><strong>${item.model}</strong></td><td>${item.pr_auc.toFixed(3)}</td><td>${item.recall.toFixed(3)}</td><td>${item.f1.toFixed(3)}</td><td>${item.brier_score.toFixed(3)}</td></tr>`).join('');
}

function setupReveal() {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
}

function setupEvents() {
  $('#themeToggle').addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
  document.querySelectorAll('[data-language]').forEach((button) => button.addEventListener('click', () => {
    state.language = button.dataset.language;
    document.querySelectorAll('[data-language]').forEach((item) => item.classList.toggle('is-active', item === button));
    applyTranslations(); renderTimes(); renderPrediction();
  }));
  $('#zoneSelect').addEventListener('change', (event) => { state.zone = event.target.value; state.row = 0; renderTimes(); });
  $('#timeSelect').addEventListener('change', (event) => { state.row = Number(event.target.value); renderPrediction(); });
  const menu = $('#mobileNav');
  $('#menuToggle').addEventListener('click', () => { const isOpen = !menu.hidden; menu.hidden = isOpen; $('#menuToggle').setAttribute('aria-expanded', String(!isOpen)); });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => { menu.hidden = true; $('#menuToggle').setAttribute('aria-expanded', 'false'); }));
}

async function init() {
  try {
    state.data = await loadDemoData();
    applyTranslations(); renderSelectors(); renderMetrics(); setupEvents(); setupReveal();
  } catch (error) {
    document.body.insertAdjacentHTML('beforeend', `<div class="load-error">Demo data could not be loaded. Run the site through a local server.</div>`);
    console.error(error);
  }
}

init();
