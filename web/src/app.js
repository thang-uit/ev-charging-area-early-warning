import { loadDemoData, formatDate, formatPercent } from './data.js';
import { translations } from './i18n.js';
import { renderZoneMap } from './map.js';

const state = { language: 'vi', theme: document.documentElement.dataset.theme || 'light', data: null, zone: null, row: 0, customSelects: new Map() };
const $ = (selector) => document.querySelector(selector);

function applyTranslations() {
  document.documentElement.lang = state.language;
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const value = translations[state.language][element.dataset.i18n];
    if (value) element.textContent = value;
  });
  document.querySelectorAll('[data-i18n-alt]').forEach((element) => {
    const value = translations[state.language][element.dataset.i18nAlt];
    if (value) element.setAttribute('alt', value);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
    const value = translations[state.language][element.dataset.i18nAria];
    if (value) element.setAttribute('aria-label', value);
  });
  const themeLabel = $('.theme-toggle-label');
  if (themeLabel) themeLabel.textContent = state.theme === 'dark'
    ? (state.language === 'vi' ? 'SÁNG' : 'LIGHT')
    : (state.language === 'vi' ? 'TỐI' : 'DARK');
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('ev-warning-theme', theme); } catch (_) {}
  applyTranslations();
}

function updateMenuLabel(isOpen) {
  const labelKey = isOpen ? 'menu.close' : 'menu.aria';
  const label = translations[state.language][labelKey];
  if (label) $('#menuToggle').setAttribute('aria-label', label);
}

function setMobileMenu(isOpen) {
  const menu = $('#mobileNav');
  const scrim = $('#mobileNavScrim');
  const menuButton = $('#menuToggle');
  if (isOpen) {
    menu.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(() => {
      menu.classList.add('is-open');
      scrim.classList.add('is-visible');
    });
  } else {
    menu.classList.remove('is-open');
    scrim.classList.remove('is-visible');
    window.setTimeout(() => {
      if (!menu.classList.contains('is-open')) {
        menu.hidden = true;
        scrim.hidden = true;
      }
    }, 560);
  }
  menuButton.setAttribute('aria-expanded', String(isOpen));
  updateMenuLabel(isOpen);
}

function getZoneRows(zone) { return state.data.predictions.filter((item) => item.zone_id === zone); }

function closeCustomSelects(except = null) {
  state.customSelects.forEach((control, key) => {
    if (key === except) return;
    control.root.classList.remove('is-open');
    control.trigger.setAttribute('aria-expanded', 'false');
    control.menu.classList.remove('is-open');
    window.setTimeout(() => {
      if (!control.root.classList.contains('is-open')) control.menu.hidden = true;
    }, 220);
  });
}

function renderCustomSelect(key, options, selectedValue, onChange) {
  const control = state.customSelects.get(key);
  if (!control) return;
  control.options = options;
  control.value = String(selectedValue);
  control.onChange = onChange;
  const selected = options.find((option) => String(option.value) === control.value) || options[0];
  control.value = selected ? String(selected.value) : '';
  control.valueElement.textContent = selected?.label || '--';
  control.menu.innerHTML = '';
  options.forEach((option) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'select-option';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(String(option.value) === control.value));
    item.dataset.value = String(option.value);
    item.textContent = option.label;
    item.addEventListener('click', () => chooseCustomSelect(key, option.value));
    control.menu.append(item);
  });
}

function chooseCustomSelect(key, value) {
  const control = state.customSelects.get(key);
  if (!control) return;
  control.value = String(value);
  const selected = control.options.find((option) => String(option.value) === control.value);
  control.valueElement.textContent = selected?.label || '--';
  control.menu.querySelectorAll('.select-option').forEach((item) => item.setAttribute('aria-selected', String(item.dataset.value === control.value)));
  closeCustomSelects();
  control.onChange?.(control.value);
}

function setupCustomSelects() {
  document.querySelectorAll('[data-select-control]').forEach((root) => {
    const key = root.dataset.selectControl;
    const trigger = root.querySelector('.select-trigger');
    const menu = root.querySelector('.select-menu');
    const valueElement = root.querySelector('.select-value');
    const control = { root, trigger, menu, valueElement, options: [], value: '', onChange: null };
    state.customSelects.set(key, control);
    trigger.addEventListener('click', () => {
      const isOpen = root.classList.contains('is-open');
      closeCustomSelects(isOpen ? null : key);
      root.classList.toggle('is-open', !isOpen);
      trigger.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) {
        menu.hidden = false;
        requestAnimationFrame(() => menu.classList.add('is-open'));
        menu.querySelector('.select-option[aria-selected="true"]')?.focus();
      }
    });
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        trigger.click();
      }
    });
    menu.addEventListener('keydown', (event) => {
      const items = [...menu.querySelectorAll('.select-option')];
      const current = items.indexOf(document.activeElement);
      if (event.key === 'Escape') { closeCustomSelects(); trigger.focus(); }
      if (event.key === 'ArrowDown') { event.preventDefault(); items[Math.min(current + 1, items.length - 1)]?.focus(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); items[Math.max(current - 1, 0)]?.focus(); }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.activeElement?.click(); }
    });
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-select-control]')) closeCustomSelects();
  });
}

function renderSelectors() {
  const zones = [...new Set(state.data.predictions.map((item) => item.zone_id))].sort((a, b) => Number(a) - Number(b));
  state.zone = state.zone || zones[0];
  renderCustomSelect('zone', zones.map((zone) => ({ value: zone, label: `TAZ ${zone}` })), state.zone, (value) => {
    state.zone = value;
    state.row = 0;
    renderTimes();
  });
  renderTimes();
}

function renderTimes() {
  const rows = getZoneRows(state.zone);
  state.row = Math.max(0, Math.min(state.row || 0, rows.length - 1));
  renderCustomSelect('time', rows.map((item, index) => ({ value: index, label: formatDate(item.observation_time, state.language) })), state.row, (value) => {
    state.row = Number(value);
    renderPrediction();
  });
  renderPrediction();
}

function renderPrediction() {
  const rows = getZoneRows(state.zone);
  const row = rows[state.row] || rows[0];
  if (!row) return;
  const probability = Number(row.lstm_probability);
  const isRisk = probability >= 0.5;
  $('#currentRate').textContent = formatPercent(row.current_rate);
  $('#targetRate').textContent = formatPercent(row.target_rate_next_hour);
  $('#probability').textContent = probability.toFixed(2);
  $('#heroProbability').innerHTML = `${probability.toFixed(2)} <em>${isRisk ? (state.language === 'vi' ? 'CẦN THEO DÕI' : 'WATCH') : (state.language === 'vi' ? 'BÌNH THƯỜNG' : 'NORMAL')}</em>`;
  $('#heroProbabilityCallout').textContent = probability.toFixed(2);
  $('#probabilityRingText').textContent = formatPercent(probability);
  $('#probabilityMeter').style.width = `${probability * 100}%`;
  $('#probabilityRing').style.setProperty('--progress', `${probability * 360}deg`);
  $('#riskLabel').textContent = isRisk ? (state.language === 'vi' ? 'CẦN THEO DÕI' : 'WATCH') : (state.language === 'vi' ? 'BÌNH THƯỜNG' : 'NORMAL');
  $('#riskLabel').classList.toggle('is-risk', isRisk);
  $('#predictionMessage').textContent = isRisk
    ? (state.language === 'vi' ? `Khu vực ${state.zone} có tín hiệu cần ưu tiên xem xét trong giờ kế tiếp.` : `Area ${state.zone} deserves priority review for the next hour.`)
    : (state.language === 'vi' ? 'Chưa thấy tín hiệu cần cảnh báo cho giờ kế tiếp.' : 'No alert signal is indicated for the next hour.');
  renderTrend(rows);
  renderZoneMap($('#zoneMap'), state.data.zones, state.data.predictions, state.zone, row.observation_time);
  const zoneInfo = state.data.zones.find((zone) => zone.id === state.zone);
  $('#mapTitle').textContent = `TAZ ${state.zone}`;
  $('#mapZoneDetail').textContent = state.language === 'vi'
    ? `Khu vực ${state.zone} trong tập dự đoán. Điểm lớn hơn thể hiện sức chứa tương đối.`
    : `Area ${state.zone} in the prediction set. Larger points indicate relative capacity.`;
  $('#mapCapacity').textContent = zoneInfo ? `${zoneInfo.capacity} ${state.language === 'vi' ? 'trụ' : 'piles'}` : '--';
  $('#mapProbability').textContent = formatPercent(probability);
}

function renderTrend(rows) {
  const width = 720; const height = 230; const pad = 22;
  const scaleX = (index) => pad + (index / Math.max(1, rows.length - 1)) * (width - pad * 2);
  const scaleY = (value) => height - pad - Number(value) * (height - pad * 2);
  const points = rows.map((item, index) => `${scaleX(index).toFixed(1)},${scaleY(item.lstm_probability).toFixed(1)}`).join(' ');
  const areaPoints = `${pad},${height - pad} ${points} ${width - pad},${height - pad}`;
  const current = rows[state.row] || rows[0];
  const index = Math.max(0, rows.indexOf(current));
  const thresholdY = scaleY(.5);
  $('#trendChart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="presentation"><line class="grid-line" x1="${pad}" y1="${scaleY(.8)}" x2="${width - pad}" y2="${scaleY(.8)}"/><line class="grid-line" x1="${pad}" y1="${scaleY(.2)}" x2="${width - pad}" y2="${scaleY(.2)}"/><line class="threshold-line" x1="${pad}" y1="${thresholdY}" x2="${width - pad}" y2="${thresholdY}"/><polygon class="trend-area" points="${areaPoints}"/><polyline class="trend-line" points="${points}"/><circle class="trend-point" cx="${scaleX(index)}" cy="${scaleY(current.lstm_probability)}" r="5"/><text class="threshold-text" x="${width - 128}" y="${thresholdY - 8}">0.5</text></svg>`;
}

function renderMetrics() {
  const rows = [...state.data.metrics].sort((a, b) => b.pr_auc - a.pr_auc);
  $('#metricsBody').innerHTML = rows.map((item, index) => `<tr class="${item.model === 'LSTM' ? 'is-primary' : ''}"><td><span class="model-name"><span class="rank">0${index + 1}</span>${item.model}</span></td><td>${item.log_loss.toFixed(4)}</td><td>${item.brier_score.toFixed(4)}</td><td>${item.pr_auc.toFixed(4)}</td><td>${item.recall.toFixed(4)}</td><td>${item.f1.toFixed(4)}</td></tr>`).join('');
}

function setupReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { elements.forEach((element) => element.classList.add('is-visible')); return; }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: 0.12 });
  elements.forEach((element) => observer.observe(element));
}

function setupNavigation() {
  const sections = [...document.querySelectorAll('main section[id]')];
  const links = [...document.querySelectorAll('.main-nav a[data-nav]')];
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) links.forEach((link) => link.classList.toggle('is-current', link.dataset.nav === entry.target.id)); }), { rootMargin: '-35% 0px -55% 0px' });
  sections.forEach((section) => observer.observe(section));
}

function setupEvents() {
  $('#themeToggle').addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
  document.querySelectorAll('[data-language]').forEach((button) => button.addEventListener('click', () => {
    state.language = button.dataset.language;
    document.querySelectorAll('[data-language]').forEach((item) => item.classList.toggle('is-active', item === button));
    applyTranslations();
    updateMenuLabel($('#menuToggle').getAttribute('aria-expanded') === 'true');
    renderTimes();
  }));
  const menu = $('#mobileNav');
  $('#menuToggle').addEventListener('click', () => setMobileMenu(menu.hidden));
  $('#mobileNavScrim').addEventListener('click', () => setMobileMenu(false));
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMobileMenu(false)));
  $('#zoneMap').addEventListener('click', (event) => {
    const point = event.target.closest('.map-point-selected, .map-point-active');
    if (point?.dataset.zone) chooseCustomSelect('zone', point.dataset.zone);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !menu.hidden) setMobileMenu(false); });
  $('#heroVisual').addEventListener('pointermove', (event) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.innerWidth < 780) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    event.currentTarget.style.transform = `perspective(1200px) rotateY(${x * -7 - 1}deg) rotateX(${y * 5 + 2}deg)`;
  });
  $('#heroVisual').addEventListener('pointerleave', (event) => { event.currentTarget.style.transform = ''; });
}

async function init() {
  try {
    state.data = await loadDemoData();
    applyTranslations(); setupCustomSelects(); renderSelectors(); renderMetrics(); setupEvents(); setupReveal(); setupNavigation();
  } catch (error) {
    document.body.insertAdjacentHTML('beforeend', '<div class="load-error">Demo data could not be loaded. Run the site through a local server.</div>');
    console.error(error);
  }
}

init();
