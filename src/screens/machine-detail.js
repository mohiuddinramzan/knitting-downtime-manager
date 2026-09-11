(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function machineDetail(params, root, ctx) {
    const machine = db.getMachine(params.id);
    ctx.setChrome({ title: params.id, showNav: true, showBack: true });
    if (!machine) {
      root.innerHTML = `<div class="alert-box error"><div class="alert-title">Machine Not Found</div>${params.id}</div>`;
      return;
    }

    const user = db.getCurrentUser();
    const meta = ui.statusMeta(machine.status);
    const record = db.getActiveRecordForMachine(machine.id);
    const assigned = db.getCurrentAssignedOperator(machine.id);
    const opUser = assigned ? db.listUsers().find(u => u.id === assigned.operatorId) : null;

    // Authorization is re-checked for real when a button is pressed (db.js),
    // but we also pre-check here just to decide whether to show the button
    // vs. a "Not Authorized" message — this is a UX convenience, not the
    // security boundary itself.
    let authorized = true;
    let authMessage = '';
    if (user.role === 'OPERATOR') {
      authorized = assigned && assigned.operatorId === user.id;
      if (!authorized) authMessage = 'This machine is assigned to another operator.';
    } else if (user.role === 'TECHNICIAN' && machine.status === 'GREEN') {
      authorized = false; // nothing for a technician to do on a running machine
    }

    root.innerHTML = `
      <div class="big-status status-${machine.status}">
        <div class="icon">${meta.icon}</div>
        <div class="label">${meta.label}</div>
        <div class="bilingual">${meta.bn}</div>
      </div>

      <div class="kv-grid">
        <div class="kv"><div class="k">Operator</div><div class="v">${ui.escapeHtml(opUser ? opUser.name : '—')}</div></div>
        <div class="kv"><div class="k">Shift</div><div class="v">${ui.escapeHtml(assigned ? assigned.shift : '—')}</div></div>
        <div class="kv"><div class="k">Machine Model</div><div class="v">${ui.escapeHtml(machine.model || '—')}</div></div>
        <div class="kv"><div class="k">Current Order</div><div class="v">${ui.escapeHtml(machine.order || '—')}</div></div>
      </div>

      <div id="problem-block"></div>
      <div id="action-block" class="stack" style="margin-top:16px;"></div>
    `;

    // ----- Problem info block (RED / YELLOW) -----
    const problemBlock = document.getElementById('problem-block');
    if (record && (machine.status === 'RED' || machine.status === 'YELLOW')) {
      const mins = db.liveDowntimeMinutes(record);
      const loss = db.lossLevel(mins);
      problemBlock.innerHTML = `
        <div class="card">
          <div class="kv-grid" style="margin:0;">
            <div class="kv"><div class="k">Problem</div><div class="v">${ui.escapeHtml(record.problemType)}</div></div>
            <div class="kv"><div class="k">Reported By</div><div class="v">${ui.escapeHtml(record.reportedBy)}</div></div>
            <div class="kv"><div class="k">Reported At</div><div class="v">${ui.fmtTime(record.reportedAt)}</div></div>
            ${record.workStartedAt ? `<div class="kv"><div class="k">Work Started</div><div class="v">${ui.fmtTime(record.workStartedAt)}</div></div>` : ''}
            <div class="kv"><div class="k">Downtime</div><div class="v">${mins} min</div></div>
          </div>
          ${loss.label ? `<div class="loss-badge ${loss.level}" style="margin-top:10px;">${loss.label}</div>` : ''}
        </div>
      `;
    }

    // ----- Action block -----
    const actionBlock = document.getElementById('action-block');

    if (!authorized) {
      actionBlock.innerHTML = `
        <div class="alert-box error">
          <div class="alert-title">Not Authorized</div>
          <div>${ui.escapeHtml(authMessage || 'You cannot perform actions on this machine.')}</div>
        </div>
        ${authMessage ? `<button class="btn btn-outline" id="req-access">Request Supervisor Access</button>` : ''}
      `;
      const reqBtn = document.getElementById('req-access');
      if (reqBtn) reqBtn.addEventListener('click', () => {
        db.logAudit(user, machine.id, 'ACCESS_REQUESTED', `${user.id} requested access to ${machine.id}`);
        ui.toast('Request sent to supervisor.');
      });
      return;
    }

    if (machine.status === 'GREEN') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-red btn-lg';
      btn.innerHTML = '🔴 REPORT PROBLEM <span class="bilingual" style="color:inherit;">সমস্যা</span>';
      btn.addEventListener('click', () => { location.hash = `#/report/${encodeURIComponent(machine.id)}`; });
      actionBlock.appendChild(btn);
    } else if (machine.status === 'RED') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-yellow btn-lg';
      btn.innerHTML = '🟡 WORK STARTED <span class="bilingual" style="color:inherit;">কাজ শুরু</span>';
      btn.addEventListener('click', () => {
        ui.confirmDialog({
          title: 'Start maintenance?',
          body: `${machine.id} — ${record ? record.problemType : ''}`,
          confirmLabel: 'YES, START',
          confirmClass: 'btn-yellow',
          onConfirm: () => {
            try {
              db.startWork(user, machine.id);
              ui.toast('Work started.');
              ctx.navigate(`#/machine/${encodeURIComponent(machine.id)}`);
            } catch (e) { ui.toast(ui.friendlyError(e)); }
          }
        });
      });
      actionBlock.appendChild(btn);
      if (['ADMIN', 'SUPERVISOR'].includes(user.role)) actionBlock.appendChild(renderCancelButton(machine, user, ctx));
    } else if (machine.status === 'YELLOW') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-green btn-lg';
      btn.innerHTML = '🟢 PROBLEM RESOLVED <span class="bilingual" style="color:inherit;">সমাধান</span>';
      btn.addEventListener('click', () => { location.hash = `#/resolve/${encodeURIComponent(machine.id)}`; });
      actionBlock.appendChild(btn);
      if (['ADMIN', 'SUPERVISOR'].includes(user.role)) actionBlock.appendChild(renderCancelButton(machine, user, ctx));
    }
  }

  function renderCancelButton(machine, user, ctx) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline';
    btn.textContent = 'Cancel / Correct This Report (Supervisor)';
    btn.addEventListener('click', () => {
      ui.confirmDialog({
        title: 'Cancel this reported problem?',
        body: 'This will be recorded in the audit log and cannot be undone.',
        confirmLabel: 'YES, CANCEL REPORT',
        confirmClass: 'btn-red',
        onConfirm: () => {
          try {
            db.cancelProblem(user, machine.id, 'Corrected by supervisor/admin');
            ui.toast('Report cancelled.');
            ctx.navigate(`#/machine/${encodeURIComponent(machine.id)}`);
          } catch (e) { ui.toast(ui.friendlyError(e)); }
        }
      });
    });
    return btn;
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.machineDetail = machineDetail;
})(window);
