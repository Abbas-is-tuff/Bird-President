// Offline build: bundles every module + Three.js + fonts into ONE index.html (no internet needed),
// plus sw.js / manifest for installing as an app. Output: dist/bird-president/
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'dist', 'bird-president');
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const js = (await build({ entryPoints: [path.join(root, 'js/main.js')], bundle: true, format: 'esm', minify: true, target: 'es2020', write: false, legalComments: 'none' })).outputFiles[0].text;

const font = (pkgName, file) => fs.readFileSync(path.join(root, 'node_modules/@fontsource', pkgName, 'files', file)).toString('base64');
const faces = [
  ['IBM Plex Sans', 'ibm-plex-sans', 400], ['IBM Plex Sans', 'ibm-plex-sans', 500], ['IBM Plex Sans', 'ibm-plex-sans', 600],
  ['IBM Plex Mono', 'ibm-plex-mono', 400], ['IBM Plex Mono', 'ibm-plex-mono', 500],
  ['Source Serif 4', 'source-serif-4', 600], ['Source Serif 4', 'source-serif-4', 700],
].map(([fam, p, w]) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${font(p, `${p}-latin-${w}-normal.woff2`)}) format('woff2')}`).join('\n');
const css = fs.readFileSync(path.join(root, 'css/main.css'), 'utf8');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html
  .replace(/<link rel="preconnect"[^>]*>\n?/g, '')
  .replace(/<link href="https:\/\/fonts\.googleapis[^>]*>\n?/, '')
  .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
  .replace('<link rel="stylesheet" href="css/main.css">', `<meta name="theme-color" content="#070d18">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Bird President">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>${faces}\n${css}</style>`)
  .replace('<script type="module" src="js/main.js"></script>', () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>
<script>if('serviceWorker' in navigator&&location.protocol!=='file:')addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})});</script>`);
if (/https?:\/\/(cdn|fonts|unpkg)/.test(html.replace(/https:\/\/github\.com[^"']*/g, ''))) console.warn('WARNING: external URL left in build');
fs.writeFileSync(path.join(out, 'index.html'), html);

fs.writeFileSync(path.join(out, 'sw.js'), `// Bird President offline cache. Bump V on every release so players get the update.
const V='bird-president-v${VERSION}';
const CORE=['./','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(async c=>{
 await c.add(new Request('index.html',{cache:'reload'}));
 await Promise.all(CORE.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})));
}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// newest version when online (3 s limit), saved copy when offline or slow
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 e.respondWith((async()=>{
  const c=await caches.open(V);
  const net=fetch(new Request(r.url,{cache:'no-store',credentials:'same-origin'})).then(res=>{if(res&&res.ok)c.put(r,res.clone()).catch(()=>{});return res});
  const hit=await c.match(r,{ignoreSearch:true})||(r.mode==='navigate'?await c.match('index.html'):undefined);
  if(!hit)return net;
  return Promise.race([net,new Promise((_,rej)=>setTimeout(rej,3000))]).catch(()=>hit);
 })())});
`);

fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Bird President', short_name: 'Bird President', description: 'A realistic political and geopolitical simulator starring a nation of birds.',
  start_url: './index.html', scope: './', display: 'fullscreen', display_override: ['fullscreen', 'standalone'], orientation: 'any',
  background_color: '#070d18', theme_color: '#070d18',
  icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
}, null, 1));
console.log(`Built v${VERSION}: index.html ${(html.length / 1024 / 1024).toFixed(2)} MB`);
