#!/usr/bin/env node
/* Generates the Play Store phone screenshots from the real store build.
 *
 * These are not mockups: each shot loads www/index.html unmodified and then
 * drives the app through its own code paths — the built-in DEMO tape, the
 * real extractor, the real renderer — so what's captured is what the app
 * actually draws. The only state set by hand is S.wh.ready, which is the
 * steady state for anyone past first launch (the Whisper model downloads
 * once and is cached); letting it genuinely download would mean an 80 MB
 * fetch per shot and a "preparing" banner in every frame.
 *
 *   node tools/make-shots.mjs            # writes www/shot-*.html
 *   node tools/make-shots.mjs --capture  # also drives headless Chrome
 *
 * Requires the store build to exist (node tools/build-store.mjs) and, for
 * --capture, a local server on the port below. Start it from the repo root
 * (`npx http-server ./www -p 8099 -c-1`) rather than from inside www/ — on
 * Windows a process whose cwd is www/ holds a lock on the directory, and the
 * next build-store run then fails to clear it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const www = path.join(root, 'www');
const outDir = path.join(root, 'assets', 'store', 'screenshots');
const PORT = 8099;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Play wants 16:9 or 9:16, so each target is a CSS viewport times a device
// scale factor that lands on an exact 9:16 pixel size. The CSS width is what
// the app actually lays out against, so it has to be a plausible width for
// the device class — at 450 CSS px the phone layout fills the screen, while
// at tablet widths the app centres its device frame, which is its real
// appearance on a tablet rather than a stretched phone shot.
const TARGETS = [
  // phone: 1080x1920. 450 CSS px is the narrowest width that doesn't clip
  // the device chrome (360 and 432 both cut off the settings gear).
  { dir: 'phone', w: 450, h: 800, scale: 2.4 },
  // 7-inch tablet: 1080x1920 at a 540dp-wide layout
  { dir: 'tablet7', w: 540, h: 960, scale: 2 },
  // 10-inch tablet: 1440x2560 at a 720dp-wide layout (10-inch shots must be
  // at least 1080 px on every side, so the phone size would not qualify)
  { dir: 'tablet10', w: 720, h: 1280, scale: 2 },
];

const src = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
if (!src.includes('</body>')) throw new Error('no </body> in store build');

// The app is wrapped in an IIFE, so none of its internals are reachable from
// here. That's a feature for these shots: every scenario below drives the UI
// by clicking the same controls a user would, so nothing can diverge from
// real behaviour. Timing is handled by the virtual-time budget — the capture
// happens when the budget runs out, so the budget *is* the shutter release.
const scenarios = [
  {
    name: '1-capture',
    budget: 4000,
    script: `engineReady();`,
  },
  {
    name: '2-recording',
    // demo tape is ~110ms/word over ~66 words, so ~4s in lands mid-take:
    // live meter, transcript half filled
    budget: 4200,
    script: `engineReady(); click('#chipDemo');`,
  },
  {
    name: '3-ticket',
    // tape runs itself out, stopDemo() -> finishTake() -> go(2) after 600ms
    budget: 15000,
    script: `click('#chipDemo');`,
  },
  {
    name: '4-settings',
    budget: 5000,
    script: `engineReady(); click('#btnSettings');`,
  },
];

const runner = (body) => `
<script>
(function(){
  function click(sel){
    var e = document.querySelector(sel);
    if (!e) throw new Error('no element for ' + sel);
    e.click();
  }
  // Shows the engine line as it reads once the model is cached, which is the
  // steady state for every launch after the first. The alternative is an
  // 80 MB download inside each capture, which under a virtual-time budget
  // never finishes — so every shot would claim "preparing" forever. The
  // string is the app's own; only the timing is being sidestepped.
  function engineReady(){
    setInterval(function(){
      document.querySelectorAll('.eyebrow, .st, .status, div, span').forEach(function(n){
        if (n.children.length === 0 && /Whisper · preparing on this device/i.test(n.textContent))
          n.textContent = n.textContent.replace(/Whisper · preparing on this device/i, 'Whisper cached · works offline');
      });
    }, 120);
  }
  function start(){
    try{ ${body} }
    catch(e){
      // make failures loud: a silent no-op looks exactly like a good idle shot
      var b=document.createElement('div');
      b.style.cssText='position:fixed;inset:0;z-index:99999;background:#b00;color:#fff;font:16px monospace;padding:24px;white-space:pre-wrap';
      b.textContent='SHOT ERROR\\n'+(e&&e.stack||e);
      document.body.appendChild(b);
    }
  }
  // deliberately not the load event: the Whisper model fetch keeps the page
  // "loading" indefinitely under a virtual-time budget, so load never fires
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(start, 300); });
  else setTimeout(start, 300);
})();
</script>
`;

for (const s of scenarios) {
  const html = src.replace('</body>', runner(s.script) + '</body>');
  fs.writeFileSync(path.join(www, 'shot-' + s.name + '.html'), html);
  console.log('wrote www/shot-' + s.name + '.html');
}

if (process.argv.includes('--capture')) {
  for (const t of TARGETS) {
    const dir = path.join(outDir, t.dir);
    fs.mkdirSync(dir, { recursive: true });
    for (const s of scenarios) {
      const out = path.join(dir, s.name + '.png');
      execFileSync(CHROME, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--window-size=' + t.w + ',' + t.h,
        '--force-device-scale-factor=' + t.scale,
        '--virtual-time-budget=' + s.budget,
        '--screenshot=' + out,
        'http://localhost:' + PORT + '/shot-' + s.name + '.html',
      ], { stdio: 'pipe' });
      console.log('captured', path.relative(root, out),
        '(' + t.w * t.scale + 'x' + t.h * t.scale + ')');
    }
  }
  // These are full copies of the app with a debug harness stapled on, and
  // `npx cap sync` ships anything sitting in www/. Never leave them there.
  for (const s of scenarios) fs.rmSync(path.join(www, 'shot-' + s.name + '.html'), { force: true });
  console.log('cleaned up www/shot-*.html');
}
