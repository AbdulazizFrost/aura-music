const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

const { execSync } = require('child_process');

console.log('[AURA BUILD] Step 0: Compiling application bundle...');
execSync('node scripts/build-bundle.js', { stdio: 'inherit' });

console.log('[AURA BUILD] Bundling web application for native distribution...');

// Ensure dist directory exists
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Files to copy
const filesToCopy = ['index.html', 'style.css', 'app.js'];
for (const file of filesToCopy) {
  const src = path.join(rootDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[AURA BUILD] Copied ${file}`);
  }
}

// Copy assets
const assetsSrc = path.join(rootDir, 'assets');
const assetsDest = path.join(distDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  copyRecursive(assetsSrc, assetsDest);
  console.log('[AURA BUILD] Copied assets directory (audio, covers, icons)');
}

console.log('[AURA BUILD] Bundle completed successfully -> ' + distDir);
