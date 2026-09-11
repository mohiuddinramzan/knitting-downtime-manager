(function (global) {
  function toast(message, ms) {
    const old = document.getElementById('toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms || 2200);
  }

  // Friendly error mapping — never show raw technical errors to operators.
  function friendlyError(err) {
    if (err && err.name === 'AuthError') return err.userMessage;
    console.error('[KDM technical error]', err);
    return 'কাজটি করা যাচ্ছে না। Please contact supervisor.';
  }

  function confirmDialog({ title, body, confirmLabel, confirmClass, onConfirm }) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop">
        <div class="modal-sheet">
          <div class="modal-title">${title}</div>
          <div class="modal-body">${body || ''}</div>
          <div class="modal-actions">
            <button class="btn btn-outline grow" id="modal-no">NO</button>
            <button class="btn ${confirmClass || 'btn-primary'} grow" id="modal-yes">${confirmLabel || 'YES'}</button>
          </div>
        </div>
      </div>`;
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') root.innerHTML = '';
    });
    document.getElementById('modal-no').addEventListener('click', () => { root.innerHTML = ''; });
    document.getElementById('modal-yes').addEventListener('click', () => {
      root.innerHTML = '';
      onConfirm && onConfirm();
    });
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
  }
  function statusMeta(status) {
    return {
      GREEN: { icon: '🟢', label: 'RUNNING', bn: 'চলমান' },
      RED: { icon: '🔴', label: 'PROBLEM', bn: 'সমস্যা' },
      YELLOW: { icon: '🟡', label: 'WORK IN PROGRESS', bn: 'মেরামত চলছে' }
    }[status] || { icon: '⚪', label: status, bn: '' };
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  global.KDM_UI = { toast, friendlyError, confirmDialog, fmtTime, fmtDate, statusMeta, escapeHtml };
})(window);
