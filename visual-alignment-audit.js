(function () {
  'use strict';

  const tolerance = 1;
  const isVisible = (element) => Boolean(element && element.getClientRects().length);
  const rect = (element) => {
    const value = element.getBoundingClientRect();
    return { top: value.top, right: value.right, bottom: value.bottom, left: value.left, width: value.width, height: value.height };
  };
  const closeEnough = (a, b) => Math.abs(a - b) <= tolerance;

  function auditGroup(selector, failures) {
    document.querySelectorAll(selector).forEach((group, groupIndex) => {
      const children = Array.from(group.children).filter(isVisible);
      if (children.length < 2) return;
      const rows = [];
      children.map(rect).forEach((box, itemIndex) => {
        const row = rows.find((candidate) => closeEnough(candidate[0].box.top, box.top));
        (row || rows[rows.push([]) - 1]).push({ box, itemIndex });
      });
      rows.filter((row) => row.length > 1).forEach((row) => {
        const reference = row[0].box;
        row.slice(1).forEach(({ box, itemIndex }) => {
          if (!closeEnough(reference.bottom, box.bottom)) {
            failures.push({
              code: 'GROUP_EDGE_MISMATCH',
              selector,
              groupIndex,
              itemIndex,
              expected: { top: reference.top, bottom: reference.bottom },
              actual: { top: box.top, bottom: box.bottom }
            });
          }
        });
      });
    });
  }

  function run() {
    const failures = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + tolerance) {
      failures.push({ code: 'PAGE_HORIZONTAL_OVERFLOW', expected: root.clientWidth, actual: root.scrollWidth });
    }

    document.querySelectorAll('.global-nav span, .module-tab').forEach((element, index) => {
      if (!isVisible(element)) return;
      const style = getComputedStyle(element);
      const lineHeight = Number.parseFloat(style.lineHeight) || element.clientHeight;
      const globalNavigationWraps = element.matches('.global-nav span') && element.getBoundingClientRect().height > lineHeight * 1.5;
      if (style.whiteSpace !== 'nowrap' || globalNavigationWraps) {
        failures.push({ code: 'NAV_TEXT_WRAPS', index, text: element.textContent.trim() });
      }
    });

    ['.metrics', '.dashboard-guidance-grid', '.grid-2', '.grid-even'].forEach((selector) => auditGroup(selector, failures));

    document.querySelectorAll('.dashboard-guidance-grid, .grid-2, .grid-even').forEach((group, groupIndex) => {
      const headers = Array.from(group.querySelectorAll(':scope > .card > .card-header')).filter(isVisible).map(rect);
      if (headers.length < 2) return;
      const expected = headers[0].height;
      headers.slice(1).forEach((header, index) => {
        if (!closeEnough(expected, header.height)) {
          failures.push({ code: 'CARD_HEADER_HEIGHT_MISMATCH', groupIndex, itemIndex: index + 1, expected, actual: header.height });
        }
      });
    });

    const dashboardColumnGroups = ['.dashboard-guidance-grid', '.grid-2', '.grid-even']
      .map((selector) => ({ selector, element: document.querySelector(selector) }))
      .filter(({ element }) => isVisible(element))
      .map(({ selector, element }) => ({ selector, cards: Array.from(element.children).filter(isVisible).map(rect) }))
      .filter(({ cards }) => cards.length === 2);
    if (dashboardColumnGroups.length > 1) {
      const reference = dashboardColumnGroups[0];
      dashboardColumnGroups.slice(1).forEach((group) => {
        const splitMismatch = !closeEnough(reference.cards[0].right, group.cards[0].right)
          || !closeEnough(reference.cards[1].left, group.cards[1].left);
        if (splitMismatch) {
          failures.push({
            code: 'DASHBOARD_COLUMN_GUIDE_MISMATCH',
            selector: group.selector,
            expected: { firstRight: reference.cards[0].right, secondLeft: reference.cards[1].left },
            actual: { firstRight: group.cards[0].right, secondLeft: group.cards[1].left }
          });
        }
      });
    }

    return {
      passed: failures.length === 0,
      route: location.hash || '#/dashboard',
      viewport: { width: innerWidth, height: innerHeight },
      checkedAt: new Date().toISOString(),
      failures
    };
  }

  function schedule() {
    window.setTimeout(() => {
      const result = run();
      window.__AIPC_LAST_VISUAL_AUDIT__ = result;
      if (!result.passed) console.warn('AI 巡课视觉对齐审计未通过', result.failures);
    }, 0);
  }

  window.AIPCVisualAudit = Object.freeze({ run });
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  window.addEventListener('hashchange', schedule);
}());
