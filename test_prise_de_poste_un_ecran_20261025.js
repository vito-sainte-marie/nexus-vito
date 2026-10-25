// Prise de poste en un écran (lot PRISE-DE-POSTE-UN-ECRAN-20261025).
//
// Contrat gardé ici, sans réseau :
//  - trois cartes Piste, Caisse, Renfort, aucune présélectionnée ;
//  - UN SEUL appui : le clic d'une carte appelle l'unique écriture, puis
//    ouvre la suite (jaugeage du fil pour Piste, Missions pour les autres) ;
//  - le rappel de sécurité est dans le HTML initial, sans appui, texte inchangé ;
//  - le manager garde son arrivée ;
//  - « Ma progression » reste visible et ne crée ni service, ni pointage, ni retard.
// Chaque garde est suivie d'une mutation qui doit la faire rougir.
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const R = __dirname;
const lire = f => fs.readFileSync(path.join(R, f), 'utf8');
const MOD = lire('nexus-prise-de-poste.js');
const APP = lire('NEXUS-App-v1.html');
const PAGE = lire('NEXUS-Prise-De-Poste-v1.html');

function corps(src, debut) {
  const i = src.indexOf(debut);
  assert.ok(i !== -1, `${debut} introuvable`);
  const o = src.indexOf('{', src.indexOf(')', i));
  let d = 0;
  for (let k = o; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(o, k + 1);
  }
  throw new Error('accolades déséquilibrées');
}

const GARDES = [];
function garde(nom, test, mutation) { GARDES.push({ nom, test, mutation }); }

// 1. Trois cartes, aucune présélection.
garde('trois cartes Piste, Caisse, Renfort',
  m => /label: 'Piste'/.test(m) && /label: 'Caisse'/.test(m) && /label: 'Renfort'/.test(m),
  m => m.replace("label: 'Caisse'", "label: 'Boutique'"));
garde('aucune carte présélectionnée',
  m => { const f = corps(m, 'function renderChoixPoste()'); return !/selected|checked|aria-pressed="true"/.test(f); },
  m => m.replace('class="pdp-carte" data-role', 'class="pdp-carte selected" data-role'));

// 2. Un seul appui.
garde('le clic d’une carte appelle directement la prise de poste',
  m => /addEventListener\('click', \(\) => confirmerPriseDePoste\(el\.dataset\.role, el\)\)/.test(m),
  m => m.replace("confirmerPriseDePoste(el.dataset.role, el)", "renderResume(el.dataset.role)"));
garde('aucun bouton « Continuer » entre la carte et la suite',
  m => { const c = corps(m, 'async function confirmerPriseDePoste('); const f = corps(m, 'function renderChoixPoste()');
    return !/Continuer/.test(c) && !/Continuer/.test(f) && !/id="btnConfirmer"/.test(m); },
  m => m.replace('<p class="pdp-sous">', '<button id="btnConfirmer">Continuer</button><p class="pdp-sous">'));
garde('Piste ouvre le jaugeage du fil, les autres Missions',
  m => { const f = corps(m, 'function destinationApresPriseDePoste()');
    return /roleChoisi !== 'pompiste'\) return 'NEXUS-Missions-v1\.html'/.test(f) && /return NexusFilDebutQuart\.ACCUEIL_DEMARRAGE/.test(f); },
  m => m.replace("return NexusFilDebutQuart.ACCUEIL_DEMARRAGE;", "return 'NEXUS-Missions-v1.html';"));
garde('une seule écriture : nexus_changer_de_quart',
  m => (m.match(/\.rpc\('nexus_changer_de_quart'/g) || []).length === 1 && !/\.from\('(shifts|pointages)'\)\s*\.(insert|upsert|update)/.test(m),
  m => m.replace("function preparer(", "async function ecrire(){ await nexusClient.from('shifts').insert({}); }\n  function preparer("));

// 3. Rappel de sécurité sans appui, texte inchangé.
garde('le rappel de sécurité est dans le rendu initial des cartes',
  m => { const f = corps(m, 'function renderChoixPoste()');
    return /id="rappelSecurite"/.test(f) && /Strictement interdit/.test(f) && /N'utilisez jamais NEXUS ni votre téléphone à la vue d'un client/.test(f); },
  m => m.replace('Strictement interdit', 'Interdit'));

// 4. Manager inchangé.
garde('le manager garde son arrivée (Manager-App, pas de choix forcé)',
  m => /if \(estNiveauManagerCourant\(\)\) return 'NEXUS-App-v1\.html'/.test(corps(m, 'function destinationApresPriseDePoste()')),
  m => m.replace("'NEXUS-App-v1.html'", "'NEXUS-Missions-v1.html'"));

// 5. Accueil : pas de redirection d'office, « Ma progression » visible et sans écriture.
function gardesApp(app) {
  const f = corps(app, 'function renderPrisePoste(');
  return {
    monte: /NexusPriseDePoste\.monter\(hote, employee\)/.test(f),
    manager: /if \(estNiveauManager\)[\s\S]*?cheminService/.test(f),
    sansEcriture: !/\.(insert|upsert|update|delete)\(|\.rpc\(/.test(f),
    progressionVisible: /id="maProgressionMini"/.test(app) && /sans-service > :not\(#maProgressionMini\)/.test(app),
    termine: /Votre service est terminé/.test(app) && /wrapEl\.after\(hotePdp\)/.test(app),
    pasDeRedirection: !/location\.(href|replace)\s*=[^;]*Prise-De-Poste/.test(app),
  };
}

let ok = 0;
for (const g of GARDES) {
  assert.ok(g.test(MOD), `garde rouge : ${g.nom}`);
  const mut = g.mutation(MOD);
  assert.notStrictEqual(mut, MOD, `mutation sans effet : ${g.nom}`);
  let rougit;
  try { rougit = !g.test(mut); } catch (e) { rougit = true; }
  assert.ok(rougit, `la mutation ne fait pas rougir : ${g.nom}`);
  console.log('OK  —', g.nom); ok++;
}

const base = gardesApp(APP);
for (const [k, v] of Object.entries(base)) { assert.ok(v, `Accueil : ${k}`); console.log('OK  — Accueil :', k); ok++; }

const mutApp = {
  monte: APP.replace('NexusPriseDePoste.monter(hote, employee)', 'void 0'),
  sansEcriture: APP.replace("NexusPriseDePoste.monter(hote, employee).catch(() => {});", "nexusClient.from('shifts').insert({});"),
  progressionVisible: APP.replace('sans-service > :not(#maProgressionMini)', 'sans-service > :not(#autre)'),
  termine: APP.replace('wrapEl.after(hotePdp)', 'void 0'),
  manager: APP.replace('cheminService', 'autreId'),
};
for (const [k, src] of Object.entries(mutApp)) {
  assert.notStrictEqual(src, APP, `mutation Accueil sans effet : ${k}`);
  assert.ok(!gardesApp(src)[k], `mutation Accueil ne fait pas rougir : ${k}`);
  console.log('OK  — mutation Accueil rougit :', k); ok++;
}

// 6. Nulle part ailleurs que dans le module on n'écrit un service, un pointage ou un retard.
const fichiers = fs.readdirSync(R).filter(f => /^(NEXUS-.*\.html|nexus-.*\.js)$/.test(f) && f !== 'nexus-prise-de-poste.js' && !/^nexus-(build|config)/.test(f));
const ECRIT = /\.from\('(shifts|pointages|retards)'\)\s*\.(insert|upsert)\(/;
const fautifs = fichiers.filter(f => ECRIT.test(lire(f)));
console.log('INFO — fichiers écrivant shifts/pointages/retards hors module :', fautifs.join(', ') || 'aucun');
assert.ok(!fautifs.includes('NEXUS-Progression-v1.html') && !fautifs.includes('NEXUS-App-v1.html'), '« Ma progression » et l’Accueil ne créent ni service ni pointage ni retard');
ok++;
assert.ok(ECRIT.test("x.from('shifts').insert({})"), 'mutation de la garde d’écriture');
assert.ok(PAGE.includes('nexus-prise-de-poste.js'), 'la page charge le module');
console.log(`\n${ok} vérifications passées.`);
