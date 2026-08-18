(function () {
  'use strict';

  const STORAGE_KEY = 'aipc-demo-v01';
  const app = document.getElementById('app');
  const portal = document.getElementById('portal');
  const seed = window.AIPCDemoData;

  let db = loadDB();
  const ui = {
    role: 'school',
    schoolId: 's1',
    dashboardTab: 'pre',
    dashboardDays: 30,
    dashboardRange: { start: '', end: '' },
    dashboardCategory: 'all',
    cluePage: 1,
    cluePageSize: 6,
    clueFilters: { schoolId: 'all', roomId: 'all', teacherId: 'all', classId: 'all', category: 'all', typeId: 'all', days: 30, rangeStart: '', rangeEnd: '', keyword: '' },
    taskPage: 1,
    taskPageSize: 7,
    taskFilters: { schoolId: 'all', roomId: 'all', status: 'all' },
    messagePage: 1,
    messagePageSize: 7,
    messageKind: 'all',
    clueDrafts: {},
    activeAnomaly: {},
    camera: {},
    detailPlayback: {},
    playerPrimary: {},
    analysisDrawer: {},
    anomalyEditor: {},
    ruleDrafts: {},
    openDatePicker: null
  };

  function loadDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schemaVersion === 17) return parsed;
      }
    } catch (error) {
      console.warn('无法读取本地演示数据', error);
    }
    const fresh = seed.createSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function saveDB() {
    syncFormalIssues();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function resetDB() {
    db = seed.createSeedData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    ui.clueDrafts = {};
    ui.ruleDrafts = {};
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function byId(list, id) { return list.find((item) => item.id === id); }
  function school(id) { return byId(db.schools, id); }
  function person(id) { return byId(db.people, id); }
  function room(id) { return byId(db.rooms, id); }
  function klass(id) { return byId(db.classes, id); }
  function session(id) { return byId(db.sessions, id); }
  function task(id) { return byId(db.tasks, id); }
  function clue(id) { return byId(db.clues, id); }
  function type(id) { return byId(db.anomalyTypes, id); }
  function categoryGroupId(category) { return category === 'teacher' ? 'teacher' : 'student'; }
  function categoryGroup(category) { return db.categoryGroups[categoryGroupId(category)]; }
  function categoryLabel(category) { return categoryGroup(category)?.label || db.categories[category] || category; }
  function categoryScene(category) { return db.categoryScenes[category] || ''; }
  function anomalyScene(typeId) {
    const anomalyType = type(typeId);
    return anomalyType?.scene === 'break' || anomalyType?.category === 'student_break' ? '课间' : '课堂';
  }
  function lessonSceneBounds(ss) {
    const durationSeconds = Math.max(1, ss.duration * 60);
    const breakSeconds = Math.min(600, Math.floor(durationSeconds / 3));
    return { durationSeconds, classStart: breakSeconds, classEnd: Math.max(breakSeconds, durationSeconds - breakSeconds) };
  }
  function occurrenceMatchesScene(typeId, occurredSecond, ss) {
    const { durationSeconds, classStart, classEnd } = lessonSceneBounds(ss);
    const second = Number(occurredSecond);
    if (!Number.isFinite(second) || second < 0 || second > durationSeconds) return false;
    const isBreak = second < classStart || second >= classEnd;
    return anomalyScene(typeId) === '课间' ? isBreak : !isBreak;
  }
  function defaultOccurrenceSecond(typeId, ss) {
    const { durationSeconds, classStart, classEnd } = lessonSceneBounds(ss);
    return anomalyScene(typeId) === '课间' ? Math.min(300, Math.max(60, classStart - 60)) : Math.min(classEnd - 60, classStart + 120, durationSeconds - 60);
  }
  function categoryMatches(category, selected) { return selected === 'all' || (db.categoryGroups[selected]?.categoryIds || [selected]).includes(category); }
  function categoryFilterOptions(selected) { return Object.entries(db.categoryGroups).map(([id, meta]) => option(id, meta.label, selected)).join(''); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }
  function fmtDate(value, withTime) {
    if (!value) return '—';
    const d = new Date(value);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return withTime === false ? date : `${date} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function fmtClock(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function fmtHours(minutes) { return `${(minutes / 60).toFixed(1)} 小时`; }
  function todayDiff(value) {
    return (new Date(seed.DEMO_NOW).getTime() - new Date(value).getTime()) / 86400000;
  }
  function inDays(value, days) { return todayDiff(value) >= 0 && todayDiff(value) <= days; }
  function dateKey(value) { return fmtDate(value, false); }
  function dateOffset(days) { const d = new Date(seed.DEMO_NOW); d.setDate(d.getDate() - days); return dateKey(d); }
  function inDateRange(value, days, start, end) {
    const key = dateKey(value);
    if (start && end) return key >= start && key <= end;
    if (days === 'all') return true;
    return inDays(value, days);
  }
  function rangeLabel(days, start, end) { return start && end ? `${start} 至 ${end}` : `近 ${days} 天`; }
  function rangeSpanDays(days, start, end) {
    if (!start || !end) return days;
    return Math.max(1, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000) + 1);
  }
  function rangeEndDate(end) { return end ? new Date(`${end}T12:00:00`) : new Date(seed.DEMO_NOW); }
  function dateRangeControl(key, days, start, end) {
    const isOpen = ui.openDatePicker === key;
    const inputStart = start || dateOffset(Math.max(0, days - 1));
    const inputEnd = end || dateKey(seed.DEMO_NOW);
    return `<div class="date-range-control${isOpen ? ' open' : ''}"><button type="button" class="date-range-trigger" data-date-range-toggle="${key}" aria-expanded="${isOpen}"><span class="date-range-icon" aria-hidden="true"></span><span>${escapeHtml(rangeLabel(days, start, end))}</span><i class="date-range-caret" aria-hidden="true"></i></button>${isOpen ? `<div class="date-range-popover"><div class="date-range-presets"><button type="button" data-date-range-preset="${key}" data-days="7">近 7 天</button><button type="button" data-date-range-preset="${key}" data-days="30">近 30 天</button><button type="button" data-date-range-preset="${key}" data-days="90">近 90 天</button></div><div class="date-range-divider"></div><div class="date-range-custom-title">自定义时间</div><div class="date-range-inputs"><input id="date-range-start-${key}" type="date" value="${inputStart}" aria-label="开始日期"/><span>至</span><input id="date-range-end-${key}" type="date" value="${inputEnd}" aria-label="结束日期"/></div><div class="date-range-actions"><button type="button" class="btn small" data-date-range-cancel="${key}">取消</button><button type="button" class="btn small primary" data-date-range-apply="${key}">确定</button></div></div>` : ''}</div>`;
  }
  function bindDateRangeControl(key, applyRange) {
    document.querySelector(`[data-date-range-toggle="${key}"]`)?.addEventListener('click', () => { ui.openDatePicker = ui.openDatePicker === key ? null : key; renderApp(); });
    document.querySelectorAll(`[data-date-range-preset="${key}"]`).forEach((el) => el.addEventListener('click', () => { ui.openDatePicker = null; applyRange({ days: Number(el.dataset.days), start: '', end: '' }); }));
    document.querySelector(`[data-date-range-cancel="${key}"]`)?.addEventListener('click', () => { ui.openDatePicker = null; renderApp(); });
    document.querySelector(`[data-date-range-apply="${key}"]`)?.addEventListener('click', () => {
      const start = document.getElementById(`date-range-start-${key}`)?.value || '';
      const end = document.getElementById(`date-range-end-${key}`)?.value || '';
      if (!start || !end || start > end) { toast('请填写有效的起止日期', 'error'); return; }
      ui.openDatePicker = null; applyRange({ days: rangeSpanDays(0, start, end), start, end });
    });
  }
  function unique(values) { return [...new Set(values.filter(Boolean))]; }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function option(value, label, selected) { return `<option value="${escapeHtml(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${escapeHtml(label)}</option>`; }

  function closeCustomSelects(except) {
    document.querySelectorAll('.select-control.open').forEach((control) => {
      if (control !== except) {
        control.classList.remove('open');
        control.querySelector('.select-trigger')?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function enhanceSelects() {
    document.querySelectorAll('select.control:not(.enhanced-native)').forEach((select) => {
      const options = Array.from(select.options);
      const selected = options.find((item) => item.selected) || options[0];
      const control = document.createElement('div');
      control.className = `select-control${select.disabled ? ' disabled' : ''}`;
      control.style.minWidth = `${select.getBoundingClientRect().width || 130}px`;
      control.innerHTML = `<button type="button" class="select-trigger" aria-haspopup="listbox" aria-expanded="false" ${select.disabled ? 'disabled' : ''}><span class="select-value">${escapeHtml(selected?.text || '')}</span><span class="select-arrow"></span></button><div class="select-menu" role="listbox">${options.map((item) => `<button type="button" class="select-option${item.selected ? ' selected' : ''}" role="option" aria-selected="${item.selected ? 'true' : 'false'}" data-value="${escapeHtml(item.value)}">${escapeHtml(item.text)}</button>`).join('')}</div>`;
      select.classList.add('enhanced-native');
      select.insertAdjacentElement('afterend', control);
      const trigger = control.querySelector('.select-trigger');
      if (!select.disabled) {
        trigger.addEventListener('click', (event) => {
          event.stopPropagation();
          const opening = !control.classList.contains('open');
          closeCustomSelects(control);
          control.classList.toggle('open', opening);
          trigger.setAttribute('aria-expanded', String(opening));
        });
        trigger.addEventListener('keydown', (event) => {
          if (event.key === 'Escape') { control.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); }
        });
        control.querySelectorAll('.select-option').forEach((item) => item.addEventListener('click', (event) => {
          event.stopPropagation();
          select.value = item.dataset.value;
          control.querySelector('.select-value').textContent = item.textContent;
          control.querySelectorAll('.select-option').forEach((optionItem) => {
            const active = optionItem === item;
            optionItem.classList.toggle('selected', active);
            optionItem.setAttribute('aria-selected', String(active));
          });
          control.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }));
      }
    });
  }

  const taskStatusMeta = {
    waiting: ['等待视频', 'gray'], analyzing: ['分析中', 'blue'], complete_none: ['无异常', 'green'],
    complete_issue: ['有疑似线索', 'orange'], partial: ['部分失败', 'orange'], failed: ['分析失败', 'red']
  };
  const resultMeta = {
    unprocessed: ['未处理', 'gray'], formal: ['正式问题', 'red'], false: ['误报', 'green'],
    uncertain: ['暂不确定', 'orange'], deleted: ['人工删除', 'gray']
  };
  const noticeMeta = { formal: ['正式通知', 'blue'], correction: ['更正通知', 'orange'], withdraw: ['撤回通知', 'red'] };
  function tag(meta) { return `<span class="tag ${meta[1]}">${escapeHtml(meta[0])}</span>`; }

  function currentSchoolIds() {
    if (ui.role === 'school') return [ui.schoolId];
    if (ui.dashboardSchoolId && ui.dashboardSchoolId !== 'all') return [ui.dashboardSchoolId];
    return db.schools.map((s) => s.id);
  }

  function visibleSchoolIds() {
    return ui.role === 'school' ? [ui.schoolId] : db.schools.map((item) => item.id);
  }

  function formalAnomalies(items) {
    return items.flatMap((c) => c.anomalies.map((a) => ({ ...a, clueId: c.id, sessionId: c.sessionId })))
      .filter((a) => a.result === 'formal' && !a.deleted);
  }

  function syncFormalIssues() {
    db.formalIssues = [];
    db.clues.forEach((c) => c.anomalies.filter((a) => a.result === 'formal' && !a.deleted).forEach((a) => {
      db.formalIssues.push({
        id: `fi_${c.id}_${a.id}`, clueId: c.id, anomalyId: a.id, active: true,
        severity: a.severity, repeat: !!a.repeat, source: a.source, createdAt: c.lastUpdatedAt || c.aiCreatedAt
      });
    }));
  }

  function toast(message, kind) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast ${kind || ''}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function closePortal() {
    portal.innerHTML = '';
    ui.analysisDrawer = {};
  }

  function focusPortal(selector) {
    const target = portal.querySelector(selector);
    if (!target) return;
    const applyFocus = () => target.focus?.();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(applyFocus);
    else applyFocus();
  }

  function showModal({ title, body, confirmText, confirmClass, onConfirm, cancelText }) {
    const titleId = `modal-title-${Date.now()}`;
    portal.innerHTML = `<div class="modal-mask">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <div class="modal-header"><div class="modal-title" id="${titleId}">${escapeHtml(title)}</div><button class="close-btn" data-modal-cancel aria-label="关闭弹窗" title="关闭">×</button></div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">
          <button class="btn" data-modal-cancel>${escapeHtml(cancelText || '取消')}</button>
          <button class="btn ${confirmClass || 'primary'}" data-modal-confirm>${escapeHtml(confirmText || '确认')}</button>
        </div>
      </div>
    </div>`;
    portal.querySelectorAll('[data-modal-cancel]').forEach((el) => el.addEventListener('click', closePortal));
    portal.querySelector('.modal-mask').addEventListener('click', (event) => { if (event.target.classList.contains('modal-mask')) closePortal(); });
    portal.querySelector('[data-modal-confirm]').addEventListener('click', () => {
      closePortal();
      if (onConfirm) onConfirm();
    });
    focusPortal('[data-modal-confirm]');
  }

  function showDrawer(title, body) {
    const titleId = `drawer-title-${Date.now()}`;
    portal.innerHTML = `<div class="drawer-mask"><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="drawer-header"><div class="drawer-title" id="${titleId}">${escapeHtml(title)}</div><button class="close-btn" data-drawer-close aria-label="关闭抽屉" title="关闭">×</button></div>
      <div class="drawer-body">${body}</div>
    </aside></div>`;
    portal.querySelector('[data-drawer-close]').addEventListener('click', closePortal);
    portal.querySelector('.drawer-mask').addEventListener('click', (event) => { if (event.target.classList.contains('drawer-mask')) closePortal(); });
    focusPortal('[data-drawer-close]');
  }

  function routeInfo() {
    const clean = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const parts = clean.split('/').filter(Boolean);
    return { page: parts[0] || 'dashboard', id: parts[1] || null };
  }

  function navigate(path) { location.hash = `#/${path}`; }

  // 侧栏及顶部操作统一使用 24px 线性图标，颜色继承父级状态（含 active / hover）。
  function icon(name, extraClass) {
    const paths = {
      video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
      course: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M11 8h5M11 12h5"/>',
      live: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m10 10 5 2-5 2zM6 3.5a8.5 8.5 0 0 1 0 17M18 3.5a8.5 8.5 0 0 0 0 17"/>',
      research: '<path d="M4 19V5l8-3 8 3v14l-8 3zM4 5l8 3 8-3M12 8v14"/><path d="M8 12h1M15 12h1"/>',
      interact: '<rect x="3" y="4" width="12" height="10" rx="2"/><path d="M7 18h14V8M8 8h3M18 13h1M18 16h1"/>',
      groups: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 20a4.5 4.5 0 0 1 6-3.7"/>',
      patrol: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 2.5 2.5L16.5 8.5M8 17h8"/>',
      contest: '<path d="M8 3h8v5a4 4 0 0 1-8 0zM8 5H4v1a4 4 0 0 0 4 4M16 5h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/>',
      feedback: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4.2A2.5 2.5 0 0 1 4 13.5z"/><path d="M8 8h8M8 11.5h5"/>',
      teacher: '<circle cx="12" cy="7" r="3"/><path d="M6.5 21v-2.5a5.5 5.5 0 0 1 11 0V21M18 5l2 2-2 2M6 5 4 7l2 2"/>',
      organization: '<path d="M5 20V5l7-3 7 3v15M3 20h18M8 9h1M8 13h1M15 9h1M15 13h1M11 20v-3h2v3"/>',
      bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-.9.5-1.5 1.1-1.5 2.2M12 17h.01"/>'
    };
    return `<svg class="ui-icon${extraClass ? ` ${extraClass}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.course}</svg>`;
  }

  function shell(pageResult, activePage) {
    const schoolIds = visibleSchoolIds();
    const unread = db.notifications.filter((n) => !n.read && schoolIds.includes(n.schoolId)).length;
    const navItems = [
      ['dashboard', '巡课看板'], ['clues', '分析结果'], ['rules', '巡课规则']
    ];
    return `<div class="shell">
      <header class="topbar">
        <div class="brand-area"><div class="brand-mark">三</div><div class="brand-name">三个课堂平台</div></div>
        <nav class="global-nav" aria-label="平台模块"><span class="active">首页</span><span>数据中心</span><span>名师课堂</span><span>专递课堂</span><span>名校网络课堂</span><span>教学成果</span><span>精品课</span></nav>
        <div class="top-actions">
          <span class="demo-version-pill">演示数据 · ${escapeHtml(db.demoVersion || seed.DEMO_VERSION || 'V0.54')}</span>
          <div class="role-switch"><button data-role="school" class="${ui.role === 'school' ? 'active' : ''}">校级管理员</button><button data-role="region" class="${ui.role === 'region' ? 'active' : ''}">区域管理员</button></div>
          <button class="icon-btn" title="打开演示指南" aria-label="打开演示指南" data-action="guide">${icon('help')}</button>
          <button class="icon-btn" title="恢复演示数据" aria-label="恢复演示数据" data-action="refresh">${icon('refresh')}</button>
          <button class="icon-btn" title="打开消息中心" aria-label="打开消息中心，${unread} 条未查看" data-action="messages">${icon('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button>
          <div class="avatar">${ui.role === 'school' ? '林' : '宋'}</div>
        </div>
      </header>
      <aside class="sidebar">
        <div class="side-section-title">资源</div>
        ${[['录播视频','video'],['课程管理','course'],['直播活动','live'],['教研活动','research'],['互动课堂','interact'],['分组管理','groups']].map(([name, iconName]) => `<div class="side-item"><span class="side-icon">${icon(iconName)}</span>${name}</div>`).join('')}
        <div class="side-item active"><span class="side-icon">${icon('patrol')}</span>AI 巡课</div>
        <div class="side-item"><span class="side-icon">${icon('contest')}</span>赛课活动</div>
        <div class="side-item"><span class="side-icon">${icon('feedback')}</span>AI 课堂反馈</div>
        <hr class="side-divider" />
        <div class="side-section-title">认证</div>
        <div class="side-item"><span class="side-icon">${icon('teacher')}</span>名师认证</div>
        <div class="side-item"><span class="side-icon">${icon('organization')}</span>教研组认证</div>
      </aside>
      <main class="content"><div class="workspace">
        <nav class="module-tabs">
          ${navItems.map(([key, label]) => `<button class="module-tab ${activePage === key ? 'active' : ''}" data-nav="${key}">${label}</button>`).join('')}
          <div class="module-spacer"></div>
        </nav>
        ${pageResult.html}
      </div></main>
    </div>`;
  }

  function bindGlobal() {
    document.querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.nav)));
    document.querySelectorAll('[data-role]').forEach((el) => el.addEventListener('click', () => {
      ui.role = el.dataset.role;
      if (ui.role === 'school') ui.schoolId = ui.schoolId || 's1';
      renderApp();
    }));
    const refresh = document.querySelector('[data-action="refresh"]');
    if (refresh) refresh.addEventListener('click', () => { showModal({title:'恢复演示数据',body:'<div class="warning-box">将清除当前浏览器内的规则修改、结果调整、点评和消息已读状态，并恢复为固定演示数据。</div>',confirmText:'确认恢复',onConfirm:()=>{resetDB();renderApp();toast('演示数据已恢复');}}); });
    const messages = document.querySelector('[data-action="messages"]');
    if (messages) messages.addEventListener('click', () => navigate('messages'));
    document.querySelector('[data-action="guide"]')?.addEventListener('click', showDemoGuide);
  }

  function showDemoGuide() {
    const body = `<div class="demo-guide-intro"><span class="demo-version-pill">${escapeHtml(db.demoVersion || seed.DEMO_VERSION || 'V0.54')}</span><div><strong>AI 巡课完整演示路径</strong><p>全部姓名、课堂、消息和识别结果均为虚构演示数据；页面修改仅保存在当前浏览器。</p></div></div>
      <ol class="demo-story-list">
        <li><strong>发现需要关注的课堂</strong><span>在巡课看板查看“建议优先查看”，进入分析结果。</span></li>
        <li><strong>理解 AI 为什么提示</strong><span>在课堂详情查看异常时间、证据画面、判定定义和识别可信度。</span></li>
        <li><strong>调整当前结果</strong><span>通过秩序管理新增、修改或删除异常，保存后同步刷新统计。</span></li>
        <li><strong>验证消息闭环</strong><span>进入消息中心查看正式、更正和撤回通知。</span></li>
        <li><strong>维护学校规则</strong><span>查看指标字典、逐观测点判定定义、通知角色和规则生效范围。</span></li>
      </ol>
      <div class="demo-guide-note"><strong>状态边界</strong><span>等待视频、分析中、部分指标无结论、分析失败和视频已删除均不会被包装为“正常课堂”。</span></div>
      <div class="drawer-actions"><button class="btn" data-drawer-close-action>关闭</button><button class="btn primary" id="guide-start">从看板开始</button></div>`;
    showDrawer('演示指南', body);
    portal.querySelector('[data-drawer-close-action]')?.addEventListener('click', closePortal);
    portal.querySelector('#guide-start')?.addEventListener('click', () => { closePortal(); navigate('dashboard'); });
  }

  function metricCard(label, value, unit, color, drillable) {
    return `<div class="metric-card${drillable ? ' clickable' : ''}" ${drillable ? 'data-down-clues="1" role="button" tabindex="0" aria-label="查看' + escapeHtml(label) + '明细"' : ''} style="--metric-soft:${color || '#eef4ff'}"><div class="metric-label">${label}</div><div class="metric-value">${value}<span class="metric-unit">${unit || ''}</span></div></div>`;
  }

  function lineChart(values) {
    const width = 620, height = 205, padX = 34, padY = 24;
    const max = Math.max(1, ...values.map((x) => x.value));
    const points = values.map((item, index) => {
      const x = padX + (index * (width - padX * 2)) / Math.max(1, values.length - 1);
      const y = height - padY - (item.value / max) * (height - padY * 2);
      return { ...item, x, y };
    });
    const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    const area = `${path} L${points[points.length - 1].x},${height - padY} L${points[0].x},${height - padY} Z`;
    return `<svg class="line-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8fff"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
      ${[0,1,2,3].map((n) => `<line class="chart-grid" x1="${padX}" x2="${width-padX}" y1="${padY+n*(height-padY*2)/3}" y2="${padY+n*(height-padY*2)/3}"/>`).join('')}
      <path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>
      ${points.map((p) => `<circle class="chart-dot" cx="${p.x}" cy="${p.y}" r="4"><title>${p.label}：${p.value}</title></circle>`).join('')}
      ${points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 6)) === 0 || i === points.length - 1).map((p) => `<text class="axis-label" x="${p.x}" y="${height-4}" text-anchor="middle">${p.label}</text>`).join('')}
    </svg>`;
  }

  function donut(items) {
    const colors = ['#2970ff', '#67a5ff', '#8c6be8', '#ffa94d', '#29b36b'];
    const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
    let acc = 0;
    const stops = items.map((item, index) => {
      const start = (acc / total) * 360;
      acc += item.value;
      const end = (acc / total) * 360;
      return `${colors[index % colors.length]} ${start}deg ${end}deg`;
    }).join(',');
    return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops})"><div class="donut-center"><div>${total}<span>合计</span></div></div></div><div class="legend">
      ${items.map((item, index) => `<div class="legend-item"><span class="legend-name"><i class="legend-dot" style="background:${colors[index % colors.length]}"></i>${escapeHtml(item.label)}</span><strong>${item.value}</strong></div>`).join('')}
    </div></div>`;
  }

  function dashboardPage() {
    const schoolIds = currentSchoolIds();
    const sessions = db.sessions.filter((s) => schoolIds.includes(s.schoolId) && inDateRange(s.startAt, ui.dashboardDays, ui.dashboardRange.start, ui.dashboardRange.end));
    const sessionIds = new Set(sessions.map((s) => s.id));
    const tasks = db.tasks.filter((t) => sessionIds.has(t.sessionId));
    let clues = db.clues.filter((c) => sessionIds.has(c.sessionId));
    if (ui.dashboardCategory !== 'all') clues = clues.filter((c) => categoryMatches(c.category, ui.dashboardCategory));
    const anomalies = clues.flatMap((c) => c.anomalies.filter((a) => !a.deleted).map((a) => ({ ...a, clueId: c.id, sessionId: c.sessionId })));
    const abnormalClassrooms = unique(anomalies.map((a) => a.sessionId));
    const completed = tasks.filter((t) => ['complete_none','complete_issue','partial'].includes(t.status));
    const issueTeacherCount = unique(anomalies.filter((a) => a.category === 'teacher').map((a) => a.teacherId)).length;
    const isRegionSummary = ui.role === 'region' && (!ui.dashboardSchoolId || ui.dashboardSchoolId === 'all');
    const enabledRoomCount = schoolIds.reduce((total, schoolId) => total + (db.rules[schoolId]?.enabledRooms.length || 0), 0);
    const scopeMetrics = isRegionSummary
      ? [['分析学校', schoolIds.length, '所', false], ['开启分析教室', enabledRoomCount, '间', false]]
      : [['开启分析教室', enabledRoomCount, '间', false]];
    const activityMetrics = isRegionSummary
      ? [['已分析课堂', completed.length, '节', true], ['异常课堂数', abnormalClassrooms.length, '节', true], ['异常数量', anomalies.length, '项', true], ['异常课堂占比', pct(abnormalClassrooms.length, completed.length), '%', true]]
      : [['已分析课堂', completed.length, '节', true], ['异常课堂数', abnormalClassrooms.length, '节', true], ['异常数量', anomalies.length, '项', true], ['涉及教师', issueTeacherCount, '人', true], ['异常课堂占比', pct(abnormalClassrooms.length, completed.length), '%', true]];
    const metrics = [...scopeMetrics, ...activityMetrics];
    const dashboardRangeDays = rangeSpanDays(ui.dashboardDays, ui.dashboardRange.start, ui.dashboardRange.end);
    const trend = Array.from({ length: Math.min(14, dashboardRangeDays) }, (_, index) => {
      const dayOffset = Math.min(14, dashboardRangeDays) - 1 - index;
      const labelDate = rangeEndDate(ui.dashboardRange.end); labelDate.setDate(labelDate.getDate() - dayOffset);
      const key = fmtDate(labelDate.toISOString(), false);
      const value = anomalies.filter((a) => fmtDate(session(a.sessionId).startAt, false) === key).length;
      return { label: `${labelDate.getMonth()+1}/${labelDate.getDate()}`, value };
    });
    const distSource = anomalies;
    const typeCounts = {};
    distSource.forEach((a) => { typeCounts[a.typeId] = (typeCounts[a.typeId] || 0) + 1; });
    const dist = Object.entries(typeCounts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([id,value]) => ({ label: type(id)?.label || id, value }));
    if (!dist.length) dist.push({ label: '暂无数据', value: 0 });
    const teacherRanks = rankEntities(anomalies.filter((a) => a.category === 'teacher'), 'teacher');
    const classRanks = rankEntities(anomalies.filter((a) => a.category !== 'teacher'), 'class');
    const schoolOverview = schoolIds.map((schoolId) => {
      const schoolSessions = sessions.filter((s) => s.schoolId === schoolId);
      const schoolSessionIds = new Set(schoolSessions.map((s) => s.id));
      return {
        id: schoolId,
        name: school(schoolId).name,
        enabledRooms: db.rules[schoolId]?.enabledRooms.length || 0,
        analyzedClasses: completed.filter((t) => schoolSessionIds.has(t.sessionId)).length,
        anomalyCount: anomalies.filter((a) => schoolSessionIds.has(a.sessionId)).length
      };
    }).sort((a,b) => b.anomalyCount-a.anomalyCount || b.analyzedClasses-a.analyzedClasses);
    const focusClues = clues.slice().sort((a,b) => new Date(session(b.sessionId).startAt)-new Date(session(a.sessionId).startAt)).slice(0,5);
    const actionQueue = clues.filter((item) => item.anomalies.some((anomaly) => !anomaly.deleted)).slice().sort((a, b) => {
      const aRepeat = a.anomalies.some((item) => !item.deleted && item.repeat) ? 1 : 0;
      const bRepeat = b.anomalies.some((item) => !item.deleted && item.repeat) ? 1 : 0;
      const aCount = a.anomalies.filter((item) => !item.deleted).length;
      const bCount = b.anomalies.filter((item) => !item.deleted).length;
      return bRepeat - aRepeat || bCount - aCount || new Date(session(b.sessionId).startAt) - new Date(session(a.sessionId).startAt);
    }).slice(0, 3);
    const stateCounts = {
      waiting: tasks.filter((item) => item.status === 'waiting').length,
      analyzing: tasks.filter((item) => item.status === 'analyzing').length,
      partial: tasks.filter((item) => item.status === 'partial').length,
      failed: tasks.filter((item) => item.status === 'failed').length,
      deleted: tasks.filter((item) => item.videoStatus === 'deleted').length
    };
    const stateTaskCount = tasks.filter((item) => ['waiting', 'analyzing', 'partial', 'failed'].includes(item.status) || item.videoStatus === 'deleted').length;
    const isSchoolDrilldown = ui.role === 'region' && ui.dashboardSchoolId && ui.dashboardSchoolId !== 'all';
    const currentLabel = ui.role === 'region' ? (isSchoolDrilldown ? school(ui.dashboardSchoolId).name : '青川区区域汇总') : school(ui.schoolId).name;
    const dashboardSubtitle = isSchoolDrilldown
      ? `学校看板 · ${rangeLabel(ui.dashboardDays, ui.dashboardRange.start, ui.dashboardRange.end)}，按异常实际发生时间统计`
      : `${escapeHtml(currentLabel)} · ${rangeLabel(ui.dashboardDays, ui.dashboardRange.start, ui.dashboardRange.end)}，按异常实际发生时间统计`;

    const rankCards = `<div class="grid-even"><div class="card"><div class="card-header"><div class="card-title">教师异常前 10</div><span class="muted">按异常数量</span></div><div class="card-body">${rankList(teacherRanks, isRegionSummary)}</div></div><div class="card"><div class="card-header"><div class="card-title">班级异常前 10</div><span class="muted">仅学生行为问题</span></div><div class="card-body">${rankList(classRanks, isRegionSummary)}</div></div></div>`;
    const schoolOverviewCard = isRegionSummary ? `<div class="card dashboard-school-overview"><div class="card-header"><div class="card-title">学校巡课概览</div></div><div class="school-overview"><div class="school-overview-head"><span></span><span>学校</span><span>开启分析教室</span><span>已分析课堂</span><span>异常数量</span></div>${schoolOverview.map((item,i) => `<button type="button" class="school-overview-row" data-school-down="${item.id}" aria-label="查看${escapeHtml(item.name)}巡课看板"><span class="rank-no">${i+1}</span><span class="school-overview-name">${escapeHtml(item.name)}<i>›</i></span><span>${item.enabledRooms} 间</span><span>${item.analyzedClasses} 节</span><span class="rank-value">${item.anomalyCount} 项</span></button>`).join('')}</div></div>` : '';
    const html = `<section class="page-body">
      <div class="page-header"><div>${isSchoolDrilldown ? `<nav class="dashboard-breadcrumb" aria-label="看板层级"><button type="button" id="return-region-summary">区域汇总</button><span>／</span><strong>${escapeHtml(currentLabel)}</strong></nav>` : ''}<h1 class="page-title">巡课看板</h1><div class="page-subtitle">${dashboardSubtitle}</div></div><div class="page-actions"><span class="muted">数据更新于 ${fmtDate(seed.DEMO_NOW)}</span></div></div>
      <div class="filter-bar">
        ${ui.role === 'region' ? `<select class="control" id="dashboard-school">${option('all','区域汇总',ui.dashboardSchoolId||'all')}${db.schools.map((s) => option(s.id,s.name,ui.dashboardSchoolId)).join('')}</select>` : ''}
        ${dateRangeControl('dashboard', ui.dashboardDays, ui.dashboardRange.start, ui.dashboardRange.end)}
        <select class="control" id="dashboard-category">${option('all','全部问题',ui.dashboardCategory)}${categoryFilterOptions(ui.dashboardCategory)}</select>
      </div>
      <div class="metrics">${metrics.map((m,i) => metricCard(m[0],m[1],m[2],['#eef4ff','#effaf4','#fff6e7','#f4efff','#fff0f1','#edf7ff'][i],m[3])).join('')}</div>
      <div class="dashboard-guidance-grid">
        <div class="card action-queue-card"><div class="card-header"><div><div class="card-title">建议优先查看</div><div class="muted">按重复出现、异常项数量和发生时间排序</div></div><button class="text-link" id="view-action-queue">查看全部结果</button></div><div class="action-queue-list">${actionQueue.length ? actionQueue.map((item) => {
          const itemSession = session(item.sessionId);
          const itemAnomalies = item.anomalies.filter((anomaly) => !anomaly.deleted);
          const hasRepeat = itemAnomalies.some((anomaly) => anomaly.repeat);
          const reason = hasRepeat ? '同类问题在规则周期内重复出现' : `${itemAnomalies.length} 项异常需要结合证据查看`;
          return `<button class="action-queue-row" data-focus-clue="${item.id}"><span class="action-queue-time">${fmtDate(itemSession.startAt)}</span><span class="action-queue-main"><strong>${escapeHtml(person(itemSession.teacherId)?.name || '—')} · ${escapeHtml(klass(itemSession.classId)?.name || '—')}</strong><small>${escapeHtml(reason)}</small></span><span class="action-queue-link">查看证据 ›</span></button>`;
        }).join('') : '<div class="empty-state compact"><div>当前筛选范围内没有需要关注的课堂</div></div>'}</div></div>
        <div class="card analysis-state-card"><div class="card-header"><div><div class="card-title">分析状态说明</div><div class="muted">未完成分析不计入正常结论</div></div><button class="text-link" id="open-analysis-status">查看说明</button></div><div class="analysis-state-summary"><div><span>等待视频</span><strong>${stateCounts.waiting}</strong></div><div><span>分析中</span><strong>${stateCounts.analyzing}</strong></div><div><span>部分无结论</span><strong>${stateCounts.partial}</strong></div><div><span>分析失败</span><strong>${stateCounts.failed}</strong></div></div><p>${stateTaskCount ? `当前范围内有 ${stateTaskCount} 节课堂存在非完整状态，系统不会将缺失结果计为正常。` : '当前范围内课堂均已完成完整分析。'}</p></div>
      </div>
      <div class="grid-2"><div class="card"><div class="card-header"><div class="card-title">异常数量变化趋势</div></div><div class="card-body chart-box">${lineChart(trend)}</div></div>
      <div class="card"><div class="card-header"><div class="card-title">异常项分布</div><button class="text-link" data-down-clues>查看明细</button></div><div class="card-body chart-box">${donut(dist)}</div></div></div>
      ${schoolOverviewCard}
      ${rankCards}
      <div class="card"><div class="card-header"><div class="card-title">最新分析结果</div><button class="text-link" id="view-all-clues">查看全部</button></div>${focusClues.length ? dashboardClueTable(focusClues) : '<div class="empty-state"><div class="empty-icon">□</div><div>当前筛选范围内暂无巡课数据</div></div>'}</div>
    </section>`;
    return { html, setup: () => {
      const bindChange = (id, fn) => { const el=document.getElementById(id); if(el) el.addEventListener('change', () => { fn(el.value); renderApp(); }); };
      bindChange('dashboard-school', (v) => { ui.dashboardSchoolId=v; });
      bindDateRangeControl('dashboard', ({ days, start, end }) => { ui.dashboardDays=days; ui.dashboardRange={ start, end }; renderApp(); });
      bindChange('dashboard-category', (v) => { ui.dashboardCategory=v; });
      const openDashboardClues = () => { applyDashboardClueContext(); navigate('clues'); };
      document.querySelectorAll('[data-down-clues]').forEach((el) => {
        el.addEventListener('click', openDashboardClues);
        el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDashboardClues(); } });
      });
      document.querySelectorAll('[data-clue-row]').forEach((el) => el.addEventListener('click', () => navigate(`clues/${el.dataset.clueRow}`)));
      document.querySelectorAll('[data-focus-clue]').forEach((el) => el.addEventListener('click', () => navigate(`clues/${el.dataset.focusClue}`)));
      document.getElementById('view-action-queue')?.addEventListener('click', () => { applyDashboardClueContext(); navigate('clues'); });
      document.getElementById('open-analysis-status')?.addEventListener('click', () => showAnalysisStatusGuide(tasks));
      document.querySelectorAll('[data-school-down]').forEach((el) => el.addEventListener('click', () => { ui.dashboardSchoolId=el.dataset.schoolDown; renderApp(); window.scrollTo({top:0,behavior:'smooth'}); }));
      document.getElementById('return-region-summary')?.addEventListener('click', () => { ui.dashboardSchoolId='all'; renderApp(); window.scrollTo({top:0,behavior:'smooth'}); });
      document.getElementById('view-all-clues').addEventListener('click', () => { applyDashboardClueContext(); navigate('clues'); });
    }};
  }

  function showAnalysisStatusGuide(tasks) {
    const statusOrder = ['waiting', 'analyzing', 'partial', 'failed'];
    const statusCopy = {
      waiting: ['等待视频', '课堂视频尚未就绪，不生成课堂结果；视频到达后自动进入分析。'],
      analyzing: ['分析中', '仅展示处理状态，不提前给出正常或异常结论。'],
      partial: ['部分指标无结论', '已完成指标可展示；失败指标明确标记无结论，不计入正常数量。'],
      failed: ['分析失败', '不生成课堂结论，需由内部任务监控处理，业务端不提供虚假正常结果。']
    };
    const representative = statusOrder.map((status) => tasks.find((item) => item.status === status)).filter(Boolean);
    const body = `<div class="analysis-status-intro">这些状态用于解释“课堂总数”与“已分析课堂”之间的差异，不形成额外人工核查流程。</div><div class="analysis-status-list">${representative.map((item) => {
      const ss = session(item.sessionId);
      const copy = statusCopy[item.status];
      return `<article><div><span class="tag ${item.status === 'failed' ? 'red' : item.status === 'partial' ? 'orange' : 'blue'}">${copy[0]}</span><strong>${fmtDate(ss.startAt)} · ${escapeHtml(klass(ss.classId)?.name || '课堂')}</strong></div><p>${copy[1]}</p>${item.failures?.length ? `<small>示例原因：${escapeHtml(item.failures.map((failure) => failure.reason).join('；'))}</small>` : ''}</article>`;
    }).join('')}</div><div class="demo-guide-note"><strong>视频删除</strong><span>已完成的分析结果继续保留，播放器和必要证据明确显示不可用，不影响已保存的评价。</span></div><div class="drawer-actions"><button class="btn" data-drawer-close-action>关闭</button></div>`;
    showDrawer('分析状态说明', body);
    portal.querySelector('[data-drawer-close-action]')?.addEventListener('click', closePortal);
  }

  function applyDashboardClueContext() {
    ui.clueFilters.schoolId = ui.role === 'region' ? (ui.dashboardSchoolId || 'all') : ui.schoolId;
    ui.clueFilters.category = ui.dashboardCategory;
    ui.cluePage = 1;
  }

  function rankEntities(anomalies, mode) {
    const counts = {};
    anomalies.forEach((a) => {
      const id = mode === 'teacher' ? a.teacherId : session(a.sessionId)?.classId;
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return Object.entries(counts).map(([id,value]) => {
      const entity = mode === 'teacher' ? person(id) : klass(id);
      return { id, name: entity?.name, schoolName: entity?.schoolId ? school(entity.schoolId)?.name : '', value };
    }).sort((a,b)=>b.value-a.value).slice(0,10);
  }

  function rankList(items, showSchool) {
    if (!items.length) return '<div class="empty-state" style="min-height:180px"><div>暂无排名数据</div></div>';
    return `<div class="school-rank">${items.map((r,i) => `<div class="rank-row ${showSchool?'rank-row-with-school':''}" data-rank-id="${r.id}"><span class="rank-no">${i+1}</span><span class="rank-entity"><strong>${escapeHtml(r.name)}</strong>${showSchool?`<small>${escapeHtml(r.schoolName)}</small>`:''}</span><span class="rank-value">${r.value} 项</span></div>`).join('')}</div>`;
  }

  function dashboardClueTable(items) {
    return `<div class="table-wrap" style="border:0;border-radius:0"><table class="analysis-result-table dashboard-result-table"><colgroup><col style="width:140px">${ui.role==='region'?'<col style="width:130px">':''}<col style="width:108px"><col style="width:108px"><col style="width:128px"><col style="width:82px"><col style="width:104px"></colgroup><thead><tr><th>发生时间</th>${ui.role==='region'?'<th>学校</th>':''}<th>教师</th><th>班级</th><th>问题类型</th><th>异常项</th><th>操作</th></tr></thead><tbody>${items.map((c) => clueRow(c)).join('')}</tbody></table></div>`;
  }

  function clueListPage() {
    const filterSchoolIds = ui.role === 'school'
      ? [ui.schoolId]
      : ui.clueFilters.schoolId !== 'all' ? [ui.clueFilters.schoolId] : db.schools.map((s) => s.id);
    let items = db.clues.filter((c) => filterSchoolIds.includes(session(c.sessionId).schoolId));
    const f = ui.clueFilters;
    items = items.filter((c) => {
      const ss = session(c.sessionId);
      const anomalyPeople = unique(c.anomalies.map((a) => a.teacherId));
      const anomalyTypes = unique(c.anomalies.map((a) => a.typeId));
      const keywordText = [person(ss.teacherId)?.name, klass(ss.classId)?.name].join('');
      return (f.roomId === 'all' || ss.roomId === f.roomId)
        && (f.teacherId === 'all' || ss.teacherId === f.teacherId || anomalyPeople.includes(f.teacherId))
        && (f.classId === 'all' || ss.classId === f.classId)
        && categoryMatches(c.category, f.category)
        && (f.typeId === 'all' || anomalyTypes.includes(f.typeId))
        && inDateRange(ss.startAt, f.days, f.rangeStart, f.rangeEnd)
        && (!f.keyword || keywordText.toLowerCase().includes(f.keyword.toLowerCase()));
    });
    items.sort((a,b) => new Date(session(b.sessionId).startAt) - new Date(session(a.sessionId).startAt));
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / ui.cluePageSize));
    if (ui.cluePage > pages) ui.cluePage = pages;
    const pageItems = items.slice((ui.cluePage - 1) * ui.cluePageSize, ui.cluePage * ui.cluePageSize);
    const scopedSchools = ui.role === 'school' ? db.schools.filter((s) => s.id === ui.schoolId) : db.schools;
    const availableRooms = db.rooms.filter((r) => filterSchoolIds.includes(r.schoolId));
    const availableClasses = db.classes.filter((c) => filterSchoolIds.includes(c.schoolId));
    const availablePeople = db.people.filter((p) => p.schoolId && filterSchoolIds.includes(p.schoolId));
    const activeFilterCount = Object.entries(f).filter(([key,value]) => !['keyword','days','rangeStart','rangeEnd'].includes(key) && value !== 'all').length + ((f.rangeStart && f.rangeEnd) || Number(f.days) !== 30 ? 1 : 0);
    const html = `<section class="page-body">
      <div class="page-header"><div class="result-title-row"><h1 class="page-title">分析结果</h1><span class="result-count-inline">${total}</span></div></div>
      <div class="filter-toolbar">
        <div class="search"><input class="control" id="clue-keyword" value="${escapeHtml(f.keyword)}" placeholder="搜索教师或班级" /></div>
        ${ui.role === 'region' ? `<select class="control" id="clue-quick-school">${option('all','全部学校',f.schoolId)}${scopedSchools.map((s)=>option(s.id,s.name,f.schoolId)).join('')}</select>` : ''}
        ${dateRangeControl('clues', f.days, f.rangeStart, f.rangeEnd)}
        <select class="control" id="clue-quick-category">${option('all','全部问题',f.category)}${categoryFilterOptions(f.category)}</select>
        <button class="btn" id="open-clue-filters" aria-label="打开筛选条件">筛选${activeFilterCount ? `<span class="filter-badge">${activeFilterCount}</span>` : ''}</button>
      </div>
      ${pageItems.length ? `<div class="table-wrap"><table class="analysis-result-table"><colgroup><col style="width:140px">${ui.role==='region'?'<col style="width:130px">':''}<col style="width:108px"><col style="width:108px"><col style="width:128px"><col style="width:82px"><col style="width:104px"></colgroup><thead><tr><th>发生时间</th>${ui.role==='region'?'<th>学校</th>':''}<th>教师</th><th>班级</th><th>问题类型</th><th>异常项</th><th>操作</th></tr></thead><tbody>
        ${pageItems.map((c) => clueRow(c)).join('')}</tbody></table></div>` : '<div class="card empty-state"><div class="empty-icon">□</div><div>当前筛选条件下暂无分析结果</div></div>'}
      <div class="pagination"><span class="result-count">共 ${total} 条，每页 ${ui.cluePageSize} 条</span><button class="page-btn" aria-label="上一页" title="上一页" data-page="${ui.cluePage-1}" ${ui.cluePage===1?'disabled':''}>‹</button>${Array.from({length:pages},(_,i)=>`<button class="page-btn ${ui.cluePage===i+1?'active':''}" aria-label="第 ${i+1} 页" ${ui.cluePage===i+1?'aria-current="page"':''} data-page="${i+1}">${i+1}</button>`).join('')}<button class="page-btn" aria-label="下一页" title="下一页" data-page="${ui.cluePage+1}" ${ui.cluePage===pages?'disabled':''}>›</button></div>
    </section>`;
    return { html, setup: () => {
      const search = () => { ui.clueFilters.keyword=document.getElementById('clue-keyword').value.trim(); ui.cluePage=1; renderApp(); };
      document.getElementById('clue-keyword').addEventListener('keydown', (e) => { if(e.key==='Enter') search(); });
      const updateQuickFilter = (id, update) => { document.getElementById(id)?.addEventListener('change', (event) => { update(event.target.value); ui.cluePage=1; renderApp(); }); };
      updateQuickFilter('clue-quick-school', (value) => { ui.clueFilters.schoolId=value; ui.clueFilters.roomId='all'; ui.clueFilters.teacherId='all'; ui.clueFilters.classId='all'; });
      bindDateRangeControl('clues', ({ days, start, end }) => { ui.clueFilters.days=days; ui.clueFilters.rangeStart=start; ui.clueFilters.rangeEnd=end; ui.cluePage=1; renderApp(); });
      updateQuickFilter('clue-quick-category', (value) => { ui.clueFilters.category=value; ui.clueFilters.typeId='all'; });
      document.getElementById('open-clue-filters').addEventListener('click', () => showClueFilterDrawer({ f, scopedSchools, availableRooms, availablePeople, availableClasses }));
      document.querySelectorAll('[data-clue-row]').forEach((el)=>el.addEventListener('click',(event)=>{ if(!event.target.closest('button')) navigate(`clues/${el.dataset.clueRow}`); }));
      document.querySelectorAll('[data-clue-open]').forEach((el)=>el.addEventListener('click',(event)=>{ event.stopPropagation(); navigate(`clues/${el.dataset.clueOpen}`); }));
      document.querySelectorAll('[data-page]').forEach((el)=>el.addEventListener('click',()=>{ const p=Number(el.dataset.page); if(p>=1&&p<=pages){ui.cluePage=p;renderApp();} }));
    }};
  }

  function showClueFilterDrawer({ f, scopedSchools, availableRooms, availablePeople, availableClasses }) {
    const filterField = (key, label, optionsHtml) => `<div class="field"><label>${label}</label><select class="control clue-drawer-filter" data-key="${key}">${optionsHtml}</select></div>`;
    const body = `<div class="filter-drawer-grid">
      ${filterField('roomId','教室',`${option('all','全部教室',f.roomId)}${availableRooms.map((r)=>option(r.id,r.name,f.roomId)).join('')}`)}
      ${filterField('teacherId','教师',`${option('all','全部教师',f.teacherId)}${availablePeople.map((p)=>option(p.id,p.name,f.teacherId)).join('')}`)}
      ${filterField('classId','班级',`${option('all','全部班级',f.classId)}${availableClasses.map((c)=>option(c.id,c.name,f.classId)).join('')}`)}
      ${filterField('typeId','异常类型',`${option('all','全部异常类型',f.typeId)}${db.anomalyTypes.filter((t)=>categoryMatches(t.category,f.category)).map((t)=>option(t.id,t.label,f.typeId)).join('')}`)}
    </div><div class="drawer-actions"><button class="btn primary" id="apply-clue-filters">应用筛选</button></div>`;
    showDrawer('筛选分析结果', body);
    enhanceSelects();
    portal.querySelector('#apply-clue-filters').addEventListener('click', () => {
      const next = { ...ui.clueFilters };
      portal.querySelectorAll('.clue-drawer-filter').forEach((el) => { next[el.dataset.key] = el.value; });
      if (next.category !== f.category) next.typeId = 'all';
      if (next.schoolId !== ui.clueFilters.schoolId) { next.roomId='all'; next.teacherId='all'; next.classId='all'; }
      ui.clueFilters = next; ui.cluePage = 1; portal.innerHTML = ''; renderApp();
    });
  }

  function clueRow(c) {
    const ss=session(c.sessionId); const anomalyTypeNames=unique(c.anomalies.filter((a)=>!a.deleted).map((a)=>type(a.typeId)?.label));
    const issueTypeLabel=categoryLabel(c.category);
    const issueTypeColor=c.category==='teacher'?'blue':'green';
    const scene = categoryScene(c.category);
    const issueTypeDetail=anomalyTypeNames.length?`${scene ? `发生场景：${scene}；` : ''}异常内容：${anomalyTypeNames.join('、')}`:'暂无异常内容';
    return `<tr class="clickable" data-clue-row="${c.id}">
      <td title="${fmtDate(ss.startAt)}">${fmtDate(ss.startAt)}</td>
      ${ui.role==='region'?`<td title="${escapeHtml(school(ss.schoolId).name)}">${escapeHtml(school(ss.schoolId).name)}</td>`:''}
      <td title="${escapeHtml(person(ss.teacherId)?.name||'—')}">${escapeHtml(person(ss.teacherId)?.name||'—')}</td>
      <td title="${escapeHtml(klass(ss.classId)?.name||'—')}">${escapeHtml(klass(ss.classId)?.name||'—')}</td>
      <td><span class="tag ${issueTypeColor} issue-type-tag" title="${escapeHtml(issueTypeDetail)}" aria-label="${escapeHtml(`${issueTypeLabel}，${issueTypeDetail}`)}">${escapeHtml(issueTypeLabel)}</span></td>
      <td>${c.anomalies.filter((a)=>!a.deleted).length} 项</td>
      <td class="table-action-cell"><button class="text-link table-action-link" data-clue-open="${c.id}">查看结果</button></td>
    </tr>`;
  }

  function getClueDraft(id) {
    const source = clue(id);
    if (!source) return null;
    if (!ui.clueDrafts[id]) {
      ui.clueDrafts[id] = clone(source);
      ui.clueDrafts[id]._baseRevision = source.revision;
    }
    return ui.clueDrafts[id];
  }

  function configuredRecipients(schoolId, category, ss) {
    const rule = db.rules[schoolId];
    const settings = rule?.[category === 'teacher' ? 'notifyTeacher' : 'notifyStudent'] || [];
    const classInfo = klass(ss.classId);
    return unique(settings.flatMap((value) => {
      if (value === 'role:teacher') return ss.teacherId ? [ss.teacherId] : [];
      if (value === 'role:homeroom') return classInfo?.homeroomId ? [classInfo.homeroomId] : [];
      const position = {
        'role:principal': '校长/副校长',
        'role:director': '教导主任',
        'role:research_lead': '教研组长'
      }[value];
      return position ? db.people.filter((item) => item.schoolId === schoolId && item.position === position).map((item) => item.id) : [];
    }));
  }

  function enabledMetricCount(schoolId, category) {
    const enabledTypes = db.rules[schoolId]?.enabledTypes || {};
    return db.anomalyTypes.filter((item) => (!category || categoryMatches(item.category, category)) && enabledTypes[item.id] !== false).length;
  }

  function participationTrendChart(values = [58, 61, 66, 70, 74, 78, 76, 81, 79]) {
    const width = 232;
    const height = 46;
    const padX = 4;
    const padY = 5;
    const min = 50;
    const max = 90;
    const points = values.map((value, index) => {
      const x = padX + index * ((width - padX * 2) / (values.length - 1));
      const y = height - padY - ((value - min) / (max - min)) * (height - padY * 2);
      return { x, y };
    });
    const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
    const area = `${line} L${points[points.length - 1].x.toFixed(1)},${height - padY} L${points[0].x.toFixed(1)},${height - padY} Z`;
    return `<svg class="participation-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><path class="participation-area" d="${area}"/><path class="participation-line" d="${line}"/><circle cx="${points[points.length - 1].x.toFixed(1)}" cy="${points[points.length - 1].y.toFixed(1)}" r="3"/></svg>`;
  }

  function normalObservationSummary(draft) {
    const studentIssues = draft.anomalies.filter((item) => !item.deleted && categoryMatches(type(item.typeId)?.category, 'student'));
    const participationNormal = !studentIssues.some((item) => item.typeId === 'student_participation');
    const cards = [];
    if (participationNormal) {
      cards.push(`<button class="normal-observation participation-observation" data-detail-action="participation" aria-label="查看学生参与度变化">
        <span class="normal-observation-name">学生参与度</span><strong>正常 <em>79</em><small>分</small></strong><span class="normal-observation-meta">课堂内整体平稳，后段保持活跃</span>${participationTrendChart()}<span class="normal-observation-link">查看变化 ›</span>
      </button>`);
    }
    if (!studentIssues.length) {
      cards.push(`<div class="normal-observation"><span class="normal-observation-name">正常行为观察</span><strong>学生行为正常</strong><span class="normal-observation-meta">纪律、到课、手机、趴桌、吃东西及课间行为均未发现异常</span></div>`);
    }
    return cards.length ? `<div class="normal-observation-grid ${cards.length === 1 ? 'single' : ''}" aria-label="正常课堂观察">${cards.join('')}</div>` : '';
  }

  function lessonInsightData(source, draft, ss) {
    const clueNo = Number(String(source.id || '').replace(/\D/g, '')) || 1;
    const participation = 76 + (clueNo * 3) % 8;
    const participationValues = [58, 61, 66, 70, 74, participation - 1, participation - 3, participation + 2, participation];
    const visible = draft.anomalies.filter((item) => !item.deleted);
    const issueTypeIds = unique(visible.map((item) => item.typeId));
    const enabledTypes = db.anomalyTypes.filter((item) => db.rules[ss.schoolId]?.enabledTypes?.[item.id] !== false);
    const sourceTask = task(source.taskId);
    const unavailableReasons = Object.fromEntries((sourceTask?.failures || []).filter((item) => item.typeId && item.typeId !== 'all').map((item) => [item.typeId, item.reason]));
    const statusByType = Object.fromEntries(enabledTypes.map((item) => {
      if (issueTypeIds.includes(item.id)) return [item.id, { state: 'issue' }];
      if (unavailableReasons[item.id]) return [item.id, { state: 'unavailable', reason: unavailableReasons[item.id] }];
      return [item.id, { state: 'normal' }];
    }));
    const totalMetrics = enabledTypes.length;
    return {
      participation,
      participationValues,
      visible,
      issueTypeIds,
      enabledTypes,
      statusByType,
      totalMetrics,
      normalMetrics: enabledTypes.filter((item) => statusByType[item.id].state === 'normal').length,
      unavailableMetrics: enabledTypes.filter((item) => statusByType[item.id].state === 'unavailable').length
    };
  }

  function behaviorPortrait(source, draft, ss) {
    const insight = lessonInsightData(source, draft, ss);
    const groupDetails = Object.entries(db.categoryGroups).map(([groupId, group]) => {
      const groupTypes = db.anomalyTypes.filter((item) => categoryMatches(item.category, groupId) && db.rules[ss.schoolId]?.enabledTypes?.[item.id] !== false);
      const groupAnomalies = insight.visible.filter((item) => categoryMatches(type(item.typeId)?.category, groupId));
      const groupIssueTypes = unique(groupAnomalies.map((item) => item.typeId));
      const normalTypes = groupTypes.filter((item) => insight.statusByType[item.id]?.state === 'normal');
      const unavailableTypes = groupTypes.filter((item) => insight.statusByType[item.id]?.state === 'unavailable');
      const normalCount = normalTypes.length;
      const isTeacher = groupId === 'teacher';
      const state = groupAnomalies.length ? `${groupAnomalies.length} 项需关注` : unavailableTypes.length ? `${unavailableTypes.length} 项无结论` : '未发现异常';
      const issueList = groupAnomalies.length
        ? `<div class="portrait-issue-list">${groupAnomalies.map((item) => `<button class="portrait-issue" data-seek-lesson="${draft.anomalies.indexOf(item)}"><span>${escapeHtml(type(item.typeId)?.label || '异常项')}</span><strong>${fmtClock(item.occurredSecond)}</strong></button>`).join('')}</div>`
        : '';
      const statusCopy = `<div class="portrait-normal-copy">${isTeacher ? `已配置 ${groupTypes.length} 项教师行为指标，其中 ${normalCount} 项表现正常` : `已配置 ${groupTypes.length} 项学生行为指标，其中 ${normalCount} 项表现正常`}${unavailableTypes.length ? `，${unavailableTypes.length} 项因数据不足无结论` : ''}</div>`;
      const indicatorSummary = isTeacher
        ? `<div class="portrait-indicator-line"><span>正常指标</span><strong>${normalCount} 项</strong><small>${normalTypes.slice(0, 3).map((item) => escapeHtml(item.label)).join('、') || '—'}</small></div>`
        : insight.statusByType.student_participation?.state === 'normal'
          ? `<div class="portrait-participation"><div><span>学生参与度</span><strong>正常 · ${insight.participation} 分</strong><small>课堂整体保持活跃</small></div><button data-detail-action="participation" aria-label="查看学生参与度变化">${participationTrendChart(insight.participationValues)}<span>查看趋势 ›</span></button></div>`
          : '';
      const stateClass = groupAnomalies.length ? 'has-issue' : unavailableTypes.length ? 'is-unavailable' : 'is-normal';
      return `<article class="portrait-domain ${stateClass}"><div class="portrait-domain-head"><div><span>${escapeHtml(group.label)}</span><strong>${state}</strong></div><button class="text-link" data-detail-action="behavior-insight" data-behavior-group="${groupId}">${groupAnomalies.length ? '查看异常' : '查看分析'}</button></div>${issueList}${statusCopy}${indicatorSummary}</article>`;
    }).join('');
    return `<section class="indicator-overview behavior-portrait" aria-label="分析详情"><div class="indicator-overview-heading"><div><h2>分析详情</h2></div></div>
      <div class="portrait-summary-row${insight.unavailableMetrics ? ' has-unavailable' : ''}"><div><span>需关注</span><strong>${insight.visible.length}<small> 项异常</small></strong><em>${insight.visible.length ? '已命中规则，可回看证据' : '当前未发现异常'}</em></div><div><span>正常</span><strong>${insight.normalMetrics}<small> 项指标</small></strong><em>未触发异常规则</em></div>${insight.unavailableMetrics ? `<div><span>无结论</span><strong>${insight.unavailableMetrics}<small> 项指标</small></strong><em>数据不足，不计入正常</em></div>` : ''}</div>
      <div class="portrait-domain-grid">${groupDetails}</div>
    </section>`;
  }

  function lessonEventTimeline(draft, ss, insight) {
    if (!insight.visible.length) return '';
    const markers = insight.visible.map((item) => {
      const index = draft.anomalies.indexOf(item);
      const left = Math.max(2, Math.min(98, (item.occurredSecond / Math.max(1, ss.duration * 60)) * 100));
      const scene = anomalyScene(item.typeId);
      return `<button class="portrait-event-marker${scene === '课间' ? ' is-break' : ''}" style="left:${left}%" data-seek-lesson="${index}" aria-label="回看${escapeHtml(type(item.typeId)?.label || '异常项')} ${fmtClock(item.occurredSecond)}，发生于${scene}"><i></i><span>${fmtClock(item.occurredSecond)} · ${scene} · ${escapeHtml(type(item.typeId)?.label || '异常项')}</span></button>`;
    }).join('');
    const durationSeconds = Math.max(1, ss.duration * 60);
    const breakSeconds = Math.min(600, Math.floor(durationSeconds / 3));
    const classEndSeconds = Math.max(breakSeconds, durationSeconds - breakSeconds);
    const breakPercent = (breakSeconds / durationSeconds) * 100;
    const classPercent = ((classEndSeconds - breakSeconds) / durationSeconds) * 100;
    return `<div class="portrait-event-timeline video-event-timeline" aria-label="异常时间定位"><div class="portrait-timeline-labels" style="grid-template-columns:${breakPercent}% ${classPercent}% ${breakPercent}%" aria-hidden="true"><span>课间</span><span>课堂</span><span>课间</span></div><div class="portrait-timeline-track"><span>00:00</span><div class="portrait-timeline-line"><span class="portrait-timeline-segment is-break" style="left:0;width:${breakPercent}%"></span><span class="portrait-timeline-segment is-class" style="left:${breakPercent}%;width:${classPercent}%"></span><span class="portrait-timeline-segment is-break" style="left:${breakPercent + classPercent}%;width:${breakPercent}%"></span>${markers}<b class="portrait-timeline-tick is-first" style="left:${breakPercent}%">${fmtClock(breakSeconds)}</b><b class="portrait-timeline-tick is-last" style="left:${breakPercent + classPercent}%">${fmtClock(classEndSeconds)}</b></div><span>${fmtClock(durationSeconds)}</span></div></div>`;
  }

  function analysisCategorySummary(draft, schoolId) {
    return Object.entries(db.categoryGroups).map(([groupId, group]) => {
      const issueCount = draft.anomalies.filter((item) => !item.deleted && categoryMatches(type(item.typeId)?.category, groupId)).length;
      const metricCount = enabledMetricCount(schoolId, groupId);
      const state = issueCount ? `${issueCount} 项异常` : '未发现异常';
      const sceneSummary = `已分析 ${metricCount} 项指标`;
      return `<button class="indicator-dimension ${issueCount ? 'has-issue' : ''}" data-detail-action="management" aria-label="查看${escapeHtml(group.label)}结果"><span>${escapeHtml(group.label)}</span><strong>${state}</strong><small>${escapeHtml(sceneSummary)}</small></button>`;
    }).join('');
  }

  function anomalyObjectLabel(anomaly) {
    if (anomaly.teacherId) return person(anomaly.teacherId)?.name || '任课教师';
    if (anomaly.classId) return klass(anomaly.classId)?.name || '相关班级';
    return anomaly.position || '视频画面中的位置';
  }

  function anomalyEvidenceMeta(anomaly) {
    const evidence = anomaly.evidence?.[0];
    const cameraNames = { 1: '教师全景', 2: '学生全景', 3: '电脑画面' };
    if (!evidence) return { camera: '未保留必要证据', range: '—' };
    return { camera: cameraNames[evidence.camera] || '课堂画面', range: `${fmtClock(evidence.start)}–${fmtClock(evidence.end)}` };
  }

  function anomalyRuleLabel(anomaly, schoolId) {
    const anomalyType = type(anomaly.typeId);
    if (!anomalyType) return '按学校巡课规则识别';
    return `判定定义：${ruleCriteriaSummary(anomalyType, db.rules[schoolId])}`;
  }

  function ruleCriteriaValues(anomalyType, rule) {
    const saved = rule?.criteria?.[anomalyType.id] || {};
    return Object.fromEntries((anomalyType.criteria || []).map((criterion) => [criterion.id, saved[criterion.id] ?? criterion.defaultValue]));
  }

  function ruleCriteriaSummary(anomalyType, rule, limit) {
    const values = ruleCriteriaValues(anomalyType, rule);
    const parts = (anomalyType.criteria || []).map((criterion) => `${criterion.label}${criterion.operatorLabel}${values[criterion.id]}${criterion.unit}`);
    if (limit && parts.length > limit) return `${parts.slice(0, limit).join('；')}；另 ${parts.length - limit} 项`;
    return parts.join('；') || '按学校当前判定规则执行';
  }

  function clueDetailPage(id) {
    const source = clue(id);
    if (!source) return notFoundPage('未找到该分析结果');
    const draft = getClueDraft(id);
    const ss = session(source.sessionId);
    if (ui.role === 'school' && ss.schoolId !== ui.schoolId) return noPermissionPage();
    const videoDeleted = ss.videoDeleted;
    const visibleAnomalies = draft.anomalies.filter((a)=>!a.deleted);
    const requestedIndex = Math.min(ui.activeAnomaly[id] || 0, Math.max(0, draft.anomalies.length - 1));
    let activeIndex = requestedIndex;
    let anomaly = draft.anomalies[activeIndex];
    if (!anomaly || anomaly.deleted) {
      anomaly = visibleAnomalies[0];
      activeIndex = anomaly ? draft.anomalies.indexOf(anomaly) : -1;
    }
    ui.activeAnomaly[id] = Math.max(0, activeIndex);
    const insight = lessonInsightData(source, draft, ss);
    const cameraSources = [
      { id:'teacher', label:'教师全景', src:'./assets/videos/classroom-teacher.mp4' },
      { id:'students', label:'学生全景', src:'./assets/videos/classroom-students.mp4' },
      { id:'computer', label:'电脑画面', src:'./assets/videos/teaching-screen.mp4' }
    ];
    const playbackSecond = ui.detailPlayback[id] == null ? (anomaly?.occurredSecond || 0) : ui.detailPlayback[id];
    const primaryCamera = cameraSources.find((item)=>item.id===(ui.playerPrimary[id]||'teacher')) || cameraSources[0];
    const secondaryCameras = cameraSources.filter((item)=>item.id!==primaryCamera.id);
    const scopeLine = ui.role==='region' ? `${escapeHtml(school(ss.schoolId).name)} · ` : '';
    const activeEvidence = anomaly?.evidence?.[0];
    const evidenceCameraIds = { 1:'teacher', 2:'students', 3:'computer' };
    const markerOnPrimary = Boolean(activeEvidence && evidenceCameraIds[activeEvidence.camera] === primaryCamera.id);
    const activeEvidenceMeta = anomaly ? anomalyEvidenceMeta(anomaly) : null;
    const videoState = videoDeleted
      ? '<span class="video-result-status incomplete">视频已删除</span><span class="video-result-copy">无法回看，分析结果继续保留</span>'
      : anomaly
        ? `<span class="video-result-status issue">需关注</span><span class="video-result-copy">当前定位：${escapeHtml(type(anomaly.typeId)?.label || '异常项')} · ${escapeHtml(activeEvidenceMeta.range)}${markerOnPrimary ? ' · 已在当前画面标记证据' : ' · 可切换至证据画面查看'}</span>`
        : '<span class="video-result-status normal">正常</span><span class="video-result-copy">已完成分析，当前可回看整节课</span>';
    const playerMarkup = videoDeleted
      ? '<div class="video-deleted"><div style="font-size:34px">⊘</div><div>视频已删除，无法播放</div><span class="muted">分析结果继续保留</span></div>'
      : `<div class="classroom-multi-grid"><div class="video-pane primary-pane"><video class="evidence-video" src="${primaryCamera.src}" muted loop playsinline autoplay preload="metadata"></video><span class="pane-label">${primaryCamera.label}</span>${markerOnPrimary ? '<div class="video-marker" aria-label="当前异常项证据标记"></div>' : ''}</div><div class="secondary-camera-stack">${secondaryCameras.map((camera)=>`<button class="video-pane secondary-pane" data-player-primary="${camera.id}" aria-label="切换${camera.label}为主画面" title="切换为主画面"><video class="evidence-video" src="${camera.src}" muted loop playsinline autoplay preload="metadata"></video><span class="pane-label">${camera.label}</span></button>`).join('')}</div></div>`;
    const playerOverlay = videoDeleted ? '' : `<div class="video-time">${fmtClock(playbackSecond)} / ${fmtClock(ss.duration*60)}</div><div class="video-overlay"></div>`;
    const html = `<section class="page-body analysis-result-page">
      <div class="analysis-detail-heading"><div class="detail-top"><button class="back-link" id="back-clues">← 返回分析结果</button><span class="detail-separator">/</span><strong>${fmtDate(ss.startAt)} · ${escapeHtml(ss.subject)}</strong></div><div class="analysis-detail-actions"><button class="btn primary" data-detail-action="management">秩序管理${visibleAnomalies.length ? `（${visibleAnomalies.length}）` : ''}</button><div class="analysis-review-actions" role="group" aria-label="课堂评价"><button class="btn small" data-detail-action="text-review">文字点评</button><button class="btn small" data-detail-action="rubric-review">评价表</button></div></div></div>
      <div class="page-header result-detail-header"><div><h1 class="page-title">课堂分析结果</h1><div class="page-subtitle">${scopeLine}${escapeHtml(room(ss.roomId).name)} · ${escapeHtml(klass(ss.classId).name)} · ${escapeHtml(person(ss.teacherId).name)}</div></div></div>
      <div class="card video-panel analysis-video-panel"><div class="video-stage classroom-multi-stage">${playerMarkup}${playerOverlay}</div>
        <div class="video-controlbar">${videoDeleted?videoState:`<button class="video-control" id="toggle-video" aria-label="播放或暂停视频" title="播放或暂停">Ⅱ</button><span class="video-current-time">${fmtClock(playbackSecond)} / ${fmtClock(ss.duration*60)}</span>${videoState}`}</div>
        ${videoDeleted ? '' : lessonEventTimeline(draft, ss, insight)}
      </div>
      ${behaviorPortrait(source, draft, ss)}
    </section>`;
    return { html, setup: () => bindClueDetail(source, draft, ss, anomaly, activeIndex) };
  }

  function anomalyForm(draft, a, index, ss, availablePeople) {
    const isTeacher = a.category === 'teacher';
    const schoolClasses = db.classes.filter((c)=>c.schoolId===ss.schoolId);
    const schoolTeachers = db.people.filter((p)=>p.schoolId===ss.schoolId);
    const editorKey=`${draft.id}:${a.id}`;
    const isEditing=a.source==='manual'||Boolean(ui.anomalyEditor[editorKey]);
    const editFields=`<div class="form-grid anomaly-edit-fields">
      <div class="field wide"><label>异常类型 *</label><select class="control anomaly-input" data-field="typeId">${db.anomalyTypes.filter((t)=>t.category===a.category).map((t)=>option(t.id,t.label,a.typeId)).join('')}</select></div>
      <div class="field"><label>问题类型</label><input class="control" value="${escapeHtml(categoryLabel(a.category))}" disabled /></div>
      <div class="field"><label>发生时间 *</label><input class="control anomaly-input" data-field="occurredSecond" type="number" min="0" max="${ss.duration*60}" value="${a.occurredSecond}" /></div>
      ${isTeacher?`<div class="field"><label>教师归属 *</label><select class="control anomaly-input" data-field="teacherId">${schoolTeachers.map((p)=>option(p.id,`${p.name}（${p.role}）`,a.teacherId)).join('')}</select></div><div class="field"><label>问题位置</label><input class="control anomaly-input" data-field="position" value="${escapeHtml(a.position||'')}" /></div>`:`<div class="field"><label>班级归属 *</label><select class="control anomaly-input" data-field="classId">${schoolClasses.map((c)=>option(c.id,c.name,a.classId)).join('')}</select></div><div class="field"><label>问题对象</label><select class="control anomaly-input" data-field="objectKind">${option('class','整个班级',a.objectKind)}${option('position','视频画面中的位置',a.objectKind)}</select></div><div class="field wide"><label>画面位置</label><input class="control anomaly-input" data-field="position" value="${escapeHtml(a.position||'')}" placeholder="仅标记视频位置，不填写座位号" /></div>`}
      <div class="field wide"><label>通知对象（允许为空）</label><div class="recipient-box checkbox-row">${availablePeople.map((p)=>`<label><input type="checkbox" class="recipient-input" value="${p.id}" ${a.recipients.includes(p.id)?'checked':''}/> ${escapeHtml(p.name)} <span class="muted">${escapeHtml(p.role)}</span></label>`).join('')}</div></div>
    </div>`;
    const evidenceMeta = anomalyEvidenceMeta(a);
    const anomalyType = type(a.typeId) || {};
    const readOnlyDetail = `<div class="anomaly-reading-detail"><div class="anomaly-reading-lead">${escapeHtml(anomalyRuleLabel(a, ss.schoolId))}</div><dl class="anomaly-reading-grid"><dt>问题对象</dt><dd>${escapeHtml(anomalyObjectLabel(a))}</dd><dt>发生场景</dt><dd>${escapeHtml(anomalyType.applicableScene || anomalyScene(a.typeId))}</dd><dt>发生时段</dt><dd><button class="evidence-time-link" data-seek-evidence="${index}">${fmtClock(a.occurredSecond)}</button></dd><dt>证据画面</dt><dd>${escapeHtml(evidenceMeta.camera)} · ${escapeHtml(evidenceMeta.range)}</dd><dt>分析来源</dt><dd>${escapeHtml(anomalyType.signalSource || '课堂音视频')}</dd><dt>识别可信度</dt><dd>${a.source === 'manual' ? '人工新增，不适用' : `${Number(a.confidence) || 90}%（演示值）`}</dd><dt>判定理由</dt><dd>${escapeHtml(a.rationale || '观测结果达到学校当前判定定义')}</dd></dl><p class="anomaly-reading-footnote">识别可信度仅用于解释算法对本次识别结果的把握程度；是否采信仍应结合对应证据判断。</p></div>`;
    return `<div class="anomaly-form" data-anomaly-form="${index}">
      <div class="source-line"><div>${tag([a.source==='manual'?'人工新增':'AI分析',a.source==='manual'?'purple':'blue'])} ${a.repeat?tag(['重复问题','red']):''}</div>${isEditing?'<button class="text-link danger-text" id="delete-anomaly">删除异常项</button>':'<button class="text-link" id="edit-anomaly">调整异常信息</button>'}</div>
      ${isEditing?`${editFields}<div class="form-actions"><button class="btn primary" id="save-result-changes">保存修改</button></div>`:`${readOnlyDetail}<div class="result-summary"><span>${a.recipients.length?`通知对象：${escapeHtml(a.recipients.map((id)=>person(id)?.name).filter(Boolean).join('、'))}`:'未设置通知对象'}</span></div>`}
    </div>`;
  }

  function bindClueDetail(source, draft, ss, anomaly, activeIndex) {
    document.getElementById('back-clues').addEventListener('click', () => navigate('clues'));
    document.querySelectorAll('[data-player-primary]').forEach((el)=>el.addEventListener('click',()=>{ui.playerPrimary[source.id]=el.dataset.playerPrimary;renderApp();}));
    const videos=Array.from(document.querySelectorAll('.evidence-video')); const toggle=document.getElementById('toggle-video');
    if(toggle&&videos.length)toggle.addEventListener('click',()=>{const shouldPlay=videos.some((video)=>video.paused);videos.forEach((video)=>{if(shouldPlay)video.play().catch(()=>{});else video.pause();});toggle.textContent=shouldPlay?'Ⅱ':'▶';});
    document.querySelectorAll('[data-seek-lesson]').forEach((el)=>el.addEventListener('click',()=>{const index=Number(el.dataset.seekLesson);ui.activeAnomaly[source.id]=index;ui.detailPlayback[source.id]=draft.anomalies[index]?.occurredSecond||0;renderApp();}));
    if(ui.analysisDrawer[source.id]) showAnalysisDrawer(source,draft,ss);
  }

  function showAnalysisDrawer(source, draft, ss) {
    const visibleAnomalies = draft.anomalies.filter((a)=>!a.deleted);
    const requestedIndex = Math.min(ui.activeAnomaly[source.id] || 0, Math.max(0, draft.anomalies.length - 1));
    let activeIndex = requestedIndex;
    let anomaly = draft.anomalies[activeIndex];
    if (!anomaly || anomaly.deleted) {
      anomaly = visibleAnomalies[0];
      activeIndex = anomaly ? draft.anomalies.indexOf(anomaly) : -1;
    }
    ui.activeAnomaly[source.id] = Math.max(0, activeIndex);
    const availablePeople = db.people.filter((p)=>p.schoolId===ss.schoolId || p.regionId===school(ss.schoolId).regionId);
    const insight = lessonInsightData(source, draft, ss);
    const list = Object.entries(db.categoryGroups).map(([groupId, group]) => {
      const groupAnomalies = visibleAnomalies.filter((item) => categoryMatches(type(item.typeId)?.category, groupId));
      const groupTypes = insight.enabledTypes.filter((item) => categoryMatches(item.category, groupId));
      const normalCount = groupTypes.filter((item) => insight.statusByType[item.id]?.state === 'normal').length;
      const groupState = groupAnomalies.length
        ? `${groupAnomalies.length} 项需关注`
        : `已完成 ${normalCount} 项 · 未发现异常`;
      const header = `<div class="finding-category-title"><strong>${escapeHtml(group.label)}</strong><span>${groupState}</span></div>`;
      if (!groupAnomalies.length) return `<div class="finding-category empty">${header}</div>`;
      const scenes = `<div class="finding-scene">${groupAnomalies.map((a)=>{
          const index=draft.anomalies.indexOf(a);
          return `<button class="finding-item ${index===activeIndex?'active':''}" data-anomaly-tab="${index}"><span class="finding-status ${a.source==='manual'?'manual':'ai'}"></span><span class="finding-main"><strong>${escapeHtml(type(a.typeId)?.label||'异常项')}</strong><small>${fmtClock(a.occurredSecond)} · ${a.source==='manual'?'人工新增':'分析结果'}</small></span></button>`;
        }).join('')}</div>`;
      return `<section class="finding-category">${header}${scenes}</section>`;
    }).join('');
    const body = `<div class="analysis-drawer-toolbar"><span class="muted">本节课共 ${visibleAnomalies.length} 项需关注 · 正常 ${insight.normalMetrics} 项</span><button class="btn small" id="add-anomaly">＋ 新增异常项</button></div><div class="finding-list analysis-drawer-list">${list}</div>${anomaly ? anomalyForm(draft, anomaly, activeIndex, ss, availablePeople) : '<div class="empty-state analysis-drawer-empty"><div>本节课未发现异常</div><span class="muted">可按需补充人工异常项</span><button class="btn primary" id="add-anomaly-empty">新增异常项</button></div>'}`;
    showDrawer('秩序管理', body);
    portal.querySelector('[data-drawer-close]').addEventListener('click',()=>{ui.analysisDrawer[source.id]=false;});
    portal.querySelector('.drawer-mask').addEventListener('click',(event)=>{if(event.target.classList.contains('drawer-mask'))ui.analysisDrawer[source.id]=false;});
    enhanceSelects();
    bindAnalysisDrawer(source,draft,ss,anomaly,activeIndex);
  }

  function bindAnalysisDrawer(source, draft, ss, anomaly, activeIndex) {
    portal.querySelectorAll('[data-anomaly-tab]').forEach((el)=>el.addEventListener('click',()=>{const target=Number(el.dataset.anomalyTab);ui.activeAnomaly[source.id]=target;ui.detailPlayback[source.id]=draft.anomalies[target]?.occurredSecond||0;renderApp();}));
    const addButton=document.getElementById('add-anomaly'); const addEmpty=document.getElementById('add-anomaly-empty');
    const addAnomaly=()=>{
      const firstType=db.anomalyTypes.find((t)=>t.category===draft.category) || db.anomalyTypes[0];
      const newId=`manual_${Date.now()}`;
      draft.anomalies.push({ id:newId, source:'manual', typeId:firstType.id, category:firstType.category, objectKind:firstType.category==='teacher'?'teacher':'class', teacherId:firstType.category==='teacher'?ss.teacherId:null, classId:firstType.category==='teacher'?null:ss.classId, position:firstType.category==='teacher'?'主要教学区域':'整个班级', occurredSecond:defaultOccurrenceSecond(firstType.id,ss), evidence:[], result:'formal', severity:firstType.defaultSeverity, recipients:[], submitted:false, repeat:false, deleted:false });
      ui.activeAnomaly[source.id]=draft.anomalies.length-1; renderApp(); toast('已新增人工异常项');
    };
    if(addButton)addButton.addEventListener('click',addAnomaly); if(addEmpty)addEmpty.addEventListener('click',addAnomaly);
    if(anomaly){
      portal.querySelectorAll('[data-seek-evidence]').forEach((el)=>el.addEventListener('click',()=>{const targetIndex=Number(el.dataset.seekEvidence);ui.activeAnomaly[source.id]=targetIndex;ui.detailPlayback[source.id]=draft.anomalies[targetIndex]?.occurredSecond||0;ui.analysisDrawer[source.id]=false;renderApp();}));
      document.querySelectorAll('.anomaly-input').forEach((el)=>el.addEventListener('change',()=>{
        let value=el.type==='number'?Number(el.value):el.value;
        anomaly[el.dataset.field]=value;
        if(el.dataset.field==='typeId'){
          const selected=type(value); anomaly.category=selected.category;
          if(!anomaly.severity)anomaly.severity=selected.defaultSeverity;
        }
        renderApp();
      }));
      const editBtn=document.getElementById('edit-anomaly');
      if(editBtn)editBtn.addEventListener('click',()=>{ui.anomalyEditor[`${draft.id}:${anomaly.id}`]=true;renderApp();});
      document.querySelectorAll('.recipient-input').forEach((el)=>el.addEventListener('change',()=>{
        anomaly.recipients=Array.from(document.querySelectorAll('.recipient-input:checked')).map((x)=>x.value);
      }));
      const saveChanges=document.getElementById('save-result-changes');
      if(saveChanges)saveChanges.addEventListener('click',()=>{
        const occurredSecondInput=portal.querySelector('[data-field="occurredSecond"]');
        if(occurredSecondInput)anomaly.occurredSecond=Number(occurredSecondInput.value);
        if(!occurrenceMatchesScene(anomaly.typeId,anomaly.occurredSecond,ss)){toast(`${type(anomaly.typeId)?.label||'当前指标'}仅适用于${anomalyScene(anomaly.typeId)}时段，请调整发生时间`,'error');return;}
        saveAnalysisResult(source,draft,anomaly);
      });
      const deleteBtn=document.getElementById('delete-anomaly');
      if(deleteBtn)deleteBtn.addEventListener('click',()=>{
        if(anomaly.source==='manual'&&!clue(source.id).anomalies.some((item)=>item.id===anomaly.id)){
          draft.anomalies.splice(activeIndex,1); ui.activeAnomaly[source.id]=Math.max(0,activeIndex-1); renderApp(); toast('已移除新增异常项'); return;
        }
        showModal({title:'删除异常项',body:'<div class="warning-box">确认后，此异常项将从当前课堂分析结果中移除。</div>',confirmText:'确认删除',confirmClass:'danger',onConfirm:()=>{anomaly.deleted=true;anomaly.recipients=[];saveAnalysisResult(source,draft,anomaly,'已删除异常项');}});
      });
    }
  }

  function lessonReview(source) {
    if (!source.lessonReview) source.lessonReview = { tags: [], comment: '', rubric: {}, updatedAt: '', updatedBy: '' };
    if (!Array.isArray(source.lessonReview.tags)) source.lessonReview.tags=[];
    if (typeof source.lessonReview.comment !== 'string') source.lessonReview.comment='';
    if (!source.lessonReview.rubric) source.lessonReview.rubric={};
    return source.lessonReview;
  }

  function showTextReviewDrawer(source, ss) {
    const review=lessonReview(source);
    const reviewTags=['目标明确','环节流畅','突出重点','教态亲切','师生互动','学生参与','课堂秩序良好','建议关注个别学生'];
    const body=`<div class="review-context">${escapeHtml(klass(ss.classId).name)} · ${escapeHtml(person(ss.teacherId).name)} · ${fmtDate(ss.startAt)}</div><section class="review-section"><div class="field-label">评价标签</div><div class="review-tag-list">${reviewTags.map((label)=>`<button class="review-tag ${review.tags.includes(label)?'selected':''}" data-review-tag="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join('')}</div></section><section class="review-section"><div class="review-text-head"><label class="field-label" for="text-review-content">文字点评</label><span id="review-char-count">${review.comment.length}/1000</span></div><textarea id="text-review-content" class="control review-textarea" maxlength="1000" placeholder="记录本节课的观察与建议">${escapeHtml(review.comment)}</textarea></section><div class="drawer-actions review-save-actions"><button class="btn primary" id="save-text-review">保存点评</button></div>`;
    showDrawer('文字点评',body);
    const textarea=portal.querySelector('#text-review-content'); const counter=portal.querySelector('#review-char-count');
    textarea.addEventListener('input',()=>{counter.textContent=`${textarea.value.length}/1000`;});
    portal.querySelectorAll('[data-review-tag]').forEach((el)=>el.addEventListener('click',()=>{const label=el.dataset.reviewTag;review.tags=review.tags.includes(label)?review.tags.filter((item)=>item!==label):[...review.tags,label];el.classList.toggle('selected',review.tags.includes(label));}));
    portal.querySelector('#save-text-review').addEventListener('click',()=>{const comment=textarea.value.trim();if(!comment&&!review.tags.length){toast('请填写文字点评或选择评价标签','warning');return;}review.comment=comment;review.updatedAt=seed.DEMO_NOW;review.updatedBy=ui.role==='school'?'林静':'宋倩';saveDB();renderApp();toast('文字点评已保存');});
  }

  function showParticipationDrawer(source, ss) {
    const insight = lessonInsightData(source, getClueDraft(source.id), ss);
    const status = insight.statusByType.student_participation || { state: 'normal' };
    const values = insight.participationValues;
    const peak = Math.max(...values);
    const low = Math.min(...values);
    const trend = values[values.length - 1] > values[0] ? '整体上升' : values[values.length - 1] < values[0] ? '整体下降' : '整体平稳';
    const result = status.state === 'normal'
      ? `<div class="participation-detail-heading"><div><span>学生参与度</span><strong>正常 · ${insight.participation} 分</strong></div><span class="tag green">处于学校设定正常范围</span></div><div class="participation-chart-large">${participationTrendChart(values)}<div class="participation-axis"><span>开始</span><span>20 分钟</span><span>结束</span></div></div><div class="participation-detail-metrics"><div><span>课堂峰值</span><strong>${peak} 分</strong></div><div><span>课堂低点</span><strong>${low} 分</strong></div><div><span>变化趋势</span><strong>${trend}</strong></div></div><p class="muted">综合举手、发言、起立、书写等课堂事件计算。本节课已完成分析，未触发“学生参与度低”异常。</p>`
      : status.state === 'issue'
        ? `<div class="participation-detail-heading"><div><span>学生参与度</span><strong>需关注</strong></div><span class="tag orange">已触发异常规则</span></div><p class="muted">本节课已命中“学生参与度低”规则，可在分析详情的关键异常片段回看对应时段。</p>`
        : '';
    const body = `<div class="review-context">${escapeHtml(klass(ss.classId).name)} · ${fmtDate(ss.startAt)} · ${escapeHtml(ss.subject)}</div><section class="participation-detail">${result}</section>`;
    showDrawer('学生参与度变化', body);
  }

  function showBehaviorInsightDrawer(source, draft, ss, groupId) {
    const group = db.categoryGroups[groupId];
    if (!group) return;
    const insight = lessonInsightData(source, draft, ss);
    const groupTypes = db.anomalyTypes.filter((item) => categoryMatches(item.category, groupId) && db.rules[ss.schoolId]?.enabledTypes?.[item.id] !== false);
    const groupIssues = insight.visible.filter((item) => categoryMatches(type(item.typeId)?.category, groupId));
    const issueTypeIds = unique(groupIssues.map((item) => item.typeId));
    const normalCount = groupTypes.filter((item) => insight.statusByType[item.id]?.state === 'normal').length;
    const rows = groupTypes.map((item) => {
        const occurrences = groupIssues.filter((issue) => issue.typeId === item.id);
        const isIssue = occurrences.length > 0;
        const metricStatus = insight.statusByType[item.id] || { state: 'normal' };
        const isUnavailable = metricStatus.state === 'unavailable';
        const meta = ruleCriteriaSummary(item, db.rules[ss.schoolId]);
        const result = isIssue
          ? `<div class="metric-insight-result issue-result"><span>发现 ${occurrences.length} 项</span>${occurrences.map((issue) => `<button data-portrait-seek="${draft.anomalies.indexOf(issue)}">${fmtClock(issue.occurredSecond)} 回看</button>`).join('')}</div>`
          : isUnavailable
            ? `<div class="metric-insight-result unavailable-result"><span>无结论</span><small>${escapeHtml(metricStatus.reason || item.unavailablePolicy || '分析所需数据不足')}</small></div>`
          : item.id === 'student_participation'
            ? `<div class="metric-insight-result normal-result participation-result"><span>正常 · ${insight.participation} 分</span><button data-detail-action="participation">查看变化 ›</button>${participationTrendChart(insight.participationValues)}</div>`
            : `<div class="metric-insight-result normal-result"><span>正常</span><small>未触发异常规则</small></div>`;
        return `<article class="metric-insight-row ${isIssue ? 'has-issue' : isUnavailable ? 'is-unavailable' : 'is-normal'}"><div class="metric-insight-main"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(meta || '已按当前规则完成分析')}</span><small>${escapeHtml(`${item.applicableScene || anomalyScene(item.id)} · ${item.signalSource || '课堂音视频'}`)}</small></div><div class="metric-insight-status">${isIssue ? tag(['需关注', 'orange']) : isUnavailable ? tag(['无结论', 'gray']) : tag(['正常', 'green'])}</div>${result}</article>`;
      }).join('');
    const unavailableCount = groupTypes.filter((item) => insight.statusByType[item.id]?.state === 'unavailable').length;
    const body = `<div class="behavior-insight-summary${unavailableCount ? ' has-unavailable' : ''}"><div><span>需关注</span><strong>${groupIssues.length} 项异常</strong></div><div><span>正常</span><strong>${normalCount} 项指标</strong></div>${unavailableCount ? `<div><span>无结论</span><strong>${unavailableCount} 项指标</strong></div>` : ''}</div><div class="metric-insight-list">${rows}</div><div class="drawer-actions"><button class="btn" id="open-group-management">查看异常项</button></div>`;
    showDrawer(`${group.label}分析`, body);
    portal.querySelectorAll('[data-portrait-seek]').forEach((el) => el.addEventListener('click', () => {
      const index = Number(el.dataset.portraitSeek);
      ui.activeAnomaly[source.id] = index;
      ui.detailPlayback[source.id] = draft.anomalies[index]?.occurredSecond || 0;
      portal.innerHTML = '';
      renderApp();
    }));
    portal.querySelector('#open-group-management')?.addEventListener('click', () => {
      portal.innerHTML = '';
      ui.analysisDrawer[source.id] = true;
      showAnalysisDrawer(source, draft, ss);
    });
  }

  function showRubricReviewDrawer(source, ss) {
    const review=lessonReview(source);
    const rubricItems=[
      {id:'objective',label:'教学目标',desc:'目标明确，任务与教学内容一致'},
      {id:'organization',label:'课堂组织',desc:'节奏适宜，环节衔接自然'},
      {id:'interaction',label:'师生互动',desc:'提问、回应与反馈有效'},
      {id:'engagement',label:'学生参与',desc:'学生专注并积极参与课堂'},
      {id:'achievement',label:'学习达成',desc:'学生能够理解并完成学习任务'}
    ];
    const options=[['','请选择'],['5','优秀（5分）'],['4','良好（4分）'],['3','合格（3分）'],['2','待改进（2分）'],['1','需重点关注（1分）']];
    const body=`<div class="review-context">${escapeHtml(klass(ss.classId).name)} · ${escapeHtml(person(ss.teacherId).name)} · ${fmtDate(ss.startAt)}</div><div class="rubric-list">${rubricItems.map((item)=>`<div class="rubric-row"><div class="rubric-info"><strong>${item.label}</strong><small>${item.desc}</small></div><select class="control rubric-input" data-rubric-key="${item.id}">${options.map(([value,label])=>option(value,label,review.rubric[item.id]||'')).join('')}</select></div>`).join('')}</div><div class="drawer-actions review-save-actions"><button class="btn primary" id="save-rubric-review">保存评价</button></div>`;
    showDrawer('课堂评价表',body);
    enhanceSelects();
    portal.querySelector('#save-rubric-review').addEventListener('click',()=>{portal.querySelectorAll('.rubric-input').forEach((el)=>{review.rubric[el.dataset.rubricKey]=el.value;});review.updatedAt=seed.DEMO_NOW;review.updatedBy=ui.role==='school'?'林静':'宋倩';saveDB();renderApp();toast('课堂评价已保存');});
  }

  function saveAnalysisResult(source,draft,anomaly,message) {
    const current=clue(source.id);
    current.anomalies=clone(draft.anomalies);
    current.revision+=1;
    current.lastUpdatedAt=seed.DEMO_NOW;
    current.lastUpdatedBy=ui.role==='school'?'林静':'宋倩';
    ui.clueDrafts[source.id]=clone(current);
    ui.clueDrafts[source.id]._baseRevision=current.revision;
    delete ui.anomalyEditor[`${draft.id}:${anomaly.id}`];
    saveDB();
    toast(message||'分析结果已保存');
    renderApp();
  }

  function taskListPage() {
    const f=ui.taskFilters;
    const schoolIds=ui.role==='school'?[ui.schoolId]:(f.schoolId!=='all'?[f.schoolId]:db.schools.map((s)=>s.id));
    let items=db.tasks.filter((t)=>schoolIds.includes(session(t.sessionId).schoolId));
    items=items.filter((t)=>{
      const ss=session(t.sessionId);
      return (f.roomId==='all'||ss.roomId===f.roomId)&&(f.status==='all'||t.status===f.status);
    }).sort((a,b)=>new Date(session(b.sessionId).startAt)-new Date(session(a.sessionId).startAt));
    const total=items.length; const pages=Math.max(1,Math.ceil(total/ui.taskPageSize)); if(ui.taskPage>pages)ui.taskPage=pages;
    const pageItems=items.slice((ui.taskPage-1)*ui.taskPageSize,ui.taskPage*ui.taskPageSize);
    const availableRooms=db.rooms.filter((r)=>schoolIds.includes(r.schoolId));
    const html=`<section class="page-body"><div class="page-header"><div><h1 class="page-title">分析任务</h1></div></div>
      <div class="filter-bar">${ui.role==='region'?`<select class="control task-filter" data-key="schoolId">${option('all','全部学校',f.schoolId)}${db.schools.map((s)=>option(s.id,s.name,f.schoolId)).join('')}</select>`:''}<select class="control task-filter" data-key="roomId">${option('all','全部教室',f.roomId)}${availableRooms.map((r)=>option(r.id,r.name,f.roomId)).join('')}</select><select class="control task-filter" data-key="status">${option('all','全部任务状态',f.status)}${Object.entries(db.statusLabels).map(([id,label])=>option(id,label,f.status)).join('')}</select><button class="btn" id="task-reset">重置</button></div>
      ${pageItems.length?`<div class="table-wrap"><table><thead><tr><th>课堂时间</th><th>${ui.role==='region'?'学校/教室':'教室'}</th><th>教师/班级</th><th>视频</th><th>任务状态</th><th>疑似线索</th><th>失败摘要</th><th>操作</th></tr></thead><tbody>${pageItems.map((t)=>taskRow(t)).join('')}</tbody></table></div>`:'<div class="card empty-state"><div class="empty-icon">□</div><div>当前筛选条件下暂无分析任务</div></div>'}
      <div class="pagination"><span class="result-count">共 ${total} 条</span><button class="page-btn" aria-label="上一页" title="上一页" data-task-page="${ui.taskPage-1}" ${ui.taskPage===1?'disabled':''}>‹</button>${Array.from({length:pages},(_,i)=>`<button class="page-btn ${ui.taskPage===i+1?'active':''}" aria-label="第 ${i+1} 页" ${ui.taskPage===i+1?'aria-current="page"':''} data-task-page="${i+1}">${i+1}</button>`).join('')}<button class="page-btn" aria-label="下一页" title="下一页" data-task-page="${ui.taskPage+1}" ${ui.taskPage===pages?'disabled':''}>›</button></div>
    </section>`;
    return {html,setup:()=>{
      document.querySelectorAll('.task-filter').forEach((el)=>el.addEventListener('change',()=>{ui.taskFilters[el.dataset.key]=el.value;ui.taskPage=1;if(el.dataset.key==='schoolId')ui.taskFilters.roomId='all';renderApp();}));
      document.getElementById('task-reset').addEventListener('click',()=>{ui.taskFilters={schoolId:'all',roomId:'all',status:'all'};ui.taskPage=1;renderApp();});
      document.querySelectorAll('[data-task-detail]').forEach((el)=>el.addEventListener('click',()=>showTaskDetail(task(el.dataset.taskDetail))));
      document.querySelectorAll('[data-task-page]').forEach((el)=>el.addEventListener('click',()=>{const p=Number(el.dataset.taskPage);if(p>=1&&p<=pages){ui.taskPage=p;renderApp();}}));
    }};
  }

  function taskRow(t) {
    const ss=session(t.sessionId); const related=db.clues.filter((c)=>c.taskId===t.id); const failure=t.failures[0]?.reason||'—';
    const schoolRoom=ui.role==='region'?`${school(ss.schoolId).name} / ${room(ss.roomId).name}`:room(ss.roomId).name;
    return `<tr><td title="${fmtDate(ss.startAt)}">${fmtDate(ss.startAt)}</td><td title="${escapeHtml(schoolRoom)}">${escapeHtml(schoolRoom)}</td><td title="${escapeHtml(`${person(ss.teacherId).name} / ${klass(ss.classId).name}`)}">${escapeHtml(`${person(ss.teacherId).name} / ${klass(ss.classId).name}`)}</td><td>${t.videoStatus==='deleted'?tag(['已删除','red']):t.videoStatus==='waiting'?tag(['等待视频','gray']):tag(['视频已到达','green'])}</td><td title="${escapeHtml(t.failures.map((x)=>x.reason).join('；'))}">${tag(taskStatusMeta[t.status])}</td><td>${related.length} 条</td><td title="${escapeHtml(failure)}">${escapeHtml(failure)}</td><td><button class="text-link" data-task-detail="${t.id}">查看详情</button></td></tr>`;
  }

  function showTaskDetail(t) {
    const ss=session(t.sessionId); const related=db.clues.filter((c)=>c.taskId===t.id);
    const resultTypes=db.anomalyTypes.map((tp)=>{
      const failed=t.failures.find((f)=>f.typeId===tp.id||f.typeId==='all');
      return `<div class="result-block ${failed?'error':''}"><div style="display:flex;justify-content:space-between"><strong>${escapeHtml(tp.label)}</strong>${failed?tag(['分析失败','red']):tag([related.some((c)=>c.anomalies.some((a)=>a.typeId===tp.id))?'发现线索':'无异常',related.some((c)=>c.anomalies.some((a)=>a.typeId===tp.id))?'orange':'green'])}</div>${failed?`<div class="danger-text" style="margin-top:6px">${escapeHtml(failed.reason)}</div>`:'<div class="muted" style="margin-top:6px">已按本次规则快照完成分析</div>'}</div>`;
    }).join('');
    const body=`<dl class="detail-list">${ui.role==='region'?`<dt>学校</dt><dd>${escapeHtml(school(ss.schoolId).name)}</dd>`:''}<dt>课堂</dt><dd>${fmtDate(ss.startAt)} · ${escapeHtml(ss.subject)}</dd><dt>教师 / 班级</dt><dd>${escapeHtml(person(ss.teacherId).name)} / ${escapeHtml(klass(ss.classId).name)}</dd><dt>教室</dt><dd>${escapeHtml(room(ss.roomId).name)}</dd><dt>视频状态</dt><dd>${t.videoStatus==='deleted'?'视频已删除':t.videoStatus==='waiting'?'等待视频':'视频已到达'}</dd><dt>任务状态</dt><dd>${tag(taskStatusMeta[t.status])}</dd><dt>规则快照</dt><dd>${escapeHtml(t.ruleSnapshot.version)} · ${fmtDate(t.ruleSnapshot.capturedAt)}</dd></dl><h3 style="margin-top:24px;color:var(--title)">异常类型分析结果</h3>${resultTypes}${related.length?`<button class="btn primary" id="drawer-view-clue" style="margin-top:16px">查看分析结果（${related.length}）</button>`:''}<div class="muted" style="margin-top:12px">当前不支持自动重试或手动重新分析。</div>`;
    showDrawer('分析任务详情',body);
    const view=portal.querySelector('#drawer-view-clue'); if(view)view.addEventListener('click',()=>{portal.innerHTML='';navigate(`clues/${related[0].id}`);});
  }

  function defaultRecipientLabel(value) {
    if (value === 'role:teacher') return '任课教师';
    if (value === 'role:homeroom') return '班主任';
    if (value === 'role:principal') return '校长/副校长';
    if (value === 'role:director') return '教导主任';
    if (value === 'role:research_lead') return '教研组长';
    return value;
  }

  function showDefaultNotifyEditor(kind, schoolId, draft) {
    const title = kind === 'notifyTeacher' ? '教师课堂行为默认通知' : '学生行为默认通知';
    const options = kind === 'notifyTeacher'
      ? [
          { id:'role:teacher', label:'任课教师', desc:'按课堂自动匹配' },
          { id:'role:principal', label:'校长/副校长', desc:'按学校岗位匹配' },
          { id:'role:director', label:'教导主任', desc:'按学校岗位匹配' },
          { id:'role:research_lead', label:'教研组长', desc:'按学校岗位匹配' }
        ]
      : [
          { id:'role:homeroom', label:'班主任', desc:'按班级自动匹配' },
          { id:'role:principal', label:'校长/副校长', desc:'按学校岗位匹配' },
          { id:'role:director', label:'教导主任', desc:'按学校岗位匹配' },
          { id:'role:research_lead', label:'教研组长', desc:'按学校岗位匹配' }
        ];
    const selected = draft[kind] || [];
    const body = `<div class="notify-editor-note">选择默认接收角色。系统将在课堂分析结果生成后，按课堂归属和学校岗位匹配具体接收人；管理员仍可在调整分析结果时单独设置接收人。</div><div class="notify-editor-list">${options.map((item)=>`<label><input type="checkbox" class="default-notify-input" value="${item.id}" ${selected.includes(item.id)?'checked':''}/> <span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.desc)}</small></label>`).join('')}</div><div class="drawer-actions"><button class="btn primary" id="save-default-notify">保存</button></div>`;
    showDrawer(title, body);
    portal.querySelector('#save-default-notify').addEventListener('click', () => {
      draft[kind] = Array.from(portal.querySelectorAll('.default-notify-input:checked')).map((item) => item.value);
      portal.innerHTML = '';
      renderApp();
      toast('默认通知角色已更新，请保存巡课规则');
    });
  }

  function showRuleCriteriaEditor(typeId, schoolId, draft, readOnly) {
    const anomalyType = type(typeId);
    if (!anomalyType) return;
    const values = ruleCriteriaValues(anomalyType, draft);
    const criteria = anomalyType.criteria || [];
    const profile = `<section class="metric-profile-card"><h3>指标定义与适用前提</h3><dl><dt>适用场景</dt><dd>${escapeHtml(anomalyType.applicableScene || anomalyScene(anomalyType.id))}</dd><dt>分析来源</dt><dd>${escapeHtml(anomalyType.signalSource || '课堂音视频')}</dd><dt>观测窗口</dt><dd>${escapeHtml(anomalyType.observationWindow || '整节课堂')}</dd><dt>聚合方式</dt><dd>${escapeHtml(anomalyType.aggregation || '按学校规则汇总')}</dd><dt>无结论条件</dt><dd>${escapeHtml(anomalyType.unavailablePolicy || '分析所需数据不足时不输出结论')}</dd><dt>证据要求</dt><dd>${escapeHtml(anomalyType.evidenceRequirement || '保留必要时间点和来源片段')}</dd><dt>可信度规则</dt><dd>${escapeHtml(anomalyType.confidencePolicy || '达到算法门槛后再与规则比较')}</dd></dl>${anomalyType.governanceNote ? `<div class="metric-governance-note"><strong>使用注意</strong><span>${escapeHtml(anomalyType.governanceNote)}</span></div>` : ''}</section>`;
    const body = `<div class="rule-criteria-intro"><strong>${escapeHtml(anomalyType.label)}</strong><span>${escapeHtml(anomalyType.ruleLabel)}</span><small>每个观测条件独立判断，任一条件达到设定值即生成对应异常项。</small></div>${profile}<div class="rule-criteria-editor-list">${criteria.map((criterion) => `<div class="rule-criterion-card"><div class="rule-criterion-copy"><strong>${escapeHtml(criterion.label)}</strong><span>${escapeHtml(criterion.help)}</span></div><div class="rule-criterion-input"><span>${escapeHtml(criterion.operatorLabel)}</span><input class="control rule-criterion-value" type="number" data-criterion="${criterion.id}" value="${values[criterion.id]}" min="${criterion.min ?? 0}" max="${criterion.max ?? 9999}" step="${criterion.step ?? 1}" ${readOnly ? 'disabled' : ''}/><em>${escapeHtml(criterion.unit)}</em></div></div>`).join('')}</div>${readOnly ? '<div class="drawer-actions"><button class="btn" data-drawer-close-action>关闭</button></div>' : '<div class="drawer-actions"><button class="btn" data-drawer-close-action>取消</button><button class="btn primary" id="save-rule-criteria">保存设置</button></div>'}`;
    showDrawer(`${anomalyType.label}判定设置`, body);
    portal.querySelectorAll('[data-drawer-close-action]').forEach((el) => el.addEventListener('click', closePortal));
    if (readOnly) return;
    portal.querySelector('#save-rule-criteria').addEventListener('click', () => {
      const nextValues = {};
      let invalid = null;
      criteria.forEach((criterion) => {
        const input = portal.querySelector(`[data-criterion="${criterion.id}"]`);
        const value = Number(input?.value);
        if (!Number.isFinite(value) || value < (criterion.min ?? 0) || value > (criterion.max ?? 9999)) invalid = criterion;
        nextValues[criterion.id] = value;
      });
      if (invalid) { toast(`${invalid.label}请输入 ${invalid.min}–${invalid.max}${invalid.unit}之间的数值`, 'error'); return; }
      if (!draft.criteria) draft.criteria = {};
      draft.criteria[anomalyType.id] = nextValues;
      draft.thresholds[anomalyType.id] = nextValues[criteria[0]?.id] ?? null;
      closePortal();
      renderApp();
      toast(`${anomalyType.label}判定设置已更新，请保存巡课规则`);
    });
  }

  function rulesPage() {
    const viewSchoolId=ui.role==='school'?ui.schoolId:(ui.ruleSchoolId||'s1');
    if(!ui.ruleDrafts[viewSchoolId])ui.ruleDrafts[viewSchoolId]=clone(db.rules[viewSchoolId]);
    const draft=ui.ruleDrafts[viewSchoolId]; const readOnly=ui.role==='region';
    const hasChanges=!readOnly&&JSON.stringify(draft)!==JSON.stringify(db.rules[viewSchoolId]);
    const groups=['teacher','student'];
    const notificationRow=(kind,title,desc)=>{const recipients=draft[kind]||[]; return `<div class="notify-config-row"><div><div class="rule-name">${title}</div><div class="rule-desc">${desc}</div></div><div class="notify-recipient-list">${recipients.length?recipients.map((value)=>tag([defaultRecipientLabel(value),'blue'])).join(''):'<span class="muted">未设置默认接收人</span>'}</div>${readOnly?'':`<button class="btn small" data-edit-notify="${kind}">${recipients.length?'编辑':'设置'}</button>`}</div>`;};
    const html=`<section class="page-body"><div class="page-header"><div><div class="rule-title-row"><h1 class="page-title">巡课规则</h1>${readOnly?'':`<span id="rule-dirty-status" class="rule-dirty-status${hasChanges?' is-dirty':''}" aria-live="polite">${hasChanges?'有未保存修改':'当前规则已保存'}</span>`}</div></div>${ui.role==='region'?'<div class="page-actions"><span class="tag orange">区域管理员只读</span></div>':''}</div>
      ${ui.role==='region'?`<div class="filter-bar"><select class="control" id="rule-school">${db.schools.map((s)=>option(s.id,s.name,viewSchoolId)).join('')}</select><div class="read-only-banner" style="margin:0">区域管理员可以查看学校规则，但不能编辑或下发统一规则。</div></div>`:''}
      <div class="rule-version-panel"><div><span>当前学校</span><strong>${escapeHtml(school(viewSchoolId)?.name || '—')}</strong></div><div><span>生效版本</span><strong>${escapeHtml(draft.version || '—')}</strong></div><div><span>最近生效</span><strong>${fmtDate(draft.effectiveFrom || draft.updatedAt)}</strong></div><div><span>操作人</span><strong>${escapeHtml(draft.updatedBy || '系统管理员')}</strong></div><p>本版本仅适用于生效后新开始的课堂；已经开始的课堂继续使用任务创建时锁定的规则快照。</p></div>
      <div class="rule-layout${readOnly?' read-only':''}"><nav class="rule-nav"><a data-scroll="rule-teacher">教师课堂行为</a><a data-scroll="rule-student">学生行为</a><a data-scroll="rule-repeat">重复问题</a><a data-scroll="rule-notify">默认通知</a></nav><div>
        ${groups.map((group)=>ruleTypeSection(group,draft,readOnly)).join('')}
        <section class="card rule-section" id="rule-repeat"><div class="card-header"><div><div class="card-title">教师重复问题</div><div class="muted">按指标分别配置；学生问题不参与重复判断</div></div></div><div class="card-body">${db.anomalyTypes.filter((t)=>t.category==='teacher').map((t)=>{const v=draft.repeat[t.id]||{days:30,times:3};return `<div class="rule-repeat-row"><div class="rule-name">${escapeHtml(t.label)}</div><div class="repeat-config"><label><input class="control rule-repeat-days" data-type="${t.id}" type="number" min="1" value="${v.days}" ${readOnly?'disabled':''}/><span>天内</span></label><label><input class="control rule-repeat-times" data-type="${t.id}" type="number" min="2" value="${v.times}" ${readOnly?'disabled':''}/><span>次</span></label></div></div>`;}).join('')}</div></section>
        <section class="card rule-section" id="rule-notify"><div class="card-header"><div><div class="card-title">默认通知</div><div class="muted">未设置默认接收人时，管理员可按具体情况选择通知对象</div></div></div><div class="card-body">${notificationRow('notifyTeacher','教师课堂行为','适用于教师课堂行为问题')}${notificationRow('notifyStudent','学生行为','适用于学生课堂和课间行为问题')}<div class="notify-config-row video-permission"><div><div class="rule-name">整节课视频权限</div><div class="rule-desc">未授权时，通知接收者仍可查看管理员保留的必要证据</div></div><label><input id="allow-full-video" class="switch" type="checkbox" ${draft.allowFullVideo?'checked':''} ${readOnly?'disabled':''}/> 允许查看</label></div></div></section>
        ${readOnly?'':`<div class="rule-footer"><button class="btn" id="discard-rules" ${hasChanges?'':'disabled'}>恢复当前规则</button><button class="btn primary" id="save-rules" ${hasChanges?'':'disabled'}>保存巡课规则</button></div>`}
      </div></div>
    </section>`;
    return {html,setup:()=>bindRules(viewSchoolId,draft,readOnly)};
  }

  function ruleTypeSection(group,draft,readOnly) {
    const groupMeta=db.categoryGroups[group];
    const ruleRow=(t)=>{const enabled=Boolean(draft.enabledTypes[t.id]);return `<div class="rule-row${enabled?'':' is-disabled'}"><div><div class="rule-name">${escapeHtml(t.label)}</div><div class="rule-desc">${escapeHtml(t.ruleLabel||'达到判定条件后生成异常项')}</div><small class="rule-profile-line">${escapeHtml(`${t.applicableScene || anomalyScene(t.id)} · ${t.signalSource || '课堂音视频'}`)}</small></div><div class="rule-definition-summary"><span>当前定义</span><strong>${escapeHtml(ruleCriteriaSummary(t,draft))}</strong></div><label><input class="switch rule-type" type="checkbox" value="${t.id}" ${enabled?'checked':''} ${readOnly?'disabled':''}/> ${enabled?'已启用':'已停用'}</label><button class="btn small rule-setting-button" data-edit-rule-criteria="${t.id}">${readOnly?'查看定义':'设置'}</button></div>`;};
    const sceneGroups = `<div class="rule-scene-group">${groupMeta.categoryIds.flatMap((category) => db.anomalyTypes.filter((t) => t.category === category)).map(ruleRow).join('')}</div>`;
    return `<section class="card rule-section" id="rule-${group}"><div class="card-header"><div><div class="card-title">${escapeHtml(groupMeta.label)}</div></div></div><div class="card-body">${sceneGroups}</div></section>`;
  }

  function bindRules(schoolId,draft,readOnly) {
    const schoolSelect=document.getElementById('rule-school'); if(schoolSelect)schoolSelect.addEventListener('change',()=>{ui.ruleSchoolId=schoolSelect.value;renderApp();});
    document.querySelectorAll('[data-scroll]').forEach((el)=>el.addEventListener('click',()=>document.getElementById(el.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'})));
    document.querySelectorAll('[data-edit-rule-criteria]').forEach((el)=>el.addEventListener('click',()=>showRuleCriteriaEditor(el.dataset.editRuleCriteria,schoolId,draft,readOnly)));
    if(readOnly)return;
    const updateDirty=()=>updateRuleDirtyStatus(schoolId,draft);
    document.querySelectorAll('.rule-type').forEach((el)=>el.addEventListener('change',()=>{draft.enabledTypes[el.value]=el.checked;renderApp();}));
    document.querySelectorAll('.rule-repeat-days').forEach((el)=>el.addEventListener('input',()=>{draft.repeat[el.dataset.type].days=Number(el.value);updateDirty();}));
    document.querySelectorAll('.rule-repeat-times').forEach((el)=>el.addEventListener('input',()=>{draft.repeat[el.dataset.type].times=Number(el.value);updateDirty();}));
    document.querySelectorAll('[data-edit-notify]').forEach((el)=>el.addEventListener('click',()=>showDefaultNotifyEditor(el.dataset.editNotify, schoolId, draft)));
    document.getElementById('allow-full-video').addEventListener('change',(e)=>{draft.allowFullVideo=e.target.checked;updateDirty();});
    document.getElementById('discard-rules').addEventListener('click',()=>{ui.ruleDrafts[schoolId]=clone(db.rules[schoolId]);renderApp();toast('已恢复为当前生效规则');});
    document.getElementById('save-rules').addEventListener('click',()=>{if(JSON.stringify(draft)===JSON.stringify(db.rules[schoolId])){toast('当前没有待保存修改');return;}const summary=describeRuleChanges(db.rules[schoolId],draft);showModal({title:'保存巡课规则',body:`<div class="rule-save-summary"><strong>本次变更</strong><ul>${summary.map((item)=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></div><div class="warning-box">规则保存后，仅对之后新开始的课堂生效；进行中的课堂仍使用开始时的旧规则。</div>`,confirmText:'确认保存并生效',onConfirm:()=>{const match=String(draft.version).match(/\d+/);const currentNo=match?Number(match[0]):1;draft.version=`R${currentNo + 1}.0`;draft.updatedAt=seed.DEMO_NOW;draft.effectiveFrom=seed.DEMO_NOW;draft.updatedBy=ui.role==='school'?'林静':'宋倩';db.rules[schoolId]=clone(draft);saveDB();toast(`巡课规则 ${draft.version} 已生效`);renderApp();}});});
  }

  function describeRuleChanges(current, draft) {
    const items = [];
    const toggled = db.anomalyTypes.filter((item) => Boolean(current.enabledTypes[item.id]) !== Boolean(draft.enabledTypes[item.id])).length;
    const criteriaChanged = db.anomalyTypes.filter((item) => JSON.stringify(current.criteria?.[item.id] || {}) !== JSON.stringify(draft.criteria?.[item.id] || {})).length;
    const repeatChanged = db.anomalyTypes.filter((item) => item.category === 'teacher' && JSON.stringify(current.repeat?.[item.id] || {}) !== JSON.stringify(draft.repeat?.[item.id] || {})).length;
    if (toggled) items.push(`调整 ${toggled} 项指标的启停状态`);
    if (criteriaChanged) items.push(`修改 ${criteriaChanged} 项指标的判定定义`);
    if (repeatChanged) items.push(`修改 ${repeatChanged} 项教师重复问题规则`);
    if (JSON.stringify(current.notifyTeacher || []) !== JSON.stringify(draft.notifyTeacher || []) || JSON.stringify(current.notifyStudent || []) !== JSON.stringify(draft.notifyStudent || [])) items.push('更新默认通知角色');
    if (current.allowFullVideo !== draft.allowFullVideo) items.push(`整节课视频权限改为${draft.allowFullVideo ? '允许查看' : '不允许查看'}`);
    return items.length ? items : ['更新巡课规则配置'];
  }

  function updateRuleDirtyStatus(schoolId,draft) {
    const dirty=JSON.stringify(draft)!==JSON.stringify(db.rules[schoolId]);
    const status=document.getElementById('rule-dirty-status');
    const save=document.getElementById('save-rules');
    const discard=document.getElementById('discard-rules');
    if(status){status.textContent=dirty?'有未保存修改':'当前规则已保存';status.classList.toggle('is-dirty',dirty);}
    if(save)save.disabled=!dirty;
    if(discard)discard.disabled=!dirty;
  }

  function messageListPage() {
    const schoolIds=ui.role==='school'?[ui.schoolId]:db.schools.map((s)=>s.id);
    let items=db.notifications.filter((n)=>schoolIds.includes(n.schoolId));
    if(ui.messageKind!=='all')items=items.filter((n)=>n.kind===ui.messageKind);
    items.sort((a,b)=>new Date(b.sentAt)-new Date(a.sentAt));
    const total=items.length; const pages=Math.max(1,Math.ceil(total/ui.messagePageSize)); if(ui.messagePage>pages)ui.messagePage=pages;
    const pageItems=items.slice((ui.messagePage-1)*ui.messagePageSize,ui.messagePage*ui.messagePageSize);
    const html=`<section class="page-body"><div class="page-header"><div><h1 class="page-title">消息中心</h1></div><div class="page-actions"><span class="tag blue">${db.notifications.filter((n)=>!n.read&&schoolIds.includes(n.schoolId)).length} 条未查看</span></div></div>
      <div class="filter-bar"><select class="control" id="message-kind">${option('all','全部通知类型',ui.messageKind)}${Object.entries(noticeMeta).map(([id,m])=>option(id,m[0],ui.messageKind)).join('')}</select></div>
      ${pageItems.length?`<div class="table-wrap"><table><thead><tr><th style="width:40px"></th><th>通知类型</th><th>标题</th><th>课堂</th><th>接收人</th><th>问题变化</th><th>发送时间</th><th>操作</th></tr></thead><tbody>${pageItems.map((n)=>messageRow(n)).join('')}</tbody></table></div>`:'<div class="card empty-state"><div class="empty-icon">□</div><div>暂无此类通知</div></div>'}
      <div class="pagination"><span class="result-count">共 ${total} 条</span><button class="page-btn" aria-label="上一页" title="上一页" data-message-page="${ui.messagePage-1}" ${ui.messagePage===1?'disabled':''}>‹</button>${Array.from({length:pages},(_,i)=>`<button class="page-btn ${ui.messagePage===i+1?'active':''}" aria-label="第 ${i+1} 页" ${ui.messagePage===i+1?'aria-current="page"':''} data-message-page="${i+1}">${i+1}</button>`).join('')}<button class="page-btn" aria-label="下一页" title="下一页" data-message-page="${ui.messagePage+1}" ${ui.messagePage===pages?'disabled':''}>›</button></div>
    </section>`;
    return {html,setup:()=>{
      document.getElementById('message-kind').addEventListener('change',(e)=>{ui.messageKind=e.target.value;ui.messagePage=1;renderApp();});
      document.querySelectorAll('[data-message-row]').forEach((el)=>el.addEventListener('click',(event)=>{if(!event.target.closest('button'))navigate(`messages/${el.dataset.messageRow}`);}));
      document.querySelectorAll('[data-message-open]').forEach((el)=>el.addEventListener('click',(event)=>{event.stopPropagation();navigate(`messages/${el.dataset.messageOpen}`);}));
      document.querySelectorAll('[data-message-page]').forEach((el)=>el.addEventListener('click',()=>{const p=Number(el.dataset.messagePage);if(p>=1&&p<=pages){ui.messagePage=p;renderApp();}}));
    }};
  }

  function messageRow(n) {
    const ss=session(n.sessionId); const recipient=person(n.recipientId); const delta=n.kind==='formal'?`新增 ${n.after.length} 项`:n.kind==='withdraw'?`撤回 ${n.before.length} 项`:`${n.before.length} → ${n.after.length} 项`;
    return `<tr class="clickable" data-message-row="${n.id}"><td>${n.read?'':'<span class="legend-dot" style="background:var(--theme);display:inline-block"></span>'}</td><td>${tag(noticeMeta[n.kind])}</td><td title="${escapeHtml(n.title)}">${escapeHtml(n.title)}</td><td title="${escapeHtml(`${fmtDate(ss.startAt)} · ${klass(ss.classId).name} · ${ss.subject}`)}">${escapeHtml(`${fmtDate(ss.startAt)} · ${klass(ss.classId).name} · ${ss.subject}`)}</td><td>${escapeHtml(recipient?.name||'—')}</td><td>${escapeHtml(delta)}</td><td>${fmtDate(n.sentAt)}</td><td><button class="text-link" data-message-open="${n.id}">查看详情</button></td></tr>`;
  }

  function resolveAnomaly(clueItem, id) {
    let found=clueItem?.anomalies.find((a)=>a.id===id);
    if(found)return found;
    const versions=(clueItem?.history||[]).slice().reverse();
    for(const version of versions){found=version.snapshot?.find((a)=>a.id===id);if(found)return found;}
    return null;
  }

  function messageDetailPage(id) {
    const notice=byId(db.notifications,id); if(!notice)return notFoundPage('未找到该通知');
    if(ui.role==='school' && notice.schoolId!==ui.schoolId)return noPermissionPage();
    notice.read=true; saveDB();
    const ss=session(notice.sessionId); const c=clue(notice.clueId); const scRule=db.rules[notice.schoolId];
    const beforeItems=(notice.beforeSnapshot||notice.before.map((aid)=>resolveAnomaly(c,aid)).filter(Boolean)); const afterItems=(notice.afterSnapshot||notice.after.map((aid)=>resolveAnomaly(c,aid)).filter(Boolean));
    const issueList=(items)=>items.length?items.map((a)=>`<div class="issue-card"><div class="issue-head"><span class="issue-title">${escapeHtml(type(a.typeId)?.label||'已撤销问题')}</span><span>${fmtClock(a.occurredSecond)}</span></div><div class="muted">问题对象：${a.teacherId?escapeHtml(person(a.teacherId)?.name):a.classId?escapeHtml(klass(a.classId)?.name):escapeHtml(a.position||'画面位置')}</div>${ss.videoDeleted?'<div class="muted" style="margin-top:7px">原视频已删除，对应必要证据不可查看</div>':a.evidence?.length?`<button class="evidence-preview" data-notice-evidence="${escapeHtml(a.id)}">▶ 查看必要证据</button>`:'<div class="muted" style="margin-top:7px">未保留必要证据</div>'}</div>`).join(''):'<div class="empty-state" style="min-height:150px"><div>无保留问题</div></div>';
    const body=notice.kind==='correction'?`<div class="notice-compare"><div class="notice-side before"><strong>修改前</strong><div style="margin-top:10px">${issueList(beforeItems)}</div></div><div class="notice-side after"><strong>修改后</strong><div style="margin-top:10px">${issueList(afterItems)}</div></div></div>`:notice.kind==='withdraw'?`<div class="warning-box">与您相关的课堂巡课问题已撤回。原通知内容仅用于说明变化，不再作为当前有效问题。</div><div style="margin-top:14px">${issueList(beforeItems)}</div>`:issueList(afterItems);
    const html=`<section class="page-body"><div class="detail-top"><button class="back-link" id="back-messages">← 返回消息中心</button><span class="muted">/</span>${tag(noticeMeta[notice.kind])}</div><div class="page-header"><div><h1 class="page-title">${escapeHtml(notice.title)}</h1><div class="page-subtitle">发送给 ${escapeHtml(person(notice.recipientId)?.name||'接收人')} · ${fmtDate(notice.sentAt)}</div></div></div>
      <div class="card"><div class="card-body"><dl class="detail-list"><dt>学校</dt><dd>${escapeHtml(school(notice.schoolId).name)}</dd><dt>课堂时间</dt><dd>${fmtDate(ss.startAt)}</dd><dt>教室</dt><dd>${escapeHtml(room(ss.roomId).name)}</dd><dt>课程</dt><dd>${escapeHtml(ss.subject)}</dd><dt>教师 / 班级</dt><dd>${escapeHtml(person(ss.teacherId).name)} / ${escapeHtml(klass(ss.classId).name)}</dd></dl><hr class="side-divider"/><h3 style="color:var(--title)">${notice.kind==='correction'?'问题变更内容':notice.kind==='withdraw'?'已撤回内容':'与您相关的问题'}</h3>${body}${ss.videoDeleted?'<div class="read-only-banner">原视频及对应必要证据已删除，无法播放；通知和问题记录继续保留。</div>':scRule.allowFullVideo?'<button class="btn" id="open-notice-full-video" style="margin-top:8px">查看整节课视频</button>':'<div class="read-only-banner" style="margin-top:12px">学校未授权查看整节课视频，您仍可查看管理员保留的必要证据。</div>'}</div></div>
    </section>`;
    return {html,setup:()=>{document.getElementById('back-messages').addEventListener('click',()=>navigate('messages'));document.getElementById('open-notice-full-video')?.addEventListener('click',()=>showDrawer('课堂视频',`<div class="full-video-drawer"><video src="./assets/videos/classroom-teacher.mp4" controls playsinline preload="metadata"></video><div class="muted">${escapeHtml(room(ss.roomId).name)} · ${fmtDate(ss.startAt)} · ${escapeHtml(ss.subject)}</div></div>`));document.querySelectorAll('[data-notice-evidence]').forEach((el)=>el.addEventListener('click',()=>{const target=[...beforeItems,...afterItems].find((item)=>item.id===el.dataset.noticeEvidence);const meta=target?anomalyEvidenceMeta(target):{camera:'课堂画面',range:'—'};showDrawer('必要证据',`<div class="full-video-drawer"><video src="./assets/videos/classroom-teacher.mp4" controls playsinline preload="metadata"></video><div class="evidence-context"><strong>${escapeHtml(type(target?.typeId)?.label||'课堂问题')}</strong><span>${escapeHtml(meta.camera)} · ${escapeHtml(meta.range)}</span><small>${target?.confidence?`识别可信度 ${target.confidence}%（演示值） · `:''}${escapeHtml(target?.rationale||'观测结果达到学校当前判定定义')}</small></div></div>`);}));}};
  }

  function qualityPage() {
    const totals={success:db.tasks.filter((t)=>['complete_none','complete_issue'].includes(t.status)).length,partial:db.tasks.filter((t)=>t.status==='partial').length,failed:db.tasks.filter((t)=>t.status==='failed').length};
    const aiFormal=db.clues.flatMap((c)=>c.anomalies).filter((a)=>a.source==='ai'&&a.result==='formal').length;
    const aiFalse=db.clues.flatMap((c)=>c.anomalies).filter((a)=>a.source==='ai'&&a.result==='false').length;
    const html=`<section class="page-body"><div class="page-header"><div><h1 class="page-title">研发质量统计</h1><div class="page-subtitle">内部研发视角，不展示给业务用户</div></div><span class="version-pill">研发人员可见</span></div><div class="metrics">${metricCard('分析成功',totals.success,'节')}${metricCard('部分失败',totals.partial,'节')}${metricCard('分析失败',totals.failed,'节')}${metricCard('AI确认比例',pct(aiFormal,aiFormal+aiFalse),'%')}${metricCard('人工删除',db.clues.flatMap((c)=>c.anomalies).filter((a)=>a.result==='deleted').length,'项')}${metricCard('模型版本',unique(db.tasks.map((t)=>t.modelVersion)).length,'个')}</div><div class="card"><div class="card-header"><div class="card-title">模型版本</div></div><div class="card-body">${unique(db.tasks.map((t)=>t.modelVersion)).map((v)=>`<span class="tag blue">${v}</span>`).join('')}</div></div></section>`;
    return {html,setup:()=>{}};
  }

  function notFoundPage(message) { return {html:`<section class="page-body"><div class="card empty-state"><div class="empty-icon">?</div><div>${escapeHtml(message)}</div><button class="btn primary" id="go-home">返回巡课看板</button></div></section>`,setup:()=>{document.getElementById('go-home').addEventListener('click',()=>navigate('dashboard'));}}; }
  function noPermissionPage() { return {html:'<section class="page-body"><div class="card empty-state"><div class="empty-icon">⊘</div><div>暂无权限查看该内容</div><span class="muted">请切换到有权限的学校范围，或返回分析结果列表。</span><button class="btn primary" id="permission-back">返回分析结果</button></div></section>',setup:()=>{document.getElementById('permission-back')?.addEventListener('click',()=>navigate('clues'));}}; }

  function renderApp() {
    portal.innerHTML='';
    const route=routeInfo(); let result; let active=route.page;
    if(route.page==='dashboard')result=dashboardPage();
    else if(route.page==='clues'&&route.id){result=clueDetailPage(route.id);active='clues';}
    else if(route.page==='clues')result=clueListPage();
    else if(route.page==='tasks')result=notFoundPage('页面不存在');
    else if(route.page==='rules')result=rulesPage();
    else if(route.page==='messages'&&route.id){result=messageDetailPage(route.id);active='messages';}
    else if(route.page==='messages')result=messageListPage();
    else if(route.page==='quality')result=notFoundPage('页面不存在');
    else result=notFoundPage('页面不存在');
    app.innerHTML=shell(result,active); bindGlobal(); result.setup(); enhanceSelects();
  }

  document.addEventListener('click', (event) => {
    closeCustomSelects();
    if (ui.openDatePicker) {
      const dateRangeTarget = event.target instanceof Element ? event.target.closest('.date-range-control') : null;
      if (!dateRangeTarget) {
        ui.openDatePicker = null;
        renderApp();
      }
    }
    const target=event.target instanceof Element ? event.target.closest('[data-detail-action]') : null;
    if(!target) return;
    const route=routeInfo(); if(route.page!=='clues'||!route.id) return;
    const source=clue(route.id); if(!source) return;
    const ss=session(source.sessionId); if(!ss) return;
    if(target.dataset.detailAction==='management') { ui.analysisDrawer[source.id]=true; showAnalysisDrawer(source,getClueDraft(source.id),ss); }
    if(target.dataset.detailAction==='text-review') showTextReviewDrawer(source,ss);
    if(target.dataset.detailAction==='rubric-review') showRubricReviewDrawer(source,ss);
    if(target.dataset.detailAction==='participation') showParticipationDrawer(source,ss);
    if(target.dataset.detailAction==='behavior-insight') showBehaviorInsightDrawer(source,getClueDraft(source.id),ss,target.dataset.behaviorGroup);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.openDatePicker) {
      ui.openDatePicker = null;
      renderApp();
      return;
    }
    if (event.key === 'Escape' && portal.innerHTML) closePortal();
  });
  window.addEventListener('hashchange',renderApp);
  if(!location.hash)location.hash='#/dashboard'; else renderApp();
})();
