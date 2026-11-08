// Récapitulatif d'une clôture tardive (Guardian 6721931366, A1 ; 6714116458) : quand l'employé valide APRÈS la clôture du serveur
// (heure_depart > cloture_le), le récap affiche son heure réelle « Fermeture · 18 h 52 (en retard) », pas « 13 h 30 → 18 h 52 ».
const assert = require('assert'); const fs = require('fs'); const path = require('path');
let n = 0; const t = (nom, f) => { f(); n++; console.log('OK ' + nom); };
const lire = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const APP = lire('NEXUS-App-v1.html'); const PISTE = lire('nexus-accueil-piste.js');
const charger = (src) => { const m = { exports: {} }; new Function('module', 'self', src)(m, undefined); return m.exports; };

// Bloc de l'Accueil qui calcule recapQuart, extrait tel quel et exécuté avec des faits injectés.
const recapDe = (appSrc, rows) => {
  const d = appSrc.indexOf('    // Clôture tardive (Guardian 6721931366, A1)'); const f = appSrc.indexOf("    if (enService && roleDuJour === 'pompiste' && fuseauStation && quartDuJour) {");
  assert.ok(d >= 0 && f > d, 'bloc recapQuart introuvable');
  const corps = appSrc.slice(d, f);
  return new Function('quartEmployeRows', 'todayISO', 'surQuartDeService', 'heureReleve', 'momentIndexDebut', 'momentIndexFin', corps + '; return recapQuart;')
    (rows, '2026-10-28', () => true, () => null, 'debut_q1', 'fin_q1');
};
const ligne = (o, q) => Object.assign({ a_valide_cloture: true, heure_depart: null, inventaire_quarts: Object.assign({ date: '2026-10-28', is_simulation: false, cloture_le: null }, q || {}) }, o);
const SERVEUR = '2026-10-28T09:30:00Z', EMPLOYE = '2026-10-28T14:52:00Z';  // 13 h 30 et 18 h 52 à La Réunion

const piste = charger(PISTE);
const base = { enService: true, consultationExterne: false, roleDuJour: 'pompiste', prenom: 'Karim', libelleRole: 'Pompiste', quart: 'matin',
  heureDebut: '2026-10-28T01:05:00Z', fuseau: 'Indian/Reunion', jaugeageApplicable: true, jaugeageFait: true, indexApplicable: true, indexFait: true,
  inventaireApplicable: true, inventaireFait: false, inventaireOuvertureFaite: true, receptionApplicable: true, commandes: [], dateLocale: '2026-10-28',
  missions: { total: 3, faites: 1 }, points: 2, filLien: null, finMinutes: 795, maintenantMinutes: 780, finIndexApplicable: true, finIndexFait: true,
  clotureInventaireFait: true, pointageActif: true };
const affiche = (recap) => piste.html(piste.modele(Object.assign({}, base, { recap })));

t('clôture validée après celle du serveur : l\'Accueil calcule l\'heure réelle et le marqueur de retard', () => {
  const r = recapDe(APP, [ligne({ heure_depart: EMPLOYE }, { cloture_le: SERVEUR })]);
  assert.strictEqual(r.fermetureA, EMPLOYE); assert.strictEqual(r.fermetureTardive, true);
});
t('clôture dans les temps (pas de cloture_le serveur) : heure_depart, sans retard', () => {
  const r = recapDe(APP, [ligne({ heure_depart: EMPLOYE }, { cloture_le: null })]);
  assert.strictEqual(r.fermetureA, EMPLOYE); assert.strictEqual(r.fermetureTardive, false);
});
t('heure_depart avant cloture_le : on garde l\'heure du serveur, sans retard', () => {
  const r = recapDe(APP, [ligne({ heure_depart: '2026-10-28T09:00:00Z' }, { cloture_le: SERVEUR })]);
  assert.strictEqual(r.fermetureA, SERVEUR); assert.strictEqual(r.fermetureTardive, false);
});
t('a_valide_cloture faux : aucune heure de fermeture', () => {
  const r = recapDe(APP, [ligne({ a_valide_cloture: false, heure_depart: EMPLOYE }, { cloture_le: SERVEUR })]);
  assert.strictEqual(r.fermetureA, null); assert.strictEqual(r.fermetureTardive, false);
});
t('affichage : « Fermeture · 18 h 52 (en retard) », sans plage 13 h 30 → 18 h 52', () => {
  const h = affiche({ fermetureDe: '2026-10-28T09:10:00Z', fermetureA: EMPLOYE, fermetureTardive: true });
  assert.ok(h.includes('Fermeture · 18 h 52 (en retard)'), h.slice(h.indexOf('Fermeture')));
  assert.ok(!h.includes('→ 18 h 52') && !h.includes('13 h 30'));
});
t('affichage dans les temps : la plage reste, sans « en retard »', () => {
  const h = affiche({ fermetureDe: '2026-10-28T08:40:00Z', fermetureA: '2026-10-28T09:05:00Z', fermetureTardive: false });
  assert.ok(/Fermeture · 12 h 40 → 13 h 05/.test(h) && !h.includes('en retard'));
});
t('le récap reçoit bien le marqueur (câblage : recap: recapQuart)', () => {
  assert.ok(/recap:\s*recapQuart/.test(APP) && /fermetureTardive:/.test(APP));
});

// Mutations : chaque garde doit rougir quand on casse la règle.
const mut = (nom, src, litteral, remplacement, preuve) => t('mutation : ' + nom, () => {
  assert.ok(src.indexOf(litteral) >= 0, 'littéral introuvable : ' + litteral);
  assert.throws(() => preuve(src.replace(litteral, remplacement)), undefined, 'mutation survivante : ' + nom);
});
const preuveApp = (s) => { const r = recapDe(s, [ligne({ heure_depart: EMPLOYE }, { cloture_le: SERVEUR })]); assert.strictEqual(r.fermetureA, EMPLOYE); assert.strictEqual(r.fermetureTardive, true); };
mut('comparaison inversée (< au lieu de >)', APP, 'getTime() > new Date(r.inventaire_quarts.cloture_le)', 'getTime() < new Date(r.inventaire_quarts.cloture_le)', preuveApp);
mut('on garde toujours l\'heure du serveur', APP, 'clotureTardiveDe(r) ? r.heure_depart : (', 'false ? r.heure_depart : (', preuveApp);
mut('marqueur de retard jamais posé', APP, 'fermetureTardive: !!derniereCloture && clotureTardiveDe(derniereCloture)', 'fermetureTardive: false', preuveApp);
mut('la clôture non validée compte aussi', APP, 'r.a_valide_cloture === true && (r.inventaire_quarts.cloture_le || r.heure_depart)).filter(surQuartDeService);\n    const clotureTardiveDe', 'r.a_valide_cloture !== undefined && (r.inventaire_quarts.cloture_le || r.heure_depart)).filter(surQuartDeService);\n    const clotureTardiveDe',
  (s) => { const r = recapDe(s, [ligne({ a_valide_cloture: false, heure_depart: EMPLOYE }, { cloture_le: SERVEUR })]); assert.strictEqual(r.fermetureA, null); });
const preuvePiste = (s) => { const M = charger(s); const h = M.html(M.modele(Object.assign({}, base, { recap: { fermetureDe: '2026-10-28T09:10:00Z', fermetureA: EMPLOYE, fermetureTardive: true } }))); assert.ok(h.includes('Fermeture · 18 h 52 (en retard)')); };
mut('affichage : mention « en retard » retirée', PISTE, "+ ' (en retard)'", "+ ''", preuvePiste);
mut('affichage : le marqueur n\'est plus lu', PISTE, 'rc.fermetureTardive === true &&', 'false &&', preuvePiste);
console.log(n + ' épreuves OK');
