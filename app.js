/* ─────────────────────────────────────────────────────────────
   GOLF 조 편성기 - app.js
   Features: 남여균형, 슬로우분리, 3개월동일팀회피, 드래그편집, PWA
───────────────────────────────────────────────────────────── */

// ── State ────────────────────────────────────────────────────
let db = { members: [], history: [] };
let editId = null;
let selSet = new Set();
let slowSet = new Set();
let lastTeams = null;
let dragSrc = null; // {tIdx, mIdx}

// ── Storage ──────────────────────────────────────────────────
function save() {
  localStorage.setItem('golfapp_v2', JSON.stringify(db));
}
function load() {
  try {
    const s = localStorage.getItem('golfapp_v2');
    if (s) db = JSON.parse(s);
    // migration: add gender to old members
    db.members.forEach(m => { if (!m.gender) m.gender = 'M'; });
  } catch (e) { db = { members: [], history: [] }; }
}

// ── Helpers ──────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { return new Date().toISOString().slice(0, 10); }
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Tabs ─────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('on', ['members','draw','history'][i] === name);
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  $('tab-' + name).classList.add('on');
  if (name === 'draw') renderPGrid();
  if (name === 'history') renderHistory();
}

// ── Members ──────────────────────────────────────────────────
function saveMember() {
  const nick = $('fNick').value.trim();
  const name = $('fName').value.trim();
  const phone = $('fPhone').value.trim();
  const gender = $('fGender').value;
  const isSlow = $('fSlow').classList.contains('on');

  if (!nick || !name) { toast('❌ 닉네임과 실명은 필수입니다'); return; }
  if (phone && !/^\d{4}$/.test(phone)) { toast('❌ 전화번호는 숫자 4자리'); return; }

  if (editId) {
    const m = db.members.find(m => m.id === editId);
    if (m) Object.assign(m, { nick, name, phone, gender, isSlow });
    editId = null;
  } else {
    if (db.members.some(m => m.nick === nick)) { toast('❌ 동일 닉네임 존재'); return; }
    db.members.push({ id: uid(), nick, name, phone, gender, isSlow });
  }
  save();
  resetForm();
  renderMembers();
  toast('✅ 저장되었습니다');
}

function resetForm() {
  ['fNick','fName','fPhone'].forEach(id => $(id).value = '');
  $('fGender').value = 'M';
  $('fSlow').classList.remove('on');
  $('formTitle').textContent = '신규 회원 등록';
  $('fSaveBtn').textContent = '✚ 등록하기';
  $('fCancelBtn').style.display = 'none';
  editId = null;
}

function cancelEdit() { resetForm(); }

function editMember(id) {
  const m = db.members.find(m => m.id === id); if (!m) return;
  editId = id;
  $('fNick').value = m.nick;
  $('fName').value = m.name;
  $('fPhone').value = m.phone || '';
  $('fGender').value = m.gender || 'M';
  $('fSlow').classList.toggle('on', !!m.isSlow);
  $('formTitle').textContent = '회원 정보 수정';
  $('fSaveBtn').textContent = '✔ 저장하기';
  $('fCancelBtn').style.display = '';
  $('formCard').scrollIntoView({ behavior: 'smooth' });
}

function deleteMember(id) {
  const m = db.members.find(m => m.id === id);
  if (!confirm(`'${m.nick}' 회원을 삭제할까요?`)) return;
  db.members = db.members.filter(m => m.id !== id);
  selSet.delete(id); slowSet.delete(id);
  save(); renderMembers(); toast('삭제되었습니다');
}

function renderMembers() {
  const q = $('mSearch').value.toLowerCase();
  const list = db.members.filter(m =>
    m.nick.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
  );
  const mc = db.members.filter(m => m.gender === 'M').length;
  const fc = db.members.filter(m => m.gender === 'F').length;
  $('mTotal').textContent = `(${db.members.length}명)`;
  $('mGender').innerHTML = `<span style="color:#5ba4e6;font-size:12px">👨${mc}</span> <span style="color:#e879a0;font-size:12px">👩${fc}</span>`;

  if (db.members.length === 0) {
    $('mBody').innerHTML = ''; $('mEmpty').style.display = ''; return;
  }
  $('mEmpty').style.display = 'none';
  $('mBody').innerHTML = list.map(m => `
    <tr>
      <td><b style="color:var(--gold-l)">${esc(m.nick)}</b></td>
      <td>${esc(m.name)}</td>
      <td><span class="badge badge-${m.gender === 'F' ? 'f' : 'm'}">${m.gender === 'F' ? '👩 여' : '👨 남'}</span></td>
      <td style="color:rgba(255,255,255,.38)">${m.phone ? '****-' + esc(m.phone) : '—'}</td>
      <td>${m.isSlow
        ? '<span class="badge badge-slow">🐢 슬로우</span>'
        : '<span class="badge badge-norm">일반</span>'}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="editMember('${m.id}')" style="margin-right:3px">수정</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMember('${m.id}')">삭제</button>
      </td>
    </tr>`).join('');
}

function exportJSON() {
  const b = new Blob([JSON.stringify(db.members, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b);
  a.download = 'golf-members.json'; a.click();
}
function importJSON(e) {
  const file = e.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const arr = JSON.parse(ev.target.result);
      if (!Array.isArray(arr)) throw new Error();
      db.members = arr.map(m => ({ ...m, gender: m.gender || 'M' }));
      save(); renderMembers();
      toast(`✅ ${arr.length}명 가져오기 완료`);
    } catch { toast('❌ 파일 형식 오류'); }
  };
  r.readAsText(file); e.target.value = '';
}

// ── Draw ─────────────────────────────────────────────────────
function renderPGrid() {
  const g = $('pGrid');
  if (db.members.length === 0) {
    g.innerHTML = '<span style="color:rgba(255,255,255,.2);font-size:13px">회원을 먼저 등록해 주세요</span>';
    updateSelCnt(); return;
  }
  g.innerHTML = db.members.map(m => {
    const sel = selSet.has(m.id);
    const slowBorder = m.isSlow ? 'slow-border' : '';
    const gc = m.gender === 'F' ? 'var(--pink)' : 'var(--blue)';
    return `<div class="chip ${sel ? 'sel' : ''} ${slowBorder}" onclick="togSel('${m.id}')">
      <span style="font-size:10px;color:${gc}">${m.gender === 'F' ? '👩' : '👨'}</span>
      ${m.isSlow ? '🐢 ' : ''}${esc(m.nick)}
    </div>`;
  }).join('');
  renderSlowRow();
  updateSelCnt();
}

function togSel(id) {
  if (selSet.has(id)) { selSet.delete(id); slowSet.delete(id); }
  else {
    selSet.add(id);
    const m = db.members.find(m => m.id === id);
    if (m && m.isSlow) slowSet.add(id);
  }
  renderPGrid();
}

function selAll() {
  db.members.forEach(m => { selSet.add(m.id); if (m.isSlow) slowSet.add(m.id); });
  renderPGrid();
}
function selNone() { selSet.clear(); slowSet.clear(); renderPGrid(); }

function updateSelCnt() {
  const n = selSet.size;
  $('selCnt').textContent = n;
  $('selTeams').textContent = n > 0 ? Math.ceil(n / 4) : 0;
  const sel = db.members.filter(m => selSet.has(m.id));
  const mc = sel.filter(m => m.gender === 'M').length;
  const fc = sel.filter(m => m.gender === 'F').length;
  $('selGender').innerHTML = n > 0
    ? `<span style="color:var(--blue);font-size:12px">👨${mc}</span> <span style="color:var(--pink);font-size:12px">👩${fc}</span>`
    : '';
}

function renderSlowRow() {
  const sel = db.members.filter(m => selSet.has(m.id));
  const card = $('slowCard');
  if (sel.length === 0) { card.style.display = 'none'; return; }
  card.style.display = '';
  $('slowRow').innerHTML = sel.map(m => {
    const on = slowSet.has(m.id) ? 'slow-on' : '';
    return `<div class="chip ${on}" onclick="togSlow('${m.id}')">${esc(m.nick)}</div>`;
  }).join('');
  $('slowMsg').textContent = slowSet.size > 0 ? `슬로우 플레이어 ${slowSet.size}명 지정됨` : '';
}

function togSlow(id) {
  slowSet.has(id) ? slowSet.delete(id) : slowSet.add(id);
  renderSlowRow();
}

function showDrawErr(msg) {
  const e = $('drawErr'); e.textContent = msg; e.style.display = '';
  setTimeout(() => e.style.display = 'none', 5000);
}

// ── Algorithm ────────────────────────────────────────────────
function recentTeammates(memberId) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
  const result = new Set();
  for (const h of db.history) {
    if (new Date(h.date) < cutoff) continue;
    for (const team of h.teams) {
      const ids = team.map(m => m.id);
      if (ids.includes(memberId)) ids.forEach(id => { if (id !== memberId) result.add(id); });
    }
  }
  return result;
}

function tryAssign(participants, sArr, nTeams, strict) {
  const slowP = shuffle(participants.filter(m => sArr.includes(m.id)));
  const males  = shuffle(participants.filter(m => !sArr.includes(m.id) && m.gender === 'M'));
  const females = shuffle(participants.filter(m => !sArr.includes(m.id) && m.gender === 'F'));

  const teams = Array.from({ length: nTeams }, () => []);

  // 1) 슬로우 각 팀 1명
  for (let i = 0; i < slowP.length; i++) teams[i].push(slowP[i]);

  // 2) 남녀 교차 배분
  const remain = [];
  const max = Math.max(males.length, females.length);
  for (let i = 0; i < max; i++) {
    if (i < males.length) remain.push(males[i]);
    if (i < females.length) remain.push(females[i]);
  }

  let ni = 0;
  for (let t = 0; t < nTeams; t++) {
    const slots = 4 - teams[t].length;
    for (let s = 0; s < slots && ni < remain.length; s++) teams[t].push(remain[ni++]);
  }
  while (ni < remain.length) teams[nTeams - 1].push(remain[ni++]);

  // 3) 슬로우 중복 검증
  for (const team of teams)
    if (team.filter(m => sArr.includes(m.id)).length > 1) return null;

  // 4) 3개월 동일팀 검증 (strict 모드만)
  if (strict) {
    for (const team of teams) {
      const ids = team.map(m => m.id);
      for (let i = 0; i < ids.length; i++) {
        const prev = recentTeammates(ids[i]);
        for (let j = i + 1; j < ids.length; j++)
          if (prev.has(ids[j])) return null;
      }
    }
  }
  return teams;
}

function draw() {
  $('drawErr').style.display = 'none';
  const participants = db.members.filter(m => selSet.has(m.id));
  if (participants.length < 4) { showDrawErr('참가자가 최소 4명 이상이어야 합니다.'); return; }

  const sArr = [...slowSet];
  const nTeams = Math.ceil(participants.length / 4);
  if (sArr.length > nTeams) { showDrawErr(`슬로우 플레이어(${sArr.length}명)가 팀 수(${nTeams})보다 많습니다.`); return; }

  let teams = null;
  let relaxed = false;

  // strict: 3개월 조건 포함 (최대 2000회)
  for (let i = 0; i < 2000 && !teams; i++) teams = tryAssign(participants, sArr, nTeams, true);

  // relaxed: 3개월 조건 제외 (최대 500회)
  if (!teams) {
    relaxed = true;
    for (let i = 0; i < 500 && !teams; i++) teams = tryAssign(participants, sArr, nTeams, false);
  }

  if (!teams) { showDrawErr('조 편성 실패. 슬로우 플레이어를 줄이거나 참가자를 늘려주세요.'); return; }

  $('conflictWarn').style.display = relaxed ? '' : 'none';
  lastTeams = teams;
  $('saveHistBtn').textContent = '💾 이력 저장';
  renderResult(teams);
  launchConfetti();
}

function renderResult(teams) {
  $('resSection').style.display = '';
  const g = $('tGrid'); g.innerHTML = '';

  teams.forEach((team, tIdx) => {
    const mc = team.filter(m => m.gender === 'M').length;
    const fc = team.filter(m => m.gender !== 'M').length;
    const div = document.createElement('div');
    div.className = 'tcard';
    div.style.animationDelay = tIdx * 0.06 + 's';
    div.dataset.tidx = tIdx;

    // Drag-over events
    div.addEventListener('dragover', e => { e.preventDefault(); div.classList.add('drag-over'); });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
    div.addEventListener('drop', e => { e.preventDefault(); div.classList.remove('drag-over'); handleDrop(tIdx); });
    // Touch drop zone
    div.addEventListener('touchend', () => { if (dragSrc !== null) handleDrop(tIdx); });

    div.innerHTML = `
      <div class="thd">
        <span class="tnum">${tIdx + 1}조</span>
        <div style="display:flex;gap:6px;font-size:11px">
          <span style="color:var(--blue)">👨${mc}</span>
          <span style="color:var(--pink)">👩${fc}</span>
          <span style="color:rgba(255,255,255,.35)">${team.length}명</span>
        </div>
      </div>
      <div class="tbody">
        ${team.map((m, mIdx) => {
          const isSlow = slowSet.has(m.id);
          const gc = m.gender === 'F' ? 'var(--pink)' : 'var(--blue)';
          return `<div class="mrow ${isSlow ? 'slow' : ''}" draggable="true"
            data-tidx="${tIdx}" data-midx="${mIdx}"
            ondragstart="handleDragStart(${tIdx},${mIdx})"
            ontouchstart="handleDragStart(${tIdx},${mIdx})">
            <span style="font-size:10px;color:${gc}">${m.gender === 'F' ? '👩' : '👨'}</span>
            <div class="mdot"></div>
            <span class="mname">${esc(m.nick)}</span>
            <span style="font-size:11px;color:rgba(255,255,255,.27)">${esc(m.name)}</span>
            ${m.phone ? `<span style="font-size:10px;color:rgba(255,255,255,.25)">(${esc(m.phone)})</span>` : ''}
            ${isSlow ? '<span style="font-size:10px">🐢</span>' : ''}
          </div>`;
        }).join('')}
      </div>`;
    g.appendChild(div);
  });

  const total = teams.reduce((s, t) => s + t.length, 0);
  const mc = db.members.filter(m => selSet.has(m.id) && m.gender === 'M').length;
  const fc = db.members.filter(m => selSet.has(m.id) && m.gender !== 'M').length;
  $('sumBar').innerHTML = `
    <span>총 <b style="color:var(--g4)">${total}명</b></span>
    <span><b style="color:var(--g4)">${teams.length}팀</b> 편성</span>
    <span>👨<b style="color:var(--blue)">${mc}</b> · 👩<b style="color:var(--pink)">${fc}</b></span>
    ${slowSet.size > 0 ? `<span>슬로우 <b style="color:var(--g4)">${slowSet.size}명</b> 분리</span>` : ''}`;

  setTimeout(() => $('resSection').scrollIntoView({ behavior: 'smooth' }), 80);
}

// ── Drag & Drop ──────────────────────────────────────────────
function handleDragStart(tIdx, mIdx) { dragSrc = { tIdx, mIdx }; }
function handleDrop(toTIdx) {
  if (dragSrc === null) return;
  const { tIdx: fromT, mIdx: fromM } = dragSrc;
  dragSrc = null;
  if (fromT === toTIdx) return;

  const next = lastTeams.map(t => [...t]);
  const [member] = next[fromT].splice(fromM, 1);
  next[toTIdx].push(member);
  lastTeams = next;
  renderResult(next);
  $('saveHistBtn').textContent = '💾 이력 저장';
}

// ── History ──────────────────────────────────────────────────
function saveHist() {
  if (!lastTeams) return;
  const date = $('drawDate').value || today();
  const note = $('drawNote').value.trim();
  const entry = {
    id: uid(), date, note, slowCount: slowSet.size,
    teams: lastTeams.map(team => team.map(m => ({
      id: m.id, nick: m.nick, name: m.name,
      phone: m.phone || '', gender: m.gender || 'M',
      isSlow: slowSet.has(m.id)
    })))
  };
  db.history.unshift(entry);
  save();
  $('saveHistBtn').textContent = '✅ 저장됨';
  toast('✅ 이력이 저장되었습니다');
}

function copyRes() {
  if (!lastTeams) return;
  const date = $('drawDate').value || today();
  let t = `⛳ 골프 조 편성 결과 (${date})\n`;
  if ($('drawNote').value.trim()) t += `📍 ${$('drawNote').value.trim()}\n`;
  t += '\n';
  lastTeams.forEach((team, i) => {
    t += `【${i + 1}조】\n`;
    team.forEach(m => {
      const ph = m.phone ? ` (${m.phone})` : '';
      t += `  ${slowSet.has(m.id) ? '🐢 ' : ''}${m.nick} / ${m.name}${ph}\n`;
    });
    t += '\n';
  });
  navigator.clipboard.writeText(t).then(() => toast('📋 클립보드에 복사됨'));
}

function renderHistory() {
  const list = $('histList');
  if (db.history.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:28px;color:rgba(255,255,255,.22);font-size:13px">저장된 이력이 없습니다</div>';
    return;
  }
  list.innerHTML = db.history.map(h => {
    const total = h.teams.reduce((s, t) => s + t.length, 0);
    return `
    <div class="hi" id="hi-${h.id}">
      <div class="hi-hdr" onclick="togHist('${h.id}')">
        <div>
          <div class="hi-date">${esc(h.date)}</div>
          <div class="hi-meta">${h.teams.length}팀 · ${total}명${h.note ? ' · ' + esc(h.note) : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:7px">
          <button class="btn btn-ghost btn-sm" onclick="copyHist('${h.id}',event)">📋</button>
          <button class="btn btn-danger btn-sm" onclick="delHist('${h.id}',event)">삭제</button>
          <span id="arr-${h.id}" style="color:rgba(255,255,255,.28);font-size:11px;transition:transform .2s;display:inline-block">▼</span>
        </div>
      </div>
      <div class="hi-body" id="hb-${h.id}">
        <div class="ht-grid">
          ${h.teams.map((team, i) => `
            <div class="tcard">
              <div class="thd">
                <span class="tnum">${i + 1}조</span>
                <span style="font-size:11px;color:rgba(255,255,255,.35)">${team.length}명</span>
              </div>
              <div class="tbody">
                ${team.map(m => `
                  <div class="mrow ${m.isSlow ? 'slow' : ''}">
                    <span style="font-size:9px;color:${m.gender === 'F' ? 'var(--pink)' : 'var(--blue)'}">${m.gender === 'F' ? '👩' : '👨'}</span>
                    <div class="mdot"></div>
                    <span class="mname" style="font-size:12px">${esc(m.nick)}</span>
                    <span style="font-size:10px;color:rgba(255,255,255,.27)">${esc(m.name)}</span>
                    ${m.phone ? `<span style="font-size:10px;color:rgba(255,255,255,.22)">(${esc(m.phone)})</span>` : ''}
                    ${m.isSlow ? '<span style="font-size:9px">🐢</span>' : ''}
                  </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
  }).join('');
}

function togHist(id) {
  const b = $('hb-' + id); const a = $('arr-' + id);
  const open = b.classList.toggle('open');
  a.style.transform = open ? 'rotate(180deg)' : '';
}

function delHist(id, e) {
  e.stopPropagation();
  if (!confirm('이 이력을 삭제할까요?')) return;
  db.history = db.history.filter(h => h.id !== id);
  save(); renderHistory(); toast('삭제되었습니다');
}

function clearHist() {
  if (!db.history.length) return;
  if (!confirm(`전체 ${db.history.length}개의 이력을 삭제할까요?`)) return;
  db.history = []; save(); renderHistory(); toast('전체 이력 삭제됨');
}

function copyHist(id, e) {
  e.stopPropagation();
  const h = db.history.find(h => h.id === id); if (!h) return;
  let t = `⛳ 골프 조 편성 결과 (${h.date})\n`;
  if (h.note) t += `📍 ${h.note}\n`;
  t += '\n';
  h.teams.forEach((team, i) => {
    t += `【${i + 1}조】\n`;
    team.forEach(m => {
      const ph = m.phone ? ` (${m.phone})` : '';
      t += `  ${m.isSlow ? '🐢 ' : ''}${m.nick} / ${m.name}${ph}\n`;
    });
    t += '\n';
  });
  navigator.clipboard.writeText(t).then(() => toast('📋 복사됨'));
}

// ── Confetti ─────────────────────────────────────────────────
function launchConfetti() {
  const cols = ['#d4a017','#52b788','#f0c040','#95d5b2','#ff9f85'];
  for (let i = 0; i < 40; i++) {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;width:${Math.random()*8+3}px;height:${Math.random()*8+3}px;
      background:${cols[i%cols.length]};border-radius:${Math.random()>.5?'50%':'2px'};
      left:${Math.random()*100}vw;top:-10px;opacity:1;pointer-events:none;z-index:9999;
      transition:all ${Math.random()*1.3+.7}s ease-out`;
    document.body.appendChild(d);
    setTimeout(() => { d.style.top = Math.random()*60+30+'vh'; d.style.opacity='0'; }, 60);
    setTimeout(() => d.remove(), 2500);
  }
}

// ── PWA Install ──────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  const bar = $('installBar');
  bar.style.display = 'flex';
  bar.querySelector('p').innerHTML = '📲 앱으로 설치하면 더 편리하게 사용할 수 있어요<br><b style="color:var(--gold-l)">지금 설치하기</b>';
  bar.querySelector('button').textContent = '설치';
  bar.querySelector('button').onclick = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    bar.style.display = 'none';
  };
});

// iOS Safari install hint
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone; }
if (isIOS() && !isStandalone()) {
  $('installBar').style.display = 'flex';
}

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ── Init ─────────────────────────────────────────────────────
load();
$('drawDate').value = today();
renderMembers();
