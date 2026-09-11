(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function reports(params, root, ctx) {
    ctx.setChrome({ title: 'Reports', showNav: true, showBack: false });
    root.innerHTML = `
      <div class="row" style="margin-bottom:12px;">
        <select id="rep-range" class="grow">
          <option value="1">Today</option>
          <option value="7" selected>This Week</option>
          <option value="30">This Month</option>
          <option value="0">All Time</option>
        </select>
      </div>
      <div id="rep-body"></div>
    `;
    const sel = document.getElementById('rep-range');
    function draw() {
      const days = parseInt(sel.value, 10) || 0;
      const data = db.getReportData(days || null);
      const users = db.listUsers();
      const machineName = id => id;
      const categoryLabel = id => {
        const c = db.listCategories().find(c => c.id === id);
        return c ? `${c.icon} ${c.label}` : id;
      };
      document.getElementById('rep-body').innerHTML = `
        <div class="kv-grid">
          <div class="kv"><div class="k">Total Machines</div><div class="v">${data.totalMachines}</div></div>
          <div class="kv"><div class="k">Running</div><div class="v">${data.runningMachines}</div></div>
          <div class="kv"><div class="k">Problem</div><div class="v">${data.problemMachines}</div></div>
          <div class="kv"><div class="k">Maintenance</div><div class="v">${data.maintenanceMachines}</div></div>
          <div class="kv"><div class="k">Total Downtime</div><div class="v">${data.totalDowntime} min</div></div>
          <div class="kv"><div class="k">Number of Problems</div><div class="v">${data.numberOfProblems}</div></div>
          <div class="kv"><div class="k">Average Downtime</div><div class="v">${data.averageDowntime} min</div></div>
        </div>

        <div class="row" style="margin:14px 0;">
          <div class="kv grow" style="text-align:center;"><div class="k">⚠️ 10+ min</div><div class="v">${data.loss10}</div></div>
          <div class="kv grow" style="text-align:center;"><div class="k">🔴 30+ min</div><div class="v">${data.loss30}</div></div>
          <div class="kv grow" style="text-align:center;"><div class="k">🚨 60+ min</div><div class="v">${data.loss60}</div></div>
        </div>

        <div class="section-title">Top Downtime Machines</div>
        <div class="card stack">
          ${data.topMachines.length ? data.topMachines.map(([id, mins], i) =>
            `<div class="row"><div class="grow">${i + 1}. ${ui.escapeHtml(machineName(id))}</div><b>${mins} min</b></div>`
          ).join('') : '<div class="muted">No resolved problems in this range.</div>'}
        </div>

        <div class="section-title">Top Problem Categories</div>
        <div class="card stack">
          ${data.topCategories.length ? data.topCategories.map(([id, mins], i) =>
            `<div class="row"><div class="grow">${i + 1}. ${ui.escapeHtml(categoryLabel(id))}</div><b>${mins} min</b></div>`
          ).join('') : '<div class="muted">No resolved problems in this range.</div>'}
        </div>
      `;
    }
    sel.addEventListener('change', draw);
    draw();
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.reports = reports;
})(window);
