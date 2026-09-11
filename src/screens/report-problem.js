(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function reportProblem(params, root, ctx) {
    const machine = db.getMachine(params.id);
    ctx.setChrome({ title: 'Report Problem', showNav: false, showBack: true });
    if (!machine) { root.innerHTML = `<div class="alert-box error">Machine not found.</div>`; return; }
    if (machine.status !== 'GREEN') {
      root.innerHTML = `<div class="alert-box error"><div class="alert-title">Not Available</div>This machine already has an open problem.</div>`;
      return;
    }

    let step = 'category'; // 'category' | 'problem'
    let selectedCategory = null;

    function draw() {
      if (step === 'category') {
        const cats = db.listCategories();
        root.innerHTML = `
          <div class="section-title">${machine.id} — Select Category</div>
          <div class="category-grid" id="cat-grid"></div>
        `;
        const grid = document.getElementById('cat-grid');
        cats.forEach(c => {
          const btn = document.createElement('button');
          btn.className = 'tile-btn';
          btn.innerHTML = `<span class="tile-icon">${c.icon}</span><span>${ui.escapeHtml(c.label)}</span>`;
          btn.addEventListener('click', () => { selectedCategory = c; step = 'problem'; draw(); });
          grid.appendChild(btn);
        });
      } else {
        root.innerHTML = `
          <div class="section-title">${ui.escapeHtml(selectedCategory.label)} — Select Problem</div>
          <div class="problem-grid" id="prob-grid"></div>
          <button class="btn btn-ghost" id="back-cat" style="margin-top:14px;">← Back to categories</button>
        `;
        const grid = document.getElementById('prob-grid');
        selectedCategory.items.forEach(item => {
          const btn = document.createElement('button');
          btn.className = 'tile-btn';
          btn.textContent = item;
          btn.addEventListener('click', () => confirmReport(item));
          grid.appendChild(btn);
        });
        document.getElementById('back-cat').addEventListener('click', () => { step = 'category'; draw(); });
      }
    }

    function confirmReport(problemType) {
      ui.confirmDialog({
        title: 'Report this problem?',
        body: `${machine.id} — ${ui.escapeHtml(problemType)}`,
        confirmLabel: 'YES, REPORT',
        confirmClass: 'btn-red',
        onConfirm: () => {
          const user = db.getCurrentUser();
          try {
            db.reportProblem(user, machine.id, selectedCategory.id, problemType);
            ui.toast('Problem reported. Downtime timer started.');
            ctx.navigate(`#/machine/${encodeURIComponent(machine.id)}`);
          } catch (e) {
            ui.toast(ui.friendlyError(e));
            ctx.navigate(`#/machine/${encodeURIComponent(machine.id)}`);
          }
        }
      });
    }

    draw();
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.reportProblem = reportProblem;
})(window);
