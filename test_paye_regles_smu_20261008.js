#!/usr/bin/env node
// NEXUS PAYE — règles métier SMU du 08/10/2026, corrections 1 à 3.
//
// 1. Le planning officiel fait foi pour le renfort (§2) : un renfort
//    planifié sans Verify ni pointage est compté, jamais signalé absent.
//    Seuls la caisse et la piste attendent une preuve Verify.
// 2. Verify prime sur le planning pour la fonction exercée (§2-3) : une
//    renfort que Verify place en boutique un vendredi ouvre l'heure
//    supplémentaire, comme une caissière.
// 3. Retard 0 par défaut (§4) : le pointage n'en produit plus aucun ; seul
//    le manager le déclare, et sa saisie porte son auteur jusqu'à l'export.
//
// Plus le critère de conformité du §10 : aucune journée comptée deux fois.
//
// Chaque scénario juge le rapport rendu par le vrai moteur, jamais le texte
// du source.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('./nexus-paye-moteur.js');
const M = global.NexusPayeMoteur;

const base = {
  periode: '2026-08-01',
  employees: [{ id: 'e1', nom: 'Angélique', role: 'renfort', actif: true }],
  settings: [{ employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' }],
  planning: [], pointages: [], audits: [], indisponibilites: [], items: [], ecarts: [],
  config: { jours_heure_supp: [4, 5, 6], minutes_heure_supp: 60, activites_heure_supp: ['piste', 'boutique'], quart_exclu_heure_supp: 'renfort', retard_max_coherent_min: 180, jours_feries: ['2026-08-15'] },
};
const run = extra => M.construireRapport(Object.assign({}, base, extra));
const fiche = r => r.employes[0];
const typeItems = r => fiche(r).items.map(i => i.typeItem);

const LUNDI = '2026-08-03';
const VENDREDI = '2026-08-07';
const renfort = (date, duree_heures) => ({ employee_id: 'e1', date, quart: 'renfort', statut: 'renfort', duree_heures });
const caisse = (date, duree_heures) => ({ employee_id: 'e1', date, quart: 'quart1', statut: 'travail_normal', duree_heures, tache: 'caisse' });

let passes = 0;
function scenario(nom, fn) { fn(); passes += 1; console.log(`  ✓ ${nom}`); }

// ── Correction 1 : renfort ───────────────────────────────────────────────
scenario('un renfort planifié sans preuve est compté, pas signalé absent', () => {
  const r = run({ planning: [renfort(LUNDI, 7)] });
  assert.strictEqual(fiche(r).heuresConfirmees, 7);
  assert.strictEqual(fiche(r).joursConfirmes.size, 1);
  assert.strictEqual(M.variablesComptables(fiche(r)).presence.joursPlanifies, 1);
  assert.ok(!typeItems(r).includes('absence_a_verifier'));
});

scenario('un renfort sans durée prend le barème renfort, tracé comme défaut', () => {
  const r = run({ planning: [renfort(LUNDI, null)] });
  const bareme = M.heuresParDefautJour('renfort', LUNDI);
  assert.ok(bareme && bareme.heures > 0);
  assert.strictEqual(fiche(r).heuresConfirmees, bareme.heures);
  assert.strictEqual(fiche(r).heuresParDefaut, bareme.heures);
  assert.ok(!typeItems(r).includes('absence_a_verifier'));
});

scenario('une caisse planifiée sans Verify reste « Présence à vérifier »', () => {
  const r = run({ planning: [caisse(LUNDI, 7)] });
  const item = fiche(r).items.find(i => i.typeItem === 'absence_a_verifier');
  assert.ok(item);
  assert.strictEqual(item.libelle, 'Présence à vérifier : caisse ou piste prévue sans Verify');
  assert.strictEqual(fiche(r).heuresConfirmees, 0);
  assert.strictEqual(M.variablesComptables(fiche(r)).presence.joursPlanifies, 0);
});

// ── Correction 2 : Verify prime pour la fonction exercée ─────────────────
scenario('une renfort que Verify place en boutique un vendredi ouvre l’heure supplémentaire', () => {
  const r = run({
    planning: [renfort(VENDREDI, 7)],
    audits: [{ id: 'a', date: VENDREDI, quart: 'quart1', employes_piste: [], employes_boutique: ['e1'] }],
  });
  const hs = fiche(r).items.find(i => i.typeItem === 'heure_supplementaire');
  assert.ok(hs, 'heure supplémentaire attendue');
  assert.strictEqual(hs.origine, 'verify');
  assert.strictEqual(hs.quantiteMinutes, 60);
});

scenario('la même renfort sans Verify (pointage seul) n’en ouvre aucune', () => {
  const r = run({
    planning: [renfort(VENDREDI, 7)],
    pointages: [{ employee_id: 'e1', date: VENDREDI, type: 'arrivee', retard_min: 0 }],
  });
  assert.ok(!typeItems(r).includes('heure_supplementaire'));
});

// ── Correction 3 : retards ───────────────────────────────────────────────
scenario('le pointage ne produit aucun retard, cohérent ou aberrant', () => {
  const r = run({
    planning: [caisse(LUNDI, 7), caisse('2026-08-04', 7)],
    pointages: [
      { employee_id: 'e1', date: LUNDI, type: 'arrivee', retard_min: 12 },
      { employee_id: 'e1', date: '2026-08-04', type: 'arrivee', retard_min: 5754 },
    ],
  });
  assert.ok(!typeItems(r).some(t => t === 'retard' || t === 'retard_incoherent'));
  assert.strictEqual(M.variablesComptables(fiche(r)).retards.minutes, 0);
  assert.strictEqual(M.variablesComptables(fiche(r)).retards.enAttente, 0);
  // La preuve de présence, elle, est conservée.
  assert.strictEqual(fiche(r).heuresConfirmees, 14);
});

scenario('un retard saisi par le manager est compté et exporté avec son auteur', () => {
  const r = run({
    items: [{
      id: 'm1', employee_id: 'e1', periode: '2026-08-01', origine: 'manuel', source_cle: 'manuel:m1:2026-08-04',
      type_item: 'retard', date_evenement: '2026-08-04', libelle: 'Retard déclaré', statut: 'valide',
      impact_paye: false, quantite_minutes: 12, cree_par: 'u-manager', cree_le: '2026-08-04T10:00:00Z',
    }],
  });
  const v = M.variablesComptables(fiche(r));
  assert.strictEqual(v.retards.minutes, 12);
  assert.strictEqual(v.retards.occurrences, 1);
  const ligne = M.lignesExport(r).find(l => l.type === 'retard');
  assert.ok(ligne, 'ligne d’export du retard attendue');
  assert.strictEqual(ligne.auteur, 'u-manager');
  assert.strictEqual(ligne.saisi_le, '2026-08-04T10:00:00Z');
  assert.strictEqual(ligne.quantite_minutes, 12);
});

scenario('l’écran propose le retard à la saisie manuelle, durée obligatoire', () => {
  const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
  const liste = html.match(/TYPES_VARIABLE_MANUELLE\s*=\s*(\[[^\]]*\])/);
  assert.ok(liste, 'TYPES_VARIABLE_MANUELLE introuvable');
  assert.ok(JSON.parse(liste[1].replace(/'/g, '"')).includes('retard'));
  assert.ok(/typeItem==='retard'&&!\(Number\(min\)>0\)/.test(html), 'garde de durée du retard manuel absente');
});

// ── §10 : aucun double comptage ──────────────────────────────────────────
scenario('un jour renfort + caisse sans Verify : renfort compté une fois, caisse à vérifier', () => {
  const r = run({ planning: [renfort(LUNDI, 3), caisse(LUNDI, 4)] });
  assert.strictEqual(fiche(r).heuresConfirmees, 3);
  assert.strictEqual(fiche(r).joursConfirmes.size, 1);
  assert.strictEqual(fiche(r).presencesPlanifiees, 1);
  assert.strictEqual(fiche(r).items.filter(i => i.typeItem === 'absence_a_verifier').length, 1);
});

scenario('un jour renfort + caisse sans durée : pas de barème journalier découpé', () => {
  const r = run({ planning: [renfort(LUNDI, null), caisse(LUNDI, null)] });
  assert.strictEqual(fiche(r).heuresConfirmees, 0);
  assert.ok(!(fiche(r).heuresParDefaut > 0));
});

scenario('un jour Verify avec deux shifts compte ses heures une seule fois', () => {
  const r = run({
    planning: [renfort(LUNDI, 3), caisse(LUNDI, 4)],
    audits: [{ id: 'a', date: LUNDI, quart: 'quart1', employes_piste: [], employes_boutique: ['e1'] }],
  });
  assert.strictEqual(fiche(r).heuresConfirmees, 7);
  assert.strictEqual(fiche(r).joursConfirmes.size, 1);
  assert.strictEqual(fiche(r).presencesPlanifiees, 0);
  assert.ok(!typeItems(r).includes('absence_a_verifier'));
});

// ── Décisions de Frédéric du 08/10 sur les questions ouvertes ────────────
// « Paye ne peut fonctionner sans Verify mais il peut fonctionner sans
// planning » ; « si le pointage est inactif, il ne prouve rien ».
const AUDIT_BOUTIQUE = date => ({ id: `a-${date}`, date, quart: '1', employes_piste: [], employes_boutique: ['e1'] });

scenario('sans planning, un jour Verify est compté et ne bloque pas le salarié', () => {
  const r = run({ audits: [AUDIT_BOUTIQUE(LUNDI), AUDIT_BOUTIQUE(VENDREDI)] });
  assert.strictEqual(fiche(r).heuresConfirmees, 7 + 8);
  assert.strictEqual(fiche(r).joursConfirmes.size, 2);
  const items = fiche(r).items.filter(i => i.typeItem === 'presence_exceptionnelle');
  assert.strictEqual(items.length, 2);
  items.forEach(i => {
    assert.strictEqual(i.statut, 'information');
    assert.strictEqual(i.libelle, 'Présence constatée par Verify, sans planning');
  });
  assert.strictEqual(M.statutSalarie(fiche(r)), 'pret');
});

scenario('un jour de repos planifié que Verify contredit reste à vérifier (§3)', () => {
  const r = run({
    planning: [{ employee_id: 'e1', date: LUNDI, quart: 'quart1', statut: 'repos', duree_heures: null }],
    audits: [AUDIT_BOUTIQUE(LUNDI)],
  });
  const item = fiche(r).items.find(i => i.typeItem === 'presence_exceptionnelle');
  assert.strictEqual(item.statut, 'a_verifier');
  assert.strictEqual(M.statutSalarie(fiche(r)), 'a_verifier');
});

scenario('un pointage seul, pointage actif, ne vaut pas Verify : jamais établi', () => {
  const r = run({ pointages: [{ employee_id: 'e1', date: LUNDI, type: 'arrivee' }] });
  const item = fiche(r).items.find(i => i.typeItem === 'presence_exceptionnelle');
  assert.strictEqual(item.statut, 'a_verifier');
});

scenario('pointage inactif : une caisse planifiée avec pointage seul reste à vérifier', () => {
  const entree = {
    planning: [caisse(LUNDI, 7)],
    pointages: [{ employee_id: 'e1', date: LUNDI, type: 'arrivee' }],
  };
  assert.strictEqual(fiche(run(entree)).heuresConfirmees, 7, 'témoin : pointage actif, la présence est confirmée');
  const r = run(Object.assign({ pointageActif: false }, entree));
  assert.strictEqual(fiche(r).heuresConfirmees, 0);
  assert.ok(typeItems(r).includes('absence_a_verifier'));
});

scenario('pointage inactif : un pointage hors planning ne crée aucune présence', () => {
  const r = run({ pointageActif: false, pointages: [{ employee_id: 'e1', date: LUNDI, type: 'arrivee' }] });
  assert.strictEqual(fiche(r).joursConfirmes.size, 0);
  assert.ok(!typeItems(r).includes('presence_exceptionnelle'));
});

scenario('pointage inactif : Verify seul fait foi, sans être compté comme mesuré deux fois', () => {
  const r = run({
    pointageActif: false,
    planning: [caisse(LUNDI, 7)],
    pointages: [{ employee_id: 'e1', date: LUNDI, type: 'arrivee' }],
    audits: [AUDIT_BOUTIQUE(LUNDI)],
  });
  assert.strictEqual(fiche(r).heuresConfirmees, 7);
  assert.strictEqual(fiche(r).presencesMesurees, 0);
  assert.strictEqual(fiche(r).presencesReconstituees, 1);
});

scenario('le chargeur transmet station_config.pointage_actif au moteur', () => {
  const src = fs.readFileSync(path.join(__dirname, 'nexus-paye-donnees.js'), 'utf8');
  assert.ok(/from\('station_config'\)\.select\('[^']*\bpointage_actif\b/.test(src), 'pointage_actif non lu');
  assert.ok(/pointageActif:\s*!\(configRes\.data && configRes\.data\.pointage_actif === false\)/.test(src), 'pointageActif non transmis');
});

console.log(`\nNEXUS PAYE — règles SMU du 08/10 : ${passes}/${passes} scénarios passent.`);
