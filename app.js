/* ═══════════════════════════════════════════════════════════════
   GOLF 조 편성기 - app.js  v4
   ✅ D등급 팀내 중복 금지
   ✅ 결과 수정 모드 (팀 이동 버튼 + 팀원 제거)
═══════════════════════════════════════════════════════════════ */

// ── 등급 정의 ─────────────────────────────────────────────────
const PACES = ['A','B','C','D'];
const PACE_LABEL = { A:'매우 빠름', B:'보통 빠름', C:'보통 느림', D:'매우 느림' };
const PACE_COLOR = { A:'var(--pa)', B:'var(--pb)', C:'var(--pc)', D:'var(--pd)' };

// ── State ─────────────────────────────────────────────────────
let db = { members: [], history: [] };
let editId      = null;   // 회원 폼 수정 ID
let currentPace = null;   // 등록 폼 선택 등급
let selSet      = new Set();   // 이번 모임 참가자
let lastTeams   = null;        // 최근 편성 결과
let dragSrc     = null;        // 드래그 출발지 {tIdx, mIdx}
let editMode    = false;       // 결과 수정 모드 on/off

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
      const old = localStorage.getItem('golfapp_v2');
      if (old) {
        const o = JSON.parse(old);
        db.members = (o.members || []).map(m => ({
          ...m, pace: m.pace || (m.isSlow ? 'D' : 'B'), gender: m.gender || 'M'
        }));
        db.history = (o.history || []).map(h => ({
          ...h, teams: h.teams.map(t => t.map(m => ({
            ...m, pace: m.pace || (m.isSlow ? 'D' : 'B')
          })))
        }));
      }
    }
    db.members.forEach(m => {
      if (!m.pace)   m.pace   = 'B';
      if (!m.gender) m.gender = 'M';
    });
  } catch { db = { members: [], history: [] }; }
}

// ── Helpers ───────────────────────────────────────────────────
function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function today(){ return new Date().toISOString().slice(0,10); }
function $(id)  { return document.getElementById(id); }
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
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function paceBadge(p) {
  return `<span class="pace pace-${p}">${p}</span>`;
}
function gradeDist(members) {
  return PACES.map(p => {
    const cnt = members.filter(m => m.pace === p).length;
    if (!cnt) return '';
    return `<span class="gd-item">${paceBadge(p)}<span style="color:${PACE_COLOR[p]}">${cnt}</span></span>`;
  }).join('');
}
function teamGradeDist(team) {
  return PACES.map(p => {
    const cnt = team.filter(m => m.pace === p).length;
    if (!cnt) return '';
    const bg = p==='A'?'rgba(224,92,58,.22)':p==='B'?'rgba(212,160,23,.18)':p==='C'?'rgba(82,183,136,.16)':'rgba(91,164,230,.16)';
    return `<span style="font-family:'Black Han Sans',sans-serif;font-size:10px;padding:1px 5px;border-radius:4px;background:${bg};color:${PACE_COLOR[p]}">${p}:${cnt}</span>`;
  }).join('');
}

// ── Tabs ──────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t,i) =>
    t.classList.toggle('on', ['members','draw','history'][i] === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('on'));
  $('tab-'+name).classList.add('on');
  if (name === 'draw')    renderPGrid();
  if (name === 'history') renderHistory();
}

// ── 등급 선택 ─────────────────────────────────────────────────
function setPace(p) {
  currentPace = p;
  document.querySelectorAll('.pace-btn').forEach(btn => {
    btn.className = 'pace-btn';
    if (btn.dataset.pace === p) btn.classList.add(`on-${p}`);
  });
}

// ── Members ───────────────────────────────────────────────────
function saveMember() {
  const nick   = $('fNick').value.trim();
  const name   = $('fName').value.trim();
  const phone  = $('fPhone').value.trim();
  const gender = $('fGender').value;
  if (!nick || !name)         { toast('❌ 닉네임과 실명은 필수입니다'); return; }
  if (!currentPace)           { toast('❌ 플레이 속도 등급을 선택해 주세요'); return; }
  if (phone && !/^\d{4}$/.test(phone)) { toast('❌ 전화번호는 숫자 4자리'); return; }

  if (editId) {
    const m = db.members.find(m => m.id === editId);
    if (m) Object.assign(m, { nick, name, phone, gender, pace: currentPace });
    editId = null;
  } else {
    if (db.members.some(m => m.nick === nick)) { toast('❌ 동일 닉네임 존재'); return; }
    db.members.push({ id: uid(), nick, name, phone, gender, pace: currentPace });
  }
  save(); resetForm(); renderMembers(); toast('✅ 저장되었습니다');
}
function resetForm() {
  ['fNick','fName','fPhone'].forEach(id => $(id).value = '');
  $('fGender').value = 'M';
  document.querySelectorAll('.pace-btn').forEach(b => b.className = 'pace-btn');
  currentPace = null;
  $('formTitle').textContent   = '신규 회원 등록';
  $('fSaveBtn').textContent    = '✚ 등록하기';
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
  $('formTitle').textContent   = '회원 정보 수정';
  $('fSaveBtn').textContent    = '✔ 저장하기';
  $('fCancelBtn').style.display = '';
  $('formCard').scrollIntoView({ behavior:'smooth' });
}
function deleteMember(id) {
  const m = db.members.find(m => m.id === id);
  if (!confirm(`'${m.nick}' 회원을 삭제할까요?`)) return;
  db.members = db.members.filter(m => m.id !== id);
  selSet.delete(id);
  save(); renderMembers(); toast('삭제되었습니다');
}
function renderMembers() {
  const q    = $('mSearch').value.toLowerCase();
  const list = db.members.filter(m =>
    m.nick.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  $('mTotal').textContent    = `(${db.members.length}명)`;
  $('mGradeBar').innerHTML   = gradeDist(db.members);
  if (db.members.length === 0) {
    $('mBody').innerHTML = ''; $('mEmpty').style.display = ''; return;
  }
  $('mEmpty').style.display = 'none';
  $('mBody').innerHTML = list.map(m => `
    <tr>
      <td><b style="color:var(--gold-l)">${esc(m.nick)}</b></td>
      <td>${esc(m.name)}</td>
      <td><span class="badge badge-${m.gender==='F'?'f':'m'}">${m.gender==='F'?'👩 여':'👨 남'}</span></td>
      <td style="color:rgba(255,255,255,.38)">${m.phone?'****-'+esc(m.phone):'—'}</td>
      <td>${paceBadge(m.pace)}<span style="font-size:11px;color:${PACE_COLOR[m.pace]};margin-left:4px">${PACE_LABEL[m.pace]||''}</span></td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="editMember('${m.id}')" style="margin-right:3px">수정</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMember('${m.id}')">삭제</button>
      </td>
    </tr>`).join('');
}
function exportJSON() {
  const b = new Blob([JSON.stringify(db.members,null,2)],{type:'application/json'});
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
      db.members = arr.map(m => ({ ...m, pace: m.pace||(m.isSlow?'D':'B'), gender: m.gender||'M' }));
      save(); renderMembers(); toast(`✅ ${arr.length}명 가져오기 완료`);
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
  g.innerHTML = db.members.map(m => {
    const gc = m.gender==='F'?'var(--pink)':'var(--blue)';
    return `<div class="chip ${selSet.has(m.id)?'sel':''}" onclick="togSel('${m.id}')">
      ${paceBadge(m.pace)}
      <span style="font-size:10px;color:${gc}">${m.gender==='F'?'👩':'👨'}</span>
      ${esc(m.nick)}
    </div>`;
  }).join('');
  updateSelCnt();
}
function togSel(id) { selSet.has(id)?selSet.delete(id):selSet.add(id); renderPGrid(); }
function selAll()   { db.members.forEach(m => selSet.add(m.id)); renderPGrid(); }
function selNone()  { selSet.clear(); renderPGrid(); }
function updateSelCnt() {
  const n   = selSet.size;
  $('selCnt').textContent   = n;
  $('selTeams').textContent = n > 0 ? Math.ceil(n/4) : 0;
  const sel = db.members.filter(m => selSet.has(m.id));
  $('selGradeBar').innerHTML = n > 0 ? gradeDist(sel) : '';
}

// ══════════════════════════════════════════════════════════════
//  알고리즘: A/B/C/D 균형 배분 + D등급 팀내 중복 금지
// ══════════════════════════════════════════════════════════════
/*
  배분 전략:
  ① D등급은 슬로우처럼 "팀당 최대 1명" 제약
  ② 나머지 등급(A/B/C)은 라운드로빈으로 각 팀에 균등 배분
  ③ 각 등급 내에서 남/여 교차 배치 → 성별 균형
  ④ 3개월 동일팀 회피 (strict 모드)

  D 배정 방식:
  - D 인원을 셔플 후 앞 nTeams명까지만 각 팀에 1명씩 선배정
  - D가 nTeams보다 많으면 남은 D는 일반 pool에 합류 (불가피)
  - D가 nTeams 이하면 각 팀에 최대 1명 보장
*/
function recentTeammates(memberId) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-3);
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
  const males   = arr.filter(m => m.gender === 'M');
  const females = arr.filter(m => m.gender === 'F');
  const result  = [];
  const max = Math.max(males.length, females.length);
  for (let i = 0; i < max; i++) {
    if (i < males.length)   result.push(males[i]);
    if (i < females.length) result.push(females[i]);
  }
  return result;
}

function tryAssign(participants, nTeams, strict) {
  const teams = Array.from({ length: nTeams }, () => []);

  // ① D등급 분리
  const dPlayers = interleaveMF(shuffle(participants.filter(m => m.pace === 'D')));
  const others   = participants.filter(m => m.pace !== 'D');

  // D등급 각 팀에 1명씩 선배정 (팀 수까지)
  const dAssigned = [];
  const dOverflow = [];
  dPlayers.forEach((m, i) => {
    if (i < nTeams) dAssigned.push(m);
    else            dOverflow.push(m);   // D가 팀 수보다 많으면 overflow
  });

  // 팀 순서를 셔플해서 D가 항상 같은 팀에만 가지 않도록
  const teamOrder = shuffle([...Array(nTeams).keys()]);
  dAssigned.forEach((m, i) => teams[teamOrder[i]].push(m));

  // ② 나머지(A/B/C) + D overflow → 등급별 남/여 교차 후 라운드로빈
  const byGrade = {};
  ['A','B','C'].forEach(p => {
    byGrade[p] = interleaveMF(shuffle(others.filter(m => m.pace === p)));
  });
  if (dOverflow.length) {
    byGrade['D_overflow'] = interleaveMF(shuffle(dOverflow));
  }

  const gradeKeys = Math.random() > 0.5 ? ['A','B','C'] : ['A','C','B'];
  if (dOverflow.length) gradeKeys.push('D_overflow');

  const pool = [];
  const maxLen = Math.max(...gradeKeys.map(k => (byGrade[k]||[]).length));
  for (let i = 0; i < maxLen; i++) {
    for (const k of gradeKeys) {
      if (byGrade[k] && i < byGrade[k].length) pool.push(byGrade[k][i]);
    }
  }

  // 각 팀의 현재 인원수 기준으로 적게 채워진 팀부터 배분
  pool.forEach(m => {
    // 현재 가장 인원이 적은 팀 찾기
    let minIdx = 0;
    for (let t = 1; t < nTeams; t++) {
      if (teams[t].length < teams[minIdx].length) minIdx = t;
    }
    teams[minIdx].push(m);
  });

  // ③ D중복 검증 (D가 팀 수보다 많아서 overflow 발생 시 최소화 확인)
  for (const team of teams) {
    const dCnt = team.filter(m => m.pace === 'D').length;
    if (dCnt > 1 && dPlayers.length <= nTeams) return null; // 보장 가능한데 실패 시 retry
  }

  // ④ 3개월 동일팀 검증
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

  const nTeams   = Math.ceil(participants.length / 4);
  const dCount   = participants.filter(m => m.pace === 'D').length;

  // D가 팀 수보다 많으면 경고
  if (dCount > nTeams) {
    const warn = $('conflictWarn');
    warn.textContent = `⚠️ D등급(${dCount}명)이 팀 수(${nTeams})보다 많아 일부 팀에 D등급이 2명 배정될 수 있습니다.`;
    warn.style.display = '';
  }

  let teams   = null;
  let relaxed = false;

  for (let i = 0; i < 2000 && !teams; i++) teams = tryAssign(participants, nTeams, true);
  if (!teams) {
    relaxed = true;
    for (let i = 0; i < 500 && !teams; i++) teams = tryAssign(participants, nTeams, false);
  }
  if (!teams) { showErr('조 편성 실패. 참가자를 늘려주세요.'); return; }

  if (relaxed && dCount <= nTeams) {
    $('conflictWarn').textContent = '⚠️ 최근 3개월 동일팀 조건을 완전히 만족하는 배치를 찾지 못해 최선의 배치로 편성했습니다.';
    $('conflictWarn').style.display = '';
  } else if (!relaxed && dCount <= nTeams) {
    $('conflictWarn').style.display = 'none';
  }

  lastTeams = teams;
  editMode  = false;
  $('saveHistBtn').textContent = '💾 이력 저장';
  renderResult(teams);
  launchConfetti();
}

function showErr(msg) {
  const e = $('drawErr'); e.textContent = msg; e.style.display = '';
  setTimeout(() => e.style.display = 'none', 7000);
}

// ══════════════════════════════════════════════════════════════
//  결과 렌더링 (일반 모드 + 수정 모드)
// ══════════════════════════════════════════════════════════════
function renderResult(teams) {
  $('resSection').style.display = '';
  const g = $('tGrid'); g.innerHTML = '';

  // 수정 모드 버튼 텍스트 업데이트
  const editBtn = $('editModeBtn');
  if (editBtn) {
    editBtn.textContent = editMode ? '✅ 수정 완료' : '✏️ 결과 수정';
    editBtn.className   = editMode ? 'btn btn-outline btn-sm' : 'btn btn-ghost btn-sm';
  }

  teams.forEach((team, tIdx) => {
    const mc = team.filter(m => m.gender==='M').length;
    const fc = team.filter(m => m.gender!=='M').length;

    const div = document.createElement('div');
    div.className = 'tcard';
    div.style.animationDelay = tIdx * 0.05 + 's';
    div.dataset.tidx = tIdx;

    // ── 드래그 이벤트 (수정 모드일 때만 활성) ──
    div.addEventListener('dragover', e => {
      if (!editMode) return;
      e.preventDefault(); div.classList.add('drag-over');
    });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
    div.addEventListener('drop', e => {
      if (!editMode) return;
      e.preventDefault(); div.classList.remove('drag-over'); handleDrop(tIdx);
    });
    div.addEventListener('touchend', () => {
      if (editMode && dragSrc !== null) handleDrop(tIdx);
    });

    // ── 팀원 행 렌더링 ──
    const membersHtml = team.map((m, mIdx) => {
      const gc = m.gender==='F' ? 'var(--pink)' : 'var(--blue)';

      if (editMode) {
        // ─ 수정 모드: 이동 버튼 + 제거 버튼
        const moveButtons = teams.map((_, tDest) => {
          if (tDest === tIdx) return '';
          return `<button class="move-btn" title="${tDest+1}조로 이동"
            onclick="moveMember(${tIdx},${mIdx},${tDest})">${tDest+1}조</button>`;
        }).join('');

        return `<div class="mrow edit-row" draggable="true"
            ondragstart="handleDragStart(${tIdx},${mIdx})"
            ontouchstart="handleDragStart(${tIdx},${mIdx})">
          <div class="mrow-info">
            ${paceBadge(m.pace)}
            <span style="font-size:10px;color:${gc}">${m.gender==='F'?'👩':'👨'}</span>
            <span class="mname">${esc(m.nick)}</span>
            <span style="font-size:11px;color:rgba(255,255,255,.27)">${esc(m.name)}</span>
            ${m.phone?`<span style="font-size:10px;color:rgba(255,255,255,.25)">(${esc(m.phone)})</span>`:''}
          </div>
          <div class="mrow-actions">
            <div class="move-btns">${moveButtons}</div>
            <button class="remove-btn" title="팀에서 제거" onclick="removeMember(${tIdx},${mIdx})">✕</button>
          </div>
        </div>`;
      } else {
        // ─ 일반 모드
        return `<div class="mrow" draggable="false">
          ${paceBadge(m.pace)}
          <span style="font-size:10px;color:${gc}">${m.gender==='F'?'👩':'👨'}</span>
          <span class="mname">${esc(m.nick)}</span>
          <span style="font-size:11px;color:rgba(255,255,255,.27)">${esc(m.name)}</span>
          ${m.phone?`<span style="font-size:10px;color:rgba(255,255,255,.25)">(${esc(m.phone)})</span>`:''}
        </div>`;
      }
    }).join('');

    div.innerHTML = `
      <div class="thd">
        <span class="tnum">${tIdx+1}조</span>
        <div style="display:flex;gap:3px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${teamGradeDist(team)}
          <span style="font-size:10px;color:var(--blue);margin-left:2px">👨${mc}</span>
          <span style="font-size:10px;color:var(--pink)">👩${fc}</span>
          <span style="font-size:10px;color:rgba(255,255,255,.35)">${team.length}명</span>
        </div>
      </div>
      <div class="tbody ${editMode?'edit-tbody':''}">${membersHtml}</div>`;

    g.appendChild(div);
  });

  // 요약
  const allMembers = teams.flat();
  const mc = allMembers.filter(m => m.gender==='M').length;
  const fc = allMembers.filter(m => m.gender!=='M').length;
  $('sumBar').innerHTML = `
    <span>총 <b style="color:var(--g4)">${allMembers.length}명</b></span>
    <span><b style="color:var(--g4)">${teams.length}팀</b> 편성</span>
    <span>👨<b style="color:var(--blue)">${mc}</b> 👩<b style="color:var(--pink)">${fc}</b></span>
    ${gradeDist(allMembers)}`;

  if (!editMode) {
    setTimeout(() => $('resSection').scrollIntoView({ behavior:'smooth' }), 80);
  }
}

// ── 수정 모드 토글 ────────────────────────────────────────────
function toggleEditMode() {
  editMode = !editMode;
  renderResult(lastTeams);
  if (editMode) toast('✏️ 수정 모드: 버튼으로 팀원을 이동하거나 드래그하세요');
  else          toast('✅ 수정 완료');
}

// ── 팀원 이동 (수정 모드) ─────────────────────────────────────
function moveMember(fromT, fromM, toT) {
  const next = lastTeams.map(t => [...t]);
  const [member] = next[fromT].splice(fromM, 1);
  next[toT].push(member);
  lastTeams = next;
  $('saveHistBtn').textContent = '💾 이력 저장';
  renderResult(next);
}

// ── 팀원 제거 (미배정 풀로 이동) ─────────────────────────────
function removeMember(tIdx, mIdx) {
  const next = lastTeams.map(t => [...t]);
  next[tIdx].splice(mIdx, 1);
  lastTeams = next;
  $('saveHistBtn').textContent = '💾 이력 저장';
  renderResult(next);
  toast('팀에서 제거되었습니다');
}

// ── 드래그 & 드롭 ─────────────────────────────────────────────
function handleDragStart(tIdx, mIdx) {
  if (!editMode) return;
  dragSrc = { tIdx, mIdx };
}
function handleDrop(toTIdx) {
  if (!editMode || dragSrc === null) return;
  const { tIdx: fromT, mIdx: fromM } = dragSrc;
  dragSrc = null;
  if (fromT === toTIdx) return;
  moveMember(fromT, fromM, toTIdx);
}

// ── History ───────────────────────────────────────────────────
function saveHist() {
  if (!lastTeams) return;
  const entry = {
    id: uid(),
    date:  $('drawDate').value || today(),
    note:  $('drawNote').value.trim(),
    teams: lastTeams.map(team => team.map(m => ({
      id: m.id, nick: m.nick, name: m.name,
      phone: m.phone||'', gender: m.gender||'M', pace: m.pace||'B'
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
  const b = $('hb-'+id), a = $('arr-'+id);
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
    deferredPrompt = null; bar.style.display = 'none';
  };
});
function isIOS()        { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone; }
if (isIOS() && !isStandalone()) $('installBar').style.display = 'flex';
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

// ── Init ──────────────────────────────────────────────────────
load();
$('drawDate').value = today();
renderMembers();
