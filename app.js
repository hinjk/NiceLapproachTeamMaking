/* ═══════════════════════════════════════════════════════════════
   GOLF 조 편성기 - app.js  v3
   플레이 속도 A/B/C/D 등급 균형 배분 + 남여균형 + 3개월동일팀회피
═══════════════════════════════════════════════════════════════ */

// ── 등급 정의 ─────────────────────────────────────────────────
const PACES = ['A','B','C','D'];
const PACE_LABEL = { A:'매우 빠름', B:'보통 빠름', C:'보통 느림', D:'매우 느림' };
const PACE_COLOR = { A:'var(--pa)', B:'var(--pb)', C:'var(--pc)', D:'var(--pd)' };

// ── State ─────────────────────────────────────────────────────
let db = { members: [], history: [] };
let editId = null;
let currentPace = null;   // 등록 폼에서 선택된 등급
let selSet = new Set();   // 이번 모임 참가자 id set
let lastTeams = null;
let dragSrc = null;

// ── Storage ───────────────────────────────────────────────────
function save() {
  localStorage.setItem('golfapp_v3', JSON.stringify(db));
}
function load() {
  try {
    const s = localStorage.getItem('golfapp_v3');
    if (s) {
      db = JSON.parse(s);
    } else {
      // v2 마이그레이션: isSlow → pace (슬로우였으면 D, 아니면 B)
      const old = localStorage.getItem('golfapp_v2');
      if (old) {
        const oldDb = JSON.parse(old);
        db.members = (oldDb.members || []).map(m => ({
          ...m,
          pace: m.pace || (m.isSlow ? 'D' : 'B'),
          gender: m.gender || 'M'
        }));
        db.history = (oldDb.history || []).map(h => ({
          ...h,
          teams: h.teams.map(team => team.map(m => ({
            ...m,
            pace: m.pace || (m.isSlow ? 'D' : 'B')
          })))
        }));
      }
    }
    // 방어: pace 없는 경우
    db.members.forEach(m => {
      if (!m.pace) m.pace = 'B';
      if (!m.gender) m.gender = 'M';
    });
  } catch (e) { db = { members: [], history: [] }; }
}

// ── Helpers ───────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { return new Date().toISOString().slice(0, 10); }
function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// 등급 배지 HTML
function paceBadge(p) {
  return `<span class="pace pace-${p}" style="font-family:'Black Han Sans',sans-serif">${p}</span>`;
}

// 등급 분포 HTML (grade-dist 영역용)
function gradeDist(members) {
  return PACES.map(p => {
    const cnt = members.filter(m => m.pace === p).length;
    if (cnt === 0) return '';
    return `<span class="gd-item">${paceBadge(p)}<span style="color:${PACE_COLOR[p]}">${cnt}</span></span>`;
  }).join('');
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('on', ['members','draw','history'][i] === name);
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  $('tab-' + name).classList.add('on');
  if (name === 'draw') renderPGrid();
  if (name === 'history') renderHistory();
}

// ── 등급 선택 버튼 ────────────────────────────────────────────
function setPace(p) {
  currentPace = p;
  document.querySelectorAll('.pace-btn').forEach(btn => {
    btn.className = 'pace-btn';
    if (btn.dataset.pace === p) btn.classList.add(`on-${p}`);
  });
}

// ── Members ───────────────────────────────────────────────────
function saveMember() {
  const nick  = $('fNick').value.trim();
  const name  = $('fName').value.trim();
  const phone = $('fPhone').value.trim();
  const gender = $('fGender').value;

  if (!nick || !name) { toast('❌ 닉네임과 실명은 필수입니다'); return; }
  if (!currentPace)   { toast('❌ 플레이 속도 등급을 선택해 주세요'); return; }
  if (phone && !/^\d{4}$/.test(phone)) { toast('❌ 전화번호는 숫자 4자리'); return; }

  if (editId) {
    const m = db.members.find(m => m.id === editId);
    if (m) Object.assign(m, { nick, name, phone, gender, pace: currentPace });
    editId = null;
  } else {
    if (db.members.some(m => m.nick === nick)) { toast('❌ 동일 닉네임 존재'); return; }
    db.members.push({ id: uid(), nick, name, phone, gender, pace: currentPace });
  }
  save();
  resetForm();
  renderMembers();
  toast('✅ 저장되었습니다');
}

function resetForm() {
  ['fNick','fName','fPhone'].forEach(id => $(id).value = '');
  $('fGender').value = 'M';
  document.querySelectorAll('.pace-btn').forEach(btn => btn.className = 'pace-btn');
  currentPace = null;
  $('formTitle').textContent = '신규 회원 등록';
  $('fSaveBtn').textContent  = '✚ 등록하기';
  $('fCancelBtn').style.display = 'none';
  editId = null;
}
function cancelEdit() { resetForm(); }

function editMember(id) {
  const m = db.members.find(m => m.id === id); if (!m) return;
  editId = id;
  $('fNick').value   = m.nick;
  $('fName').value   = m.name;
  $('fPhone').value  = m.phone || '';
  $('fGender').value = m.gender || 'M';
  setPace(m.pace || 'B');
  $('formTitle').textContent = '회원 정보 수정';
  $('fSaveBtn').textContent  = '✔ 저장하기';
  $('fCancelBtn').style.display = '';
  $('formCard').scrollIntoView({ behavior: 'smooth' });
}

function deleteMember(id) {
  const m = db.members.find(m => m.id === id);
  if (!confirm(`'${m.nick}' 회원을 삭제할까요?`)) return;
  db.members = db.members.filter(m => m.id !== id);
  selSet.delete(id);
  save(); renderMembers(); toast('삭제되었습니다');
}

function renderMembers() {
  const q = $('mSearch').value.toLowerCase();
  const list = db.members.filter(m =>
    m.nick.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
  );
  $('mTotal').textContent = `(${db.members.length}명)`;
  $('mGradeBar').innerHTML = gradeDist(db.members);

  if (db.members.length === 0) {
    $('mBody').innerHTML = ''; $('mEmpty').style.display = ''; return;
  }
  $('mEmpty').style.display = 'none';
  $('mBody').innerHTML = list.map(m => `
    <tr>
      <td><b style="color:var(--gold-l)">${esc(m.nick)}</b></td>
      <td>${esc(m.name)}</td>
      <td><span class="badge badge-${m.gender==='F'?'f':'m'}">${m.gender==='F'?'👩 여':'👨 남'}</span></td>
      <td style="color:rgba(255,255,255,.38)">${m.phone ? '****-'+esc(m.phone) : '—'}</td>
      <td>
        ${paceBadge(m.pace)}
        <span style="font-size:11px;color:${PACE_COLOR[m.pace]};margin-left:4px">${PACE_LABEL[m.pace]||''}</span>
      </td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="editMember('${m.id}')" style="margin-right:3px">수정</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMember('${m.id}')">삭제</button>
      </td>
    </tr>`).join('');
}

function exportJSON() {
  const b = new Blob([JSON.stringify(db.members, null, 2)], { type:'application/json' });
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
      db.members = arr.map(m => ({
        ...m,
        pace:   m.pace   || (m.isSlow ? 'D' : 'B'),
        gender: m.gender || 'M'
      }));
      save(); renderMembers();
      toast(`✅ ${arr.length}명 가져오기 완료`);
    } catch { toast('❌ 파일 형식 오류'); }
  };
  r.readAsText(file); e.target.value = '';
}

// ── Draw: 참가자 선택 ─────────────────────────────────────────
function renderPGrid() {
  const g = $('pGrid');
  if (db.members.length === 0) {
    g.innerHTML = '<span style="color:rgba(255,255,255,.2);font-size:13px">회원을 먼저 등록해 주세요</span>';
    updateSelCnt(); return;
  }
  const gc = m => m.gender === 'F' ? 'var(--pink)' : 'var(--blue)';
  g.innerHTML = db.members.map(m =>
    `<div class="chip ${selSet.has(m.id)?'sel':''}" onclick="togSel('${m.id}')">
      ${paceBadge(m.pace)}
      <span style="font-size:10px;color:${gc(m)}">${m.gender==='F'?'👩':'👨'}</span>
      ${esc(m.nick)}
    </div>`
  ).join('');
  updateSelCnt();
}

function togSel(id) {
  selSet.has(id) ? selSet.delete(id) : selSet.add(id);
  renderPGrid();
}
function selAll()  { db.members.forEach(m => selSet.add(m.id)); renderPGrid(); }
function selNone() { selSet.clear(); renderPGrid(); }

function updateSelCnt() {
  const n = selSet.size;
  $('selCnt').textContent   = n;
  $('selTeams').textContent = n > 0 ? Math.ceil(n/4) : 0;
  const sel = db.members.filter(m => selSet.has(m.id));
  $('selGradeBar').innerHTML = n > 0 ? gradeDist(sel) : '';
}

// ── 알고리즘: 등급 균형 배분 ──────────────────────────────────
/*
  전략:
  1) 참가자를 등급별로 그룹화 (A, B, C, D)
  2) 라운드 로빈 방식으로 각 팀에 순서대로 배분
     - 등급 순서를 랜덤 섞어서 매번 다른 결과
  3) 4명 미만 팀은 남은 인원으로 채움
  4) 남/여 균형 최대화: 각 등급 내에서 남/여 교차 배치
  5) 3개월 동일팀 회피 (가능한 경우)
*/
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

function interleaveMF(arr) {
  // 같은 등급 내에서 남/여 교차 배열
  const males   = arr.filter(m => m.gender === 'M');
  const females = arr.filter(m => m.gender === 'F');
  const result = [];
  const max = Math.max(males.length, females.length);
  for (let i = 0; i < max; i++) {
    if (i < males.length)   result.push(males[i]);
    if (i < females.length) result.push(females[i]);
  }
  return result;
}

function tryAssign(participants, nTeams, strict) {
  // 등급별 분류 + 각 등급 내 남/여 교차 + 셔플
  const byGrade = {};
  PACES.forEach(p => {
    byGrade[p] = interleaveMF(shuffle(participants.filter(m => m.pace === p)));
  });

  const teams = Array.from({ length: nTeams }, () => []);

  // 라운드 로빈: A→B→C→D 순으로 각 팀에 1명씩 배분
  // 등급 순서도 약간 랜덤성 부여 (A/D 고정, B/C 순서만 랜덤)
  const gradeOrder = Math.random() > 0.5 ? ['A','B','C','D'] : ['A','C','B','D'];
  const pool = [];
  const maxGLen = Math.max(...PACES.map(p => byGrade[p].length));
  for (let i = 0; i < maxGLen; i++) {
    for (const p of gradeOrder) {
      if (i < byGrade[p].length) pool.push(byGrade[p][i]);
    }
  }

  // 팀에 순서대로 배분
  pool.forEach((m, idx) => {
    teams[idx % nTeams].push(m);
  });

  // 3개월 동일팀 검증
  if (strict) {
    for (const team of teams) {
      const ids = team.map(m => m.id);
      for (let i = 0; i < ids.length; i++) {
        const prev = recentTeammates(ids[i]);
        for (let j = i+1; j < ids.length; j++) {
          if (prev.has(ids[j])) return null;
        }
      }
    }
  }
  return teams;
}

function draw() {
  $('drawErr').style.display = 'none';
  const participants = db.members.filter(m => selSet.has(m.id));
  if (participants.length < 4) { showErr('참가자가 최소 4명 이상이어야 합니다.'); return; }

  const nTeams = Math.ceil(participants.length / 4);
  let teams = null;
  let relaxed = false;

  // 엄격 모드 (3개월 조건 포함) 최대 2000회
  for (let i = 0; i < 2000 && !teams; i++) teams = tryAssign(participants, nTeams, true);

  // 완화 모드 (3개월 조건 제외) 최대 500회
  if (!teams) {
    relaxed = true;
    for (let i = 0; i < 500 && !teams; i++) teams = tryAssign(participants, nTeams, false);
  }

  if (!teams) { showErr('조 편성 실패. 참가자를 늘려주세요.'); return; }

  $('conflictWarn').style.display = relaxed ? '' : 'none';
  lastTeams = teams;
  $('saveHistBtn').textContent = '💾 이력 저장';
  renderResult(teams);
  launchConfetti();
}

function showErr(msg) {
  const e = $('drawErr'); e.textContent = msg; e.style.display = '';
  setTimeout(() => e.style.display = 'none', 6000);
}

// ── 결과 렌더링 ───────────────────────────────────────────────
function teamGradeDist(team) {
  return PACES.map(p => {
    const cnt = team.filter(m => m.pace === p).length;
    if (cnt === 0) return '';
    return `<span style="font-family:'Black Han Sans',sans-serif;font-size:10px;padding:1px 5px;border-radius:4px;
      background:${p==='A'?'rgba(224,92,58,.22)':p==='B'?'rgba(212,160,23,.18)':p==='C'?'rgba(82,183,136,.16)':'rgba(91,164,230,.16)'};
      color:${PACE_COLOR[p]}">${p}:${cnt}</span>`;
  }).join('');
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

    div.addEventListener('dragover',  e => { e.preventDefault(); div.classList.add('drag-over'); });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
    div.addEventListener('drop',      e => { e.preventDefault(); div.classList.remove('drag-over'); handleDrop(tIdx); });
    div.addEventListener('touchend',  () => { if (dragSrc !== null) handleDrop(tIdx); });

    div.innerHTML = `
      <div class="thd">
        <span class="tnum">${tIdx+1}조</span>
        <div style="display:flex;gap:3px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${teamGradeDist(team)}
          <span style="font-size:10px;color:var(--blue);margin-left:2px">👨${mc}</span>
          <span style="font-size:10px;color:var(--pink)">👩${fc}</span>
        </div>
      </div>
      <div class="tbody">
        ${team.map((m, mIdx) => {
          const gc = m.gender === 'F' ? 'var(--pink)' : 'var(--blue)';
          return `<div class="mrow" draggable="true"
              data-tidx="${tIdx}" data-midx="${mIdx}"
              ondragstart="handleDragStart(${tIdx},${mIdx})"
              ontouchstart="handleDragStart(${tIdx},${mIdx})">
            ${paceBadge(m.pace)}
            <span style="font-size:10px;color:${gc}">${m.gender==='F'?'👩':'👨'}</span>
            <span class="mname">${esc(m.nick)}</span>
            <span style="font-size:11px;color:rgba(255,255,255,.27)">${esc(m.name)}</span>
            ${m.phone ? `<span style="font-size:10px;color:rgba(255,255,255,.25)">(${esc(m.phone)})</span>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    g.appendChild(div);
  });

  // 요약 바
  const sel = db.members.filter(m => selSet.has(m.id));
  const mc = sel.filter(m => m.gender === 'M').length;
  const fc = sel.filter(m => m.gender !== 'M').length;
  $('sumBar').innerHTML = `
    <span>총 <b style="color:var(--g4)">${sel.length}명</b></span>
    <span><b style="color:var(--g4)">${teams.length}팀</b> 편성</span>
    <span>👨<b style="color:var(--blue)">${mc}</b> 👩<b style="color:var(--pink)">${fc}</b></span>
    ${gradeDist(sel)}`;

  setTimeout(() => $('resSection').scrollIntoView({ behavior:'smooth' }), 80);
}

// ── Drag & Drop ───────────────────────────────────────────────
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

// ── History ───────────────────────────────────────────────────
function saveHist() {
  if (!lastTeams) return;
  const entry = {
    id: uid(),
    date: $('drawDate').value || today(),
    note: $('drawNote').value.trim(),
    teams: lastTeams.map(team => team.map(m => ({
      id: m.id, nick: m.nick, name: m.name,
      phone: m.phone || '', gender: m.gender || 'M',
      pace: m.pace || 'B'
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
    t += `【${i+1}조】\n`;
    team.forEach(m => {
      const ph = m.phone ? ` (${m.phone})` : '';
      t += `  [${m.pace}] ${m.nick} / ${m.name}${ph}\n`;
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
    const total = h.teams.reduce((s,t) => s+t.length, 0);
    const allM  = h.teams.flat();
    return `
    <div class="hi" id="hi-${h.id}">
      <div class="hi-hdr" onclick="togHist('${h.id}')">
        <div>
          <div class="hi-date">${esc(h.date)}</div>
          <div class="hi-meta">${h.teams.length}팀 · ${total}명${h.note?' · '+esc(h.note):''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:7px">
          <button class="btn btn-ghost btn-sm" onclick="copyHist('${h.id}',event)">📋</button>
          <button class="btn btn-danger btn-sm" onclick="delHist('${h.id}',event)">삭제</button>
          <span id="arr-${h.id}" style="color:rgba(255,255,255,.28);font-size:11px;transition:transform .2s;display:inline-block">▼</span>
        </div>
      </div>
      <div class="hi-body" id="hb-${h.id}">
        <div class="ht-grid">
          ${h.teams.map((team,i) => `
            <div class="tcard">
              <div class="thd">
                <span class="tnum">${i+1}조</span>
                <div style="display:flex;gap:3px;flex-wrap:wrap">${teamGradeDist(team)}</div>
              </div>
              <div class="tbody">
                ${team.map(m => `
                  <div class="mrow" style="cursor:default">
                    ${paceBadge(m.pace||'B')}
                    <span style="font-size:9px;color:${m.gender==='F'?'var(--pink)':'var(--blue)'}">${m.gender==='F'?'👩':'👨'}</span>
                    <span class="mname" style="font-size:12px">${esc(m.nick)}</span>
                    <span style="font-size:10px;color:rgba(255,255,255,.27)">${esc(m.name)}</span>
                    ${m.phone?`<span style="font-size:10px;color:rgba(255,255,255,.22)">(${esc(m.phone)})</span>`:''}
                  </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
  }).join('');
}

function togHist(id) {
  const b = $('hb-'+id); const a = $('arr-'+id);
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
    t += `【${i+1}조】\n`;
    team.forEach(m => {
      const ph = m.phone ? ` (${m.phone})` : '';
      t += `  [${m.pace||'B'}] ${m.nick} / ${m.name}${ph}\n`;
    });
    t += '\n';
  });
  navigator.clipboard.writeText(t).then(() => toast('📋 복사됨'));
}

// ── Confetti ──────────────────────────────────────────────────
function launchConfetti() {
  const cols = ['#d4a017','#52b788','#f0c040','#95d5b2','#e05c3a','#5ba4e6'];
  for (let i = 0; i < 42; i++) {
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

// ── PWA ───────────────────────────────────────────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  const bar = $('installBar');
  bar.style.display = 'flex';
  bar.querySelector('p').innerHTML = '📲 앱으로 설치하면 더 편리하게 사용할 수 있어요<br><b style="color:var(--gold-l)">지금 설치하기</b>';
  const btn = bar.querySelector('button');
  btn.textContent = '설치';
  btn.onclick = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    bar.style.display = 'none';
  };
});
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone; }
if (isIOS() && !isStandalone()) $('installBar').style.display = 'flex';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

// ── Init ──────────────────────────────────────────────────────
load();
$('drawDate').value = today();
renderMembers();
