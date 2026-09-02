#!/usr/bin/env node
'use strict';
const assert = require('assert');
require('../nexus-paye-moteur.js');
const M = global.NexusPayeMoteur;
const base = {
  periode: '2026-08-01',
  employees: [{ id: 'e1', nom: 'Camille', role: 'pompiste', actif: true }],
  settings: [{ employee_id: 'e1', inclus_paye: true, mode_presence: 'automatique' }],
  planning: [], pointages: [], audits: [], indisponibilites: [], items: [], ecarts: [],
  config: { jours_heure_supp: [4,5,6], minutes_heure_supp: 60, activites_heure_supp: ['piste','boutique'], quart_exclu_heure_supp: 'renfort', retard_max_coherent_min: 180, jours_feries: ['2026-08-15'] },
};
const run = extra => M.construireRapport(Object.assign({}, base, extra));
const scenarios = [];
function scenario(nom, fn){fn();scenarios.push(nom)}

scenario('planning + pointage confirme la présence',()=>{
 const r=run({planning:[{employee_id:'e1',date:'2026-08-03',quart:'quart1',statut:'travail_normal',duree_heures:7,tache:'piste'}],pointages:[{employee_id:'e1',date:'2026-08-03',type:'arrivee',retard_min:0}]});
 assert.strictEqual(r.synthese.heuresConfirmees,7);
});
scenario('planning sans preuve reste à vérifier',()=>{
 const r=run({planning:[{employee_id:'e1',date:'2026-08-03',quart:'quart1',statut:'travail_normal',duree_heures:7,tache:'piste'}]});
 assert.ok(r.items.some(i=>i.typeItem==='absence_a_verifier'));
});
scenario('preuve sans planning devient présence exceptionnelle',()=>{
 const r=run({pointages:[{employee_id:'e1',date:'2026-08-04',type:'arrivee',retard_min:0}]});
 assert.ok(r.items.some(i=>i.typeItem==='presence_exceptionnelle'));
});
scenario('Verify peut reconstituer une présence sans pointage',()=>{
 const r=run({planning:[{employee_id:'e1',date:'2026-08-05',quart:'quart1',statut:'travail_normal',duree_heures:7,tache:'piste'}],audits:[{id:'a',date:'2026-08-05',quart:'quart1',employes_piste:['e1'],employes_boutique:[]}]});
 assert.strictEqual(r.employes[0].presencesReconstituees,1);
});
scenario('vendredi piste propose une heure supplémentaire',()=>{
 const r=run({planning:[{employee_id:'e1',date:'2026-08-07',quart:'quart1',statut:'travail_normal',duree_heures:8,tache:'piste'}],pointages:[{employee_id:'e1',date:'2026-08-07',type:'arrivee',retard_min:0}]});
 assert.strictEqual(r.items.find(i=>i.typeItem==='heure_supplementaire').quantiteMinutes,60);
});
scenario('renfort reste à 7 h sans heure supplémentaire',()=>{
 const r=run({planning:[{employee_id:'e1',date:'2026-08-07',quart:'renfort',statut:'renfort',duree_heures:7}],pointages:[{employee_id:'e1',date:'2026-08-07',type:'arrivee',retard_min:0}]});
 assert.ok(!r.items.some(i=>i.typeItem==='heure_supplementaire'));
});
scenario('retard cohérent est proposé à arbitrage',()=>{
 const r=run({pointages:[{employee_id:'e1',date:'2026-08-08',type:'arrivee',retard_min:12}]});
 assert.ok(r.items.some(i=>i.typeItem==='retard'&&i.quantiteMinutes===12));
});
scenario('retard aberrant est bloqué techniquement',()=>{
 const r=run({pointages:[{employee_id:'e1',date:'2026-08-08',type:'arrivee',retard_min:5754}]});
 assert.ok(r.items.some(i=>i.typeItem==='retard_incoherent'&&i.bloquantTechnique));
});
scenario('congé déclaré n’est pas transformé en absence certaine',()=>{
 const r=run({indisponibilites:[{id:'c1',employee_id:'e1',date_debut:'2026-08-09',date_fin:'2026-08-09',type:'conge'}]});
 assert.ok(r.items.some(i=>i.typeItem==='conge_paye'&&i.statut==='a_verifier'));
});
scenario('jour férié travaillé est détecté',()=>{
 const r=run({planning:[{employee_id:'e1',date:'2026-08-15',quart:'quart1',statut:'travail_normal',duree_heures:8,tache:'piste'}],pointages:[{employee_id:'e1',date:'2026-08-15',type:'arrivee',retard_min:0}]});
 assert.ok(r.items.some(i=>i.typeItem==='jour_ferie'));
});
scenario('écart ne devient jamais retenue automatiquement',()=>{
 const r=run({ecarts:[{id:'verify-a-piste',employeeId:'e1',date:'2026-08-12',activite:'piste',sourceModule:'verify',montantRetenu:-36.65}]});
 const i=r.items.find(x=>x.typeItem==='ecart_caisse'); assert.strictEqual(i.impactPaye,false);assert.strictEqual(i.montantCentimes,null);
});
scenario('écart positif reste visible sans bloquer la paie',()=>{
 const r=run({ecarts:[{id:'verify-plus',employeeId:'e1',date:'2026-08-12',activite:'boutique',sourceModule:'verify',ecartInitial:3.01,ecartFinal:.31,montantRetenu:.31}]});
 const i=r.items.find(x=>x.typeItem==='ecart_caisse');assert.strictEqual(i.statut,'information');assert.strictEqual(i.impactPaye,false);assert.ok(!r.bloqueurs.some(b=>b.sourceCle===i.sourceCle));
});
scenario('écart non attribué reste visible et bloque si négatif',()=>{
 const r=run({ecarts:[{id:'verify-partage',employeeId:null,date:'2026-08-12',activite:'piste',sourceModule:'verify',montantRetenu:-12.5}]});
 assert.strictEqual(r.ecartsNonAttribues.length,1);assert.ok(r.bloqueurs.some(b=>b.type==='ecart_non_attribue'));
});
scenario('contestation ouverte bloque malgré un ancien arbitrage',()=>{
 const r=run({ecarts:[{id:'verify-a-piste',employeeId:'e1',date:'2026-08-12',activite:'piste',sourceModule:'verify',montantRetenu:-36.65,contestation:{statut_contestation:'ouverte'}}],items:[{id:'i',employee_id:'e1',periode:'2026-08-01',origine:'verify',source_cle:'ecart:verify-a-piste',statut:'valide',impact_paye:true,montant_centimes:3665}]});
 assert.ok(r.bloqueurs.some(b=>b.type==='ecart_caisse'));
});
scenario('export ne contient que les variables validées',()=>{
 const r=run({items:[{id:'m',employee_id:'e1',periode:'2026-08-01',origine:'manuel',source_cle:'manuel:m',type_item:'acompte',date_evenement:'2026-08-20',libelle:'Acompte validé',statut:'valide',impact_paye:true,montant_centimes:5000}]});
 assert.ok(M.lignesExport(r).some(l=>l.type==='acompte'&&l.montant_euros==='50.00'));
});

console.log(`NEXUS PAYE — ${scenarios.length}/${scenarios.length} simulations complètes passent.`);
