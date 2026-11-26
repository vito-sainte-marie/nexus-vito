// Recette mobile du 25/11/2026 (Guardian 7180536030) : sur téléphone, « Dossier comptable » et
// « Décisions » doivent ouvrir leur panneau (il restait masqué), la barre du bas ne porte que
// ces deux boutons, et Valider / Transmettre vivent dans le dossier avec leur raison visible.
// RÉEL : la vraie page NEXUS-Paye-v1.html, ses vrais scripts (moteur, données, validation, PDF),
// un vrai Chromium (Playwright). SIMULÉ : le client Supabase (données fictives « Recette… »),
// supabase-js et pdf-lib (scripts CDN remplacés par des coquilles). Aucune base, aucun réseau.
// Usage : node test_paye_mobile_panneau_playwright.js [--captures <dossier>]
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
  catch (e2) { console.log('SAUTÉ — Playwright indisponible : ' + e2.message.split('\n')[0]); process.exit(0); }
}
const racine = __dirname;
const iCap = process.argv.indexOf('--captures');
const dossierCap = iCap > 0 ? process.argv[iCap + 1] : null;
if (dossierCap) fs.mkdirSync(dossierCap, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const serveur = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'NEXUS-Paye-v1.html';
  // Le build pose nexus-config.js (jamais versionné) puis nexus-page.js avant nexus-auth.js : on le reproduit.
  if (rel === 'nexus-build-stub.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end("window.NexusBuild={id:'recette',versionner:function(u){return u;}};"); }
  if (rel === 'nexus-config.js') { res.writeHead(200, { 'content-type': MIME['.js'] }); return res.end("window.NEXUS_CONFIG={supabaseUrl:'http://127.0.0.1:1',supabaseCle:'cle-fictive',environnement:'test'};"); }
  if (rel === 'NEXUS-Paye-v1.html') {
    const h = fs.readFileSync(path.join(racine, rel), 'utf8').replace(/(<script src="nexus-auth\.js)/, '<script src="nexus-build-stub.js"></script>\n<script src="nexus-config.js"></script>\n<script src="nexus-page.js"></script>\n$1');
    res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(h);
  }
  const f = path.join(racine, rel);
  if (!f.startsWith(racine) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

const COQUILLE_SUPABASE = `(function(){
  const MANAGER={id:'m-1',username:'recette.gerant',nom:'RecetteGérant',role:'gerant',est_createur:true,site_id:'nexus-station-test'};
  const d=new Date(), iso=(j)=>{const x=new Date(d.getFullYear(),d.getMonth(),j);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(j).padStart(2,'0')};
  const T={
    employees:[{id:'e-a',username:'recette.a',nom:'RecettePayeA',role:'employe',actif:true,site_id:'nexus-station-test'},{id:'e-b',username:'recette.b',nom:'RecettePayeB',role:'employe',actif:true,site_id:'nexus-station-test'}],
    v_planning_officiel:[{id:'p1',employee_id:'e-a',date:iso(3),quart:'Q1',statut:'travail',duree_heures:8,heure_debut:'06:00',heure_fin:'14:00',tache:'Piste'},{id:'p2',employee_id:'e-b',date:iso(4),quart:'Q2',statut:'travail',duree_heures:8,heure_debut:'14:00',heure_fin:'22:00',tache:'Boutique'}],
    station_config:[{paye_config:{},horaires:{},planning_source:'nexus',pointage_actif:false}]
  };
  function q(table){
    const o={_t:table};
    ['select','eq','neq','lt','lte','gt','gte','in','is','not','or','order','limit','range','filter','match','contains','ilike','like'].forEach(m=>o[m]=()=>o);
    const rows=()=>T[table]||[];
    o.single=async()=>({data:table==='employees'?MANAGER:(rows()[0]||null),error:null});
    o.maybeSingle=async()=>({data:table==='employees'?MANAGER:(rows()[0]||null),error:null});
    o.then=(res,rej)=>Promise.resolve({data:rows(),error:null}).then(res,rej);
    o.insert=o.upsert=o.update=o.delete=()=>o;
    return o;
  }
  const client={
    auth:{getSession:async()=>({data:{session:{user:{id:'m-1'}}}}),signOut:async()=>({}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getUser:async()=>({data:{user:{id:'m-1'}}})},
    from:q, rpc:async()=>({data:[],error:null}),
    channel:()=>({on(){return this},subscribe(){return this}}), removeChannel(){},
    functions:{invoke:async()=>({data:null,error:null})},
    storage:{from:()=>({upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:''}})})}
  };
  window.supabase={createClient:()=>client};
})();`;

async function ouvrir(browser, largeur, hauteur, theme) {
  const ctx = await browser.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.route(/cdn\.jsdelivr|unpkg|cdnjs/, r => {
    const u = r.request().url();
    r.fulfill({ contentType: 'application/javascript', body: /supabase/i.test(u) ? COQUILLE_SUPABASE : 'window.PDFLib=window.PDFLib||{rgb:function(){return {}},StandardFonts:{Helvetica:"H",HelveticaBold:"HB"},PDFDocument:{}};' });
  });
  const page = await ctx.newPage();
  const erreurs = []; page.on('pageerror', e => erreurs.push(e.message));
  await page.addInitScript(t => { try { localStorage.setItem('nexus-theme', t); localStorage.setItem('theme', t); } catch (e) {} document.documentElement && document.documentElement.setAttribute('data-theme', t); }, theme);
  return { ctx, page, erreurs };
}

let ok = 0, ko = 0;
async function t(nom, fn) { try { await fn(); ok++; console.log('OK  — ' + nom); } catch (e) { ko++; console.log('ROUGE — ' + nom + ' : ' + e.message.split('\n')[0]); } }
const assert = require('assert');

(async () => {
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + serveur.address().port + '/NEXUS-Paye-v1.html';
  const browser = await chromium.launch();
  try {
    for (const [l, h] of [[375, 812], [390, 844]]) for (const theme of ['jour', 'nuit']) {
      const { ctx, page, erreurs } = await ouvrir(browser, l, h, theme);
      await page.goto(base);; await page.waitForSelector('.hero', { timeout: 4000 }).catch(() => {});
      const vp = `${l}×${h} ${theme}`;
      await t(`${vp} : la page se charge sans erreur de script`, async () => { assert.ok(await page.$('.hero'), 'écran Paye absent'); assert.deepStrictEqual(erreurs, []); });
      if (dossierCap) await page.screenshot({ path: path.join(dossierCap, `paye-${l}-${theme}-1-accueil.png`) });
      await t(`${vp} : la barre du bas ne porte que « Décisions » et « Dossier comptable », sur une ligne`, async () => {
        const v = await page.$$eval('.hero>.topacts .btn', bs => bs.filter(b => b.offsetParent !== null).map(b => ({ t: b.textContent.trim().replace(/\s+/g, ' '), y: Math.round(b.getBoundingClientRect().top), r: Math.round(b.getBoundingClientRect().right) })));
        assert.strictEqual(v.length, 2, 'boutons visibles : ' + JSON.stringify(v));
        assert.ok(/Décisions/.test(v[0].t) && /Dossier comptable/.test(v[1].t), JSON.stringify(v));
        assert.strictEqual(v[0].y, v[1].y, 'pas sur la même ligne'); assert.ok(v[1].r <= l, 'déborde à droite');
      });
      await t(`${vp} : « Dossier comptable » ouvre le panneau, plein écran, avec « Télécharger le PDF » visible sans défiler`, async () => {
        await page.getByRole('button', { name: /Dossier comptable/ }).first().click();
        await page.waitForSelector('.workspace.feuille .panel', { state: 'visible', timeout: 3000 });
        const r = await page.evaluate(() => { const p = document.querySelector('.workspace.feuille .panel').getBoundingClientRect(); const b = [...document.querySelectorAll('.workspace.feuille .panel button')].find(x => /Télécharger/.test(x.textContent)); const bb = b && b.getBoundingClientRect(); return { pw: Math.round(p.width), ph: Math.round(p.height), b: bb ? { top: Math.round(bb.top), bottom: Math.round(bb.bottom), w: Math.round(bb.width) } : null, vh: innerHeight, vw: innerWidth }; });
        assert.ok(r.pw >= r.vw - 1 && r.ph >= r.vh - 1, 'panneau pas plein écran ' + JSON.stringify(r));
        assert.ok(r.b, 'bouton Télécharger introuvable'); assert.ok(r.b.top >= 0 && r.b.bottom <= r.vh, 'Télécharger hors de l’écran ' + JSON.stringify(r));
      });
      if (dossierCap) await page.screenshot({ path: path.join(dossierCap, `paye-${l}-${theme}-2-dossier.png`) });
      await t(`${vp} : Valider et Transmettre sont dans le dossier, avec leur raison lisible quand ils sont inactifs`, async () => {
        const v = await page.evaluate(() => { const z = document.querySelector('.workspace.feuille #validMobile'); if (!z) return null; const vis = e => e && e.offsetParent !== null; return { titre: !!z.querySelector('.bloc-titre'), boutons: [...z.querySelectorAll('.btn')].filter(vis).map(b => ({ t: b.textContent.trim(), off: b.disabled || b.getAttribute('aria-disabled') === 'true' })), raisons: [...z.querySelectorAll('.raison')].filter(vis).map(x => x.textContent.trim()) }; });
        assert.ok(v, '#validMobile absent'); assert.ok(v.boutons.length >= 1, 'aucun bouton');
        if (v.boutons.some(b => b.off)) assert.ok(v.raisons.length >= 1 && v.raisons.every(x => x.length > 5), 'bouton inactif sans raison visible ' + JSON.stringify(v));
      });
      await t(`${vp} : « ‹ Retour » referme la feuille`, async () => {
        await page.click('.workspace.feuille #retourFeuille');
        await page.waitForFunction(() => !document.querySelector('.workspace.feuille'), null, { timeout: 3000 });
        assert.ok(await page.$('.hero'), 'écran d’accueil absent après retour');
      });
      await t(`${vp} : « Décisions » ouvre aussi son panneau, et le « + » ne recouvre pas la barre`, async () => {
        const rien = await page.evaluate(() => { const plus = document.querySelector('.fab,.btn-plus,#fabAjout,.add-fab'); const bar = document.querySelector('.hero>.topacts'); if (!plus || !bar) return null; const a = plus.getBoundingClientRect(), b = bar.getBoundingClientRect(); return a.bottom <= b.top + 1; });
        if (rien !== null) assert.ok(rien, 'le « + » chevauche la barre');
        await page.getByRole('button', { name: /Décisions/ }).first().click();
        await page.waitForSelector('.workspace.feuille .panel', { state: 'visible', timeout: 3000 });
      });
      if (dossierCap) await page.screenshot({ path: path.join(dossierCap, `paye-${l}-${theme}-3-decisions.png`) });
      await ctx.close();
    }
  } finally { await browser.close(); serveur.close(); }
  console.log(`\n${ok} OK, ${ko} rouge(s)`); process.exit(ko ? 1 : 0);
})();
