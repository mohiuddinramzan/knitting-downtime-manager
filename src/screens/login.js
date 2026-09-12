(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function login(params, root, ctx) {
    ctx.setChrome({ title: null, showNav: false, showBack: false });
    const firebaseOn = global.KDM_SYNC && global.KDM_SYNC.enabled;

    root.innerHTML = `
      <div class="login-wrap">
        <div class="login-logo">🧶</div>
        <div class="login-title">Knitting Downtime Manager</div>
        <div class="login-sub">নিটিং ফ্লোর ডাউনটাইম ব্যবস্থাপনা</div>
        <div class="card stack">
          ${firebaseOn ? `
            <div class="field">
              <label>Email</label>
              <input id="login-id" type="email" autocomplete="username" placeholder="you@factory.com" />
            </div>
            <div class="field">
              <label>Password</label>
              <input id="login-pin" type="password" autocomplete="current-password" placeholder="••••••••" />
            </div>
          ` : `
            <div class="field">
              <label>Operator / User ID</label>
              <input id="login-id" type="text" autocomplete="off" placeholder="e.g. OP101" />
            </div>
            <div class="field">
              <label>PIN</label>
              <input id="login-pin" type="password" inputmode="numeric" maxlength="6" class="pin-input" placeholder="••••" />
            </div>
          `}
          <button id="login-btn" class="btn btn-primary btn-lg">LOG IN</button>
          <div id="login-error"></div>
        </div>
        ${firebaseOn ? `
          <div class="demo-users card small muted">
            An Admin creates your account (email + password) from the Admin Panel.
            No self sign-up — if you don't have an account yet, ask your Admin.
          </div>
        ` : `
          <div class="demo-users card">
            <b>Demo accounts</b> (for trying the app now — replace in Admin Panel)
            <table>
              <tr><td>ADMIN1</td><td>PIN 0000</td><td>Admin</td></tr>
              <tr><td>SUP01</td><td>PIN 1111</td><td>Supervisor</td></tr>
              <tr><td>TECH05</td><td>PIN 2222</td><td>Technician</td></tr>
              <tr><td>OP101</td><td>PIN 1010</td><td>Operator — K-101, K-117</td></tr>
              <tr><td>OP102</td><td>PIN 1020</td><td>Operator — K-102, K-132</td></tr>
            </table>
          </div>
        `}
      </div>`;

    const idInput = document.getElementById('login-id');
    const pinInput = document.getElementById('login-pin');
    const errBox = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    function attempt() {
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = 'LOGGING IN…';
      db.login(idInput.value.trim(), pinInput.value.trim())
        .then(() => {
          errBox.innerHTML = '';
          ctx.navigate('#/dashboard');
        })
        .catch((e) => {
          errBox.innerHTML = `<div class="alert-box error" style="margin-top:10px;"><div class="alert-title">Not Authorized</div>${ui.escapeHtml(ui.friendlyError(e))}</div>`;
        })
        .finally(() => {
          btn.disabled = false;
          btn.textContent = originalLabel;
        });
    }
    btn.addEventListener('click', attempt);
    pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.login = login;
})(window);
