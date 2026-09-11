(function (global) {
  const db = global.KDM_DB;
  db.init();

  const appEl = document.getElementById('app');
  const topbar = document.getElementById('topbar');
  const topbarTitle = document.getElementById('topbar-title');
  const topbarUser = document.getElementById('topbar-user');
  const bottomnav = document.getElementById('bottomnav');
  const btnBack = document.getElementById('btn-back');

  const history = [];

  // Simple hash router: '#/route/param'
  const routes = {}; // path pattern -> handler(params)
  function on(pattern, handler) { routes[pattern] = handler; }

  function matchRoute(hash) {
    const parts = hash.replace(/^#\//, '').split('/');
    for (const pattern in routes) {
      const pParts = pattern.split('/');
      if (pParts.length !== parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < pParts.length; i++) {
        if (pParts[i].startsWith(':')) params[pParts[i].slice(1)] = decodeURIComponent(parts[i]);
        else if (pParts[i] !== parts[i]) { ok = false; break; }
      }
      if (ok) return { handler: routes[pattern], params };
    }
    return null;
  }

  function setChrome({ title, showNav, showBack }) {
    topbarTitle.textContent = title || 'Knitting Floor';
    topbar.classList.toggle('hidden', title === null);
    bottomnav.classList.toggle('hidden', !showNav);
    btnBack.classList.toggle('hidden', !showBack);
    const user = db.getCurrentUser();
    topbarUser.textContent = user ? `${user.name}\n${user.role}` : '';
    const base = '#/' + (location.hash.replace(/^#\//, '').split('/')[0] || '');
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.route === base);
    });
  }

  function render() {
    const hash = location.hash || '#/dashboard';
    const user = db.getCurrentUser();
    if (!user && hash !== '#/login') {
      location.hash = '#/login';
      return;
    }
    if (user && hash === '#/login') {
      location.hash = '#/dashboard';
      return;
    }
    const match = matchRoute(hash);
    if (!match) { location.hash = user ? '#/dashboard' : '#/login'; return; }
    appEl.innerHTML = '';
    match.handler(match.params, appEl, { setChrome, navigate });
  }

  function navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  btnBack.addEventListener('click', () => window.history.back());
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });

  window.addEventListener('hashchange', render);

  // ---------- Offline banner ----------
  function updateOnlineStatus() {
    document.getElementById('offline-banner').classList.toggle('hidden', navigator.onLine);
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // ---------- Register screens (defined in src/screens/*.js) ----------
  on('login', global.KDM_SCREENS.login);
  on('dashboard', global.KDM_SCREENS.dashboard);
  on('machines', global.KDM_SCREENS.machineList);
  on('machine/:id', global.KDM_SCREENS.machineDetail);
  on('report/:id', global.KDM_SCREENS.reportProblem);
  on('resolve/:id', global.KDM_SCREENS.resolve);
  on('scan', global.KDM_SCREENS.scan);
  on('reports', global.KDM_SCREENS.reports);
  on('audit', global.KDM_SCREENS.audit);
  on('admin', global.KDM_SCREENS.admin);
  on('more', global.KDM_SCREENS.more);

  render();
})(window);
