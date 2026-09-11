(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function machineList(params, root, ctx) {
    ctx.setChrome({ title: 'Machine List', showNav: true, showBack: false });
    const users = db.listUsers();
    const operators = users.filter(u => u.role === 'OPERATOR');

    root.innerHTML = `
      <div class="stack">
        <input id="ml-search" type="text" placeholder="🔍 Search machine (e.g. K-101)" />
        <div class="row">
          <select id="ml-status" class="grow">
            <option value="">All Status</option>
            <option value="GREEN">🟢 Running</option>
            <option value="RED">🔴 Problem</option>
            <option value="YELLOW">🟡 Maintenance</option>
          </select>
          <select id="ml-shift" class="grow">
            <option value="">All Shifts</option>
            ${global.KDM_SHIFTS.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <select id="ml-operator">
          <option value="">All Operators</option>
          ${operators.map(o => `<option value="${o.id}">${ui.escapeHtml(o.name)} (${o.id})</option>`).join('')}
        </select>
      </div>
      <div class="section-title" id="ml-count"></div>
      <div class="stack" id="ml-results"></div>
    `;

    const searchEl = document.getElementById('ml-search');
    const statusEl = document.getElementById('ml-status');
    const shiftEl = document.getElementById('ml-shift');
    const operatorEl = document.getElementById('ml-operator');
    const resultsEl = document.getElementById('ml-results');
    const countEl = document.getElementById('ml-count');

    function applyFilters() {
      const q = searchEl.value.trim().toLowerCase();
      const status = statusEl.value;
      const shift = shiftEl.value;
      const operatorId = operatorEl.value;
      const assignments = db.getAssignments();

      let machines = db.listMachines();
      if (q) machines = machines.filter(m => m.id.toLowerCase().includes(q) || (m.model || '').toLowerCase().includes(q));
      if (status) machines = machines.filter(m => m.status === status);
      if (shift) machines = machines.filter(m => assignments[shift] && assignments[shift][m.id]);
      if (operatorId) machines = machines.filter(m => {
        const cur = db.getCurrentAssignedOperator(m.id);
        return cur && cur.operatorId === operatorId;
      });

      countEl.textContent = `${machines.length} machine${machines.length === 1 ? '' : 's'}`;
      resultsEl.innerHTML = '';
      if (!machines.length) {
        resultsEl.innerHTML = `<div class="card center muted">No machines match your filters.</div>`;
        return;
      }
      machines.forEach(m => resultsEl.appendChild(global.KDM_SCREENS._renderMachineCard(m)));
    }

    [searchEl, statusEl, shiftEl, operatorEl].forEach(el => el.addEventListener('input', applyFilters));
    applyFilters();
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.machineList = machineList;
})(window);
