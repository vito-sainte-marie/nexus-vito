// Épreuve — 30/10/2026, lot RELEVES-FIN-QUART-20261030 (affichage seul).
// Exigences : ligne « Fin de quart : relevé des index » après le fil, absente si le relevé de fin est final, cible exacte du moment
// (matin → fin_q1, soir → fin_q2) ; étapes d'ouverture jugées sur le quart du service de l'employé ; jamais d'étape à faire sans bouton.
// Le module est exécuté tel quel ; chaque épreuve est contrôlée par une mutation.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const charger = (src) => { const m = { exports: {} }; new Function('module', 'self', src)(m, undefined); return m.exports; };
const ACC = lire('nexus-accueil-piste.js'); const REL = lire('nexus-releves-piste.js'); const APP = lire('NEXUS-App-v1.html');
const base = { enService: true, consultationExterne: false, roleDuJour: 'pompiste', prenom: 'Karim', quart: 'matin', fuseau: 'Indian/Reunion',
  jaugeageApplicable: true, jaugeageFait: true, indexApplicable: true, indexFait: true, inventaireApplicable: true, inventaireFait: true,
  inventaireOuvertureFaite: false, receptionApplicable: false, commandes: [], dateLocale: '2026-10-30', missions: { total: 2, faites: 0 }, points: 0,
  filLien: null, finQuartLien: 'NEXUS-Releves-Piste-v1.html?moment=fin_q1', finQuartFait: false };

function epreuvesAcc(M) {
  const h = M.html(M.modele(base));
  assert(h.includes('id="apFinQuart"') && h.includes('Fin de quart : relevé des index') && h.includes('href="NEXUS-Releves-Piste-v1.html?moment=fin_q1"'), 'ligne de fin présente après le fil');
  assert(h.includes('class="ap-bouton ap-secondaire" id="apFinQuart"'), 'bouton secondaire');
  assert(h.indexOf('apBoutonMissions') > -1 && h.indexOf('apBoutonMissions') < h.indexOf('apFinQuart'), 'sous « Commencer les missions »');
  assert(!M.html(M.modele(Object.assign({}, base, { finQuartFait: true }))).includes('apFinQuart'), 'absente si le relevé de fin est final');
  assert(!M.html(M.modele(Object.assign({}, base, { inventaireFait: false, filLien: 'NEXUS-Inventaire-v1.html' }))).includes('apFinQuart'), 'absente pendant le fil');
  assert(M.html(M.modele(Object.assign({}, base, { finQuartLien: 'NEXUS-Releves-Piste-v1.html?moment=fin_q2' }))).includes('moment=fin_q2'), 'cible = lien donné');
  assert(!M.html(M.modele(Object.assign({}, base, { finQuartLien: null }))).includes('apFinQuart'), 'sans cible, pas de ligne');
  assert.strictEqual(M.modele(Object.assign({}, base, { inventaireFait: false, filLien: 'x' })).incoherent, false);
  assert.strictEqual(M.modele(Object.assign({}, base, { inventaireFait: false, filLien: null })).incoherent, true, 'étape à faire sans bouton signalée');
}
function epreuvesRel(R) {
  assert.strictEqual(R.momentFinDuQuart('matin'), 'fin_q1'); assert.strictEqual(R.momentFinDuQuart('soir'), 'fin_q2');
  assert.strictEqual(R.momentFinDuQuart('Q1'), 'fin_q1'); assert.strictEqual(R.momentFinDuQuart(null), null);
}
function epreuvesApp(a) {
  assert(a.includes("momentFinDuQuart(quartDuJour)"), 'fin du quart du service');
  assert(a.includes("`NEXUS-Releves-Piste-v1.html?moment=${momentIndexFin}`"), 'cible exacte');
  assert(a.includes(".in('moment', [momentIndexDebut, momentIndexFin].filter(Boolean))"), 'relevé de fin lu');
  assert(a.includes('inventaire_quarts(date, quart, cloture_le'), 'quart lu');
  assert(a.includes('r.inventaire_quarts.quart === quartDuJour'), 'jugé sur le quart du service');
  assert((a.match(/surQuartDeService\(r\)/g) || []).length === 2, 'filtre appliqué aux deux faits');
  assert(a.includes('NexusFilDebutQuart.urlEtape(NexusFilDebutQuart.planSelonFaits(faitsFil)[0]'), 'repli : jamais d\'étape sans bouton');
  assert(a.includes('filLien, finQuartLien, finQuartFait,'), 'faits transmis au module');
}
epreuvesAcc(charger(ACC)); epreuvesRel(charger(REL)); epreuvesApp(APP);

const tue = (nom, src, orig, ep, mk) => { assert.notStrictEqual(src, orig, 'mutation sans effet : ' + nom); assert.throws(() => ep(mk(src)), 'mutation survivante : ' + nom); };
[
  ['ligne de fin jamais affichée', (s) => s.replace("(filTermine && f.finQuartLien && !f.finQuartFait)", 'false')],
  ['ligne même si final', (s) => s.replace(' && !f.finQuartFait)', ')')],
  ['ligne pendant le fil', (s) => s.replace('(filTermine && f.finQuartLien', '(f.finQuartLien')],
  ['cible figée', (s) => s.replace('href: f.finQuartLien', "href: 'NEXUS-Releves-Piste-v1.html?moment=fin_q1'")],
  ['bouton plein', (s) => s.replace('ap-bouton ap-secondaire', 'ap-bouton')],
  ['avant les missions', (s) => { const m = s.match(/    \/\/ Bouton secondaire[\s\S]*?\n    \}\n/)[0]; return s.replace(m, '').replace("    if (v.missions) {", m + "    if (v.missions) {"); }],
  ['impasse non signalée', (s) => s.replace('incoherent: !filTermine && !f.filLien', 'incoherent: false')],
].forEach(([n, m]) => tue(n, m(ACC), ACC, epreuvesAcc, charger));
[
  ['fin matin → fin_q2', (s) => s.replace("q === 'Q1' ? 'fin_q1'", "q === 'Q1' ? 'fin_q2'")],
  ['fin soir absente', (s) => s.replace("q === 'Q2' ? 'fin_q2'", "q === 'Q2' ? null")],
].forEach(([n, m]) => tue(n, m(REL), REL, epreuvesRel, charger));
[
  ['relevé de fin non lu', (s) => s.replace(".in('moment', [momentIndexDebut, momentIndexFin].filter(Boolean))", ".eq('moment', momentIndexDebut)")],
  ['inventaire sur le quart courant', (s) => s.replace('r.inventaire_quarts.quart === quartDuJour', 'true')],
  ['filtre sur une seule lecture', (s) => s.replace('      surQuartDeService(r) &&\n      r.inventaire_quarts.is_simulation !== true &&\n      !r.inventaire_quarts.cloture_le', '      r.inventaire_quarts.is_simulation !== true &&\n      !r.inventaire_quarts.cloture_le')],
  ['impasse : pas de repli', (s) => s.replace('|| NexusFilDebutQuart.urlEtape(NexusFilDebutQuart.planSelonFaits(faitsFil)[0]', '|| null && (NexusFilDebutQuart.planSelonFaits(faitsFil)[0]')],
  ['fin du mauvais moment', (s) => s.replace('momentFinDuQuart(quartDuJour)', 'momentDebutDuQuart(quartDuJour)')],
  ['faits non transmis', (s) => s.replace('filLien, finQuartLien, finQuartFait,', 'filLien,')],
].forEach(([n, m]) => tue(n, m(APP), APP, epreuvesApp, (x) => x));
console.log('OK — mutations tuées');
