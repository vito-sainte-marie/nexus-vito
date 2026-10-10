// Durées de référence par jour travaillé (cahier des charges du 09/10/2026).
//
// La table n'a pas changé depuis la règle du 03/09/2026 — dimanche au mercredi
// 7 h, jeudi au samedi 8 h, renfort 7 h tous les jours. Deux choses ont changé,
// et ce fichier les tient :
//
//   1. La 8ᵉ heure n'est plus qualifiée supplémentaire d'office. « Le système
//      ne doit pas transformer automatiquement toute heure au-delà du planning
//      en heure supplémentaire majorée » : la qualification en heures normales,
//      complémentaires ou supplémentaires relève d'un calcul distinct, fondé
//      sur les règles légales et contractuelles. Le moteur rend des heures de
//      travail de référence, et rien de plus.
//
//   2. Les durées ne sont plus en dur. Elles viennent des Paramètres Station,
//      réutilisés par Verify et par Paye sans règle dupliquée. La table reste
//      dans le code comme repli, pas comme source.
//
// Le cas d'Angélique, lui, ne change pas : renfort dans NEXUS, boutique dans
// Verify le mardi 01/09, donc 7 h — à cause du jour et du poste constatés,
// jamais à cause du rôle inscrit.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
const M = ctx.NexusPayeMoteur;

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

// Septembre 2026 : 01 mardi, 03 jeudi, 05 samedi, 06 dimanche, 07 lundi.
const H = (poste, date) => M.heuresParDefautJour(poste, date);

verifier('caissière un mardi -> 7 h', H('caissier', '2026-09-01').heures === 7);
verifier('caissière un mercredi -> 7 h', H('caissier', '2026-09-02').heures === 7);
verifier('caissière un jeudi -> 8 h', H('caissier', '2026-09-03').heures === 8);
verifier('pompiste un vendredi -> 8 h', H('pompiste', '2026-09-04').heures === 8);
verifier('pompiste un samedi -> 8 h', H('pompiste', '2026-09-05').heures === 8);
verifier('pompiste un dimanche -> 7 h', H('pompiste', '2026-09-06').heures === 7);
verifier('pompiste un lundi -> 7 h', H('pompiste', '2026-09-07').heures === 7);
verifier('renfort le jeudi -> 7 h', H('renfort', '2026-09-03').heures === 7);
verifier('renfort le dimanche -> 7 h', H('renfort', '2026-09-06').heures === 7);
verifier('poste inconnu -> aucun barème inventé', H(null, '2026-09-01') === null);

// La règle de qualification, celle qui a changé. Aucun jour, aucun poste ne
// rend une heure supplémentaire : ce n'est plus au moteur d'en décider.
const TOUS_LES_JOURS = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
                        '2026-09-05', '2026-09-06', '2026-09-07'];
verifier('aucune heure n’est qualifiée supplémentaire d’office, aucun jour, aucun poste',
  ['caissier', 'pompiste', 'renfort'].every(poste =>
    TOUS_LES_JOURS.every(d => H(poste, d).heuresSupplementaires === 0)));

// Les durées viennent des Paramètres Station quand ils les portent.
const reglesStation = M.reglesHeures(
  { durees_reference: [6, 6, 6, 6, 9, 9, 9], heures_renfort: 5 }, null);
verifier('une durée de référence paramétrée remplace la table de repli',
  M.heuresParDefautJour('caissier', '2026-09-03', reglesStation).heures === 9
  && M.heuresParDefautJour('caissier', '2026-09-01', reglesStation).heures === 6);
verifier('des heures de renfort paramétrées remplacent les 7 h de repli',
  M.heuresParDefautJour('renfort', '2026-09-03', reglesStation).heures === 5);

// À défaut de durée de renfort explicite, l'horaire standard de la station la
// donne : 09:00 → 17:00 moins 1 h de pause, soit 7 h nettes. Le caissier n'a
// pas à saisir ces horaires à chaque clôture.
const reglesHoraire = M.reglesHeures({}, {
  renfort: { debut: '09:00', fin: '17:00', pause_debut: '13:00', pause_fin: '14:00' },
});
verifier('l’horaire standard du renfort donne 7 h nettes, pause déduite',
  reglesHoraire.heuresRenfort === 7);
verifier('sans paramètre ni horaire, le repli reste 7 h',
  M.reglesHeures(null, null).heuresRenfort === M.HEURES_RENFORT_DEFAUT);
verifier('une durée paramétrée hors bornes est refusée, pas appliquée',
  M.reglesHeures({ durees_reference: [0, -3, 99, null, 'x', 7, 7] }, null).durees[0] === 7);

// La durée nette, qui sert aussi aux horaires exceptionnels du manager.
verifier('09:00 → 17:00 moins 60 min -> 7 h', M.dureeNetteHeures('09:00', '17:00', 60) === 7);
verifier('une durée à cheval sur minuit reste positive',
  M.dureeNetteHeures('22:00', '02:00', 0) === 4);
verifier('une pause plus longue que le service ne rend pas une durée négative',
  M.dureeNetteHeures('09:00', '10:00', 120) === null);
verifier('un horaire illisible ne rend aucune durée',
  M.dureeNetteHeures('neuf heures', '17:00', 0) === null);

// Le cas réel d'Angélique : renfort dans NEXUS, boutique dans Verify.
const ANGELIQUE = { id: 'e0850538', nom: 'angelique', role: 'renfort', actif: true };
const rapport = M.construireRapport({
  periode: '2026-09', employees: [ANGELIQUE],
  settings: [{ employee_id: ANGELIQUE.id, inclus_paye: true, mode_presence: 'automatique' }],
  indisponibilites: [], planning: [],
  audits: [{ date: '2026-09-01', quart: '1', site: 'vito-sainte-marie',
             employes_piste: [], employes_boutique: [ANGELIQUE.id] }],
  pointages: [], items: [], config: {},
});
const fiche = rapport.employes[0];
const item = fiche.items.find(i => i.typeItem === 'presence_exceptionnelle');

verifier('le poste vient de Verify, pas du rôle NEXUS', item.poste === 'caissier');
verifier('7 h lui sont retenues — boutique le mardi', item.heuresRetenues === 7);
verifier('et comptées dans ses heures confirmées', fiche.heuresConfirmees === 7);
verifier('ventilées en heures de caisse, pas en heures de renfort',
  fiche.heuresCaisse === 7 && fiche.heuresRenfort === 0 && fiche.heuresPiste === 0);
verifier('la carte explique le calcul en clair',
  /7 h retenues — boutique le mardi/.test(item.detail));
verifier('et signale que le poste diffère du rôle inscrit',
  /différent du rôle « renfort »/.test(item.detail));
verifier('la durée est portée en minutes, pour que « Confirmer » l’enregistre',
  item.quantiteMinutes === 420);
verifier('la journée hors planning est une information, pas un arbitrage',
  item.statut === 'information' && item.rubrique === 'ecart_verify_planning');
verifier('et elle ne bloque donc pas la préparation de la paie',
  rapport.bloqueurs.length === 0);
verifier('son identifiant de source est inchangé, pour que l’historique se rattache',
  item.sourceCle === `presence-exceptionnelle:${ANGELIQUE.id}:2026-09-01`);

// Verify prime sur le rôle dans l'autre sens aussi : une caissière placée en
// piste un jeudi fait 8 h de piste, pas 7 h de boutique.
const CAISSIERE = { id: 'c1', nom: 'test', role: 'caissier', actif: true };
const piste = M.construireRapport({
  periode: '2026-09', employees: [CAISSIERE],
  settings: [{ employee_id: CAISSIERE.id, inclus_paye: true, mode_presence: 'automatique' }],
  indisponibilites: [], planning: [],
  audits: [{ date: '2026-09-03', quart: '1', site: 'vito-sainte-marie',
             employes_piste: [CAISSIERE.id], employes_boutique: [] }],
  pointages: [], items: [], config: {},
});
const fichePiste = piste.employes[0];
const itemPiste = fichePiste.items.find(i => i.typeItem === 'presence_exceptionnelle');
verifier('une caissière placée en piste un jeudi -> 8 h de piste',
  itemPiste.poste === 'pompiste' && itemPiste.heuresRetenues === 8);
verifier('ventilées en heures de piste',
  fichePiste.heuresPiste === 8 && fichePiste.heuresCaisse === 0);
verifier('et toujours aucune heure supplémentaire déduite de la 8ᵉ heure',
  itemPiste.heuresSupplementaires === 0
  && !fichePiste.items.some(i => i.typeItem === 'heure_supplementaire'));

console.log(`\n${ok} vérifications passées.`);
