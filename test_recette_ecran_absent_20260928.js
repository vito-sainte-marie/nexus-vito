// ============================================================================
// UN 200 NE PROUVE PAS QUE L'ÉCRAN EST LÀ (28/09/2026)
//
// Ce que cette épreuve garde. Le 28/09, la recette navigateur du candidat #65
// a rendu « page.waitForFunction: Timeout 30000ms exceeded » et rien d'autre.
// Trente secondes d'attente, aucune attribution. La cause n'était pas dans
// l'écran : `NEXUS-Live-Developpement-v1.html` n'est pas déployé sur cette
// base, et l'hébergeur répond 200 à tout chemin absent en servant la page
// commerciale. La recette attendait donc un `#root` dans une page qui n'a
// jamais eu de `#root`, et accusait l'écran d'être cassé.
//
// La règle. Avant d'attendre quoi que ce soit d'un écran, on relève le corps
// servi pour un chemin qui ne PEUT pas exister, et tout écran dont le corps
// lui est identique est déclaré ABSENT. Le témoin est mesuré à l'exécution :
// il ne dépend ni du code HTTP, ni d'un marqueur propre à chaque écran, ni de
// l'hébergeur.
//
// Comment. Deux serveurs jetables, et non le vrai préviu : l'épreuve doit
// rester vraie hors ligne et ne rien mesurer d'un déploiement en vol.
//   - TÉMOIN       : un hébergeur qui répond 200 à tout → l'écran est déclaré
//                    absent, et le message NOMME le fichier et la base.
//   - CONTRE-TÉMOIN: le même hébergeur servant réellement l'écran → aucune
//                    levée. Sans lui, un `exigerEcranServi` qui lèverait
//                    toujours passerait pour vert.
//   - TROISIÈME    : un hébergeur qui rend un 404 franc → l'écran n'est pas
//                    déclaré absent par le témoin (corps différent), ce qui
//                    montre que la garde mesure le CORPS, pas le statut.
// ============================================================================
'use strict';
const assert = require('assert');
const http = require('http');

const recette = require('./outils/recette-navigateur-test.js');

const PAGE_COMMERCIALE = '<!doctype html><title>NEXUS</title><h2>Ce qui ne changera jamais</h2>';
const ECRAN = 'NEXUS-Live-Developpement-v1.html';

function serveur(repondre) {
  return new Promise(resolve => {
    const s = http.createServer(repondre);
    s.listen(0, '127.0.0.1', () => resolve({
      base: `http://127.0.0.1:${s.address().port}/`,
      fermer: () => new Promise(r => s.close(r))
    }));
  });
}

async function leve(f) {
  try { await f(); return null; } catch (e) { return e; }
}

(async () => {
  // --- TÉMOIN : 200 sur tout ---------------------------------------------
  let h = await serveur((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(PAGE_COMMERCIALE);
  });
  let temoin = await recette.releverTemoinAbsence(h.base);
  assert.ok(temoin, 'le témoin d\'absence doit être mesurable');
  let e = await leve(() => recette.exigerEcranServi(h.base, ECRAN));
  assert.ok(e, 'un hébergeur qui répond 200 à tout doit faire déclarer l\'écran absent');
  assert.ok(e.message.includes(ECRAN), 'le message doit NOMMER le fichier manquant');
  assert.ok(e.message.includes(h.base), 'le message doit NOMMER la base');
  assert.ok(/sha256:/.test(e.message), 'le message doit porter l\'empreinte mesurée');
  await h.fermer();

  // --- CONTRE-TÉMOIN : le même hébergeur, mais l'écran est là -------------
  h = await serveur((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(req.url.includes('NEXUS-Live-Developpement-v1')
      ? '<!doctype html><title>NEXUS Live</title><div id="root">vivant</div>'
      : PAGE_COMMERCIALE);
  });
  await recette.releverTemoinAbsence(h.base);
  e = await leve(() => recette.exigerEcranServi(h.base, ECRAN));
  assert.strictEqual(e, null, 'un écran réellement servi ne doit JAMAIS être déclaré absent');
  await h.fermer();

  // --- TROISIÈME : un 404 franc n'est pas le témoin ----------------------
  h = await serveur((req, res) => {
    if (req.url.includes('NEXUS-Live-Developpement-v1')) {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>NEXUS Live</title><div id="root">vivant</div>');
    } else {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>404</title>introuvable');
    }
  });
  await recette.releverTemoinAbsence(h.base);
  e = await leve(() => recette.exigerEcranServi(h.base, ECRAN));
  assert.strictEqual(e, null, 'la garde mesure le corps servi, pas le statut HTTP');
  await h.fermer();

  console.log('OK — l\'écran absent derrière un 200 est nommé, et l\'écran présent ne l\'est pas.');
})().catch(e => { console.error('ÉCHEC : ' + e.message); process.exit(1); });
