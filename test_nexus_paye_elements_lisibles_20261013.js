'use strict';
// NEXUS PAYE : « Éléments à traiter » lisible par un manager (13/10/2026).
// Une présence confirmée par Verify, planning non renseigné (Q4-C), est une
// information automatique : ni bouton d'arbitrage, ni champ de justification,
// ni compte dans les décisions, ni blocage. Résumé discret par salarié.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let ok = 0;
function verifier(libelle, condition) { console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`); assert.ok(condition, libelle); ok++; }

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nexus-paye-moteur.js'), 'utf8'), ctx);
function extraire(nom) {
  const m = html.match(new RegExp(`^(?:async )?function ${nom}\\([\\s\\S]*?^}`, 'm'));
  assert.ok(m, `fonction ${nom} introuvable dans l'écran`);
  return m[0];
}
vm.runInContext(`
  const ECHAPPE=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LIBELLE_STATUT_ITEM={information:'information'}, LIBELLE_SOURCE={}; let SAISIES_MANAGER=true, RAPPORT={};
  ${['cellule', 'estInfoAuto', 'jourCourt', 'renderInfosAuto', 'blocExplication', 'renderEcart', 'ecartsAExaminer'].map(extraire).join('\n')}
  ${html.match(/^const EXPLICATIONS=\{[\s\S]*?^\};/m)[0]}
`, ctx);

const info = (emp, nom, dates) => ({ employeeId: emp, employeeNom: nom, sourceCle: `planning-non-renseigne:${emp}:2026-10`, nature: 'planning_non_renseigne',
  typeItem: 'ecart_verify_planning', statut: 'information', date: dates[0], libelle: `${dates.length} présences confirmées, planning non renseigné`,
  detail: 'Présence confirmée par Verify', heuresRetenues: 0, jours: dates.map(d => ({ date: d, heuresRetenues: 7 })) });
const vrai = { employeeId: 'b', employeeNom: 'Brice', sourceCle: 'ecart:b:2026-10-02', nature: 'fonction_divergente', typeItem: 'ecart_verify_planning',
  statut: 'information', date: '2026-10-02', libelle: 'Fonction différente', heuresRetenues: 7, heuresPlanning: 7 };

const infoHtml = vm.runInContext('renderInfosAuto', ctx)([info('a', 'Angélique', ['2026-10-05', '2026-10-06', '2026-10-07'])]);
verifier('l’information automatique ne porte aucun bouton', !/<button/.test(infoHtml));
verifier('ni champ de justification', !/<textarea|ecart-motif|ecart-marquer|Examiné|Corrigé|Justifié/.test(infoHtml));
verifier('un résumé par salarié, dates dans un <details> à la demande', /<details/.test(infoHtml) && (infoHtml.match(/<li>/g) || []).length === 3);
verifier('libellé clair : impact supplémentaire 0 h, heures Verify déjà comptabilisées', /Impact supplémentaire sur la paie : 0 h — heures Verify déjà comptabilisées/.test(infoHtml));
verifier('« Heures retenues : 0 h » n’apparaît plus pour une information automatique', !/Heures retenues/.test(infoHtml));
const deux = vm.runInContext('renderInfosAuto', ctx)([info('a', 'Angélique', ['2026-10-05']), info('c', 'Cédric', ['2026-10-06', '2026-10-07'])]);
verifier('un bloc par salarié', (deux.match(/<details/g) || []).length === 2);

verifier('estInfoAuto ne vise que planning_non_renseigne', vm.runInContext('estInfoAuto', ctx)(info('a', 'x', ['2026-10-05'])) === true && vm.runInContext('estInfoAuto', ctx)(vrai) === false);
const carte = vm.runInContext('renderEcart', ctx)(vrai);
verifier('un vrai écart garde ses boutons d’arbitrage (historique et arbitrages préservés)', /ecart-marquer/.test(carte) && /ecart-motif/.test(carte));

ctx.__ecarts = [info('a', 'Angélique', ['2026-10-05']), vrai];
vm.runInContext('RAPPORT = { ecartsVerifyPlanning: __ecarts }', ctx);
verifier('le compteur « Écarts à examiner » ignore les informations automatiques', vm.runInContext('ecartsAExaminer', ctx)({ employee: { id: 'a' } }) === 0);
verifier('mais compte les vrais écarts', vm.runInContext('ecartsAExaminer', ctx)({ employee: { id: 'b' } }) === 1);

verifier('l’écran sépare Décisions obligatoires, Paramétrages à compléter et Informations automatiques',
  /Décisions obligatoires/.test(html) && /Paramétrages à compléter/.test(html) && /Informations automatiques — aucune action/.test(html));
verifier('chaque décision porte « ce qui s’est passé / pourquoi / options »',
  /Ce qui s’est passé/.test(html) && /Pourquoi une action est nécessaire/.test(html) && /Vos options/.test(html));
const ex = vm.runInContext('EXPLICATIONS', ctx);
verifier('explications en trois temps pour chaque type décisionnel', Object.values(ex).every(e => e.length === 3 && e.every(t => t.length > 20)));

// Moteur : ces informations ne comptent ni dans les décisions ni dans les blocages
const M = ctx.NexusPayeMoteur;
const S = 'vito-sainte-marie';
const r = M.construireRapport({ periode: '2026-10', employees: [{ id: 'x', nom: 'x', role: 'caissier', actif: true, site_id: S }],
  settings: [{ employee_id: 'x', site_id: S, inclus_paye: true, mode_presence: 'automatique', confirme_le: '2026-01-02T08:00:00Z' }],
  planning: [], pointages: [], indisponibilites: [], items: [], ecarts: [], config: { jours_feries: [] },
  audits: ['2026-10-05', '2026-10-06'].map((d, k) => ({ id: 'a' + k, date: d, quart: '1', statut: 'cloture', employes_piste: [], employes_boutique: ['x'], employes_renfort: [] })) });
const sans = r.ecartsVerifyPlanning.filter(i => i.nature === 'planning_non_renseigne');
verifier('le moteur produit une synthèse unique non bloquante', sans.length === 1 && sans[0].statut === 'information' && sans[0].jours.length === 2);
verifier('aucun blocage, aucune décision comptée', r.bloqueurs.length === 0 && r.synthese.aVerifier === 0 && r.synthese.configurationRequise === 0);
verifier('les heures Verify restent comptées (2 jours × 7 h)', r.employes[0].heuresConfirmees === 14);
console.log(`\n${ok} vérifications passées.`);
