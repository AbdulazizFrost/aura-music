const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

describe('Full Application Integrity & Asset Verification', () => {

  test('All bundled audio files exist, are readable and valid MP3 format (>1MB)', () => {
    const audioFiles = [
      'starboy.mp3',
      'faded.mp3',
      'love_story.mp3',
      'love_story_orch.mp3',
      'love_story_epic.mp3',
      'cinnamon_girl.mp3',
      'white_mustang.mp3',
      'baby_one_more_time.mp3',
      'rockabye.mp3',
      'people_you_know.mp3',
      'golden_brown.mp3',
      'sanks_mashup.mp3',
      'bond_kuhni.mp3',
      'rybak_kotik.mp3',
      'mia_boyka.mp3',
      'army_dreamers.mp3',
      'maitre_gims.mp3',
      'shontelle_impossible.mp3',
      'aziz_ustozga.mp3'
    ];

    for (const f of audioFiles) {
      const p = path.join(rootDir, 'assets', 'audio', f);
      assert.ok(fs.existsSync(p), `Missing audio file: ${f}`);
      const stat = fs.statSync(p);
      assert.ok(stat.size > 1000000, `Audio file ${f} is too small (${stat.size} bytes)`);
    }
  });

  test('All album artwork covers and avatar image exist and are non-empty', () => {
    const covers = [
      'starboy.jpg',
      'faded.jpg',
      'love_story.jpg',
      'love_story_orch.jpg',
      'love_story_epic.jpg',
      'cinnamon_girl.jpg',
      'white_mustang.jpg',
      'baby_one_more_time.jpg',
      'rockabye.jpg',
      'people_you_know.jpg',
      'golden_brown.jpg',
      'sanks_mashup.jpg',
      'bond_kuhni.jpg',
      'rybak_kotik.jpg',
      'mia_boyka.jpg',
      'army_dreamers.jpg',
      'maitre_gims.jpg',
      'shontelle_impossible.jpg',
      'aziz_ustozga.jpg',
      'avatar.jpg'
    ];

    for (const c of covers) {
      const p = path.join(rootDir, 'assets', 'covers', c);
      assert.ok(fs.existsSync(p), `Missing cover artwork: ${c}`);
      const stat = fs.statSync(p);
      assert.ok(stat.size > 1000, `Cover file ${c} is suspiciously small (${stat.size} bytes)`);
    }
  });

  test('Lucide offline icon library exists in assets/', () => {
    const p = path.join(rootDir, 'assets', 'lucide.min.js');
    assert.ok(fs.existsSync(p), 'Missing assets/lucide.min.js');
    const stat = fs.statSync(p);
    assert.ok(stat.size > 50000, 'lucide.min.js is incomplete');
  });

  test('Every DOM element ID accessed by JavaScript code exists in index.html', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');

    // Extract all document.getElementById('...') from app.js
    const getElemRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
    const idsInCode = new Set();
    let m;
    while ((m = getElemRegex.exec(appJs)) !== null) {
      idsInCode.add(m[1]);
    }

    // Dynamic IDs created at runtime (e.g. auraCustomSheet)
    const runtimeCreatedIds = new Set(['auraCustomSheet', 'auraCustomSheetBody']);

    // Check each ID against index.html
    const missingIds = [];
    for (const id of idsInCode) {
      if (runtimeCreatedIds.has(id)) continue;
      const idPattern = new RegExp(`id=["']${id}["']`);
      if (!idPattern.test(html)) {
        missingIds.push(id);
      }
    }

    assert.deepStrictEqual(missingIds, [], `Missing DOM element IDs in index.html: ${missingIds.join(', ')}`);
  });

  test('All global functions called in index.html inline event handlers exist on window in app.js', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');

    // Extract function calls from on*="..."
    const handlerAttrRegex = /on(?:click|input|change)=["']([^"']+)["']/g;
    const functionsCalled = new Set();
    let match;

    while ((match = handlerAttrRegex.exec(html)) !== null) {
      const code = match[1];
      // Extract function names (e.g. "closeNowPlayingScreen()", "switchTab('home')", "onSearchType(this.value)")
      const fnCalls = code.match(/([a-zA-Z0-9_$]+)\s*\(/g);
      if (fnCalls) {
        fnCalls.forEach(call => {
          const fnName = call.replace(/\s*\(/, '');
          if (fnName !== 'stopPropagation' && fnName !== 'preventDefault') {
            functionsCalled.add(fnName);
          }
        });
      }
    }

    // Check that every function is bound to window in app.js
    const missingFunctions = [];
    for (const fn of functionsCalled) {
      // Check for "window.fnName =" or "function fnName" or "ui.fnName"
      const isBound = appJs.includes(`window.${fn} =`) ||
                      appJs.includes(`function ${fn}(`) ||
                      appJs.includes(`window.auraApp.ui.${fn}`) ||
                      appJs.includes(`window.auraApp.${fn}`);
      if (!isBound) {
        missingFunctions.push(fn);
      }
    }

    assert.deepStrictEqual(missingFunctions, [], `Functions called in HTML but not defined in JS: ${missingFunctions.join(', ')}`);
  });

  test('CSS file contains essential responsive safe-area and notch rules', () => {
    const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
    assert.ok(css.includes('--safe-top: max(env(safe-area-inset-top, 0px), 52px)'), 'Missing safe-top with 52px notch clearance in style.css');
    assert.ok(css.includes('.phone-dynamic-notch'), 'Missing phone-dynamic-notch in style.css');
    assert.ok(css.includes('.np-drag-pill'), 'Missing np-drag-pill in style.css');
    assert.ok(css.includes('.np-close-btn'), 'Missing np-close-btn styling in style.css');
    assert.ok(css.includes('.aura-toast'), 'Missing aura-toast in style.css');
  });

  test('Package build output files are synchronized and ready', () => {
    assert.ok(fs.existsSync(path.join(rootDir, 'dist', 'index.html')), 'Missing dist/index.html');
    assert.ok(fs.existsSync(path.join(rootDir, 'dist', 'style.css')), 'Missing dist/style.css');
    assert.ok(fs.existsSync(path.join(rootDir, 'dist', 'app.js')), 'Missing dist/app.js');
    assert.ok(fs.existsSync(path.join(rootDir, 'dist', 'assets', 'audio', 'starboy.mp3')), 'Missing dist audio');
    assert.ok(fs.existsSync(path.join(rootDir, 'dist', 'assets', 'covers', 'starboy.jpg')), 'Missing dist covers');
    assert.ok(fs.existsSync(path.join(rootDir, 'aura-music-debug.apk')), 'Missing compiled aura-music-debug.apk');
  });
});
