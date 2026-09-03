// Barème d'heures par défaut (03/09/2026, règle de Frédéric).
//
// « Pour les heures par défaut si pas de planning, Verify en fonction des
// jours travaillés doit attribuer les heures travaillées : du dimanche au
// mercredi 7 heures pour pompiste et caissières, les autres jours 8 heures
// (7 + 1 supplémentaire), et pour le renfort 7 heures tous les jours. […]
// Angelique dans NEXUS est renfort mais a travaillé le 01/09 en boutique donc
// tu dois lui attribuer 7 heures, pas parce qu'elle est renfort mais en
// boutique le mardi. »
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
verifier('caissière un jeudi -> 8 h dont 1 supplémentaire',
  H('caissier', '2026-09-03').heures === 8 && H('caissier', '2026-09-03').heuresSupplementaires === 1);
verifier('pompiste un vendredi -> 8 h', H('pompiste', '2026-09-04').heures === 8);
verifier('pompiste un samedi -> 8 h', H('pompiste', '2026-09-05').heures === 8);
verifier('pompiste un dimanche -> 7 h', H('pompiste', '2026-09-06').heures === 7);
verifier('pompiste un lundi -> 7 h', H('pompiste', '2026-09-07').heures === 7);
verifier('renfort le jeudi -> 7 h, jamais d’heure supplémentaire automatique',
  H('renfort', '2026-09-03').heures === 7 && H('renfort', '2026-09-03').heuresSupplementaires === 0);
verifier('renfort le dimanche -> 7 h', H('renfort', '2026-09-06').heures === 7);
verifier('poste inconnu -> aucun barème inventé', H(null, '2026-09-01') === null);

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
verifier('7 h lui sont attribuées — boutique le mardi', item.heuresAttribuees === 7);
verifier('et comptées dans ses heures confirmées', fiche.heuresConfirmees === 7);
verifier('la carte explique le calcul en clair',
  /7 h attribuées — boutique le mardi/.test(item.detail));
verifier('et signale que le poste diffère du rôle inscrit',
  /différent du rôle « renfort »/.test(item.detail));
verifier('la durée est portée en minutes, pour que « Confirmer » l’enregistre',
  item.quantiteMinutes === 420);

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
const itemPiste = piste.employes[0].items.find(i => i.typeItem === 'presence_exceptionnelle');
verifier('une caissière placée en piste un jeudi -> 8 h de piste',
  itemPiste.poste === 'pompiste' && itemPiste.heuresAttribuees === 8);

console.log(`\n${ok} vérifications passées.`);
