// =====================================================================
// Generate natural-voice audio clips for the app with edge-tts.
//
//   node tools/gen_audio.mjs            # generate missing clips
//   FORCE=1 node tools/gen_audio.mjs    # regenerate everything
//   TTS_VOICE=fr-CA-SylvieNeural node tools/gen_audio.mjs
//
// It reads the spoken text straight out of index.html (bodies, quiz, etc.)
// so the audio can never drift from what the page displays. Requires
// `pip install edge-tts` and network access — no API key needed.
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = path.join(ROOT, 'audio');
const VOICE = process.env.TTS_VOICE || 'fr-FR-DeniseNeural';
const RATE = process.env.TTS_RATE || '-8%';       // a touch slower, for a child
const FORCE = !!process.env.FORCE;
const CONCURRENCY = 6;

// ---- same slug + emoji-strip logic the page uses --------------------
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const clean = (t) => t.replace(
  /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[‍]|[⭐☆⬡△⬜⭕❌✅⬅➡⬆🔄]/gu, ''
).replace(/\s+/g, ' ').trim();

// ---- pull the data arrays out of index.html -------------------------
function extractData() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const code = scripts.join('\n') +
    '\n;globalThis.__DUMP = { bodies, allQuizQuestions, successMsgs, encourageMsgs, finishMessages };';

  const el = new Proxy({}, {
    get(_, p) {
      if (p === 'style' || p === 'dataset' || p === 'classList') return el;
      if (p === 'appendChild') return (x) => x;
      return () => el;                 // any method call is a no-op returning el
    },
    set() { return true; },
  });
  const noop = () => {};
  const chainable = { then() { return chainable; }, catch() { return chainable; } };
  const sandbox = {
    document: { getElementById: () => el, createElement: () => el, body: el },
    window: { matchMedia: () => ({ matches: false, addEventListener: noop }), addEventListener: noop },
    navigator: {},
    speechSynthesis: { getVoices: () => [], addEventListener: noop, cancel: noop, speak: noop },
    SpeechSynthesisUtterance: class {},
    Audio: class { addEventListener() {} play() { return { catch() {} }; } pause() {} },
    fetch: () => chainable,
    setTimeout: () => 0,
    localStorage: { getItem: () => null, setItem: noop },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 5000 });
  return sandbox.__DUMP;
}

// ---- build the full list of clips -----------------------------------
function buildClips(d) {
  const clips = [
    { id: 'phrase-savais-tu', text: 'Le savais-tu ?' },
    { id: 'phrase-voice-on', text: 'La voix est activée !' },
  ];
  for (const b of d.bodies) {
    const sg = slug(b.name);
    clips.push({ id: `desc-${sg}`, text: clean(`${b.nameFr || b.name}. ${b.desc}`) });
    b.funFacts.forEach((f, i) => clips.push({ id: `fact-${sg}-${i}`, text: clean(f) }));
  }
  d.allQuizQuestions.forEach((q, i) => clips.push({ id: `quiz-${i}`, text: clean(q.q) }));
  d.successMsgs.forEach((m, i) => clips.push({ id: `success-${i}`, text: clean(m) }));
  d.encourageMsgs.forEach((m, i) => clips.push({ id: `encourage-${i}`, text: clean(m) }));
  d.finishMessages.forEach((t) => clips.push({ id: `finish-${t.key}`, text: clean(t.msg) }));
  return clips;
}

function tts(text, outFile) {
  return new Promise((resolve, reject) => {
    const args = ['-m', 'edge_tts', '--voice', VOICE, `--rate=${RATE}`, '--text', text, '--write-media', outFile];
    const p = spawn('python', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (c) => { err += c; });
    p.on('close', (code) => {
      if (code === 0 && fs.existsSync(outFile) && fs.statSync(outFile).size > 0) resolve();
      else reject(new Error(`edge-tts failed (${code}): ${err.trim().split('\n').pop() || ''}`));
    });
  });
}

async function main() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const clips = buildClips(extractData());
  const ids = clips.map((c) => c.id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate clip id detected');

  if (process.env.DRY) {
    console.log(`${clips.length} clips:`);
    for (const c of clips.slice(0, 4)) console.log(`  ${c.id} :: ${c.text.slice(0, 70)}`);
    console.log(`  ... last: ${clips[clips.length - 1].id} :: ${clips[clips.length - 1].text}`);
    return;
  }

  const todo = clips.filter((c) => FORCE || !fs.existsSync(path.join(AUDIO_DIR, `${c.id}.mp3`)));
  console.log(`${clips.length} clips total, ${todo.length} to generate (voice ${VOICE}, rate ${RATE})`);

  let done = 0, failed = 0;
  const queue = todo.slice();
  async function worker() {
    while (queue.length) {
      const c = queue.shift();
      const out = path.join(AUDIO_DIR, `${c.id}.mp3`);
      try { await tts(c.text, out); done++; }
      catch (e) { failed++; console.error(`  ✗ ${c.id}: ${e.message}`); }
      if ((done + failed) % 15 === 0) console.log(`  ...${done + failed}/${todo.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // manifest only lists clips whose file actually exists
  const have = ids.filter((id) => fs.existsSync(path.join(AUDIO_DIR, `${id}.mp3`)));
  fs.writeFileSync(path.join(AUDIO_DIR, 'manifest.json'), JSON.stringify(have));
  console.log(`Generated ${done}, failed ${failed}. Manifest lists ${have.length}/${ids.length} clips.`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
