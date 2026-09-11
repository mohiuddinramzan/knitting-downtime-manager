(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function resolve(params, root, ctx) {
    const machine = db.getMachine(params.id);
    ctx.setChrome({ title: 'Resolve Problem', showNav: false, showBack: true });
    if (!machine) { root.innerHTML = `<div class="alert-box error">Machine not found.</div>`; return; }
    if (machine.status !== 'YELLOW') {
      root.innerHTML = `<div class="alert-box error"><div class="alert-title">Not Available</div>This machine is not in Work In Progress state.</div>`;
      return;
    }
    const record = db.getActiveRecordForMachine(machine.id);
    if (!record) { root.innerHTML = `<div class="alert-box error">No active problem found.</div>`; return; }

    let selectedResolution = null;
    const currentMinutes = db.liveDowntimeMinutes(record);

    root.innerHTML = `
      <div class="card">
        <div class="kv-grid" style="margin:0;">
          <div class="kv"><div class="k">Problem</div><div class="v">${ui.escapeHtml(record.problemType)}</div></div>
          <div class="kv"><div class="k">Reported</div><div class="v">${ui.fmtTime(record.reportedAt)}</div></div>
          <div class="kv"><div class="k">Work Started</div><div class="v">${ui.fmtTime(record.workStartedAt)}</div></div>
          <div class="kv"><div class="k">Current Time</div><div class="v" id="now-time">${ui.fmtTime(new Date().toISOString())}</div></div>
        </div>
        <div class="loss-badge ${db.lossLevel(currentMinutes).level}" style="margin-top:10px;" id="total-downtime">
          Total Downtime: ${currentMinutes} minutes
        </div>
      </div>

      <div class="section-title">Resolution</div>
      <div class="problem-grid" id="res-grid"></div>

      <div class="field" style="margin-top:16px;">
        <label>Note (optional)</label>
        <textarea id="res-note" rows="3" placeholder="Any extra detail..."></textarea>
      </div>

      <button class="btn btn-green btn-lg" id="confirm-resolution" disabled>CONFIRM RESOLUTION</button>
    `;

    const grid = document.getElementById('res-grid');
    global.KDM_RESOLUTIONS.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'tile-btn';
      btn.textContent = r;
      btn.addEventListener('click', () => {
        selectedResolution = r;
        [...grid.children].forEach(c => c.style.borderColor = '');
        btn.style.borderColor = 'var(--accent)';
        document.getElementById('confirm-resolution').disabled = false;
      });
      grid.appendChild(btn);
    });

    document.getElementById('confirm-resolution').addEventListener('click', () => {
      if (!selectedResolution) return;
      const note = document.getElementById('res-note').value.trim();
      ui.confirmDialog({
        title: 'Problem solved?',
        body: `${machine.id} — ${selectedResolution}`,
        confirmLabel: 'YES, CONFIRM',
        confirmClass: 'btn-green',
        onConfirm: () => {
          const user = db.getCurrentUser();
          try {
            const rec = db.resolveProblem(user, machine.id, selectedResolution, note);
            ui.toast(`Resolved. Total downtime: ${rec.downtimeMinutes} min.`);
            ctx.navigate(`#/machine/${encodeURIComponent(machine.id)}`);
          } catch (e) { ui.toast(ui.friendlyError(e)); }
        }
      });
    });
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.resolve = resolve;
})(window);
