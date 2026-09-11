(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  const ACTION_LABELS = {
    LOGIN: 'Logged in', LOGOUT: 'Logged out', LOGIN_FAILED: 'Failed login attempt',
    PROBLEM_REPORTED: 'Problem Reported', WORK_STARTED: 'Work Started',
    PROBLEM_RESOLVED: 'Problem Resolved', PROBLEM_CANCELLED: 'Problem Cancelled (Correction)',
    OPERATOR_ASSIGNED: 'Operator Assigned', ACCESS_REQUESTED: 'Supervisor Access Requested',
    USER_ADDED: 'User Added', USER_UPDATED: 'User Updated', USER_ENABLED: 'User Enabled',
    USER_DISABLED: 'User Disabled', ROLE_CHANGED: 'Role Changed',
    MACHINE_ADDED: 'Machine Added', MACHINE_EDITED: 'Machine Edited', MACHINE_DEACTIVATED: 'Machine Deactivated',
    PROBLEM_TYPE_ADDED: 'Problem Type Added', CATEGORY_ADDED: 'Category Added'
  };

  function audit(params, root, ctx) {
    ctx.setChrome({ title: 'Audit Log', showNav: true, showBack: false });
    const user = db.getCurrentUser();
    if (!['ADMIN', 'SUPERVISOR'].includes(user.role)) {
      root.innerHTML = `<div class="alert-box error"><div class="alert-title">Not Authorized</div>Audit log is visible to Supervisors and Admins only.</div>`;
      return;
    }
    const logs = db.getAuditLogs();
    root.innerHTML = `
      <div class="small muted" style="margin-bottom:10px;">${logs.length} entries · newest first · cannot be edited or deleted</div>
      <div class="card" id="audit-list"></div>
    `;
    const list = document.getElementById('audit-list');
    if (!logs.length) { list.innerHTML = '<div class="muted">No activity yet.</div>'; return; }
    logs.slice(0, 300).forEach(l => {
      const item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = `
        <span class="log-time">${ui.fmtTime(l.timestamp)} · ${ui.fmtDate(l.timestamp)}</span>
        <span class="badge">${ui.escapeHtml(ACTION_LABELS[l.action] || l.action)}</span>
        <div class="log-meta">${ui.escapeHtml(l.userId)}${l.machineId ? ' · ' + ui.escapeHtml(l.machineId) : ''}${l.details ? ' · ' + ui.escapeHtml(l.details) : ''}</div>
      `;
      list.appendChild(item);
    });
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.audit = audit;
})(window);
