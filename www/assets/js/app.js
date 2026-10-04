/* =========================================================
   卡密生成器 · 手机版  —  应用逻辑
   纯前端 / 无依赖 / 数据存 localStorage
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  const LS_KEY    = 'kami.cards.v1';
  const LS_CFG    = 'kami.config.v1';
  const LS_SET    = 'kami.settings.v1';
  const SYMBOLS   = '!@#$%^&*_+-=';
  const ST_TEXT   = ['未使用', '已使用', '已封禁'];
  const MAX_GEN   = 5000;
  const MAX_STORE = 100000;

  /* ---------------- 小工具 ---------------- */
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('on'), ms || 1700);
  }

  function haptic(ms) {
    if (!S.set.haptic) return;
    try { navigator.vibrate && navigator.vibrate(ms || 12); } catch (e) {}
  }

  function fmtTime(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function today() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /* 复制（含 http 环境降级方案） */
  function copyText(text) {
    const done = () => { haptic(); toast('已复制到剪贴板'); };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? done() : toast('复制失败，请长按文字手动复制');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else fallback();
  }

  /* 下载文件 */
  function download(name, text, mime) {
    try {
      const blob = new Blob(['\ufeff' + text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast('已保存：' + name);
    } catch (e) { toast('导出失败：' + e.message); }
  }

  /* ---------------- 弹层 ---------------- */
  const sheetMask = $('#sheetMask'), sheet = $('#sheet'), sheetBody = $('#sheetBody');
  function openSheet(html) {
    sheetBody.innerHTML = html;
    sheetMask.classList.add('on');
    sheet.classList.add('on');
  }
  function closeSheet() {
    sheetMask.classList.remove('on');
    sheet.classList.remove('on');
  }
  sheetMask.addEventListener('click', closeSheet);

  const ICON = {
    copy:  '<path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/>',
    check: '<path d="M9.6 16.2 5.4 12l-1.4 1.4 5.6 5.6L20.4 8.2 19 6.8 9.6 16.2Z"/>',
    ban:   '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 0 1 6.3 12.9L5.1 5.7A8 8 0 0 1 12 4Z"/>',
    trash: '<path d="M9 3h6l1 2h4v2H4V5h4l1-2ZM6 9h12l-1 12H7L6 9Z"/>',
    plus:  '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/>',
    undo:  '<path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7Z"/>',
    info:  '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z"/>'
  };

  function confirmSheet(title, desc, okText, onOk, danger) {
    openSheet(`
      <h3 class="sheet-title">${title}</h3>
      <p class="sheet-desc">${desc || ''}</p>
      <div class="sheet-list">
        <button class="sheet-btn ${danger ? 'dan' : ''}" id="sOk">
          <svg viewBox="0 0 24 24">${danger ? ICON.trash : ICON.check}</svg>${okText || '确定'}
        </button>
        <button class="sheet-btn" id="sCancel"><svg viewBox="0 0 24 24">${ICON.info}</svg>取消</button>
      </div>`);
    $('#sOk').onclick = () => { closeSheet(); haptic(); onOk && onOk(); };
    $('#sCancel').onclick = closeSheet;
  }

  /* ---------------- 状态 ---------------- */
  const DEFAULT_CFG = {
    mode: 'single', prefix: '', suffix: '', codeLen: 16, genNum: 10, startSort: '',
    splitType: '4', caseType: 'upper',
    cNum: true, cLower: true, cUpper: true, cSymbol: false,
    f0O: true, flI: true, blackList: '', whiteList: '',
    noRepeat: false, noSeq: false, firstRule: 'any',
    cardTag: '', cardPrice: '', cardExp: ''
  };
  const DEFAULT_SET = { theme: 'dark', haptic: true, autoJump: false };

  let cards = [];
  let S = { cfg: Object.assign({}, DEFAULT_CFG), set: Object.assign({}, DEFAULT_SET) };
  let ui = { page: 'gen', status: 'all', kw: '', sort: 'time', selected: new Set(), lastDeleted: null };

  function loadAll() {
    try { cards = JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { cards = []; }
    if (!Array.isArray(cards)) cards = [];
    // 兼容旧数据：补 id / ts
    let dirty = false;
    cards.forEach(c => {
      if (!c.id) { c.id = uid(); dirty = true; }
      if (!c.ts) { c.ts = Date.now(); dirty = true; }
    });
    try { Object.assign(S.cfg, JSON.parse(localStorage.getItem(LS_CFG)) || {}); } catch (e) {}
    try { Object.assign(S.set, JSON.parse(localStorage.getItem(LS_SET)) || {}); } catch (e) {}
    if (dirty) saveCards();
  }
  let saveTimer = null;
  function saveCards(now) {
    const write = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(cards)); } catch (e) { toast('存储空间不足，请导出备份后清理'); } };
    if (now) { clearTimeout(saveTimer); write(); return; }
    clearTimeout(saveTimer);              // 列表渲染节流，避免大量数据卡顿
    saveTimer = setTimeout(write, 250);
  }
  function saveCfg() { try { localStorage.setItem(LS_CFG, JSON.stringify(S.cfg)); } catch (e) {} }
  function saveSet() { try { localStorage.setItem(LS_SET, JSON.stringify(S.set)); } catch (e) {} }

  /* ---------------- 字符池 ---------------- */
  function buildPool() {
    const cfg = S.cfg;
    const white = (cfg.whiteList || '').trim();
    if (white) return dedupe(white.replace(/\s/g, ''));
    let p = '';
    if (cfg.cNum)   p += '0123456789';
    if (cfg.cLower) p += 'abcdefghijklmnopqrstuvwxyz';
    if (cfg.cUpper) p += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (cfg.cSymbol) p += SYMBOLS;
    if (cfg.f0O) p = p.replace(/[0Oo]/g, '');
    if (cfg.flI) p = p.replace(/[1lI]/g, '');
    const black = (cfg.blackList || '').trim();
    for (const ch of black) p = p.split(ch).join('');
    return dedupe(p);
  }
  const dedupe = s => Array.from(new Set(s.split(''))).join('');

  /* ---------------- 单码生成引擎 ---------------- */
  function rand(pool) { return pool[(Math.random() * pool.length) | 0]; }

  function genBody(len, pool, cfg) {
    if (!pool) return '';
    let numPool = '', letPool = '';
    if (cfg.firstRule === 'num')    numPool = pool.replace(/[^0-9]/g, '');
    if (cfg.firstRule === 'letter') letPool = pool.replace(/[^A-Za-z]/g, '');
    for (let attempt = 0; attempt < 400; attempt++) {
      let s = '';
      if (cfg.firstRule === 'num') {
        if (!numPool) return '';
        s += rand(numPool);
      } else if (cfg.firstRule === 'letter') {
        if (!letPool) return '';
        s += rand(letPool);
      } else s += rand(pool);
      for (let i = 1; i < len; i++) s += rand(pool);
      if (cfg.noRepeat && /(.)\1/.test(s)) continue;
      if (cfg.noSeq && hasRun(s, 3)) continue;
      return s;
    }
    return ''; // 规则太苛刻时放弃（上层会跳过）
  }
  /* 检测递增/递减序列（123 / ABC / 321） */
  function hasRun(s, n) {
    for (let i = 0; i + n <= s.length; i++) {
      let up = true, down = true;
      for (let k = 1; k < n; k++) {
        const d = s.charCodeAt(i + k) - s.charCodeAt(i + k - 1);
        if (d !== 1) up = false;
        if (d !== -1) down = false;
      }
      if (up || down) return true;
    }
    return false;
  }

  function applyCase(s) {
    const t = S.cfg.caseType;
    return t === 'upper' ? s.toUpperCase() : t === 'lower' ? s.toLowerCase() : s;
  }
  function formatCode(str) {
    const t = S.cfg.splitType;
    if (t === '0') return str;
    const step = t === 'line' ? 4 : parseInt(t, 10);
    const sep = t === 'line' ? '-' : ' ';
    let out = '';
    for (let i = 0; i < str.length; i++) {
      out += str[i];
      if ((i + 1) % step === 0 && i !== str.length - 1) out += sep;
    }
    return out;
  }

  /* ---------------- 生成主流程 ---------------- */
  function makeCards(count) {
    const cfg = S.cfg;
    const pool = buildPool();
    if (!pool) { toast('字符池为空：请勾选字符或修改白名单/黑名单'); return null; }
    if (count < 1) { toast('生成数量至少 1'); return null; }

    const exist = new Set(cards.map(c => c.code));
    const len = clamp(parseInt(cfg.codeLen, 10) || 16, 4, 64);
    const seqMode = cfg.startSort !== '' && cfg.startSort !== null && !isNaN(Number(cfg.startSort));
    let seq = seqMode ? Number(cfg.startSort) : 0;

    const added = [];
    const tag = (cfg.cardTag || '').trim(), price = (cfg.cardPrice || '').trim(), exp = (cfg.cardExp || '').trim();
    const needCheck = !!(cfg.noRepeat || cfg.noSeq);
    let noRepeatTooStrict = false;                  // 规则与字符池不可能同时满足
    let guard = 0;
    let skipRawCheck = false;                       // 兜底：用户前缀/白名单本身必然触发规则时，退让一次
    let rawCheckRetry = 0;
    let usedFallback = false;
    const limit = seqMode ? count : count * 60 + 600; // 防止规则过严时死循环

    while (added.length < count && !usedFallback && guard++ < limit) {
      let raw;
      if (seqMode) {
        const num = String(seq++).padStart(len, '0');
        raw = cfg.prefix + num + cfg.suffix;
      } else {
        const body = genBody(len, pool, cfg);
        if (!body) {                            // 规则冲突，无法生成
          noRepeatTooStrict = added.length === 0;
          break;
        }
        raw = cfg.prefix + body + cfg.suffix;
      }
      // 规则复核：在“大小写转换 + 前缀后缀拼接”之后判断，
      // 否则池中同时含大小写时（aA→AA）或拼接处仍可能出现连续重复字符
      if (needCheck && !skipRawCheck) {
        const cased = applyCase(raw.replace(/[ -]/g, ''));
        if ((cfg.noRepeat && /(.)\1/.test(cased)) || (cfg.noSeq && hasRun(cased, 3))) {
          if (++rawCheckRetry > 12) {           // 重试多次仍冲突（多由固定前缀/序号造成），退让一次
            skipRawCheck = true;
            rawCheckRetry = 0;
            continue;
          }
          continue;
        }
        rawCheckRetry = 0;
      }
      const code = applyCase(formatCode(raw));
      if (!code || exist.has(code)) continue;   // 去重
      exist.add(code);
      if (skipRawCheck) { usedFallback = true; skipRawCheck = false; }  // 已放行一条，恢复严格校验
      let pwd = '';
      if (cfg.mode === 'pair') {
        const pb = genBody(len, pool, cfg);
        if (pb) pwd = applyCase(formatCode(pb));
      }
      added.push({ id: uid(), code, pwd, status: 0, tag, price, exp, ts: Date.now() });
    }
    if (!added.length) {
      if (noRepeatTooStrict) {
        toast(`生成失败：可用字符只有 ${pool.length} 个，却要求 ${len} 位且 ${cfg.noRepeat ? '禁止连续重复' : '禁止递增序列'}，请放宽规则或扩大字符池`, 3600);
      } else {
        toast('生成失败：字符池或规则过于严格，请放宽条件');
      }
      return null;
    }
    if (usedFallback) toast('规则与固定前缀/字符池冲突，已生成兜底卡密，可放宽「连续重复」限制', 3200);
    return added;
  }

  function doGenerate() {
    const count = clamp(parseInt(S.cfg.genNum, 10) || 1, 1, MAX_GEN);
    if (cards.length + count > MAX_STORE) { toast('卡密总量已达上限 ' + MAX_STORE + '，请先清理'); return; }
    const added = makeCards(count);
    if (!added) return;
    cards = added.concat(cards);
    saveCards(true);
    renderAll();
    haptic(24);
    toast(`成功生成 ${added.length} 条卡密` + (added.length < count ? `（部分重复已跳过）` : ''));
    if (S.set.autoJump) setTimeout(() => go('list'), 320);
  }

  /* ---------------- 预览 ---------------- */
  function renderPreview() {
    const box = $('#previewBox');
    const pool = buildPool();
    $('#poolInfo').textContent = pool
      ? `可用字符 ${pool.length} 个：${pool.length > 44 ? pool.slice(0, 44) + '…' : pool}`
      : '字符池为空，请在上方勾选字符';
    if (!pool) { box.innerHTML = '<div class="pv-line">字符池为空</div>'; return; }
    const len = clamp(parseInt(S.cfg.codeLen, 10) || 16, 4, 64);
    let html = '';
    for (let i = 0; i < 2; i++) {
      let raw;
      if (S.cfg.startSort !== '' && !isNaN(Number(S.cfg.startSort))) {
        raw = S.cfg.prefix + String(Number(S.cfg.startSort) + i).padStart(len, '0') + S.cfg.suffix;
      } else {
        const b = genBody(len, pool, S.cfg) || '(规则过严，无法生成)';
        raw = S.cfg.prefix + b + S.cfg.suffix;
      }
      const code = applyCase(formatCode(raw));
      let pwd = '';
      if (S.cfg.mode === 'pair') {
        const pb = genBody(len, pool, S.cfg);
        if (pb) pwd = `<div class="pv-pwd">密码：${esc(applyCase(formatCode(pb)))}</div>`;
      }
      html += `<div class="pv-line">${esc(code)}${pwd}</div>`;
    }
    box.innerHTML = html;
  }
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------------- 列表渲染 ---------------- */
  function visibleCards() {
    let list = cards.slice();
    if (ui.status !== 'all') list = list.filter(c => String(c.status) === ui.status);
    const kw = ui.kw.trim().toLowerCase();
    if (kw) {
      list = list.filter(c =>
        (c.code || '').toLowerCase().includes(kw) ||
        (c.pwd || '').toLowerCase().includes(kw) ||
        (c.tag || '').toLowerCase().includes(kw) ||
        (c.exp || '').toLowerCase().includes(kw) ||
        (c.price || '').toLowerCase().includes(kw));
    }
    if (ui.sort === 'time') list.sort((a, b) => b.ts - a.ts);
    else list.sort((a, b) => (a.code > b.code ? 1 : -1));
    return list;
  }

  function renderList() {
    const box = $('#listBox');
    const list = visibleCards();
    if (!list.length) {
      box.innerHTML = `<div class="empty">
        <svg viewBox="0 0 24 24"><path d="M12 3 3 7v10l9 4 9-4V7l-9-4Zm0 2.3 5.5 2.4L12 10.1 6.5 7.7 12 5.3ZM5 9.6l6 2.7v6.5l-6-2.7V9.6Zm8 9.2v-6.5l6-2.7v6.5l-6 2.7Z"/></svg>
        <p>${cards.length ? '没有符合条件的卡密' : '还没有卡密，去「生成」页批量创建'}</p>
        <small>${cards.length ? '换个关键词或筛选条件试试' : '支持单码激活码 / 卡号+密码双码'}</small>
      </div>`;
      updateTools();
      return;
    }
    const out = list.map(c => {
      const sel = ui.selected.has(c.id);
      const meta = [];
      if (c.tag)   meta.push('🏷 ' + esc(c.tag));
      if (c.price) meta.push('💰 ' + esc(c.price));
      if (c.exp)   meta.push('📅 ' + esc(c.exp));
      return `<div class="item st${c.status} ${sel ? 'is-sel' : ''}" data-id="${c.id}">
        <div class="item-top">
          <div class="pick"><svg viewBox="0 0 24 24">${ICON.check}</svg></div>
          <span class="badge-st">${ST_TEXT[c.status] || '未使用'}</span>
          <span class="item-time">${fmtTime(c.ts)}</span>
        </div>
        <div class="code-box"><span class="k">卡号</span>${esc(c.code)}</div>
        ${c.pwd ? `<div class="code-box"><span class="k">密码</span><span class="pwd">${esc(c.pwd)}</span></div>` : ''}
        ${meta.length ? `<div class="meta">${meta.map(m => `<em>${m}</em>`).join('')}</div>` : ''}
        <div class="item-acts">
          <button class="act pri" data-act="copy">复制</button>
          <button class="act" data-act="use">${c.status === 1 ? '取消已用' : '标记已用'}</button>
          <button class="act" data-act="ban">${c.status === 2 ? '解封' : '封禁'}</button>
          <button class="act dan" data-act="del">删除</button>
        </div>
      </div>`;
    }).join('');
    box.innerHTML = out;
    updateTools();
  }

  function updateTools() {
    const vis = visibleCards();
    const sel = ui.selected.size;
    const allOn = vis.length > 0 && vis.every(c => ui.selected.has(c.id));
    const b = $('#btnSelectAll');
    b.innerHTML = `<svg viewBox="0 0 24 24">${ICON.check}</svg>${sel ? '已选 ' + sel : (allOn ? '取消全选' : '全选')}`;
    b.classList.toggle('is-on', allOn);
  }

  /* ---------------- 统计 ---------------- */
  function renderStats() {
    const n = [0, 0, 0];
    cards.forEach(c => { n[c.status] = (n[c.status] || 0) + 1; });
    $('#sTotal').textContent  = cards.length;
    $('#sUnused').textContent = n[0];
    $('#sUsed').textContent   = n[1];
    $('#sBan').textContent    = n[2];
    const badge = $('#tabBadge');
    if (n[0] > 0) { badge.hidden = false; badge.textContent = n[0] > 999 ? '999+' : n[0]; }
    else badge.hidden = true;
    $('#aboutStore').textContent = `已存储 ${cards.length} 条卡密（未使用 ${n[0]} / 已使用 ${n[1]} / 已封禁 ${n[2]}）`;
  }

  function renderAll() {
    renderStats();
    renderList();
    $('#fabTxt').textContent = `生成 ${clamp(parseInt(S.cfg.genNum, 10) || 1, 1, MAX_GEN)} 条卡密`;
  }

  /* ---------------- 导航 ---------------- */
  function go(page) {
    ui.page = page;
    $$('.page').forEach(p => p.classList.toggle('is-active', p.id === 'page-' + page));
    $$('.tab').forEach(t => t.classList.toggle('is-on', t.dataset.page === page));
    $('#fabWrap').classList.toggle('hide', page !== 'gen');
    $('#scroll').scrollTop = 0;
    if (page === 'list') renderList();
    if (page === 'gen')  { renderPreview(); renderStats(); }
  }

  /* ---------------- 卡片操作 ---------------- */
  function findCard(id) { return cards.find(c => c.id === id); }

  function actOn(id, act) {
    const c = findCard(id);
    if (!c) return;
    if (act === 'copy') {
      copyText(c.pwd ? `${c.code}\n${c.pwd}` : c.code);
      return;
    }
    if (act === 'use') { c.status = c.status === 1 ? 0 : 1; toast(c.status ? '已标记为已使用' : '已恢复为未使用'); }
    if (act === 'ban') { c.status = c.status === 2 ? 0 : 2; toast(c.status ? '已封禁' : '已解封'); }
    if (act === 'del') {
      const idx = cards.indexOf(c);
      ui.selected.delete(id);
      cards.splice(idx, 1);
      ui.lastDeleted = { list: [c], idx };
      saveCards(true); haptic(20);
      toast('已删除，可在「设置」撤销', 2200);
      undoToast();
    }
    saveCards(true);
    renderAll();
  }

  /* 删除后提供撤销 */
  function undoToast() {
    const d = ui.lastDeleted;
    const n = d && d.bulk ? d.list.length : 1;
    openSheet(`<h3 class="sheet-title">已删除 ${n} 条卡密</h3>
      <p class="sheet-desc">删除操作已即时生效，可在下方撤销。</p>
      <div class="sheet-list">
        <button class="sheet-btn" id="sUndo"><svg viewBox="0 0 24 24">${ICON.undo}</svg>撤销删除</button>
        <button class="sheet-btn" id="sClose"><svg viewBox="0 0 24 24">${ICON.check}</svg>知道了</button>
      </div>`);
    $('#sUndo').onclick = () => { undoDelete(); closeSheet(); };
    $('#sClose').onclick = closeSheet;
  }
  function undoDelete() {
    const d = ui.lastDeleted;
    if (!d || !d.list || !d.list.length) { toast('没有可撤销的删除'); return; }
    if (d.bulk) {
      cards = cards.concat(d.list).sort((a, b) => b.ts - a.ts);
    } else {
      cards.splice(clamp(d.idx, 0, cards.length), 0, d.list[0]);
    }
    const n = d.list.length;
    ui.lastDeleted = null;
    saveCards(true); renderAll();
    toast(`已撤销，恢复 ${n} 条卡密`);
  }

  /* ---------------- 批量操作 ---------------- */
  function batchSheet() {
    const sel = ui.selected.size;
    if (!sel) { toast('请先勾选卡密（也可点「全选」）'); return; }
    openSheet(`<h3 class="sheet-title">批量操作 · 已选 ${sel} 条</h3>
      <p class="sheet-desc">操作立即作用于选中卡密</p>
      <div class="sheet-list">
        <button class="sheet-btn" data-b="copy"><svg viewBox="0 0 24 24">${ICON.copy}</svg>复制卡号<small>每行一条</small></button>
        <button class="sheet-btn" data-b="txt"><svg viewBox="0 0 24 24">${ICON.copy}</svg>复制“卡号+密码”<small>用 | 分隔</small></button>
        <button class="sheet-btn" data-b="use"><svg viewBox="0 0 24 24">${ICON.check}</svg>标记为已使用</button>
        <button class="sheet-btn" data-b="unuse"><svg viewBox="0 0 24 24">${ICON.undo}</svg>恢复为未使用</button>
        <button class="sheet-btn" data-b="ban"><svg viewBox="0 0 24 24">${ICON.ban}</svg>批量封禁</button>
        <button class="sheet-btn dan" data-b="del"><svg viewBox="0 0 24 24">${ICON.trash}</svg>批量删除</button>
        <button class="sheet-btn" data-b="cancel"><svg viewBox="0 0 24 24">${ICON.info}</svg>取消选择</button>
      </div>`);
    $$('#sheetBody .sheet-btn').forEach(btn => btn.onclick = () => {
      const b = btn.dataset.b;
      if (b === 'cancel') { ui.selected.clear(); closeSheet(); renderList(); return; }
      const picked = cards.filter(c => ui.selected.has(c.id));
      if (b === 'copy') copyText(picked.map(c => c.code).join('\n'));
      if (b === 'txt')  copyText(picked.map(c => c.pwd ? c.code + ' | ' + c.pwd : c.code).join('\n'));
      if (b === 'use')   { picked.forEach(c => c.status = 1); toast('已标记 ' + picked.length + ' 条为已使用'); }
      if (b === 'unuse') { picked.forEach(c => c.status = 0); toast('已恢复 ' + picked.length + ' 条为未使用'); }
      if (b === 'ban')   { picked.forEach(c => c.status = 2); toast('已封禁 ' + picked.length + ' 条'); }
      if (b === 'del') {
        confirmSheet('确认批量删除？', `将删除选中的 ${picked.length} 条卡密，无法自动恢复（建议先导出备份）。`, '确认删除', () => {
          ui.lastDeleted = { list: picked.slice(), idx: 0, bulk: true };
          cards = cards.filter(c => !ui.selected.has(c.id));
          ui.selected.clear(); saveCards(true);
          toast('已删除 ' + picked.length + ' 条');
          renderAll(); undoToast();
        }, true);
        return;
      }
      if (b !== 'del') { closeSheet(); saveCards(true); renderAll(); }
    });
  }

  /* ---------------- 导出 ---------------- */
  function exportText(withPwd) {
    const list = ui.status === 'all' ? cards : cards.filter(c => String(c.status) === ui.status);
    if (!list.length) { toast('没有可导出的卡密'); return ''; }
    return list.map(c => (withPwd && c.pwd) ? `${c.code} | ${c.pwd}` : c.code).join('\n');
  }
  function copyAll() {
    const t = exportText(S.cfg.mode === 'pair');
    if (t) copyText(t);
  }
  function exportTxt(withPwd, name) {
    const t = exportText(withPwd);
    if (t) download((name || '卡密') + '_' + today() + '.txt', t, 'text/plain');
  }
  function exportCsv() {
    if (!cards.length) { toast('没有可导出的卡密'); return; }
    const head = '卡号,密码,状态,标签,面值,有效期,生成时间\n';
    const body = cards.map(c => [c.code, c.pwd, ST_TEXT[c.status], c.tag, c.price, c.exp, fmtTime(c.ts)]
      .map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
    download('卡密列表_' + today() + '.csv', head + body, 'text/csv');
  }
  function exportJson() {
    if (!cards.length) { toast('没有可备份的数据'); return; }
    const data = { app: 'kami-generator', version: 1, exportedAt: new Date().toISOString(), count: cards.length, cards };
    download('卡密备份_' + today() + '.json', JSON.stringify(data, null, 2), 'application/json');
  }
  function shareOut() {
    const t = exportText(true);
    if (!t) return;
    if (navigator.share) {
      navigator.share({ title: '卡密列表', text: t }).catch(() => {});
    } else copyText(t);
  }

  /* ---------------- 导入 / 恢复 ---------------- */
  function importText(text) {
    const lines = String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const exist = new Set(cards.map(c => c.code));
    const add = [];
    let skip = 0;
    lines.forEach(line => {
      if (/^卡号\s*,/.test(line)) return;                 // CSV 表头
      const parts = line.split(/[|,\t]+|\s{2,}/).map(s => s.trim().replace(/^"|"$/g, ''));
      const code = parts[0];
      const pwd = parts[1] || '';
      if (!code || exist.has(code)) { skip++; return; }
      exist.add(code);
      add.push({ id: uid(), code, pwd, status: 0, tag: '导入', price: '', exp: '', ts: Date.now() });
    });
    if (!add.length) { toast('没有新增卡密（' + skip + ' 条重复或无效）'); return; }
    cards = add.concat(cards);
    saveCards(true); renderAll();
    toast(`导入成功 ${add.length} 条` + (skip ? `，跳过 ${skip} 条` : ''));
  }
  function restoreJson(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { toast('JSON 解析失败，请选择本应用备份的文件'); return; }
    const list = Array.isArray(data) ? data : (data && data.cards);
    if (!Array.isArray(list)) { toast('文件格式不正确'); return; }
    const norm = list.map(c => ({
      id: uid(),
      code: String(c.code == null ? '' : c.code),
      pwd: String(c.pwd == null ? '' : c.pwd),
      status: [0, 1, 2].includes(Number(c.status)) ? Number(c.status) : 0,
      tag: c.tag || '', price: c.price || '', exp: c.exp || '',
      ts: Number(c.ts) || Date.now()
    })).filter(c => c.code);
    if (!norm.length) { toast('文件中没有有效卡密'); return; }
    openSheet(`<h3 class="sheet-title">恢复备份</h3>
      <p class="sheet-desc">文件包含 ${norm.length} 条卡密。「合并」保留现有数据，「覆盖」清空后替换。</p>
      <div class="sheet-list">
        <button class="sheet-btn" id="rMerge"><svg viewBox="0 0 24 24">${ICON.plus}</svg>合并导入<small>保留现有 ${cards.length} 条</small></button>
        <button class="sheet-btn dan" id="rOver"><svg viewBox="0 0 24 24">${ICON.trash}</svg>覆盖全部数据<small>清空现有</small></button>
        <button class="sheet-btn" id="rCancel"><svg viewBox="0 0 24 24">${ICON.info}</svg>取消</button>
      </div>`);
    $('#rCancel').onclick = closeSheet;
    $('#rMerge').onclick = () => {
      closeSheet();
      const exist = new Set(cards.map(c => c.code));
      const add = norm.filter(c => !exist.has(c.code));
      cards = add.concat(cards); saveCards(true); renderAll();
      toast(`已合并 ${add.length} 条` + (norm.length - add.length ? `，跳过重复 ${norm.length - add.length} 条` : ''));
    };
    $('#rOver').onclick = () => {
      closeSheet();
      confirmSheet('确认覆盖？', `当前 ${cards.length} 条卡密将被清空，替换为备份中的 ${norm.length} 条。`, '确认覆盖', () => {
        cards = norm; ui.selected.clear(); saveCards(true); renderAll(); toast('已恢复 ' + norm.length + ' 条卡密');
      }, true);
    };
  }
  function readFile(input, cb) {
    const f = input.files && input.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = e => { cb(e.target.result); input.value = ''; };
    r.onerror = () => { toast('文件读取失败'); input.value = ''; };
    r.readAsText(f, 'utf-8');
  }

  /* ---------------- 表单绑定 ---------------- */
  const CFG_FIELDS = ['prefix','suffix','codeLen','genNum','startSort','splitType','caseType','blackList','whiteList','firstRule','cardTag','cardPrice','cardExp'];
  const CFG_CHECKS  = ['cNum','cLower','cUpper','cSymbol','f0O','flI','noRepeat','noSeq'];

  function fillForm() {
    CFG_FIELDS.forEach(k => { const el = $('#' + k); if (el) el.value = S.cfg[k]; });
    CFG_CHECKS.forEach(k => { const el = $('#' + k); if (el) el.checked = !!S.cfg[k]; });
    $$('#modeSeg .seg-i').forEach(b => b.classList.toggle('is-on', b.dataset.mode === S.cfg.mode));
    $$('#themeSeg .seg-i').forEach(b => b.classList.toggle('is-on', b.dataset.theme === S.set.theme));
    $('#setHaptic').checked = !!S.set.haptic;
    $('#setAutoJump').checked = !!S.set.autoJump;
  }

  function bindForm() {
    CFG_FIELDS.forEach(k => {
      const el = $('#' + k); if (!el) return;
      const ev = (el.tagName === 'SELECT') ? 'change' : 'input';
      el.addEventListener(ev, () => {
        let v = el.value;
        if (k === 'codeLen') { v = clamp(parseInt(v, 10) || 16, 4, 64); }
        if (k === 'genNum')  { v = clamp(parseInt(v, 10) || 1, 1, MAX_GEN); }
        S.cfg[k] = v;
        saveCfg();
        if (k === 'genNum') $('#fabTxt').textContent = `生成 ${v} 条卡密`;
        debouncePreview();
      });
      if (k === 'codeLen' || k === 'genNum') {
        el.addEventListener('blur', () => { el.value = S.cfg[k]; });
      }
    });
    CFG_CHECKS.forEach(k => {
      const el = $('#' + k); if (!el) return;
      el.addEventListener('change', () => { S.cfg[k] = el.checked; saveCfg(); debouncePreview(); });
    });
  }
  let pvTimer = null;
  function debouncePreview() { clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, 130); }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    // 底部导航
    $$('.tab').forEach(t => t.addEventListener('click', () => { haptic(); go(t.dataset.page); }));

    // 主题
    $('#btnTheme').addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      haptic();
    });
    $$('#themeSeg .seg-i').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme)));

    // 模式切换
    $$('#modeSeg .seg-i').forEach(b => b.addEventListener('click', () => {
      S.cfg.mode = b.dataset.mode; saveCfg(); fillForm(); renderPreview(); haptic();
      toast(S.cfg.mode === 'pair' ? '双码模式：同时生成卡号与密码' : '单码模式：仅生成激活码');
    }));

    // 统计跳转
    $$('.stat').forEach(s => s.addEventListener('click', () => {
      const j = s.dataset.jump;
      ui.status = (j === 'all') ? 'all' : j;
      $$('#filterChips .fchip').forEach(c => c.classList.toggle('is-on', c.dataset.st === ui.status));
      go('list'); haptic();
    }));

    // 预览
    $('#btnRoll').addEventListener('click', () => { renderPreview(); haptic(); });

    // 重置
    $('#btnReset').addEventListener('click', () => {
      confirmSheet('重置生成配置？', '将把前缀、后缀、长度、字符池等参数恢复默认，已生成的卡密不受影响。', '确认重置', () => {
        S.cfg = Object.assign({}, DEFAULT_CFG);
        saveCfg(); fillForm(); renderPreview(); renderAll(); toast('配置已重置');
      });
    });

    // 生成
    $('#btnGen').addEventListener('click', e => {
      const btn = e.currentTarget;
      btn.classList.add('busy');
      setTimeout(() => { doGenerate(); btn.classList.remove('busy'); }, 10);
    });

    // 列表：搜索 / 筛选 / 排序
    const si = $('#searchVal');
    si.addEventListener('input', () => {
      ui.kw = si.value;
      $('#btnClearSearch').classList.toggle('on', !!si.value);
      renderList();
    });
    $('#btnClearSearch').addEventListener('click', () => { si.value = ''; ui.kw = ''; $('#btnClearSearch').classList.remove('on'); renderList(); });
    $$('#filterChips .fchip').forEach(c => c.addEventListener('click', () => {
      if (c.dataset.sort) {
        ui.sort = ui.sort === 'time' ? 'code' : 'time';
        c.classList.toggle('is-on', ui.sort === 'code');
        c.textContent = ui.sort === 'code' ? '按卡号排序' : '最新优先';
      } else {
        ui.status = c.dataset.st;
        $$('#filterChips .fchip').forEach(x => { if (!x.dataset.sort) x.classList.toggle('is-on', x === c); });
      }
      renderList(); haptic();
    }));

    // 工具行
    $('#btnSelectAll').addEventListener('click', () => {
      const vis = visibleCards();
      const allOn = vis.length && vis.every(c => ui.selected.has(c.id));
      vis.forEach(c => allOn ? ui.selected.delete(c.id) : ui.selected.add(c.id));
      renderList();
    });
    $('#btnCopyAll').addEventListener('click', copyAll);
    $('#btnBatch').addEventListener('click', batchSheet);

    // 列表点击（委托）
    $('#listBox').addEventListener('click', e => {
      const item = e.target.closest('.item');
      if (!item) return;
      const id = item.dataset.id;
      const act = e.target.closest('[data-act]');
      if (act) { actOn(id, act.dataset.act); return; }
      if (e.target.closest('.pick') || e.target.closest('.item-top') || e.target.closest('.code-box')) {
        ui.selected.has(id) ? ui.selected.delete(id) : ui.selected.add(id);
        haptic();
        renderList();
      }
    });
    // 长按卡片 = 弹操作菜单
    let lpTimer = null;
    $('#listBox').addEventListener('touchstart', e => {
      const item = e.target.closest('.item'); if (!item) return;
      lpTimer = setTimeout(() => { haptic(30); openCardSheet(item.dataset.id); }, 550);
    }, { passive: true });
    ['touchend','touchmove','touchcancel'].forEach(ev =>
      $('#listBox').addEventListener(ev, () => clearTimeout(lpTimer), { passive: true }));

    // 设置页
    $('#setHaptic').addEventListener('change', e => { S.set.haptic = e.target.checked; saveSet(); haptic(); });
    $('#setAutoJump').addEventListener('change', e => { S.set.autoJump = e.target.checked; saveSet(); });
    $('#expTxt').addEventListener('click', () => exportTxt(S.cfg.mode === 'pair'));
    $('#expCsv').addEventListener('click', exportCsv);
    $('#expJson').addEventListener('click', exportJson);
    $('#shareOut').addEventListener('click', shareOut);
    $('#impFile').addEventListener('click', () => $('#fileImport').click());
    $('#fileImport').addEventListener('change', e => readFile(e.target, t => {
      if (/^\s*[{[]/.test(t)) restoreJson(t); else importText(t);
    }));
    $('#resJson').addEventListener('click', () => $('#fileRestore').click());
    $('#fileRestore').addEventListener('change', e => readFile(e.target, restoreJson));

    $('#clrUsed').addEventListener('click', () => {
      const n = cards.filter(c => c.status === 1).length;
      if (!n) { toast('没有已使用的卡密'); return; }
      confirmSheet('删除已使用卡密？', `将删除 ${n} 条状态为「已使用」的卡密，不可撤销。`, '确认删除', () => {
        cards = cards.filter(c => c.status !== 1); ui.selected.clear(); saveCards(true); renderAll(); toast('已删除 ' + n + ' 条');
      }, true);
    });
    $('#clrBan').addEventListener('click', () => {
      const n = cards.filter(c => c.status === 2).length;
      if (!n) { toast('没有封禁的卡密'); return; }
      confirmSheet('删除已封禁卡密？', `将删除 ${n} 条状态为「已封禁」的卡密，不可撤销。`, '确认删除', () => {
        cards = cards.filter(c => c.status !== 2); ui.selected.clear(); saveCards(true); renderAll(); toast('已删除 ' + n + ' 条');
      }, true);
    });
    $('#clrAll').addEventListener('click', () => {
      if (!cards.length) { toast('列表已经是空的'); return; }
      confirmSheet('清空全部卡密？', `将删除全部 ${cards.length} 条卡密且无法撤销，建议先导出 JSON 备份。`, '确认清空', () => {
        cards = []; ui.selected.clear(); ui.lastDeleted = null; saveCards(true); renderAll(); toast('已清空全部卡密');
      }, true);
    });

    // 键盘：回车快速生成
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSheet();
      if (e.key === 'Enter' && ui.page === 'gen' && /INPUT|SELECT/.test(document.activeElement.tagName)) {
        document.activeElement.blur(); doGenerate();
      }
    });
  }

  function undoDeletedHint() { if (ui.lastDeleted) undoDelete(); }

  /* 单卡长按菜单 */
  function openCardSheet(id) {
    const c = findCard(id); if (!c) return;
    openSheet(`<h3 class="sheet-title">卡密操作</h3>
      <p class="sheet-desc" style="word-break:break-all">${esc(c.code)}${c.pwd ? '<br>密码：' + esc(c.pwd) : ''}</p>
      <div class="sheet-list">
        <button class="sheet-btn" data-a="copy"><svg viewBox="0 0 24 24">${ICON.copy}</svg>复制卡密</button>
        <button class="sheet-btn" data-a="copyCode"><svg viewBox="0 0 24 24">${ICON.copy}</svg>只复制卡号</button>
        <button class="sheet-btn" data-a="use"><svg viewBox="0 0 24 24">${ICON.check}</svg>${c.status === 1 ? '取消已使用' : '标记为已使用'}</button>
        <button class="sheet-btn" data-a="ban"><svg viewBox="0 0 24 24">${ICON.ban}</svg>${c.status === 2 ? '解除封禁' : '封禁此卡'}</button>
        <button class="sheet-btn dan" data-a="del"><svg viewBox="0 0 24 24">${ICON.trash}</svg>删除此卡</button>
      </div>`);
    $$('#sheetBody .sheet-btn').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'copyCode') { copyText(c.code); closeSheet(); return; }
      closeSheet();
      actOn(id, a);
    });
  }

  /* ---------------- 主题 ---------------- */
  function setTheme(t) {
    S.set.theme = t; saveSet();
    document.documentElement.dataset.theme = t;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0b1020' : '#eef2fb');
    $$('#themeSeg .seg-i').forEach(b => b.classList.toggle('is-on', b.dataset.theme === t));
    const hap = $('#setHaptic'); if (hap) hap.checked = !!S.set.haptic;
  }

  /* ---------------- 软键盘适配 ----------------
     键盘弹出时：隐藏底部导航与悬浮按钮（不再被顶起来遮挡输入区），
     并把获得焦点的输入框滚进可视区域；收起后恢复原样。 */
  const kb = { base: 0, open: false, focusEl: null, savedTop: 0 };
  const vvNow = () => window.visualViewport || null;

  function kbUpdate() {
    const vv = vvNow();
    if (!vv) return;
    const vh = vv.height;
    if (vh > kb.base) kb.base = vh;                // 记录最大可视高度作为基准
    const isOpen = (kb.base - vh) > 96;            // 可视高度明显变小 = 键盘打开
    if (isOpen === kb.open) return;
    kb.open = isOpen;
    const pad = isOpen ? Math.max(0, kb.base - vh) : 0;
    document.documentElement.style.setProperty('--kb', pad + 'px');
    document.body.classList.toggle('kb-open', isOpen);
    clearTimeout(kbUpdate._t);
    if (isOpen) {
      kbUpdate._t = setTimeout(kbScroll, 260);
    } else {
      kbUpdate._t = setTimeout(() => {
        const sc = $('#scroll');
        if (sc && kb.savedTop) sc.scrollTop = kb.savedTop;
      }, 180);
    }
  }

  function kbScroll() {
    const el = kb.focusEl;
    if (!el) return;
    const sc = $('#scroll');
    if (sc) kb.savedTop = sc.scrollTop;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { try { el.scrollIntoView(); } catch (e2) {} }
    setTimeout(() => {
      const vv = vvNow();
      const rect = el.getBoundingClientRect();
      const limit = (vv ? vv.height : window.innerHeight) - 20;
      if (rect.bottom > limit) {
        const d = rect.bottom - limit + 12;
        if (sc) sc.scrollTop += d;
      }
    }, 300);
  }

  function bindKeyboard() {
    const vv = vvNow();
    if (vv) {
      kb.base = vv.height;
      vv.addEventListener('resize', kbUpdate);
      vv.addEventListener('scroll', kbUpdate);
    }
    window.addEventListener('resize', kbUpdate);
    window.addEventListener('orientationchange', () => setTimeout(() => { kb.base = 0; kb.open = false; kbUpdate(); }, 350));
    // 记住正在编辑的输入框，供键盘弹出后滚动定位
    document.addEventListener('focusin', e => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) kb.focusEl = t;
    });
    // 点空白收起键盘
    $('#scroll').addEventListener('click', e => {
      if (e.target.closest('input,textarea,select,button,label,.chip,.seg,.switch')) return;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    loadAll();
    setTheme(S.set.theme || 'dark');
    fillForm();
    bindForm();
    bindEvents();
    bindKeyboard();
    renderPreview();
    renderAll();
    go('gen');
    // 支持桌面/长按快捷方式：#gen / #list / #set
    const hashPage = (location.hash || '').replace('#', '');
    if (['gen', 'list', 'set'].includes(hashPage)) go(hashPage);
    window.addEventListener('hashchange', () => {
      const p = (location.hash || '').replace('#', '');
      if (['gen', 'list', 'set'].includes(p)) go(p);
    });
    // 注册 Service Worker（离线可用 / 可安装）
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }
    // Android 返回键：关闭弹层优先
    window.addEventListener('popstate', () => { if (sheet.classList.contains('on')) closeSheet(); });
  }

  document.addEventListener('DOMContentLoaded', init);

  /* 调试/自测挂钩：控制台可用 __kami 检查内部状态 */
  window.__kami = {
    get cards() { return cards; },
    state: S, ui,
    buildPool, genBody, formatCode, applyCase, hasRun, makeCards,
    kb: { state: kb, update: kbUpdate, scroll: kbScroll, rebind: bindKeyboard },
    add(list) { cards = list.concat(cards); saveCards(true); renderAll(); }
  };
})();
