'use strict';

/* =========================================================
 * 2026. 학교로 찾아가는 SW체험수업 — 사전 협의 응답 웹앱
 * 순수 HTML/CSS/JS, GitHub Pages + Google Apps Script 웹앱
 * ========================================================= */

const CONFIG = {
  // Apps Script 웹앱 배포 URL(…/exec). README의 배포 절차 참고.
  ENDPOINT: '',
  DATA_URL: 'data/schools.json',
  ADMIN: { org: '경남수학문화관', name: '이상우', phone: '055-713-2197' },
  RETENTION: '2026. 12. 31.(사업 결과보고 완료 시)까지 보유 후 지체 없이 파기',
  STORAGE_PREFIX: 'swvisit2026:',
  REQUEST_TIMEOUT_MS: 25000,
};

/* 구글시트 열 정의: [키, 열 제목, 섹션]. Apps Script의 HEADERS와 순서를 일치시킬 것 */
const FIELD_DEFS = [
  ['submittedAt', '제출 시각', '_'],
  ['schoolId', '학교 ID', '_'],
  ['schoolName', '학교명', '_'],
  ['resubmit', '재제출 여부', '_'],
  ['latest', '최신', '_'],
  ['opDate', '운영일자', '_'],
  ['program', '신청 프로그램', '_'],
  ['teacherName', '담당교사 성명', 'A. 담당자'],
  ['teacherPhone', '담당교사 연락처', 'A. 담당자'],
  ['schoolPhone', '학교 대표번호', 'A. 담당자'],
  ['altContact', '당일 부재 시 대체 연락처', 'A. 담당자'],
  ['p12Time', '1~2교시 시각', 'B. 시간'],
  ['p34Time', '3~4교시 시각', 'B. 시간'],
  ['breakOk', '교구 정비 10분 확보', 'B. 시간'],
  ['breakInfo', '중간놀이·쉬는 시간 위치', 'B. 시간'],
  ['rooms', '교시별 수업 장소', 'C. 학급·장소'],
  ['floorInfo', '교실 위치(층)', 'C. 학급·장소'],
  ['elevator', '엘리베이터', 'C. 학급·장소'],
  ['unloadPoint', '교구 하역 지점', 'C. 학급·장소'],
  ['laptops', '1인 1노트북 구비(교실별)', 'D. 기기'],
  ['wifi', '무선 인터넷', 'D. 기기'],
  ['display', '화면 송출 장치', 'D. 기기'],
  ['displayConn', '연결 방식', 'D. 기기'],
  ['usbPort', '노트북 USB 포트', 'D. 기기'],
  ['securityRestrict', '외부 기기 연결 제한', 'D. 기기'],
  ['groupSeating', '2인 1모둠 배치', 'D. 기기'],
  ['threeClass', '교시당 3개 학급 동시 수업 확인', 'E. 학급 편성·프로그램'],
  ['threeClassActual', '실제 학급 수', 'E. 학급 편성·프로그램'],
  ['threeRooms', '교실 3실 확보', 'E. 학급 편성·프로그램'],
  ['addClass', '3~4교시 학급 추가', 'E. 학급 편성·프로그램'],
  ['addClassDetail', '추가 학급·인원', 'E. 학급 편성·프로그램'],
  ['programChange', '프로그램 변경 희망', 'E. 학급 편성·프로그램'],
  ['programChangeTo', '변경 희망 프로그램', 'E. 학급 편성·프로그램'],
  ['programChangeReason', '변경 사유', 'E. 학급 편성·프로그램'],
  ['parking', '주차 가능 위치', 'F. 방문·주차'],
  ['vehicleRestriction', '차량 진입 제한 시간대', 'F. 방문·주차'],
  ['entryProcedure', '외부인 출입 절차', 'F. 방문·주차'],
  ['confirmedCounts', '학급별 확정 인원', 'G. 기타'],
  ['guideTeachers', '학급별 인솔 교사', 'G. 기타'],
  ['specialNeeds', '도움 필요 학생·특이사항', 'G. 기타'],
  ['mediaConsent', '촬영·결과보고 활용 동의', 'G. 기타'],
  ['surveyDevice', '만족도조사(QR) 응답 기기', 'G. 기타'],
  ['etcRequest', '기타 요청사항', 'G. 기타'],
  ['userAgent', '응답 기기', '_'],
  ['raw', '원본 JSON', '_'],
];

const state = { data: null, school: null, classes: [], saveTimer: null };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PERIOD_LABEL = { p12: '1~2교시', p34: '3~4교시' };

/* ---------- 초기화 ---------- */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  renderFooter();
  try {
    const res = await fetch(CONFIG.DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    state.data = await res.json();
  } catch (e) {
    showFatal('학교 정보를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요. (' + e.message + ')');
    return;
  }
  const sel = $('#schoolSelect');
  state.data.schools.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = `${s.name} (${fmtDate(s.date, s.dow)})`;
    sel.appendChild(o);
  });
  const pre = new URLSearchParams(location.search).get('school');
  if (pre && state.data.schools.some((s) => s.id === pre)) {
    sel.value = pre;
    $('#codeInput').focus();
  }
  $('#unlockBtn').addEventListener('click', unlock);
  $('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); unlock(); } });
  $('#codeInput').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
  $('#submitBtn').addEventListener('click', submit);
  $('#clearDraft').addEventListener('click', clearDraft);
}

function renderFooter() {
  const a = CONFIG.ADMIN;
  $('#footer').innerHTML = `
    <strong>개인정보 수집·이용 안내</strong><br>
    · 수집 목적: 2026. 학교로 찾아가는 SW체험수업 운영을 위한 학교 사전 협의(일정·장소·기기·방문 절차 확인)<br>
    · 수집 항목: 담당교사 성명·연락처, 학교 대표번호, 대체 연락처, 수업 환경 정보<br>
    · 보유 기간: ${esc(CONFIG.RETENTION)}<br>
    · 담당: ${esc(a.org)} ${esc(a.name)} (<a href="tel:${esc(a.phone.replace(/-/g, ''))}">${esc(a.phone)}</a>)<br>
    응답을 제출하면 위 내용에 동의한 것으로 봅니다. 문의는 담당자에게 연락 주세요.`;
}

function showFatal(msg) { const el = $('#fatal'); el.textContent = msg; el.hidden = false; }
function fmtDate(iso, dow) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}. ${m}. ${d}.(${dow})`;
}
function find(id) { return state.data.schools.find((s) => s.id === id); }
function key(k) { return CONFIG.STORAGE_PREFIX + k + ':' + state.school.id; }
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (_) { /* ignore */ } }

let toastTimer = null;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- 1단계: 학교 확인 ---------- */
function unlock() {
  const id = $('#schoolSelect').value;
  const code = $('#codeInput').value.trim();
  const errEl = $('#unlockError');
  const fail = (m) => { errEl.textContent = m; errEl.hidden = false; };
  errEl.hidden = true;
  if (!id) return fail('학교를 선택해 주세요.');
  if (!/^\d{4}$/.test(code)) return fail('확인코드 4자리를 입력해 주세요.');
  const s = find(id);
  if (code !== String(s.code)) return fail('확인코드가 일치하지 않습니다. 안내 문자·공문의 코드를 다시 확인해 주세요.');

  state.school = s;
  state.classes = [];
  ['p12', 'p34'].forEach((p) => (s.periods[p] || []).forEach((c, i) => state.classes.push({ period: p, plabel: PERIOD_LABEL[p], idx: i, cls: c.class, n: c.n, room: c.room || '' })));

  $('#schoolSelect').disabled = true;
  $('#codeInput').disabled = true;
  $('#unlockBtn').hidden = true;
  $('#step-select').classList.add('done');
  $('#step-select').insertAdjacentHTML('beforeend', `<p class="hint">확인 완료: <strong>${esc(s.name)}</strong> · <button type="button" class="linkbtn" onclick="location.href=location.pathname">다른 학교 선택</button></p>`);

  renderDoneBanner();
  renderInfo(s);
  renderForm(s);
  restoreDraft();
  updateConditionals();
  $('#form').hidden = false;
  $('#submitBar').hidden = false;
  $('#info').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDoneBanner() {
  const done = lsGet(key('done'));
  const el = $('#doneBanner');
  if (!done) { el.hidden = true; return; }
  el.innerHTML = `이 기기에서 <strong>${esc(done.at)}</strong>에 응답을 제출했습니다. 내용을 고치려면 아래 항목을 수정한 뒤 다시 제출하세요. 마지막 제출 내용이 최신 응답으로 반영됩니다.`;
  el.hidden = false;
}

/* ---------- 2단계: 신청서 내용(읽기 전용) ---------- */
function renderInfo(s) {
  const rows = state.classes.map((c) => `
    <tr><td>${esc(c.plabel)}</td><td>${esc(c.cls)}</td><td>${esc(c.n)}명</td>
    <td class="${c.room ? '' : 'empty'}">${c.room ? esc(c.room) : '미기재 → 아래에서 입력'}</td></tr>`).join('');
  const p34Empty = !(s.periods.p34 && s.periods.p34.length);
  const contacts = (s.contact || []).map((c) => `${esc(c.name)}${c.role ? ' (' + esc(c.role) + ')' : ''} ${esc(c.phone)}`).join('<br>');
  $('#info').innerHTML = `
    <h2>2. 신청서 기재 내용 <span class="badge">읽기 전용</span></h2>
    <p class="desc">학교에서 제출하신 참여 신청서 내용입니다. 다른 점이 있으면 아래 응답 항목에서 바로잡아 주세요.</p>
    <dl class="info-grid">
      <dt>학교</dt><dd>${esc(s.name)}</dd>
      <dt>운영일</dt><dd>${esc(fmtDate(s.date, s.dow))}${p34Empty ? ' <span class="badge warn">1~2교시만 운영</span>' : ''}</dd>
      <dt>프로그램</dt><dd>${esc(s.program)}</dd>
      <dt>참여 규모</dt><dd>${esc(s.classCount)}개 학급 · ${esc(s.studentCount)}명</dd>
      <dt>담당자</dt><dd>${contacts || '-'}</dd>
    </dl>
    <table class="ptable">
      <thead><tr><th>교시</th><th>학급</th><th>인원</th><th>수업 장소(신청서)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  $('#info').hidden = false;
}

/* ---------- 3단계: 응답 폼 ---------- */
function field({ name, label, required = false, hint = '', input }) {
  return `<div class="field" data-field="${esc(name)}">
    <label class="lbl" for="f-${esc(name)}">${esc(label)}${required ? '<span class="req">*</span>' : ''}</label>
    ${input}${hint ? `<p class="hint">${hint}</p>` : ''}<p class="err" hidden></p></div>`;
}
function text(name, { type = 'text', placeholder = '', required = false, value = '', inputmode = '', maxlength = 200, min = '' } = {}) {
  return `<input id="f-${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="${maxlength}"
    ${inputmode ? `inputmode="${inputmode}"` : ''} ${min !== '' ? `min="${min}"` : ''} ${required ? 'data-required' : ''} ${type === 'tel' ? 'data-phone' : ''}>`;
}
function textarea(name, { placeholder = '', required = false, rows = 3 } = {}) {
  return `<textarea id="f-${esc(name)}" name="${esc(name)}" rows="${rows}" placeholder="${esc(placeholder)}" maxlength="1000" ${required ? 'data-required' : ''}></textarea>`;
}
function radios(name, options, { required = true, checked = '' } = {}) {
  return `<div class="pills" role="radiogroup" id="f-${esc(name)}">${options.map((o) => {
    const v = typeof o === 'string' ? o : o.v; const l = typeof o === 'string' ? o : o.l;
    const on = checked === v;
    return `<label class="pill${on ? ' on' : ''}"><input type="radio" name="${esc(name)}" value="${esc(v)}" ${on ? 'checked' : ''} ${required ? 'data-required' : ''}><span>${esc(l)}</span></label>`;
  }).join('')}</div>`;
}
function select(name, options, { required = false, placeholder = '선택하세요' } = {}) {
  return `<select id="f-${esc(name)}" name="${esc(name)}" ${required ? 'data-required' : ''}>
    <option value="">${esc(placeholder)}</option>${options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
}
function timeRange(prefix, label, required) {
  return `<div class="field" data-field="${prefix}Start">
    <label class="lbl" for="f-${prefix}Start">${esc(label)}${required ? '<span class="req">*</span>' : ''}</label>
    <div class="row2">
      <input id="f-${prefix}Start" name="${prefix}Start" type="time" ${required ? 'data-required' : ''}>
      <span class="tilde">~</span>
      <input id="f-${prefix}End" name="${prefix}End" type="time" ${required ? 'data-required' : ''}>
    </div>
    <p class="hint">시작 시각 ~ 종료 시각 (예: 09:00 ~ 10:40)</p><p class="err" hidden></p></div>`;
}
function cond(when, eq, inner) { return `<div class="cond" data-when="${esc(when)}" data-eq="${esc(eq)}" hidden>${inner}</div>`; }
function section(title, desc, inner) { return `<section class="card sec"><h2>${title}</h2>${desc ? `<p class="desc">${desc}</p>` : ''}${inner}</section>`; }
function classBox(c, inner) { return `<div class="classbox"><div class="ctitle">${esc(c.plabel)} · ${esc(c.cls)}<small>${esc(c.n)}명</small></div>${inner}</div>`; }
function ck(c, base) { return `${base}__${c.period}__${c.idx}`; }

function renderForm(s) {
  const has34 = !!(s.periods.p34 && s.periods.p34.length);
  const primary = (s.contact && s.contact[0]) || {};
  const isMobile = (p) => /^01\d/.test(String(p || '').replace(/\D/g, ''));
  const programs = Object.values((state.data._meta && state.data._meta.programs) || {});
  const p34Classes = (s.periods.p34 || []).map((c) => c.class).join(', ');

  const A = section('3. 담당자 확인', '수업 당일 연락이 닿아야 하는 분의 정보입니다.',
    field({ name: 'schoolName', label: '학교명', input: `<input id="f-schoolName" type="text" value="${esc(s.name)}" readonly>` }) +
    field({ name: 'teacherName', label: '담당교사 성명', required: true, input: text('teacherName', { required: true, value: primary.name || '', placeholder: '홍길동' }) }) +
    field({ name: 'teacherPhone', label: '담당교사 연락처(휴대폰)', required: true, input: text('teacherPhone', { type: 'tel', required: true, value: isMobile(primary.phone) ? primary.phone : '', placeholder: '010-0000-0000', inputmode: 'tel' }) }) +
    field({ name: 'schoolPhone', label: '학교 대표번호', required: true, input: text('schoolPhone', { type: 'tel', required: true, placeholder: '055-000-0000', inputmode: 'tel' }) }) +
    field({ name: 'altContact', label: '수업 당일 부재 시 대체 연락처', required: true, hint: '성명과 연락처를 함께 적어 주세요. (예: 교무실 김○○ 055-000-0001)', input: text('altContact', { required: true, placeholder: '예: 6학년 부장 김○○ 010-0000-0000' }) }));

  const B = section('4. 시간', '학교 일과표 기준으로 적어 주세요.',
    timeRange('p12', '1~2교시 시작 ~ 종료 시각', true) +
    (has34 ? timeRange('p34', '3~4교시 시작 ~ 종료 시각', true)
      : `<p class="hint">이 학교는 1~2교시만 운영하므로 3~4교시 시각은 입력하지 않습니다.</p>`) +
    field({ name: 'breakOk', label: '교시 사이에 교구 정비 시간 10분을 확보할 수 있습니까?', required: true, input: radios('breakOk', ['확보 가능', '협의 필요']) }) +
    field({ name: 'breakInfo', label: '중간놀이·쉬는 시간 위치', required: true, hint: '일과표상 중간놀이(또는 긴 쉬는 시간)가 몇 교시 뒤 몇 분인지 적어 주세요.', input: text('breakInfo', { required: true, placeholder: '예: 2교시 후 중간놀이 20분(10:20~10:40), 쉬는 시간 10분' }) }));

  const C = section('5. 학급·장소', '신청서에 적힌 장소가 미리 채워져 있습니다. 바뀐 경우 수정해 주세요.',
    state.classes.map((c) => classBox(c,
      field({ name: ck(c, 'room'), label: '수업 장소', required: true, input: text(ck(c, 'room'), { required: true, value: c.room, placeholder: '예: 6-3 교실 / 과학실 / 컴퓨터실' }) }))).join('') +
    field({ name: 'floorInfo', label: '교실 위치(층)', required: true, input: text('floorInfo', { required: true, placeholder: '예: 6학년 교실 모두 3층, 과학실 2층' }) }) +
    field({ name: 'elevator', label: '엘리베이터', required: true, input: radios('elevator', ['있음', '없음']) }) +
    field({ name: 'unloadPoint', label: '교구 하역 지점', required: true, hint: '차량을 세우고 교구를 내릴 수 있는 곳(정문·후문·필로티·현관 앞 등)', input: text('unloadPoint', { required: true, placeholder: '예: 후문 필로티 앞, 현관 옆 계단' }) }));

  const D = section('6. 기기', '',
    `<h3 class="sub">교실별 1인 1노트북(아이북) 구비 여부</h3>` +
    state.classes.map((c) => classBox(c,
      field({ name: ck(c, 'laptop'), label: '학생 1인당 노트북 1대 준비 가능', required: true, input: radios(ck(c, 'laptop'), ['예', '아니오']) }) +
      cond(ck(c, 'laptop'), '아니오',
        field({ name: ck(c, 'laptopMax'), label: '최대 몇 대까지 준비 가능합니까?', required: true, input: text(ck(c, 'laptopMax'), { type: 'number', required: true, inputmode: 'numeric', min: 0, placeholder: '숫자만 (예: 12)' }) })))).join('') +
    `<h3 class="sub">공통</h3>` +
    field({ name: 'wifi', label: '무선 인터넷(와이파이) 정상 동작', required: true, input: radios('wifi', ['예', '아니오', '확인 필요']) }) +
    field({ name: 'display', label: '화면 송출 장치', required: true, input: radios('display', ['TV', '빔프로젝터', '없음']) }) +
    cond('display', '!없음',
      field({ name: 'displayConn', label: '노트북 연결 방식', required: true, input: radios('displayConn', ['HDMI', '미러링', '확인 필요']) })) +
    field({ name: 'usbPort', label: '노트북 USB 포트(USB-A) 유무', required: true, hint: '로봇을 USB로 연결하는 프로그램이 있어 확인이 필요합니다.', input: radios('usbPort', ['있음', '없음', '확인 필요']) }) +
    field({ name: 'securityRestrict', label: '외부 기기 연결 제한(보안 프로그램) 여부', required: true, input: radios('securityRestrict', ['제한 없음', '제한 있음', '확인 필요']) }) +
    cond('securityRestrict', '제한 있음',
      field({ name: 'securityDetail', label: '제한 내용', input: text('securityDetail', { placeholder: '예: USB 저장장치 차단, 관리자 승인 필요' }) })) +
    field({ name: 'groupSeating', label: '2인 1모둠 책걸상 배치 가능', required: true, input: radios('groupSeating', ['가능', '불가(고정 배치)', '협의 필요']) }));

  let E = '';
  if (s.flags && s.flags.threeClass) {
    E += field({ name: 'threeClass', label: '1~2교시·3~4교시에 각각 3개 학급씩 동시 수업이 맞습니까?', required: true, input: radios('threeClass', ['맞음', '아님']) }) +
      cond('threeClass', '아님',
        field({ name: 'threeClassActual', label: '실제 학급 수', required: true, input: text('threeClassActual', { required: true, placeholder: '예: 1~2교시 2개 학급, 3~4교시 2개 학급' }) })) +
      cond('threeClass', '맞음',
        field({ name: 'threeRooms', label: '동시 수업용 교실 3실 확보 가능', required: true, input: radios('threeRooms', ['확보 가능', '확보 어려움']) }));
  }
  if (s.flags && s.flags.canAddClass) {
    E += field({ name: 'addClass', label: `현재 3~4교시에 1개 학급(${esc(p34Classes)})만 배정되어 있습니다. 1개 학급 추가 운영이 가능합니다. 추가하시겠습니까?`, required: true, input: radios('addClass', ['추가함', '추가 안 함']) }) +
      cond('addClass', '추가함',
        field({ name: 'addClassName', label: '추가 학급명', required: true, input: text('addClassName', { required: true, placeholder: '예: 6-2' }) }) +
        field({ name: 'addClassN', label: '추가 학급 인원', required: true, input: text('addClassN', { type: 'number', required: true, inputmode: 'numeric', min: 1, placeholder: '숫자만' }) }));
  }
  E += field({ name: 'programChange', label: '프로그램 변경을 희망하십니까?', required: true, hint: `현재 신청: ${esc(s.program)}`, input: radios('programChange', ['아니오', '예'], { checked: '아니오' }) }) +
    cond('programChange', '예',
      field({ name: 'programChangeTo', label: '변경 희망 프로그램', required: true, input: select('programChangeTo', programs.filter((p) => p !== s.program), { required: true }) }) +
      field({ name: 'programChangeReason', label: '변경 사유', required: true, input: textarea('programChangeReason', { required: true, rows: 2, placeholder: '예: 노트북 USB 포트가 없어 연결이 어려움' }) }));
  const Esec = section('7. 학급 편성·프로그램', '', E);

  const F = section('8. 방문·주차', '강사 차량 2~3대가 교구를 싣고 방문합니다.',
    field({ name: 'parking', label: '주차 가능 위치 안내', required: true, input: textarea('parking', { required: true, rows: 2, placeholder: '예: 후문 주차장 방문객 구역 / 운동장 가장자리 주차 가능' }) }) +
    field({ name: 'vehicleRestriction', label: '차량 진입 제한 시간대', required: true, input: radios('vehicleRestriction', ['없음', '있음']) }) +
    cond('vehicleRestriction', '있음',
      field({ name: 'vehicleRestrictionDetail', label: '제한 시간대·내용', required: true, input: text('vehicleRestrictionDetail', { required: true, placeholder: '예: 08:20~08:50 등교 시간 정문 차량 통제' }) })) +
    field({ name: 'entryProcedure', label: '외부인 출입 절차', required: true, input: textarea('entryProcedure', { required: true, rows: 2, placeholder: '예: 정문 경비실에서 방문증 수령 후 출입, 교무실 경유' }) }));

  const G = section('9. 기타', '',
    `<h3 class="sub">참여 학급별 확정 인원·인솔 교사</h3><p class="desc">공문 인원과 다를 수 있어 확인합니다. 신청서 인원이 미리 채워져 있습니다.</p>` +
    state.classes.map((c) => classBox(c,
      field({ name: ck(c, 'count'), label: '확정 인원(명)', required: true, input: text(ck(c, 'count'), { type: 'number', required: true, inputmode: 'numeric', min: 0, value: c.n }) }) +
      field({ name: ck(c, 'guide'), label: '인솔(담임) 교사 배치', required: true, input: radios(ck(c, 'guide'), ['배치 확정', '협의 필요']) }))).join('') +
    `<h3 class="sub">공통</h3>` +
    field({ name: 'specialNeeds', label: '도움이 필요한 학생·특이사항', input: textarea('specialNeeds', { rows: 2, placeholder: '예: 특수학급 통합 학생 1명(보조 인력 동행), 색각 이상 학생 등' }) }) +
    field({ name: 'mediaConsent', label: '수업 사진·영상 촬영 및 결과보고 활용 동의', required: true, hint: '학생 얼굴이 식별되지 않도록 촬영하며, 결과보고·홍보 자료에만 활용합니다.', input: radios('mediaConsent', ['예', '아니오']) }) +
    field({ name: 'surveyDevice', label: '만족도 조사(QR) 응답 기기 확보 가능', required: true, hint: '수업 마지막 5분에 학생 기기로 QR 설문에 응답합니다.', input: radios('surveyDevice', ['확보 가능', '어려움(종이 설문 요청)', '확인 필요']) }) +
    field({ name: 'etcRequest', label: '기타 요청사항', input: textarea('etcRequest', { rows: 3, placeholder: '자유롭게 적어 주세요.' }) }));

  const form = $('#form');
  form.innerHTML = A + B + C + D + Esec + F + G;

  form.addEventListener('change', onFormChange);
  form.addEventListener('input', onFormInput);
  $$('.pill input', form).forEach((r) => r.addEventListener('change', syncPills));
  syncPills();
}

function syncPills() {
  $$('.pill').forEach((p) => { const i = $('input', p); p.classList.toggle('on', !!(i && i.checked)); });
}
/* 오류 표시는 입력 중(input)에 지운다. 포커스가 빠질 때(change) 지우면 아래 항목이 위로 밀려
 * 다음 항목을 탭하던 손가락이 빗나가므로, change 에서는 라디오·셀렉트만 처리한다. */
function onFormInput(e) {
  const f = e.target.closest('.field');
  if (f && f.classList.contains('invalid') && e.target.type !== 'radio' && e.target.value.trim()) clearFieldError(f);
  scheduleSave();
}
function onFormChange(e) {
  updateConditionals();
  const f = e.target.closest('.field');
  if (f && f.classList.contains('invalid') && (e.target.type === 'radio' || e.target.tagName === 'SELECT')) clearFieldError(f);
  scheduleSave();
}

function isHidden(el) { return !!el.closest('.cond[hidden]'); }

function valueOf(name) {
  const els = $$(`[name="${CSS.escape(name)}"]`, $('#form'));
  if (!els.length) return '';
  if (els[0].type === 'radio') { const c = els.find((r) => r.checked); return c ? c.value : ''; }
  return els[0].value.trim();
}

function updateConditionals() {
  $$('.cond', $('#form')).forEach((c) => {
    const v = valueOf(c.dataset.when);
    const eq = c.dataset.eq;
    const show = eq.startsWith('!') ? (v !== '' && v !== eq.slice(1)) : v === eq;
    c.hidden = !show;
  });
}

/* ---------- 임시저장 ---------- */
function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveDraft, 400);
}
function currentValues() {
  const out = {};
  $$('[name]', $('#form')).forEach((el) => {
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = ''; }
    else out[el.name] = el.value;
  });
  return out;
}
function saveDraft() {
  if (!state.school) return;
  const at = new Date();
  const ok = lsSet(key('draft'), { values: currentValues(), savedAt: at.toISOString() });
  $('#saveState').textContent = ok ? `임시저장됨 ${pad(at.getHours())}:${pad(at.getMinutes())}` : '임시저장 불가(브라우저 저장소 차단)';
}
function restoreDraft() {
  const d = lsGet(key('draft'));
  if (!d || !d.values) return;
  applyValues(d.values);
  const at = new Date(d.savedAt);
  $('#saveState').textContent = `임시저장 내용 불러옴 (${at.getMonth() + 1}/${at.getDate()} ${pad(at.getHours())}:${pad(at.getMinutes())})`;
  toast('이전에 입력하던 내용을 불러왔습니다.');
}
function applyValues(values) {
  Object.entries(values).forEach(([name, v]) => {
    const els = $$(`[name="${CSS.escape(name)}"]`, $('#form'));
    if (!els.length) return;
    if (els[0].type === 'radio') els.forEach((r) => { r.checked = r.value === v; });
    else els[0].value = v;
  });
  syncPills();
}
function clearDraft() {
  if (!confirm('입력한 내용을 모두 지우고 처음 상태로 되돌릴까요?')) return;
  lsDel(key('draft'));
  renderForm(state.school);
  updateConditionals();
  $('#saveState').textContent = '초기화됨';
  window.scrollTo({ top: $('#form').offsetTop - 12, behavior: 'smooth' });
}
const pad = (n) => String(n).padStart(2, '0');

/* ---------- 검증 ---------- */
const PHONE_RE = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;
function normalizePhone(v) {
  const d = v.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  if (d.length === 10) return d.startsWith('02') ? d.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3') : d.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  if (d.length === 9 && d.startsWith('02')) return d.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
  return v.trim();
}
function setFieldError(fieldEl, msg) {
  fieldEl.classList.add('invalid');
  const e = $('.err', fieldEl); if (e) { e.textContent = msg; e.hidden = false; }
}
function clearFieldError(fieldEl) {
  fieldEl.classList.remove('invalid');
  const e = $('.err', fieldEl); if (e) { e.hidden = true; }
}
function validate() {
  const form = $('#form');
  const bad = [];
  $$('.field.invalid', form).forEach(clearFieldError);
  const seen = new Set();
  $$('[data-required]', form).forEach((el) => {
    if (isHidden(el)) return;
    const fieldEl = el.closest('.field');
    if (el.type === 'radio') {
      if (seen.has(el.name)) return; seen.add(el.name);
      if (!valueOf(el.name)) { setFieldError(fieldEl, '하나를 선택해 주세요.'); bad.push(fieldEl); }
      return;
    }
    if (!el.value.trim()) {
      if (!fieldEl.classList.contains('invalid')) { setFieldError(fieldEl, el.type === 'time' ? '시작·종료 시각을 모두 입력해 주세요.' : '필수 항목입니다.'); bad.push(fieldEl); }
      return;
    }
    if (el.type === 'number' && (isNaN(Number(el.value)) || Number(el.value) < 0)) { setFieldError(fieldEl, '0 이상의 숫자를 입력해 주세요.'); bad.push(fieldEl); }
  });
  $$('[data-phone]', form).forEach((el) => {
    if (isHidden(el) || !el.value.trim()) return;
    const fieldEl = el.closest('.field');
    const n = normalizePhone(el.value);
    if (!PHONE_RE.test(n)) { if (!fieldEl.classList.contains('invalid')) { setFieldError(fieldEl, '전화번호 형식을 확인해 주세요. (예: 010-1234-5678)'); bad.push(fieldEl); } }
    else el.value = n;
  });
  ['p12', 'p34'].forEach((p) => {
    const s = valueOf(p + 'Start'), e = valueOf(p + 'End');
    if (s && e && e <= s) { const f = $(`.field[data-field="${p}Start"]`, form); if (f && !f.classList.contains('invalid')) { setFieldError(f, '종료 시각이 시작 시각보다 늦어야 합니다.'); bad.push(f); } }
  });
  return bad;
}

/* ---------- 수집 ---------- */
function collect() {
  const s = state.school;
  const v = (n) => (isHidden($(`[name="${CSS.escape(n)}"]`, $('#form')) || { closest: () => null }) ? '' : valueOf(n));
  const per = (base, fmt) => state.classes.map((c) => `${c.plabel} ${c.cls}: ${fmt(c)}`).join(' / ');
  const has34 = !!(s.periods.p34 && s.periods.p34.length);
  const rec = {
    submittedAt: '', resubmit: '', latest: '',
    schoolId: s.id, schoolName: s.name, opDate: fmtDate(s.date, s.dow), program: s.program,
    teacherName: v('teacherName'), teacherPhone: v('teacherPhone'), schoolPhone: v('schoolPhone'), altContact: v('altContact'),
    p12Time: `${v('p12Start')}~${v('p12End')}`,
    p34Time: has34 ? `${v('p34Start')}~${v('p34End')}` : '(운영 없음)',
    breakOk: v('breakOk'), breakInfo: v('breakInfo'),
    rooms: per('room', (c) => v(ck(c, 'room'))),
    floorInfo: v('floorInfo'), elevator: v('elevator'), unloadPoint: v('unloadPoint'),
    laptops: per('laptop', (c) => { const a = v(ck(c, 'laptop')); return a === '아니오' ? `아니오(최대 ${v(ck(c, 'laptopMax')) || '?'}대)` : a; }),
    wifi: v('wifi'), display: v('display'), displayConn: v('display') === '없음' ? '' : v('displayConn'),
    usbPort: v('usbPort'),
    securityRestrict: v('securityRestrict') + (v('securityRestrict') === '제한 있음' && v('securityDetail') ? ` (${v('securityDetail')})` : ''),
    groupSeating: v('groupSeating'),
    threeClass: v('threeClass'), threeClassActual: v('threeClassActual'), threeRooms: v('threeRooms'),
    addClass: v('addClass'), addClassDetail: v('addClass') === '추가함' ? `${v('addClassName')} ${v('addClassN')}명` : '',
    programChange: v('programChange'), programChangeTo: v('programChangeTo'), programChangeReason: v('programChangeReason'),
    parking: v('parking'),
    vehicleRestriction: v('vehicleRestriction') + (v('vehicleRestriction') === '있음' ? ` (${v('vehicleRestrictionDetail')})` : ''),
    entryProcedure: v('entryProcedure'),
    confirmedCounts: per('count', (c) => `${v(ck(c, 'count'))}명`),
    guideTeachers: per('guide', (c) => v(ck(c, 'guide'))),
    specialNeeds: v('specialNeeds'), mediaConsent: v('mediaConsent'), surveyDevice: v('surveyDevice'), etcRequest: v('etcRequest'),
    userAgent: navigator.userAgent, raw: '',
  };
  rec.raw = JSON.stringify({ schoolId: s.id, values: currentValues() });
  return rec;
}

/* ---------- 제출 ---------- */
async function submit() {
  const bad = validate();
  if (bad.length) {
    bad[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    const first = $('input:not([type=radio]), select, textarea', bad[0]) || $('input', bad[0]);
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 350);
    toast(`입력하지 않은 필수 항목이 ${bad.length}개 있습니다.`);
    return;
  }
  saveDraft();
  const rec = collect();
  rec.submittedAt = new Date().toLocaleString('ko-KR');
  if (!CONFIG.ENDPOINT) { showSubmitError('제출 서버 주소가 아직 설정되지 않았습니다. 담당자에게 알려 주세요.'); return; }

  setSubmitting(true);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(CONFIG.ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(rec),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const txt = await res.text();
    let out;
    try { out = JSON.parse(txt); } catch (_) { throw new Error('서버 응답을 해석할 수 없습니다. (HTTP ' + res.status + ')'); }
    if (!out.ok) throw new Error(out.error || '서버에서 오류를 반환했습니다.');
    const done = { at: out.submittedAt || rec.submittedAt, count: out.count || 1 };
    lsSet(key('done'), done);
    rec.submittedAt = done.at;
    rec.resubmit = out.resubmit ? `재제출(${done.count}회)` : '최초';
    renderResult(rec, out);
  } catch (e) {
    showSubmitError(e.name === 'AbortError' ? '서버 응답이 없습니다(시간 초과).' : e.message);
  } finally {
    clearTimeout(timer);
    setSubmitting(false);
  }
}
function setSubmitting(on) {
  const b = $('#submitBtn'); b.disabled = on; b.textContent = on ? '제출 중…' : '응답 제출하기';
}
function showSubmitError(msg) {
  const a = CONFIG.ADMIN;
  const el = $('#submitError');
  el.innerHTML = `<strong>제출에 실패했습니다.</strong> ${esc(msg)}<br>입력 내용은 이 기기에 저장되어 있으니 잠시 후 다시 시도해 주세요.
    계속 실패하면 ${esc(a.org)} ${esc(a.name)} <a href="tel:${esc(a.phone.replace(/-/g, ''))}">${esc(a.phone)}</a>로 연락 주시기 바랍니다.
    <button type="button" class="btn block" id="retryBtn">다시 시도</button>`;
  el.hidden = false;
  $('#retryBtn').addEventListener('click', () => { el.hidden = true; submit(); });
}

/* ---------- 4단계: 결과 요약 ---------- */
function renderResult(rec, out) {
  const sections = [];
  FIELD_DEFS.forEach(([k, label, sec]) => {
    if (sec === '_' || !rec[k]) return;
    let g = sections.find((x) => x.title === sec);
    if (!g) { g = { title: sec, items: [] }; sections.push(g); }
    g.items.push([label, rec[k]]);
  });
  const el = $('#result');
  el.innerHTML = `
    <div class="result-ok"><span class="chk">✓</span> 제출이 완료되었습니다</div>
    <p class="desc">${esc(rec.schoolName)} · ${esc(rec.submittedAt)}${out.resubmit ? ` · 재제출(${esc(out.count)}회차, 최신 응답으로 반영)` : ''}</p>
    <div class="card notice">내용을 수정하려면 <strong>같은 링크로 다시 접속</strong>해 항목을 고친 뒤 다시 제출해 주세요. 마지막 제출이 최신 응답으로 처리됩니다.</div>
    <div class="summary">${sections.map((g) => `<h4>${esc(g.title)}</h4><dl>${g.items.map(([l, v]) => `<dt>${esc(l)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`).join('')}</div>
    <p style="margin-top:16px"><button type="button" class="btn block ghost" id="editAgain">응답 수정하기</button></p>`;
  $('#form').hidden = true;
  $('#submitBar').hidden = true;
  $('#submitError').hidden = true;
  el.hidden = false;
  renderDoneBanner();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#editAgain').addEventListener('click', () => {
    el.hidden = true; $('#form').hidden = false; $('#submitBar').hidden = false;
    $('#form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
