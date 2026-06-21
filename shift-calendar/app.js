/* ==========================================================================
   Календарь смен — учёт дохода
   Универсальное веб-приложение: шаблоны рабочих смен, проставление их по дням
   календаря, расчёт дохода, статистика и экспорт в Excel / CSV.
   Данные хранятся локально в браузере (localStorage).
   ========================================================================== */

'use strict';

const STORAGE_KEY = 'shiftCalendar.v1';

/* ----- Состояние приложения ----- */
const state = {
  currency: '₽',
  templates: [],          // {id, name, start, end, breakMin, payType, rate, color}
  shifts: {},             // { 'YYYY-MM-DD': [templateId, ...] }
  activeTemplateId: null, // выбранный шаблон для «кисти»
  view: new Date(),       // отображаемый месяц
  statsScope: 'month',
};

/* ===================== Утилиты ===================== */

function uid() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function pad(n) { return String(n).padStart(2, '0'); }

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** Длительность смены в часах с учётом перерыва и ночных смен. */
function shiftHours(tpl) {
  const [sh, sm] = tpl.start.split(':').map(Number);
  const [eh, em] = tpl.end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;           // переход через полночь
  mins -= (tpl.breakMin || 0);
  return Math.max(0, mins / 60);
}

/** Доход за одну смену по шаблону. */
function shiftEarnings(tpl) {
  if (tpl.payType === 'fixed') return tpl.rate;
  return shiftHours(tpl) * tpl.rate;
}

function templateById(id) {
  return state.templates.find(t => t.id === id) || null;
}

function fmtMoney(value) {
  const rounded = Math.round(value * 100) / 100;
  const str = rounded.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return `${str} ${state.currency}`;
}

function fmtHours(value) {
  return (Math.round(value * 100) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

/* ===================== Хранилище ===================== */

function save() {
  const data = {
    currency: state.currency,
    templates: state.templates,
    shifts: state.shifts,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      state.currency = data.currency || '₽';
      state.templates = Array.isArray(data.templates) ? data.templates : [];
      state.shifts = data.shifts || {};
    }
  } catch (e) {
    console.warn('Не удалось загрузить данные:', e);
  }
  if (state.templates.length === 0) seedTemplates();
}

/** Демонстрационные шаблоны при первом запуске. */
function seedTemplates() {
  state.templates = [
    { id: uid(), name: 'Дневная', start: '09:00', end: '18:00', breakMin: 60, payType: 'hourly', rate: 250, color: '#4f86f7' },
    { id: uid(), name: 'Ночная',  start: '20:00', end: '08:00', breakMin: 0,  payType: 'hourly', rate: 320, color: '#9b59f7' },
    { id: uid(), name: 'Подработка', start: '10:00', end: '14:00', breakMin: 0, payType: 'fixed', rate: 1500, color: '#36c08a' },
  ];
}

/* ===================== Рендер: шаблоны ===================== */

const els = {};
function cacheEls() {
  [
    'templateList', 'addTemplateBtn', 'activeTemplateName', 'clearActiveBtn',
    'monthTitle', 'prevMonthBtn', 'nextMonthBtn', 'todayBtn', 'calendarGrid',
    'statsScope', 'statIncome', 'statHours', 'statShifts', 'statAvg', 'statsBreakdown',
    'currencyInput', 'exportExcelBtn', 'exportCsvBtn',
    'templateModal', 'templateModalTitle', 'templateForm', 'templateId',
    'tplName', 'tplStart', 'tplEnd', 'tplBreak', 'tplPayType', 'tplRate', 'tplRateLabel',
    'tplColor', 'tplPreview', 'deleteTemplateBtn', 'cancelTemplateBtn',
    'dayModal', 'dayModalTitle', 'dayShiftList', 'dayTemplateSelect', 'addShiftBtn', 'closeDayBtn',
  ].forEach(id => { els[id] = document.getElementById(id); });
}

function renderTemplates() {
  els.templateList.innerHTML = '';
  if (state.templates.length === 0) {
    els.templateList.innerHTML = '<li class="empty-note">Шаблонов пока нет. Добавьте первый.</li>';
  }
  for (const tpl of state.templates) {
    const li = document.createElement('li');
    li.className = 'template-item' + (tpl.id === state.activeTemplateId ? ' active' : '');
    const payInfo = tpl.payType === 'fixed'
      ? `${fmtMoney(tpl.rate)} / смена`
      : `${fmtMoney(tpl.rate)} / час`;
    li.innerHTML = `
      <span class="tpl-color" style="background:${tpl.color}"></span>
      <span class="tpl-info">
        <div class="tpl-name">${escapeHtml(tpl.name)}</div>
        <div class="tpl-meta">${tpl.start}–${tpl.end} · ${fmtHours(shiftHours(tpl))} ч · ${payInfo}</div>
      </span>
      <span class="tpl-edit" title="Редактировать">✎</span>`;
    li.querySelector('.tpl-info').addEventListener('click', () => setActiveTemplate(tpl.id));
    li.querySelector('.tpl-color').addEventListener('click', () => setActiveTemplate(tpl.id));
    li.querySelector('.tpl-edit').addEventListener('click', (e) => { e.stopPropagation(); openTemplateModal(tpl); });
    els.templateList.appendChild(li);
  }
  const active = templateById(state.activeTemplateId);
  els.activeTemplateName.textContent = active ? active.name : 'не выбран';
}

function setActiveTemplate(id) {
  state.activeTemplateId = (state.activeTemplateId === id) ? null : id;
  renderTemplates();
}

/* ===================== Рендер: календарь ===================== */

function renderCalendar() {
  const year = state.view.getFullYear();
  const month = state.view.getMonth();
  els.monthTitle.textContent = `${MONTHS[month]} ${year}`;

  const first = new Date(year, month, 1);
  // понедельник = 0
  let startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  const todayKey = dateKey(new Date());
  els.calendarGrid.innerHTML = '';

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = dateKey(d);
    const inMonth = d.getMonth() === month;

    const cell = document.createElement('div');
    cell.className = 'day-cell'
      + (inMonth ? '' : ' other-month')
      + (key === todayKey ? ' today' : '');

    const shiftIds = state.shifts[key] || [];
    let dayEarn = 0;
    let chips = '';
    for (const id of shiftIds) {
      const tpl = templateById(id);
      if (!tpl) continue;
      dayEarn += shiftEarnings(tpl);
      chips += `<span class="shift-chip" style="background:${tpl.color}">${escapeHtml(tpl.name)}</span>`;
    }

    cell.innerHTML = `
      <span class="day-num">${d.getDate()}</span>
      <div class="day-shifts">${chips}</div>
      ${dayEarn > 0 ? `<span class="day-earn">${fmtMoney(dayEarn)}</span>` : ''}`;

    cell.addEventListener('click', () => handleDayClick(key));
    els.calendarGrid.appendChild(cell);
  }
}

/** Клик по дню: если выбран активный шаблон — быстро добавляем смену,
    иначе открываем окно управления сменами дня. */
function handleDayClick(key) {
  if (state.activeTemplateId) {
    addShift(key, state.activeTemplateId);
  } else {
    openDayModal(key);
  }
}

function addShift(key, templateId) {
  if (!state.shifts[key]) state.shifts[key] = [];
  state.shifts[key].push(templateId);
  save();
  renderCalendar();
  renderStats();
}

function removeShift(key, index) {
  if (!state.shifts[key]) return;
  state.shifts[key].splice(index, 1);
  if (state.shifts[key].length === 0) delete state.shifts[key];
  save();
  renderCalendar();
  renderStats();
}

/* ===================== Окно дня ===================== */

let currentDayKey = null;

function openDayModal(key) {
  currentDayKey = key;
  const [y, m, dd] = key.split('-').map(Number);
  els.dayModalTitle.textContent = `Смены — ${dd} ${MONTHS[m - 1]} ${y}`;
  renderDayModal();
  els.dayTemplateSelect.innerHTML = state.templates
    .map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  els.dayModal.classList.remove('hidden');
}

function renderDayModal() {
  const shiftIds = state.shifts[currentDayKey] || [];
  if (shiftIds.length === 0) {
    els.dayShiftList.innerHTML = '<li class="empty-note">Смен за этот день нет.</li>';
    return;
  }
  els.dayShiftList.innerHTML = '';
  shiftIds.forEach((id, index) => {
    const tpl = templateById(id);
    if (!tpl) return;
    const li = document.createElement('li');
    li.className = 'day-shift-row';
    li.innerHTML = `
      <span class="tpl-color" style="background:${tpl.color}"></span>
      <span class="info">
        <div class="name">${escapeHtml(tpl.name)}</div>
        <div class="meta">${tpl.start}–${tpl.end} · ${fmtHours(shiftHours(tpl))} ч</div>
      </span>
      <span class="earn">${fmtMoney(shiftEarnings(tpl))}</span>
      <button class="remove" title="Удалить">✕</button>`;
    li.querySelector('.remove').addEventListener('click', () => {
      removeShift(currentDayKey, index);
      renderDayModal();
    });
    els.dayShiftList.appendChild(li);
  });
}

/* ===================== Окно шаблона ===================== */

function openTemplateModal(tpl) {
  const editing = !!tpl;
  els.templateModalTitle.textContent = editing ? 'Редактировать шаблон' : 'Новый шаблон';
  els.templateId.value = editing ? tpl.id : '';
  els.tplName.value = editing ? tpl.name : '';
  els.tplStart.value = editing ? tpl.start : '09:00';
  els.tplEnd.value = editing ? tpl.end : '18:00';
  els.tplBreak.value = editing ? (tpl.breakMin || 0) : 0;
  els.tplPayType.value = editing ? tpl.payType : 'hourly';
  els.tplRate.value = editing ? tpl.rate : 200;
  els.tplColor.value = editing ? tpl.color : '#4f86f7';
  els.deleteTemplateBtn.classList.toggle('hidden', !editing);
  updateRateLabel();
  updateTplPreview();
  els.templateModal.classList.remove('hidden');
}

function updateRateLabel() {
  els.tplRateLabel.textContent = els.tplPayType.value === 'fixed' ? 'Оплата за смену' : 'Ставка в час';
}

function updateTplPreview() {
  const tpl = readTemplateForm();
  if (!tpl.start || !tpl.end) { els.tplPreview.textContent = ''; return; }
  els.tplPreview.textContent =
    `Длительность: ${fmtHours(shiftHours(tpl))} ч · Доход за смену: ${fmtMoney(shiftEarnings(tpl))}`;
}

function readTemplateForm() {
  return {
    id: els.templateId.value || uid(),
    name: els.tplName.value.trim(),
    start: els.tplStart.value,
    end: els.tplEnd.value,
    breakMin: Number(els.tplBreak.value) || 0,
    payType: els.tplPayType.value,
    rate: Number(els.tplRate.value) || 0,
    color: els.tplColor.value,
  };
}

function submitTemplate(e) {
  e.preventDefault();
  const tpl = readTemplateForm();
  if (!tpl.name) return;
  const idx = state.templates.findIndex(t => t.id === tpl.id);
  if (idx >= 0) state.templates[idx] = tpl;
  else state.templates.push(tpl);
  save();
  renderTemplates();
  renderCalendar();
  renderStats();
  els.templateModal.classList.add('hidden');
}

function deleteTemplate() {
  const id = els.templateId.value;
  if (!id) return;
  if (!confirm('Удалить шаблон? Проставленные смены этого шаблона тоже исчезнут.')) return;
  state.templates = state.templates.filter(t => t.id !== id);
  // вычищаем смены этого шаблона
  for (const key of Object.keys(state.shifts)) {
    state.shifts[key] = state.shifts[key].filter(sid => sid !== id);
    if (state.shifts[key].length === 0) delete state.shifts[key];
  }
  if (state.activeTemplateId === id) state.activeTemplateId = null;
  save();
  renderTemplates();
  renderCalendar();
  renderStats();
  els.templateModal.classList.add('hidden');
}

/* ===================== Статистика ===================== */

/** Собирает смены по выбранному периоду. Возвращает массив записей. */
function collectShifts(scope) {
  const records = [];
  const y = state.view.getFullYear();
  const m = state.view.getMonth();
  for (const [key, ids] of Object.entries(state.shifts)) {
    const [ky, km] = key.split('-').map(Number);
    if (scope === 'month' && (ky !== y || km - 1 !== m)) continue;
    if (scope === 'year' && ky !== y) continue;
    for (const id of ids) {
      const tpl = templateById(id);
      if (!tpl) continue;
      records.push({
        date: key, templateId: id, name: tpl.name,
        start: tpl.start, end: tpl.end,
        hours: shiftHours(tpl), earnings: shiftEarnings(tpl), color: tpl.color,
      });
    }
  }
  records.sort((a, b) => a.date.localeCompare(b.date));
  return records;
}

function computeStats(records) {
  const totals = { income: 0, hours: 0, shifts: records.length };
  const byTpl = {};
  for (const r of records) {
    totals.income += r.earnings;
    totals.hours += r.hours;
    if (!byTpl[r.templateId]) {
      byTpl[r.templateId] = { name: r.name, color: r.color, shifts: 0, hours: 0, income: 0 };
    }
    const b = byTpl[r.templateId];
    b.shifts++; b.hours += r.hours; b.income += r.earnings;
  }
  return { totals, byTpl };
}

function renderStats() {
  const records = collectShifts(state.statsScope);
  const { totals, byTpl } = computeStats(records);
  els.statIncome.textContent = fmtMoney(totals.income);
  els.statHours.textContent = fmtHours(totals.hours);
  els.statShifts.textContent = totals.shifts;
  els.statAvg.textContent = totals.shifts ? fmtMoney(totals.income / totals.shifts) : fmtMoney(0);

  els.statsBreakdown.innerHTML = '';
  const entries = Object.values(byTpl).sort((a, b) => b.income - a.income);
  if (entries.length === 0) {
    els.statsBreakdown.innerHTML = '<li class="empty-note">Нет данных за выбранный период.</li>';
    return;
  }
  for (const b of entries) {
    const li = document.createElement('li');
    li.className = 'breakdown-item';
    li.innerHTML = `
      <span class="tpl-color" style="background:${b.color}"></span>
      <span class="breakdown-name">
        ${escapeHtml(b.name)}
        <div class="breakdown-sub">${b.shifts} смен · ${fmtHours(b.hours)} ч</div>
      </span>
      <span class="breakdown-val">${fmtMoney(b.income)}</span>`;
    els.statsBreakdown.appendChild(li);
  }
}

/* ===================== Экспорт ===================== */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function scopeLabel() {
  if (state.statsScope === 'all') return 'За всё время';
  if (state.statsScope === 'year') return `За ${state.view.getFullYear()} год`;
  return `${MONTHS[state.view.getMonth()]} ${state.view.getFullYear()}`;
}

function round2(v) { return Math.round(v * 100) / 100; }

function downloadFile(filename, content, mime) {
  const blob = new Blob(['﻿', content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Экспорт в формате SpreadsheetML 2003 — открывается в Excel напрямую,
    поддерживает несколько листов и форматирование, без внешних библиотек. */
function exportExcel() {
  const records = collectShifts(state.statsScope);
  const { totals, byTpl } = computeStats(records);
  const cur = state.currency;

  const cellS = (v) => `<Cell><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`;
  const cellN = (v) => `<Cell><Data ss:Type="Number">${round2(v)}</Data></Cell>`;
  const cellH = (v) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${escapeXml(v)}</Data></Cell>`;

  // Лист 1 — Календарь (детализация смен)
  let calRows = `<Row>${['Дата', 'День недели', 'Смена', 'Начало', 'Конец',
    'Часы', `Доход, ${cur}`].map(cellH).join('')}</Row>`;
  for (const r of records) {
    const d = new Date(r.date + 'T00:00:00');
    const wd = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()];
    calRows += '<Row>'
      + cellS(r.date) + cellS(wd) + cellS(r.name)
      + cellS(r.start) + cellS(r.end)
      + cellN(r.hours) + cellN(r.earnings) + '</Row>';
  }
  calRows += '<Row>' + cellH('ИТОГО') + cellS('') + cellS('') + cellS('') + cellS('')
    + `<Cell ss:StyleID="hdr"><Data ss:Type="Number">${round2(totals.hours)}</Data></Cell>`
    + `<Cell ss:StyleID="hdr"><Data ss:Type="Number">${round2(totals.income)}</Data></Cell>` + '</Row>';

  // Лист 2 — Статистика
  let statRows = `<Row>${cellH('Показатель')}${cellH('Значение')}</Row>`
    + '<Row>' + cellS('Период') + cellS(scopeLabel()) + '</Row>'
    + '<Row>' + cellS('Всего смен') + cellN(totals.shifts) + '</Row>'
    + '<Row>' + cellS('Всего часов') + cellN(totals.hours) + '</Row>'
    + '<Row>' + cellS(`Общий доход, ${cur}`) + cellN(totals.income) + '</Row>'
    + '<Row>' + cellS(`Средний доход за смену, ${cur}`)
    + cellN(totals.shifts ? totals.income / totals.shifts : 0) + '</Row>'
    + '<Row></Row>'
    + `<Row>${['Шаблон', 'Смен', 'Часы', `Доход, ${cur}`].map(cellH).join('')}</Row>`;
  for (const b of Object.values(byTpl).sort((a, b) => b.income - a.income)) {
    statRows += '<Row>' + cellS(b.name) + cellN(b.shifts) + cellN(b.hours) + cellN(b.income) + '</Row>';
  }

  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default"><Alignment ss:Vertical="Center"/></Style>
  <Style ss:ID="hdr">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#D6E0F5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Календарь">
  <Table>${calRows}</Table>
 </Worksheet>
 <Worksheet ss:Name="Статистика">
  <Table>${statRows}</Table>
 </Worksheet>
</Workbook>`;

  const suffix = state.statsScope === 'month'
    ? `${state.view.getFullYear()}-${pad(state.view.getMonth() + 1)}`
    : state.statsScope === 'year' ? `${state.view.getFullYear()}` : 'all';
  downloadFile(`Календарь-смен_${suffix}.xls`, xml,
    'application/vnd.ms-excel');
}

/** Экспорт в CSV (разделитель «;» — корректно открывается в Excel RU). */
function exportCsv() {
  const records = collectShifts(state.statsScope);
  const { totals } = computeStats(records);
  const cur = state.currency;
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [];
  lines.push(['Дата', 'Смена', 'Начало', 'Конец', 'Часы', `Доход (${cur})`].map(q).join(';'));
  for (const r of records) {
    lines.push([r.date, r.name, r.start, r.end,
      round2(r.hours), round2(r.earnings)].map(q).join(';'));
  }
  lines.push('');
  lines.push([q('ИТОГО смен'), totals.shifts].join(';'));
  lines.push([q('ИТОГО часов'), round2(totals.hours)].join(';'));
  lines.push([q(`ИТОГО доход (${cur})`), round2(totals.income)].join(';'));

  const suffix = state.statsScope === 'month'
    ? `${state.view.getFullYear()}-${pad(state.view.getMonth() + 1)}`
    : state.statsScope === 'year' ? `${state.view.getFullYear()}` : 'all';
  downloadFile(`Календарь-смен_${suffix}.csv`, lines.join('\r\n'), 'text/csv;charset=utf-8');
}

/* ===================== События ===================== */

function bindEvents() {
  els.addTemplateBtn.addEventListener('click', () => openTemplateModal(null));
  els.clearActiveBtn.addEventListener('click', () => { state.activeTemplateId = null; renderTemplates(); });

  els.prevMonthBtn.addEventListener('click', () => { state.view.setMonth(state.view.getMonth() - 1); renderCalendar(); renderStats(); });
  els.nextMonthBtn.addEventListener('click', () => { state.view.setMonth(state.view.getMonth() + 1); renderCalendar(); renderStats(); });
  els.todayBtn.addEventListener('click', () => { state.view = new Date(); renderCalendar(); renderStats(); });

  els.statsScope.addEventListener('change', () => { state.statsScope = els.statsScope.value; renderStats(); });
  els.currencyInput.addEventListener('input', () => {
    state.currency = els.currencyInput.value || '₽';
    save(); renderTemplates(); renderCalendar(); renderStats();
  });

  els.exportExcelBtn.addEventListener('click', exportExcel);
  els.exportCsvBtn.addEventListener('click', exportCsv);

  // Окно шаблона
  els.templateForm.addEventListener('submit', submitTemplate);
  els.cancelTemplateBtn.addEventListener('click', () => els.templateModal.classList.add('hidden'));
  els.deleteTemplateBtn.addEventListener('click', deleteTemplate);
  els.tplPayType.addEventListener('change', () => { updateRateLabel(); updateTplPreview(); });
  ['tplStart', 'tplEnd', 'tplBreak', 'tplRate'].forEach(id =>
    els[id].addEventListener('input', updateTplPreview));

  // Окно дня
  els.addShiftBtn.addEventListener('click', () => {
    const id = els.dayTemplateSelect.value;
    if (id) { addShift(currentDayKey, id); renderDayModal(); }
  });
  els.closeDayBtn.addEventListener('click', () => els.dayModal.classList.add('hidden'));

  // Закрытие модалок по клику на фон
  [els.templateModal, els.dayModal].forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      els.templateModal.classList.add('hidden');
      els.dayModal.classList.add('hidden');
    }
  });
}

/* ===================== Старт ===================== */

function init() {
  cacheEls();
  load();
  els.currencyInput.value = state.currency;
  bindEvents();
  renderTemplates();
  renderCalendar();
  renderStats();
}

document.addEventListener('DOMContentLoaded', init);
