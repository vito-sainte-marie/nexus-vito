// NEXUS — menu latéral : faits réels de l'employé (lot MENU-LATERAL-FAITS-REELS-20261124).
// Exécute le vrai module nexus-menu-faits.js avec des lectures simulées ; chaque fait est éprouvé seul.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = process.env.NEXUS_ROOT || __dirname;
const F = require(path.join(ROOT, 'nexus-menu-faits.js'));
const M = require(path.join(ROOT, 'nexus-menu-accueil.js'));
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

const EMP = { id: 'e1', site_id: 's1', role: 'caissier' };
const PRO = { estProfessional: (x) => x === 'professional', chargerForfait: async () => 'professional' };
// Client simulé : station_config et dates_courtes ; erreur = { error }.
function client(o) {
  o = Object.assign({ reception: 'employe', pointage: true, dates: true, scErr: false, datesErr: false }, o || {});
  return { from(t) {
    const q = { select(c) { q.c = c; return q; }, eq() { return q; }, order() { return q; }, limit() { return Promise.resolve(t === 'dates_courtes_acces_caissier'
      ? (o.datesErr ? { error: 1 } : { data: [{ actif: o.dates }] }) : null); },
    maybeSingle() { return Promise.resolve(o.scErr ? { error: 1 } : { data: { reception_carburant_role: o.reception, pointage_actif: o.pointage } }); } };
    return q; } };
}
async function codes(role, o, forfait) {
  const deps = { client: client(o), forfait: forfait === undefined ? PRO : forfait,
    serviceCourant: async () => (role ? { service: { role } } : { aucun: true }) };
  const f = await F.faits(EMP, deps);
  return [].concat(...F.groupesLateraux(M, f).map((g) => g.entrees.map((e) => e.code)));
}
(async () => {
  // Hors service : aucune entrée. Erreur du service : idem.
  ok((await codes(null)).length === 0, 'hors service : entrées offertes');
  const e = await F.faits(EMP, { client: client(), forfait: PRO, serviceCourant: async () => ({ erreur: true }) });
  ok(F.groupesLateraux(M, e).length === 0, 'service illisible : entrées offertes');
  ok((await F.faits(null, {})).enService === false, 'employé inconnu : en service');

  // Caissière, tous les droits ouverts : FDJ, Coach, dates courtes, pointage ; pas de réception (matrice).
  const c = await codes('caissiere');
  ['fdj', 'coach_fdj', 'dates_courtes', 'pointage', 'missions', 'inventaire', 'progression', 'changer_poste'].forEach((x) => ok(c.includes(x), 'caissière sans ' + x));
  ok(!c.includes('reception') && !c.includes('index') && !c.includes('deconnexion'), 'caissière : entrée de pompiste ou déconnexion');

  // Un fait à la fois.
  ok(!(await codes('caissiere', { dates: false })).includes('dates_courtes'), 'dates courtes fermées mais offertes');
  ok(!(await codes('caissiere', { datesErr: true })).includes('dates_courtes'), 'dates courtes illisibles mais offertes');
  ok(!(await codes('caissiere', { pointage: false })).includes('pointage'), 'pointage désactivé mais offert');
  ok(!(await codes('caissiere', { scErr: true })).includes('pointage'), 'pointage illisible mais offert');
  ok((await codes('caissiere', { pointage: null })).includes('pointage'), 'pointage nul : défaut Accueil = actif');
  ok(!(await codes('caissiere', {}, { estProfessional: () => false, chargerForfait: async () => 'essential' })).includes('fdj'), 'FDJ offerte en Essential');
  ok(!(await codes('caissiere', {}, { estProfessional: () => true, chargerForfait: async () => null })).includes('fdj'), 'FDJ offerte sur forfait illisible');
  ok(!(await codes('caissiere', {}, null)).includes('fdj'), 'FDJ offerte sans module forfait');

  // Pompiste : réception selon le réglage, index, jamais FDJ ni dates courtes.
  const p = await codes('pompiste');
  ok(p.includes('reception') && p.includes('index') && !p.includes('fdj') && !p.includes('dates_courtes') && !p.includes('coach_fdj'), 'pompiste : entrées inexactes');
  ok(!(await codes('pompiste', { reception: 'manager' })).includes('reception'), 'réception réservée au manager mais offerte');
  ok((await codes('pompiste', { reception: 'les_deux' })).includes('reception'), 'réception les_deux absente');
  ok((await codes('pompiste', { scErr: true })).includes('reception') === false, 'réception illisible mais offerte');

  // Renfort : pas d'inventaire, dates courtes oui, pas de FDJ.
  const r = await codes('renfort');
  ok(!r.includes('inventaire') && r.includes('dates_courtes') && !r.includes('fdj'), 'renfort : entrées inexactes');

  // La liste de l'employé reste incluse dans la plus large de l'Accueil.
  const large = [].concat(...M.groupesLateraux().map((g) => g.entrees.map((x) => x.code)));
  // « Relevés d'index » est le seul ajout : il appartient au pompiste du jour (Accueil), pas à la liste caissière.
  [c, p, r].forEach((l) => l.forEach((x) => ok(large.includes(x) || (x === 'index' && l === p), 'entrée hors liste Accueil : ' + x)));

  // Anti-dérive : la matrice du module est celle de l'Accueil.
  const app = fs.readFileSync(path.join(ROOT, 'NEXUS-App-v1.html'), 'utf8');
  const bloc = app.match(/const CAPACITES_ROLE_DEFAUT = (\{[\s\S]*?\n  \});/);
  ok(bloc, 'matrice de l\'Accueil introuvable');
  const accueil = eval('(' + bloc[1] + ')');
  ok(JSON.stringify(accueil) === JSON.stringify(F.CAPACITES_ROLE_DEFAUT), 'matrice des capacités dérivée de l\'Accueil');

  // Câblage : le bureau lit les faits ; la gestion n'y passe pas.
  const desk = fs.readFileSync(path.join(ROOT, 'nexus-desktop.js'), 'utf8');
  ok(/NexusMenuFaits\.faits\(/.test(desk) && /nexus-menu-faits\.js/.test(desk), 'nexus-desktop ne lit pas les faits');
  ok(/if \(gestion\) return NEXUS_SIDEBAR_GROUPES;/.test(desk), 'gestion touchée');
  console.log('OK test_menu_lateral_faits_reels_20261124 (' + n + ' vérifications)');
})().catch((err) => { console.error(err); process.exit(1); });
