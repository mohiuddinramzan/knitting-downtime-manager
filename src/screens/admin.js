(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function admin(params, root, ctx) {
    ctx.setChrome({ title: 'Admin Panel', showNav: true, showBack: false });
    const user = db.getCurrentUser();
    if (user.role !== 'ADMIN') {
      root.innerHTML = `<div class="alert-box error"><div class="alert-title">Not Authorized</div>Admin Panel is Admin-only.</div>`;
      return;
    }

    let tab = 'users';
    root.innerHTML = `
      <div class="row" style="margin-bottom:14px; flex-wrap:wrap; gap:8px;">
        ${tabBtn('users', 'Users')}${tabBtn('machines', 'Machines')}${tabBtn('assign', 'Assignments')}${tabBtn('cats', 'Categories')}
      </div>
      <div id="admin-body"></div>
    `;
    function tabBtn(id, label) {
      return `<button class="btn btn-outline grow admin-tab" data-tab="${id}" style="min-height:44px; font-size:14px;">${label}</button>`;
    }
    root.querySelectorAll('.admin-tab').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; draw(); }));

    function draw() {
      root.querySelectorAll('.admin-tab').forEach(b => {
        b.className = 'btn grow admin-tab ' + (b.dataset.tab === tab ? 'btn-primary' : 'btn-outline');
        b.style.minHeight = '44px'; b.style.fontSize = '14px';
      });
      const body = document.getElementById('admin-body');
      if (tab === 'users') return drawUsers(body);
      if (tab === 'machines') return drawMachines(body);
      if (tab === 'assign') return drawAssignments(body);
      if (tab === 'cats') return drawCategories(body);
    }

    function drawUsers(body) {
      const users = db.listUsers();
      body.innerHTML = `
        <div class="card stack" style="margin-bottom:16px;">
          <div class="section-title" style="margin:0;">Add User</div>
          <input id="u-id" placeholder="User ID (e.g. OP104)" />
          <input id="u-name" placeholder="Full name" />
          <input id="u-pin" placeholder="PIN (numbers)" inputmode="numeric" />
          <select id="u-role">
            <option value="OPERATOR">Operator</option>
            <option value="TECHNICIAN">Technician</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="ADMIN">Admin</option>
          </select>
          <select id="u-shift">${global.KDM_SHIFTS.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
          <button class="btn btn-primary" id="add-user">Add User</button>
        </div>
        <div class="stack" id="user-list"></div>
      `;
      document.getElementById('add-user').addEventListener('click', () => {
        const id = document.getElementById('u-id').value.trim();
        const name = document.getElementById('u-name').value.trim();
        const pin = document.getElementById('u-pin').value.trim();
        const role = document.getElementById('u-role').value;
        const shift = document.getElementById('u-shift').value;
        if (!id || !name || !pin) { ui.toast('Fill in ID, name and PIN.'); return; }
        try {
          db.addUser(user, { id, name, pin, role, shift });
          ui.toast('User added.');
          draw();
        } catch (e) { ui.toast(ui.friendlyError(e)); }
      });
      const list = document.getElementById('user-list');
      users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'card';
        row.innerHTML = `
          <div class="row">
            <div class="grow">
              <b>${ui.escapeHtml(u.name)}</b> <span class="badge">${u.role}</span> ${u.active === false ? '<span class="badge" style="background:#fdecec;color:#dc2626;">disabled</span>' : ''}
              <div class="muted small">${u.id} · ${ui.escapeHtml(u.shift || '')}</div>
            </div>
            <button class="btn btn-outline toggle-active" style="width:auto; min-height:40px; font-size:13px;">${u.active === false ? 'Enable' : 'Disable'}</button>
          </div>
        `;
        row.querySelector('.toggle-active').addEventListener('click', () => {
          try { db.setUserActive(user, u.id, u.active === false); draw(); } catch (e) { ui.toast(ui.friendlyError(e)); }
        });
        list.appendChild(row);
      });
    }

    function drawMachines(body) {
      const machines = db.listMachines();
      body.innerHTML = `
        <div class="card stack" style="margin-bottom:16px;">
          <div class="section-title" style="margin:0;">Add Machine</div>
          <input id="m-id" placeholder="Machine ID (e.g. K-140)" />
          <input id="m-model" placeholder="Machine model" />
          <input id="m-order" placeholder="Current order (optional)" />
          <button class="btn btn-primary" id="add-machine">Add Machine</button>
        </div>
        <div class="stack" id="machine-admin-list"></div>
      `;
      document.getElementById('add-machine').addEventListener('click', () => {
        const id = document.getElementById('m-id').value.trim();
        const model = document.getElementById('m-model').value.trim();
        const order = document.getElementById('m-order').value.trim();
        if (!id) { ui.toast('Enter a machine ID.'); return; }
        try { db.addMachine(user, { id, model, order }); ui.toast('Machine added.'); draw(); }
        catch (e) { ui.toast(ui.friendlyError(e)); }
      });
      const list = document.getElementById('machine-admin-list');
      machines.forEach(m => {
        const row = document.createElement('div');
        row.className = 'card row';
        row.innerHTML = `
          <div class="grow">
            <b>${ui.escapeHtml(m.id)}</b> <span class="status-pill status-${m.status}">${ui.statusMeta(m.status).label}</span>
            <div class="muted small">${ui.escapeHtml(m.model || '')}</div>
          </div>
        `;
        list.appendChild(row);
      });
    }

    function drawAssignments(body) {
      const machines = db.listMachines();
      const operators = db.listUsers().filter(u => u.role === 'OPERATOR');
      body.innerHTML = `
        <div class="field">
          <label>Shift</label>
          <select id="a-shift">${global.KDM_SHIFTS.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
        </div>
        <div class="stack" id="assign-rows"></div>
      `;
      function drawRows() {
        const shift = document.getElementById('a-shift').value;
        const assignments = db.getAssignments();
        const rows = document.getElementById('assign-rows');
        rows.innerHTML = '';
        machines.forEach(m => {
          const current = (assignments[shift] && assignments[shift][m.id]) || '';
          const row = document.createElement('div');
          row.className = 'card row';
          row.innerHTML = `
            <div class="grow"><b>${ui.escapeHtml(m.id)}</b></div>
            <select class="grow assign-select" data-machine="${m.id}">
              <option value="">— Unassigned —</option>
              ${operators.map(o => `<option value="${o.id}" ${o.id === current ? 'selected' : ''}>${ui.escapeHtml(o.name)} (${o.id})</option>`).join('')}
            </select>
          `;
          row.querySelector('.assign-select').addEventListener('change', (e) => {
            try { db.assignOperator(user, shift, m.id, e.target.value); ui.toast('Assignment saved.'); }
            catch (err) { ui.toast(ui.friendlyError(err)); }
          });
          rows.appendChild(row);
        });
      }
      document.getElementById('a-shift').addEventListener('change', drawRows);
      drawRows();
    }

    function drawCategories(body) {
      const cats = db.listCategories();
      body.innerHTML = `
        <div class="card stack" style="margin-bottom:16px;">
          <div class="section-title" style="margin:0;">Add Problem Type</div>
          <select id="c-cat">${cats.map(c => `<option value="${c.id}">${c.icon} ${ui.escapeHtml(c.label)}</option>`).join('')}</select>
          <input id="c-label" placeholder="New problem type name" />
          <button class="btn btn-primary" id="add-type">Add</button>
        </div>
        <div class="stack" id="cat-list"></div>
      `;
      document.getElementById('add-type').addEventListener('click', () => {
        const catId = document.getElementById('c-cat').value;
        const label = document.getElementById('c-label').value.trim();
        if (!label) { ui.toast('Enter a problem type name.'); return; }
        try { db.addProblemType(user, catId, label); ui.toast('Problem type added.'); draw(); }
        catch (e) { ui.toast(ui.friendlyError(e)); }
      });
      const list = document.getElementById('cat-list');
      cats.forEach(c => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `<b>${c.icon} ${ui.escapeHtml(c.label)}</b><div class="muted small">${c.items.length} problem types</div>`;
        list.appendChild(el);
      });
    }

    draw();
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.admin = admin;
})(window);
