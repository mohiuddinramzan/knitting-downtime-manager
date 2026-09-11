(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function dashboard(params, root, ctx) {
    ctx.setChrome({ title: 'Knitting Floor', showNav: true, showBack: false });
    const machines = db.listMachines();
    const running = machines.filter(m => m.status === 'GREEN').length;
    const problem = machines.filter(m => m.status === 'RED').length;
    const maint = machines.filter(m => m.status === 'YELLOW').length;

    root.innerHTML = `
      <div class="summary-row">
        <div class="summary-tile green"><span class="num">${running}</span><span class="lbl">🟢 Running</span></div>
        <div class="summary-tile red"><span class="num">${problem}</span><span class="lbl">🔴 Problem</span></div>
        <div class="summary-tile yellow"><span class="num">${maint}</span><span class="lbl">🟡 Maintenance</span></div>
      </div>
      <div class="section-title">Machines</div>
      <div class="stack" id="machine-cards"></div>
    `;

    const wrap = document.getElementById('machine-cards');
    // Problem + maintenance machines float to the top — that's what needs eyes right now.
    const sorted = [...machines].sort((a, b) => {
      const order = { RED: 0, YELLOW: 1, GREEN: 2 };
      return order[a.status] - order[b.status];
    });
    sorted.forEach(m => wrap.appendChild(renderMachineCard(m)));
  }

  function renderMachineCard(m) {
    const el = document.createElement('button');
    el.className = `card machine-card status-${m.status}`;
    const meta = ui.statusMeta(m.status);
    const record = db.getActiveRecordForMachine(m.id);
    let extra = '';
    if (record && (m.status === 'RED' || m.status === 'YELLOW')) {
      const mins = db.liveDowntimeMinutes(record);
      const loss = db.lossLevel(mins);
      extra = `<div class="mc-detail">${ui.escapeHtml(record.problemType)}</div>
        <div class="mc-detail">Downtime: ${mins} min</div>
        ${loss.label ? `<span class="loss-badge ${loss.level}">${loss.label}</span>` : ''}`;
    } else {
      const assigned = db.getCurrentAssignedOperator(m.id);
      const opName = assigned ? (db.listUsers().find(u => u.id === assigned.operatorId) || {}).name : null;
      extra = `<div class="mc-detail">Operator: ${ui.escapeHtml(opName || '—')}</div>`;
    }
    el.innerHTML = `
      <div class="mc-id">${ui.escapeHtml(m.id)}</div>
      <div class="mc-status">${meta.icon} ${meta.label} <span class="bilingual" style="margin:0;">${meta.bn}</span></div>
      ${extra}
    `;
    el.addEventListener('click', () => { location.hash = `#/machine/${encodeURIComponent(m.id)}`; });
    return el;
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.dashboard = dashboard;
  global.KDM_SCREENS._renderMachineCard = renderMachineCard; // reused by machine-list.js
})(window);
