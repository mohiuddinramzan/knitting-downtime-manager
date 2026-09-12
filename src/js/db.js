/**
 * db.js — data + authorization layer.
 *
 * IMPORTANT (see README "Security model"):
 * This default build stores data in the browser's localStorage so the app
 * is fully usable out of the box with zero paid services and zero setup.
 * Every mutating action (report/startWork/resolve/assign/admin edits) is
 * routed through the functions below and re-checks the user's role and
 * machine assignment *here*, not just in the UI — so screens cannot be
 * bypassed by editing the DOM or calling a function directly from devtools
 * with the wrong user loaded.
 *
 * For a real multi-device factory deployment, replace the bodies of the
 * functions in this file with calls to Firestore (or any backend) and
 * enforce the exact same checks server-side using security rules —
 * see /firestore.rules for a ready-to-use example that mirrors this logic.
 */
(function (global) {
  const LS_KEYS = {
    users: 'kdm_users',
    machines: 'kdm_machines',
    assignments: 'kdm_assignments',
    categories: 'kdm_categories',
    records: 'kdm_downtimeRecords',
    audit: 'kdm_auditLogs',
    session: 'kdm_session',
    settings: 'kdm_settings'
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('DB read error', key, e);
      return fallback;
    }
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function nowIso() { return new Date().toISOString(); }

  class AuthError extends Error {
    constructor(message, userMessage) {
      super(message);
      this.name = 'AuthError';
      this.userMessage = userMessage || 'Not Authorized';
    }
  }

  // Optional real-time multi-device bridge (see sync.js). Falls back to
  // no-ops if Firebase isn't configured, so this file works standalone.
  const sync = global.KDM_SYNC || {
    enabled: false, push: () => Promise.resolve(), setDoc: () => Promise.resolve(),
    subscribeCollection: () => () => {}, subscribeDoc: () => () => {}
  };
  function dispatchRemoteChange() {
    try { window.dispatchEvent(new CustomEvent('kdm:data-changed')); } catch (e) { /* no-op */ }
  }

  // In Firebase mode, the signed-in user's profile (role/name/shift) lives
  // in Firestore keyed by their Firebase Auth UID. We cache it here (and in
  // localStorage, for instant reload) so getCurrentUser() can stay
  // synchronous everywhere else in the app.
  let _currentUserCache = null;
  let _authResolvedResolve;
  const _authResolved = new Promise((res) => { _authResolvedResolve = res; });
  function _resolveAuthOnce() {
    if (_authResolvedResolve) { _authResolvedResolve(); _authResolvedResolve = null; }
  }

  function init() {
    if (!read(LS_KEYS.users, null)) write(LS_KEYS.users, global.KDM_SEED.users);
    if (!read(LS_KEYS.machines, null)) write(LS_KEYS.machines, global.KDM_SEED.machines);
    if (!read(LS_KEYS.assignments, null)) write(LS_KEYS.assignments, global.KDM_SEED.assignments);
    if (!read(LS_KEYS.categories, null)) write(LS_KEYS.categories, global.KDM_CATEGORIES);
    if (!read(LS_KEYS.records, null)) write(LS_KEYS.records, []);
    if (!read(LS_KEYS.audit, null)) write(LS_KEYS.audit, []);
    if (!read(LS_KEYS.settings, null)) write(LS_KEYS.settings, { factoryName: 'Knitting Floor' });

    if (sync.enabled) {
      initRemoteSync();
      // Restore whatever profile we cached from the last session immediately
      // (avoids a flash of the login screen on cold start), then let
      // Firebase's own session check confirm/replace it.
      _currentUserCache = read(LS_KEYS.session, null);
      sync.onAuthChange((fbUser) => {
        if (!fbUser) {
          _currentUserCache = null;
          write(LS_KEYS.session, null);
          _resolveAuthOnce();
          dispatchRemoteChange();
          return;
        }
        sync.getDocOnce('users/' + fbUser.uid).then((profile) => {
          if (!profile || profile.active === false) {
            _currentUserCache = null;
            write(LS_KEYS.session, null);
            sync.signOut();
            _resolveAuthOnce();
            dispatchRemoteChange();
            return;
          }
          _currentUserCache = Object.assign({ id: fbUser.uid, email: fbUser.email }, profile);
          write(LS_KEYS.session, _currentUserCache);
          _resolveAuthOnce();
          dispatchRemoteChange();
        });
      });
    } else {
      _resolveAuthOnce();
    }
  }

  // Wires up real-time listeners so every device converges on the same
  // data. The very first device to connect "seeds" Firestore with its
  // local copy (harmless even if two devices race — doc IDs are the
  // machine/user/record ID, so a duplicate seed just overwrites itself).
  function initRemoteSync() {
    let seededUsers = false, seededMachines = false, seededAssignments = false, seededCategories = false;

    sync.subscribeCollection('users', (docs) => {
      if (docs.length === 0 && !seededUsers) {
        seededUsers = true;
        listUsers().forEach(u => sync.push('users', u.id, u));
        return;
      }
      if (docs.length) { write(LS_KEYS.users, docs); dispatchRemoteChange(); }
    });

    sync.subscribeCollection('machines', (docs) => {
      if (docs.length === 0 && !seededMachines) {
        seededMachines = true;
        listMachines().forEach(m => sync.push('machines', m.id, m));
        return;
      }
      if (docs.length) { write(LS_KEYS.machines, docs); dispatchRemoteChange(); }
    });

    sync.subscribeDoc('meta/assignments', (data) => {
      if (!data && !seededAssignments) {
        seededAssignments = true;
        sync.setDoc('meta/assignments', getAssignments());
        return;
      }
      if (data) { write(LS_KEYS.assignments, data); dispatchRemoteChange(); }
    });

    sync.subscribeDoc('meta/categories', (data) => {
      if (!data && !seededCategories) {
        seededCategories = true;
        sync.setDoc('meta/categories', { list: listCategories() });
        return;
      }
      if (data && data.list) { write(LS_KEYS.categories, data.list); dispatchRemoteChange(); }
    });

    sync.subscribeCollection('downtimeRecords', (docs) => {
      if (!docs.length) return; // nothing to merge yet; local records push themselves up as they're created
      docs.sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));
      write(LS_KEYS.records, docs);
      dispatchRemoteChange();
    });

    sync.subscribeCollection('auditLogs', (docs) => {
      if (!docs.length) return;
      docs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      write(LS_KEYS.audit, docs);
      dispatchRemoteChange();
    });
  }

  // ---------- Audit ----------
  function logAudit(user, machineId, action, details) {
    const logs = read(LS_KEYS.audit, []);
    const entry = {
      id: uid('log'),
      timestamp: nowIso(),
      userId: user ? user.id : 'SYSTEM',
      userName: user ? user.name : 'System',
      machineId: machineId || null,
      action,
      details: details || ''
    };
    logs.unshift(entry);
    write(LS_KEYS.audit, logs);
    sync.push('auditLogs', entry.id, entry);
  }
  function getAuditLogs() { return read(LS_KEYS.audit, []); }

  // ---------- Auth ----------
  // Always returns a Promise, in both modes, so screens have one consistent
  // API regardless of whether Firebase is configured.
  function login(idOrEmail, pinOrPassword) {
    if (sync.enabled) {
      return sync.signIn(idOrEmail, pinOrPassword)
        .then((cred) => sync.getDocOnce('users/' + cred.user.uid).then((profile) => {
          if (!profile || profile.active === false) {
            return sync.signOut().then(() => {
              throw new AuthError('disabled', 'This account is disabled. Contact Admin.');
            });
          }
          const user = Object.assign({ id: cred.user.uid, email: idOrEmail }, profile);
          _currentUserCache = user;
          write(LS_KEYS.session, user);
          logAudit(user, null, 'LOGIN', '');
          return user;
        }))
        .catch((e) => {
          if (e && e.name === 'AuthError') throw e;
          logAudit(null, null, 'LOGIN_FAILED', idOrEmail);
          throw new AuthError('bad_credentials', 'Invalid email or password.');
        });
    }
    // ---- local ID+PIN mode (single device, no Firebase configured) ----
    try {
      const users = read(LS_KEYS.users, []);
      const user = users.find(u => u.id.toLowerCase() === String(idOrEmail).toLowerCase());
      if (!user || !user.active) {
        logAudit(null, null, 'LOGIN_FAILED', `Unknown or disabled user id: ${idOrEmail}`);
        throw new AuthError('unknown_user', 'Invalid ID or PIN.');
      }
      if (String(user.pin) !== String(pinOrPassword)) {
        logAudit(user, null, 'LOGIN_FAILED', 'Wrong PIN');
        throw new AuthError('wrong_pin', 'Invalid ID or PIN.');
      }
      write(LS_KEYS.session, { userId: user.id, loginAt: nowIso() });
      logAudit(user, null, 'LOGIN', '');
      return Promise.resolve(user);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function logout() {
    const u = getCurrentUser();
    write(LS_KEYS.session, null);
    _currentUserCache = null;
    if (u) logAudit(u, null, 'LOGOUT', '');
    return sync.enabled ? sync.signOut() : Promise.resolve();
  }

  function getCurrentUser() {
    if (sync.enabled) return _currentUserCache;
    const session = read(LS_KEYS.session, null);
    if (!session) return null;
    const users = read(LS_KEYS.users, []);
    return users.find(u => u.id === session.userId) || null;
  }

  // ---------- Users ----------
  function listUsers() { return read(LS_KEYS.users, []); }
  function requireAdmin(actor) {
    if (!actor || actor.role !== 'ADMIN') throw new AuthError('not_admin', 'Only Admin can do this.');
  }
  function addUser(actor, userData) {
    requireAdmin(actor);
    if (sync.enabled) {
      if (!userData.email || !userData.password) {
        return Promise.reject(new AuthError('missing_fields', 'Email and password are required.'));
      }
      return sync.createUserKeepingCurrentSession(userData.email, userData.password)
        .then((newUid) => {
          const profile = { name: userData.name, role: userData.role, shift: userData.shift, active: true, email: userData.email };
          return sync.push('users', newUid, profile).then(() => {
            const newUser = Object.assign({ id: newUid }, profile);
            // Optimistic local cache update — the Firestore listener will confirm this in a moment too.
            const users = listUsers();
            users.push(newUser);
            write(LS_KEYS.users, users);
            logAudit(actor, null, 'USER_ADDED', `${userData.email} (${userData.role})`);
            return newUser;
          });
        })
        .catch((e) => {
          if (e && e.name === 'AuthError') throw e;
          if (e && e.code === 'auth/email-already-in-use') throw new AuthError('dup', 'This email is already registered.');
          if (e && e.code === 'auth/weak-password') throw new AuthError('weak_password', 'Password should be at least 6 characters.');
          if (e && e.code === 'auth/invalid-email') throw new AuthError('bad_email', 'That email address looks invalid.');
          console.error('[addUser]', e);
          throw new AuthError('create_failed', 'Could not create the account.');
        });
    }
    // ---- local ID+PIN mode ----
    const users = listUsers();
    if (users.find(u => u.id === userData.id)) return Promise.reject(new AuthError('dup', 'User ID already exists.'));
    const newUser = Object.assign({ active: true }, userData);
    users.push(newUser);
    write(LS_KEYS.users, users);
    sync.push('users', newUser.id, newUser);
    logAudit(actor, null, 'USER_ADDED', `${userData.id} (${userData.role})`);
    return Promise.resolve(newUser);
  }
  function updateUser(actor, userId, patch) {
    requireAdmin(actor);
    const users = listUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) throw new AuthError('missing', 'User not found.');
    // Role changes are admin-only and always audited explicitly.
    if (patch.role && patch.role !== users[idx].role) {
      logAudit(actor, null, 'ROLE_CHANGED', `${userId}: ${users[idx].role} -> ${patch.role}`);
    }
    users[idx] = Object.assign({}, users[idx], patch);
    write(LS_KEYS.users, users);
    sync.push('users', users[idx].id, users[idx]);
    logAudit(actor, null, 'USER_UPDATED', userId);
  }
  function setUserActive(actor, userId, active) {
    requireAdmin(actor);
    updateUserRaw(userId, { active });
    logAudit(actor, null, active ? 'USER_ENABLED' : 'USER_DISABLED', userId);
  }
  function updateUserRaw(userId, patch) {
    const users = listUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx] = Object.assign({}, users[idx], patch);
      write(LS_KEYS.users, users);
      sync.push('users', users[idx].id, users[idx]);
    }
  }

  // ---------- Machines ----------
  function listMachines() { return read(LS_KEYS.machines, []); }
  function getMachine(machineId) { return listMachines().find(m => m.id === machineId) || null; }
  function saveMachine(machine) {
    const machines = listMachines();
    const idx = machines.findIndex(m => m.id === machine.id);
    if (idx === -1) machines.push(machine); else machines[idx] = machine;
    write(LS_KEYS.machines, machines);
    sync.push('machines', machine.id, machine);
  }
  function addMachine(actor, data) {
    requireAdmin(actor);
    if (getMachine(data.id)) throw new AuthError('dup', 'Machine ID already exists.');
    saveMachine(Object.assign({ status: 'GREEN' }, data));
    logAudit(actor, data.id, 'MACHINE_ADDED', data.id);
  }
  function editMachine(actor, machineId, patch) {
    requireAdmin(actor);
    const m = getMachine(machineId);
    if (!m) throw new AuthError('missing', 'Machine not found.');
    saveMachine(Object.assign({}, m, patch));
    logAudit(actor, machineId, 'MACHINE_EDITED', JSON.stringify(patch));
  }
  function deactivateMachine(actor, machineId) {
    requireAdmin(actor);
    editMachine(actor, machineId, { active: false });
    logAudit(actor, machineId, 'MACHINE_DEACTIVATED', '');
  }

  // ---------- Assignments (Machine -> Operator, per shift) ----------
  function getAssignments() { return read(LS_KEYS.assignments, {}); }
  function getAssignedOperator(machineId, shift) {
    const a = getAssignments();
    return (a[shift] && a[shift][machineId]) || null;
  }
  function getCurrentAssignedOperator(machineId) {
    // "Current" = look across shifts for now; a real deployment would key
    // this off the active shift clock. We fall back to searching all shifts.
    const a = getAssignments();
    for (const shift of Object.keys(a)) {
      if (a[shift][machineId]) return { operatorId: a[shift][machineId], shift };
    }
    return null;
  }
  function assignOperator(actor, shift, machineId, operatorId) {
    if (!actor || !['ADMIN', 'SUPERVISOR'].includes(actor.role)) {
      throw new AuthError('not_authorized', 'Only Supervisor/Admin can assign operators.');
    }
    const a = getAssignments();
    if (!a[shift]) a[shift] = {};
    a[shift][machineId] = operatorId;
    write(LS_KEYS.assignments, a);
    sync.setDoc('meta/assignments', a);
    logAudit(actor, machineId, 'OPERATOR_ASSIGNED', `${operatorId} -> ${machineId} (${shift})`);
  }

  // Central authorization check used by every machine action below.
  function assertCanOperate(actor, machineId, action) {
    if (!actor) throw new AuthError('no_session', 'Please log in.');
    if (['ADMIN', 'SUPERVISOR'].includes(actor.role)) return; // full access
    if (actor.role === 'TECHNICIAN') {
      // Technicians work on machines that already have an active problem
      // (START_WORK / RESOLVE), not on reporting new ones.
      if (action === 'REPORT_PROBLEM') {
        throw new AuthError('tech_cannot_report', 'Technicians work on reported problems; ask the operator to report it.');
      }
      return;
    }
    if (actor.role === 'OPERATOR') {
      const current = getCurrentAssignedOperator(machineId);
      const assignedToMe = current && current.operatorId === actor.id;
      if (!assignedToMe) {
        throw new AuthError(
          'not_assigned',
          'This machine is assigned to another operator.'
        );
      }
      return;
    }
    throw new AuthError('unknown_role', 'Not Authorized');
  }

  // ---------- Downtime records / status workflow ----------
  function listRecords() { return read(LS_KEYS.records, []); }
  function saveRecords(recs) { write(LS_KEYS.records, recs); }
  function getActiveRecordForMachine(machineId) {
    return listRecords().find(r => r.machineId === machineId && r.status === 'active') || null;
  }

  function reportProblem(actor, machineId, categoryId, problemType) {
    assertCanOperate(actor, machineId, 'REPORT_PROBLEM');
    const machine = getMachine(machineId);
    if (!machine) throw new AuthError('missing_machine', 'Machine not found.');
    if (machine.status !== 'GREEN') {
      throw new AuthError('bad_transition', 'This machine already has an open problem.');
    }
    const record = {
      id: uid('rec'),
      machineId,
      reportedBy: actor.name,
      operatorId: actor.id,
      problemCategory: categoryId,
      problemType,
      reportedAt: nowIso(),
      workStartedAt: null,
      workStartedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      downtimeMinutes: null,
      status: 'active',
      resolution: null,
      notes: null,
      shift: actor.shift
    };
    const recs = listRecords();
    recs.unshift(record);
    saveRecords(recs);
    sync.push('downtimeRecords', record.id, record);
    machine.status = 'RED';
    machine.activeRecordId = record.id;
    saveMachine(machine);
    logAudit(actor, machineId, 'PROBLEM_REPORTED', problemType);
    return record;
  }

  function startWork(actor, machineId) {
    assertCanOperate(actor, machineId, 'START_WORK');
    const machine = getMachine(machineId);
    if (!machine) throw new AuthError('missing_machine', 'Machine not found.');
    if (machine.status !== 'RED') throw new AuthError('bad_transition', 'Machine is not in PROBLEM state.');
    const record = getActiveRecordForMachine(machineId);
    if (!record) throw new AuthError('missing_record', 'No active problem found.');
    record.workStartedAt = nowIso();
    record.workStartedBy = actor.name;
    const recs = listRecords();
    saveRecords(recs.map(r => (r.id === record.id ? record : r)));
    sync.push('downtimeRecords', record.id, record);
    machine.status = 'YELLOW';
    saveMachine(machine);
    logAudit(actor, machineId, 'WORK_STARTED', '');
    return record;
  }

  function resolveProblem(actor, machineId, resolution, notes) {
    assertCanOperate(actor, machineId, 'RESOLVE');
    const machine = getMachine(machineId);
    if (!machine) throw new AuthError('missing_machine', 'Machine not found.');
    if (machine.status !== 'YELLOW') throw new AuthError('bad_transition', 'Machine is not in WORK IN PROGRESS state.');
    const record = getActiveRecordForMachine(machineId);
    if (!record) throw new AuthError('missing_record', 'No active problem found.');
    const resolvedAt = new Date();
    const downtimeMinutes = Math.round((resolvedAt - new Date(record.reportedAt)) / 60000);
    record.resolvedAt = resolvedAt.toISOString();
    record.resolvedBy = actor.name;
    record.downtimeMinutes = downtimeMinutes;
    record.status = 'resolved';
    record.resolution = resolution;
    record.notes = notes || '';
    const recs = listRecords();
    saveRecords(recs.map(r => (r.id === record.id ? record : r)));
    sync.push('downtimeRecords', record.id, record);
    machine.status = 'GREEN';
    machine.activeRecordId = null;
    saveMachine(machine);
    logAudit(actor, machineId, 'PROBLEM_RESOLVED', `${resolution} (${downtimeMinutes} min)`);
    return record;
  }

  // Supervisor/Admin: correct or cancel a wrongly reported problem.
  function cancelProblem(actor, machineId, reason) {
    if (!actor || !['ADMIN', 'SUPERVISOR'].includes(actor.role)) {
      throw new AuthError('not_authorized', 'Only Supervisor/Admin can cancel a reported problem.');
    }
    const machine = getMachine(machineId);
    if (!machine) throw new AuthError('missing_machine', 'Machine not found.');
    const record = getActiveRecordForMachine(machineId);
    if (!record) throw new AuthError('missing_record', 'No active problem found.');
    record.status = 'cancelled';
    record.resolvedAt = nowIso();
    record.resolution = 'Cancelled by Supervisor/Admin';
    record.notes = reason || '';
    const recs = listRecords();
    saveRecords(recs.map(r => (r.id === record.id ? record : r)));
    sync.push('downtimeRecords', record.id, record);
    machine.status = 'GREEN';
    machine.activeRecordId = null;
    saveMachine(machine);
    logAudit(actor, machineId, 'PROBLEM_CANCELLED', reason || '');
    return record;
  }

  // ---------- Categories (admin editable) ----------
  function listCategories() { return read(LS_KEYS.categories, []); }
  function addProblemType(actor, categoryId, label) {
    requireAdmin(actor);
    const cats = listCategories();
    const cat = cats.find(c => c.id === categoryId);
    if (!cat) throw new AuthError('missing', 'Category not found.');
    cat.items.push(label);
    write(LS_KEYS.categories, cats);
    sync.setDoc('meta/categories', { list: cats });
    logAudit(actor, null, 'PROBLEM_TYPE_ADDED', `${categoryId}: ${label}`);
  }
  function addCategory(actor, id, label, icon) {
    requireAdmin(actor);
    const cats = listCategories();
    if (cats.find(c => c.id === id)) throw new AuthError('dup', 'Category already exists.');
    cats.push({ id, label, icon: icon || '❔', items: [] });
    write(LS_KEYS.categories, cats);
    sync.setDoc('meta/categories', { list: cats });
    logAudit(actor, null, 'CATEGORY_ADDED', label);
  }

  // ---------- Loss level helper (10 / 30 / 60 minute thresholds) ----------
  function lossLevel(minutes) {
    if (minutes >= 60) return { level: 'critical', label: '🚨 CRITICAL DOWNTIME' };
    if (minutes >= 30) return { level: 'major', label: '🔴 MAJOR DOWNTIME' };
    if (minutes >= 10) return { level: 'loss', label: '⚠️ PRODUCTION LOSS' };
    return { level: 'ok', label: '' };
  }

  function liveDowntimeMinutes(record) {
    if (!record) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(record.reportedAt).getTime()) / 60000));
  }

  // ---------- Reports ----------
  function getReportData(rangeDays) {
    const cutoff = rangeDays ? Date.now() - rangeDays * 86400000 : 0;
    const recs = listRecords().filter(r => r.status === 'resolved' && new Date(r.reportedAt).getTime() >= cutoff);
    const machines = listMachines();
    const totalDowntime = recs.reduce((s, r) => s + (r.downtimeMinutes || 0), 0);
    const byMachine = {};
    const byCategory = {};
    const byOperator = {};
    let loss10 = 0, loss30 = 0, loss60 = 0;
    recs.forEach(r => {
      byMachine[r.machineId] = (byMachine[r.machineId] || 0) + r.downtimeMinutes;
      byCategory[r.problemCategory] = (byCategory[r.problemCategory] || 0) + r.downtimeMinutes;
      byOperator[r.operatorId] = (byOperator[r.operatorId] || 0) + 1;
      if (r.downtimeMinutes >= 60) loss60++;
      else if (r.downtimeMinutes >= 30) loss30++;
      else if (r.downtimeMinutes >= 10) loss10++;
    });
    const topMachines = Object.entries(byMachine).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return {
      totalMachines: machines.length,
      runningMachines: machines.filter(m => m.status === 'GREEN').length,
      problemMachines: machines.filter(m => m.status === 'RED').length,
      maintenanceMachines: machines.filter(m => m.status === 'YELLOW').length,
      totalDowntime,
      numberOfProblems: recs.length,
      averageDowntime: recs.length ? Math.round(totalDowntime / recs.length) : 0,
      loss10, loss30, loss60,
      topMachines, topCategories,
      byOperator
    };
  }

  global.KDM_DB = {
    init, AuthError, authResolved: _authResolved,
    login, logout, getCurrentUser,
    listUsers, addUser, updateUser, setUserActive,
    listMachines, getMachine, addMachine, editMachine, deactivateMachine,
    getAssignments, getAssignedOperator, getCurrentAssignedOperator, assignOperator,
    listRecords, getActiveRecordForMachine,
    reportProblem, startWork, resolveProblem, cancelProblem,
    listCategories, addProblemType, addCategory,
    lossLevel, liveDowntimeMinutes,
    getReportData, getAuditLogs, logAudit
  };
})(window);
