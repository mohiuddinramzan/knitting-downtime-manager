/**
 * Build script for Knitting Machine Downtime Manager.
 * This app is plain HTML/CSS/JS on purpose (factory devices are often
 * low/mid-range Android phones — no heavy bundler needed).
 * This script just assembles everything Capacitor needs into ./www
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www');

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('[build] cleaning www/ ...');
rimraf(OUT);
fs.mkdirSync(OUT, { recursive: true });

console.log('[build] copying index.html ...');
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(OUT, 'index.html'));

console.log('[build] copying src/ ...');
copyDir(path.join(ROOT, 'src'), path.join(OUT, 'src'));

console.log('[build] copying public/ ...');
if (fs.existsSync(path.join(ROOT, 'public'))) {
  copyDir(path.join(ROOT, 'public'), path.join(OUT, 'public'));
}

console.log('[build] done. Output in ./www');
