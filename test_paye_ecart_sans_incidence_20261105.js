#!/usr/bin/env node
// NEXUS PAYE lot 3 « logique » (05/11/2026) — un écart de caisse n'est pas une
// décision de paie. Il reste consultable (avec son lien Verify) mais ne compte
// ni dans le statut du salarié ni dans les « décisions à traiter ». Aucune
// heure ni aucun montant ne bouge.
'use strict';
const assert = require('assert');
const fs = require('fs');
require('./nexus-paye-moteur.js');
const M = global.NexusPayeMoteur;

const base = {
  periode: '2026-11-01',
  employees: [{ id: 'e1', nom: 'Fictive', role: 'renfort', actif: true }],
  settings: [{ employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' }],
  planning: [{ employee_id: 'e1', date: '2026-11-03', quart: 'renfort', statut: 'renfort', duree_heures: 7 }],
  pointages: [], audits: [], indisponibilites: [], items: [], ecarts: [],
  config: { jours_heure_supp: [4, 5, 6], minutes_heure_supp: 60, activites_heure_supp: ['piste', 'boutique'], quart_exclu_heure_supp: 'renfort', retard_max_coherent_min: 180, jours_feries: [] },
};
const ecart = (montant) => ({ id: 'a1', sourceModule: 'verify', employeeId: 'e1', date: '2026-11-10', quart: '1', activite: 'piste',
  montantRetenu: montant, ecartInitial: montant, ecartFinal: montant, statut: 'cloture_non_explique', deepLink: 'NEXUS-Verify-v1.html#a1' });
const run = ecarts => M.construireRapport(Object.assign({}, base, { ecarts }));

let n = 0; const ok = (c, m) => { assert.ok(c, 'ÉCHEC : ' + m); n++; };

const sans = run([]), avec = run([ecart(-0.17)]);
const f = r => r.employes[0];

ok(avec.employes[0].items.some(i => i.typeItem === 'ecart_caisse' && i.statut === 'a_verifier' && i.deepLink), 'l\'écart de −0,17 € reste visible, avec son lien Verify');
ok(M.sansIncidencePaie(f(avec).items.find(i => i.typeItem === 'ecart_caisse')), 'l\'écart est reconnu sans incidence paie');
assert.strictEqual(f(avec).statut, f(sans).statut, 'ÉCHEC : le statut du salarié ne change pas à cause de l\'écart'); n++;
assert.strictEqual(avec.synthese.aVerifier, sans.synthese.aVerifier, 'ÉCHEC : aucune décision de plus'); n++;
ok(!avec.bloqueurs.some(b => b.type === 'ecart_caisse'), 'aucun bloqueur pour un écart de caisse');
assert.strictEqual(f(avec).heuresConfirmees, f(sans).heuresConfirmees, 'ÉCHEC : heures inchangées'); n++;
assert.deepStrictEqual(M.variablesComptables(f(avec)).presence.heures, M.variablesComptables(f(sans)).presence.heures); n++;
assert.strictEqual(M.variablesComptables(f(avec)).retenueEcartCentimes || 0, 0); n++;

// Les autres éléments restent de vraies décisions, même avec impactPaye:false.
ok(!M.sansIncidencePaie({ typeItem: 'jour_ferie', statut: 'a_verifier', impactPaye: false }), 'un jour férié reste une décision');
ok(!M.sansIncidencePaie({ typeItem: 'absence_a_verifier', statut: 'a_verifier', impactPaye: false }), 'une absence reste une décision');

// Décision Frédéric (05/11) : un écart non attribué bloque toujours le mois.
const nonAttribue = run([Object.assign(ecart(-0.17), { employeeId: null })]);
ok(nonAttribue.bloqueurs.some(b => b.type === 'ecart_non_attribue'), 'un écart non attribué bloque toujours le mois');

// Un écart contesté bloque le mois, mais le salarié reste « Prêt » s'il n'a rien d'autre.
const conteste = run([Object.assign(ecart(-0.17), { contestation: { statut_contestation: 'ouverte' } })]);
ok(conteste.bloqueurs.some(b => b.type === 'ecart_caisse' && b.employeeId === 'e1'), 'un écart contesté bloque le mois');
assert.strictEqual(f(conteste).statut, f(sans).statut, 'ÉCHEC : le salarié reste dans son statut malgré la contestation'); n++;

// Écran : la liste « à traiter » du salarié passe par la même règle.
const html = fs.readFileSync(__dirname + '/NEXUS-Paye-v1.html', 'utf8');
ok(/function itemsEnAttente\(f\)\{return \(f\.items\|\|\[\]\)\.filter\(i=>!NexusPayeMoteur\.sansIncidencePaie\(i\)/.test(html), 'l\'écran réutilise la règle du moteur');

console.log(`${n} contrôles passent.`);

// Vocabulaire Constatée / Calculée / Corrigée (lot 3, 05/11/2026) : aucun libellé
// n'oppose plus « mesuré » à « reconstitué » à l'écran ni dans le PDF.
{
  const fs = require('fs');
  const html = fs.readFileSync(__dirname + '/NEXUS-Paye-v1.html', 'utf8');
  const pdf = fs.readFileSync(__dirname + '/nexus-paye-dossier-pdf.js', 'utf8');
  assert(!/jours mesurés|reconstitué[s]?\b(?! à)/.test(html.replace(/presencesReconstituees|joursReconstitues|reconstitues/g, '')), 'libellé « reconstitué » restant dans l’écran');
  assert(/Constatée : journée attestée/.test(html) && /Calculée : durée chiffrée/.test(html) && /Corrigée : heures exceptionnelles/.test(html), 'trois notions absentes de l’infobulle');
  assert(!/source unique/i.test(html), '« source unique » ne doit plus apparaître dans l’écran');
  assert(!/\(Verify \+ pointage\)/.test(html), 'compteur du haut non aligné');
  assert(/confirmée\(s\) par deux sources/.test(pdf), 'note PDF non alignée');
  console.log('OK — vocabulaire Constatée / Calculée / Corrigée');
}
