(function (global) {
  const db = global.KDM_DB;
  const ui = global.KDM_UI;

  function scan(params, root, ctx) {
    ctx.setChrome({ title: 'Scan Machine QR', showNav: true, showBack: false });
    root.innerHTML = `
      <div class="section-title">Point camera at the machine's QR code</div>
      <div class="scan-wrap">
        <video id="scan-video" playsinline muted></video>
        <div class="scan-frame"></div>
      </div>
      <div id="scan-status" class="center muted small" style="margin-top:10px;">Starting camera…</div>
      <div class="section-title">Or choose from the machine list</div>
      <button class="btn btn-outline" id="go-list">📋 Open Machine List</button>
    `;
    document.getElementById('go-list').addEventListener('click', () => ctx.navigate('#/machines'));

    const video = document.getElementById('scan-video');
    const statusEl = document.getElementById('scan-status');
    const canvas = document.createElement('canvas');
    const canvasCtx = canvas.getContext('2d', { willReadFrequently: true });
    let stream = null;
    let rafId = null;
    let stopped = false;

    function stop() {
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach(t => t.stop());
    }
    // Stop the camera as soon as the user navigates away.
    window.addEventListener('hashchange', stop, { once: true });

    function tick() {
      if (stopped) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && typeof jsQR === 'function') {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleScan(code.data.trim());
          return;
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    function handleScan(text) {
      stop();
      const machine = db.getMachine(text);
      if (!machine) {
        statusEl.textContent = `Unrecognized code: "${text}". Try again or pick from the list.`;
        ui.toast('QR code did not match any machine.');
        start(); // retry
        return;
      }
      ui.toast(`Scanned ${machine.id}`);
      ctx.navigate(`#/machine/${encodeURIComponent(machine.id)}`);
    }

    function start() {
      stopped = false;
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          video.srcObject = s;
          video.play();
          statusEl.textContent = 'Scanning…';
          rafId = requestAnimationFrame(tick);
        })
        .catch(err => {
          console.error(err);
          statusEl.textContent = 'Camera unavailable. Use the machine list below instead.';
        });
    }
    start();
  }

  global.KDM_SCREENS = global.KDM_SCREENS || {};
  global.KDM_SCREENS.scan = scan;
})(window);
