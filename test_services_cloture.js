// NEXUS — clôture des services (04/09/2026).
//
// Constat qui a rendu ce lot nécessaire : les 227 prises de poste en base
// étaient toutes `en_cours`, aucune avec `heure_fin`, de juillet à
// septembre 2026. Rien ne clôturait jamais un service.
//
// Constat qui en a dicté la conception : `pointage_actif = false` sur
// vito-sainte-marie. Le pointage de départ — la solution évidente — ne
// clôturerait rien à cette station.
//
// Les deux règles que ce test verrouille, parce qu'elles sont les seules
// qui ne se rattrapent pas après coup :
//   1. NEXUS n'invente jamais une heure de départ ;
//   2. aucune clôture ne découle de la seule heure courante.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-services-moteur.js'), 'utf8'), ctx);
const M = ctx.NexusServicesMoteur;

const MAINTENANT = '2026-09-04T18:00:00.000Z';
const service = (extra) => Object.assign({
  id: 'shift-1', employee_id: 'emp-nadine', site_id: 'vito-sainte-marie',
  role: 'caissiere', quart: 'soir', statut: 'en_cours',
  heure_debut: '2026-09-04T10:00:00.000Z', heure_fin: null,
}, extra || {});

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

// ── 1. Clôture normale par l'employé ────────────────────────────────────
const parEmploye = M.preparerCloture(service(), {
  source: 'employe', heureFin: '2026-09-04T17:30:00.000Z', actorId: 'emp-nadine', maintenant: MAINTENANT,
});
verifier('l’employé peut terminer son service', parEmploye.ok);
verifier('… avec une heure de fin réelle et l’état « terminé »',
  parEmploye.patch.statut === 'termine' && parEmploye.patch.heure_fin === '2026-09-04T17:30:00.000Z');
verifier('… et le journal dit qui a clôturé, quand, et par quel chemin',
  parEmploye.patch.cloture_par === 'emp-nadine' && parEmploye.patch.cloture_source === 'employe' && !!parEmploye.patch.cloture_le);

// ── 2. Clôture et correction par le manager ─────────────────────────────
const parManager = M.preparerCloture(service(), {
  source: 'manager', heureFin: '2026-09-04T17:00:00.000Z', actorId: 'emp-fred',
  motif: 'Nadine est partie à 19 h, elle a oublié de terminer son service.', maintenant: MAINTENANT,
});
verifier('le manager peut clôturer un service à la place de l’employé', parManager.ok);
verifier('… et son motif est conservé au journal',
  /oublié de terminer/.test(parManager.patch.cloture_motif) && parManager.patch.cloture_par === 'emp-fred');

const managerSansMotif = M.preparerCloture(service(), {
  source: 'manager', heureFin: '2026-09-04T17:00:00.000Z', actorId: 'emp-fred', maintenant: MAINTENANT,
});
verifier('une correction manager sans motif est refusée',
  !managerSansMotif.ok && /motif est requis/.test(managerSansMotif.erreur));

// Le manager peut aussi clore sans connaître l'heure : c'est honnête, et
// c'est précisément ce que « clos sans pointage » veut dire.
const managerSansHeure = M.preparerCloture(service(), {
  source: 'manager', statut: 'clos_sans_pointage', actorId: 'emp-fred',
  motif: 'Service resté ouvert, heure de départ inconnue.', maintenant: MAINTENANT,
});
verifier('le manager peut clore un service sans heure de fin connue',
  managerSansHeure.ok && managerSansHeure.patch.statut === 'clos_sans_pointage' && managerSansHeure.patch.heure_fin === null);

// ── 3. NEXUS n'invente jamais une heure de départ ───────────────────────
const inventer = M.preparerCloture(service(), {
  source: 'manager', statut: 'clos_sans_pointage', heureFin: '2026-09-04T17:00:00.000Z',
  actorId: 'emp-fred', motif: 'x', maintenant: MAINTENANT,
});
verifier('on ne peut pas glisser une heure de fin dans un état qui signifie « inconnue »',
  !inventer.ok && /inconnue/.test(inventer.erreur));

const suivante = M.preparerCloture(service(), {
  source: 'prise_de_poste_suivante', actorId: 'emp-nadine', maintenant: MAINTENANT,
});
verifier('ouvrir un nouveau service clôt le précédent — c’est un fait réel',
  suivante.ok && suivante.patch.statut === 'clos_sans_pointage');
verifier('… mais sans jamais lui attribuer une heure de fin',
  suivante.patch.heure_fin === null);

const suivanteAvecHeure = M.preparerCloture(service(), {
  source: 'prise_de_poste_suivante', statut: 'termine', heureFin: MAINTENANT, actorId: 'emp-nadine', maintenant: MAINTENANT,
});
verifier('… et elle ne peut pas produire un service « terminé », qu’elle ne sait pas dater',
  !suivanteAvecHeure.ok);

const sansHeure = M.preparerCloture(service(), { source: 'employe', actorId: 'emp-nadine', maintenant: MAINTENANT });
verifier('terminer un service sans heure de fin est refusé',
  !sansHeure.ok && /heure de fin est requise/.test(sansHeure.erreur));

// ── 4. Cohérence des heures ─────────────────────────────────────────────
const avantDebut = M.preparerCloture(service(), {
  source: 'employe', heureFin: '2026-09-04T09:00:00.000Z', actorId: 'emp-nadine', maintenant: MAINTENANT,
});
verifier('une heure de fin antérieure au début est refusée',
  !avantDebut.ok && /précède le début/.test(avantDebut.erreur));

const futur = M.preparerCloture(service(), {
  source: 'employe', heureFin: '2026-09-05T09:00:00.000Z', actorId: 'emp-nadine', maintenant: MAINTENANT,
});
verifier('une heure de fin dans le futur est refusée', !futur.ok && /futur/.test(futur.erreur));

// ── 5. Aucune clôture automatique sur la seule heure courante ───────────
const ouvertDepuisLongtemps = [
  service({ id: 's-vieux', heure_debut: '2026-09-03T06:00:00.000Z' }),
  service({ id: 's-recent', heure_debut: '2026-09-04T16:00:00.000Z' }),
  service({ id: 's-clos', statut: 'termine', heure_debut: '2026-09-02T06:00:00.000Z', heure_fin: '2026-09-02T14:00:00.000Z' }),
];
const signales = M.servicesRestesOuverts(ouvertDepuisLongtemps, { maintenant: MAINTENANT, seuilHeures: 14 });
verifier('un service ouvert depuis trop longtemps est signalé au manager',
  signales.length === 1 && signales[0].shift.id === 's-vieux');
verifier('… un service récent ne l’est pas, un service déjà clos non plus',
  !signales.some(x => ['s-recent', 's-clos'].includes(x.shift.id)));
verifier('… et le signalement ne modifie RIEN : c’est une liste, pas une clôture',
  ouvertDepuisLongtemps[0].statut === 'en_cours' && ouvertDepuisLongtemps[0].heure_fin === null);

// ── 6. Un seul service ouvert à la fois ─────────────────────────────────
const plusieurs = M.serviceOuvert([
  service({ id: 's-a', heure_debut: '2026-09-04T06:00:00.000Z' }),
  service({ id: 's-b', heure_debut: '2026-09-04T14:00:00.000Z' }),
  service({ id: 's-clos', statut: 'legacy', heure_debut: '2026-09-04T16:00:00.000Z' }),
], 'emp-nadine');
verifier('le service ouvert retenu est le plus récent', plusieurs.service.id === 's-b');
verifier('… les services ouverts en trop sont signalés, jamais ignorés en silence',
  plusieurs.enTrop.length === 1 && plusieurs.enTrop[0].id === 's-a');
verifier('un service legacy ou de test n’est jamais considéré comme ouvert',
  !M.estOuvert(service({ statut: 'legacy' })) && !M.estOuvert(service({ statut: 'test' })));

// ── 7. Un service déjà clos ne se reclôt pas ────────────────────────────
const dejaClos = M.preparerCloture(service({ statut: 'termine', heure_fin: MAINTENANT }), {
  source: 'employe', heureFin: MAINTENANT, actorId: 'emp-nadine', maintenant: MAINTENANT,
});
verifier('un service déjà clôturé ne peut pas l’être une seconde fois',
  !dejaClos.ok && /déjà/.test(dejaClos.erreur));

// ── 8. Journal lisible ──────────────────────────────────────────────────
const phrase = M.journalCloture(
  service({ statut: 'termine', heure_fin: MAINTENANT, cloture_par: 'emp-fred', cloture_source: 'manager', cloture_le: '2026-09-04T18:05:00.000Z', cloture_motif: 'Départ constaté sur place.' }),
  { 'emp-fred': 'Fred' });
verifier('le journal se lit en une phrase : état, chemin, auteur, date, motif',
  /Terminé/.test(phrase) && /manager/.test(phrase) && /Fred/.test(phrase) && /2026-09-04/.test(phrase) && /Départ constaté/.test(phrase));
verifier('un service en cours n’a pas de journal de clôture',
  M.journalCloture(service()) === null);

// ── 9. La migration encode les mêmes garanties que le moteur ────────────
const migration = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '20260904020000_cloture_des_services.sql'), 'utf8');
verifier('la base refuse un service « terminé » sans heure de fin',
  /statut = 'termine' and heure_fin is not null/.test(migration));
verifier('la base refuse une heure de fin sur un état qui la dit inconnue',
  /statut in \('clos_sans_pointage', 'legacy', 'test'\) and heure_fin is null/.test(migration));
verifier('la base exige un journal dès qu’un service n’est plus en cours',
  /cloture_source is not null and cloture_le is not null/.test(migration));
verifier('les 227 services antérieurs sont qualifiés sans heure de fin inventée',
  /set statut = 'legacy'/.test(migration) && !/heure_fin = now\(\)/.test(migration));
verifier('le test de Nadine est distingué des services réels',
  /set statut = 'test'/.test(migration) && /hors résultats de l''employé/.test(migration));

console.log(`\nNEXUS — clôture des services : ${ok}/${ok} vérifications passent.`);
