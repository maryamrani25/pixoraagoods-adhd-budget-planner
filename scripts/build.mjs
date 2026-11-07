// Build script: bundles the app with esbuild, compiles Tailwind CSS v4,
// copies static files and generates the service worker.
// Usage: node scripts/build.mjs            (demo build, default)
//        APP_MODE=customer node scripts/build.mjs
//        node scripts/build.mjs --tests     (bundles unit tests only)
import { build } from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const MODE = process.env.APP_MODE === 'customer' ? 'customer' : 'demo';
const OUT = path.join(root, process.env.OUT_DIR || 'dist');

if (process.argv.includes('--tests')) {
  const outdir = path.join(root, 'dist-tests');
  fs.rmSync(outdir, { recursive: true, force: true });
  await build({
    entryPoints: [path.join(root, 'tests/calc.test.ts')],
    bundle: true, platform: 'node', format: 'esm',
    outfile: path.join(outdir, 'calc.test.mjs'),
    define: { __APP_MODE__: '"demo"', __APP_VERSION__: JSON.stringify(pkg.version) },
  });
  console.log('Unit tests bundled.');
  process.exit(0);
}

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

// 1. JavaScript
const js = await build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true, minify: true, write: false, format: 'esm', target: ['es2020', 'safari15'],
  jsx: 'automatic', legalComments: 'none',
  define: {
    'process.env.NODE_ENV': '"production"',
    __APP_MODE__: JSON.stringify(MODE),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
const jsCode = js.outputFiles[0].contents;
const jsName = `assets/app-${hash(jsCode)}.js`;
fs.writeFileSync(path.join(OUT, jsName), jsCode);

// 2. CSS (Tailwind v4, candidates scanned from source files)
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
const loadStylesheet = async (id, base) => {
  const file = id === 'tailwindcss' ? path.join(twDir, 'index.css')
    : id.startsWith('tailwindcss/') ? path.join(twDir, id.slice(12))
    : path.resolve(base, id);
  return { content: fs.readFileSync(file, 'utf8'), base: path.dirname(file), path: file };
};
const cssSrc = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const compiler = await compile(cssSrc, { base: path.join(root, 'src'), loadStylesheet });
const candidates = new Set();
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(tsx?|html)$/.test(f.name)) {
      for (const t of fs.readFileSync(p, 'utf8').split(/[\s"'`{}()<>;,]+/)) if (t) candidates.add(t);
    }
  }
};
walk(path.join(root, 'src'));
const css = compiler.build([...candidates]);
const cssName = `assets/app-${hash(css)}.css`;
fs.writeFileSync(path.join(OUT, cssName), css);

// 3. Static files
fs.cpSync(path.join(root, 'public'), OUT, { recursive: true });

// 4. index.html
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8')
  .replace('%CSS%', '/' + cssName).replace('%JS%', '/' + jsName)
  .replaceAll('%TITLE%', MODE === 'demo' ? 'PixoraaGoods ADHD Budget Planner (Demo)' : 'PixoraaGoods ADHD Budget Planner');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// 5. Service worker with precache list
const files = [];
const list = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) list(p); else files.push('/' + path.relative(OUT, p).split(path.sep).join('/'));
  }
};
list(OUT);
const precache = ['/', ...files.filter((f) => f !== '/sw.js' && f !== '/index.html' && f !== '/vercel.json')];
const version = hash(JSON.stringify(precache) + jsName + cssName + MODE);
const sw = fs.readFileSync(path.join(root, 'src/sw.template.js'), 'utf8')
  .replace('__VERSION__', `${pkg.version}-${MODE}-${version}`)
  .replace('__PRECACHE__', JSON.stringify(precache));
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);

console.log(`Built ${MODE} build v${pkg.version}: ${jsName} (${(jsCode.length / 1024).toFixed(0)} KB), ${cssName} (${(css.length / 1024).toFixed(0)} KB), ${precache.length} precached files.`);
