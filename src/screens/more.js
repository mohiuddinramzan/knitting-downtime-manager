(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function more(params, root, ctx) {
    ctx.setChrome({ title: 'More', showNav: true, showBack: false });
    const user = db.getCurrentUser();
    root.innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="v" style="font-size:19px;">${ui.escapeHtml(user.name)}</div>
        <div class="muted">${user.id} · ${user.role} · ${ui.escapeHtml(user.shift || '')}</div>
      </div>
      <div class="stack">
        ${['ADMIN', 'SUPERVISOR'].includes(user.role) ? `<button class="btn btn-outline" id="go-audit">📜 Audit Log</button>` : ''}
        ${user.role === 'ADMIN' ? `<button class="btn btn-outline" id="go-admin">🛠️ Admin Panel</button>` : ''}
        <button class="btn btn-outline" id="go-scan">📷 Scan Machine QR</button>
        <button class="btn btn-red" id="btn-logout">LOG OUT</button>
      </div>
    `;
    const goAudit = document.getElementById('go-audit');
    if (goAudit) goAudit.addEventListener('click', () => ctx.navigate('#/audit'));
    const goAdmin = document.getElementById('go-admin');
    if (goAdmin) goAdmin.addEventListener('click', () => ctx.navigate('#/admin'));
    document.getElementById('go-scan').addEventListener('click', () => ctx.navigate('#/scan'));
    document.getElementById('btn-logout').addEventListener('click', () => {
      ui.confirmDialog({
        title: 'Log out?',
        confirmLabel: 'YES, LOG OUT',
        confirmClass: 'btn-red',
        onConfirm: () => { db.logout(); ctx.navigate('#/login'); }
      });
    });
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.more = more;
})(window);
