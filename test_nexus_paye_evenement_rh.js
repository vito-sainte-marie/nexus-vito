// Un événement RH = une décision (03/09/2026, retour de Frédéric).
//
// Cas réel : Vanessa, une seule ligne d'indisponibilité du 21/07/2026 au
// 03/01/2027. Avant ce lot, PAYE dépliait la période en une carte par jour —
// 30 en septembre, 31 en octobre, 167 au total pour une information déjà
// connue en une fois.
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

const VANESSA = { id: 'emp-vanessa', nom: 'vanessa', actif: true };
const INDISPO = {
  id: 'ind-1', employee_id: VANESSA.id, site_id: 'vito-sainte-marie',
  date_debut: '2026-07-21', date_fin: '2027-01-03', type: 'indisponible',
};
const REGLAGE = [{ employee_id: VANESSA.id, inclus_paye: true, mode_presence: 'automatique' }];

function rapport(extra) {
  return M.construireRapport(Object.assign({
    periode: '2026-09', employees: [VANESSA], settings: REGLAGE,
    indisponibilites: [INDISPO], planning: [], audits: [], pointages: [], items: [], config: {},
  }, extra || {}));
}

let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

// 1) Septembre : une seule carte, pas trente.
const r = rapport();
const fiche = r.employes.find(f => f.employee.id === VANESSA.id);
const indispos = fiche.items.filter(i => i.origine === 'indisponibilite');
verifier('un seul item pour toute la période, au lieu d’un par jour', indispos.length === 1);
verifier('la carte porte la période réelle de l’événement, pas le mois',
  indispos[0].evenementDebut === '2026-07-21' && indispos[0].evenementFin === '2027-01-03');
verifier('le libellé annonce la période entière',
  indispos[0].libelle === 'Indisponibilité déclarée du 21/07/2026 au 03/01/2027');
verifier('le détail chiffre l’impact du mois (30 jours en septembre)',
  indispos[0].joursMois === 30 && /30 jours sur la période de paie/.test(indispos[0].detail));
verifier('la clé ne porte plus la date — un arbitrage vaut pour la période',
  indispos[0].sourceCle === 'indispo:ind-1');
verifier('« À vérifier » compte 1 décision, pas 30', r.synthese.aVerifier === 1);

// 2) Octobre : le mois suivant ne redécouvre pas 31 nouvelles décisions.
const oct = M.construireRapport({
  periode: '2026-10', employees: [VANESSA], settings: REGLAGE,
  indisponibilites: [INDISPO], planning: [], audits: [], pointages: [], items: [], config: {},
});
verifier('octobre produit lui aussi une seule carte',
  oct.employes[0].items.filter(i => i.origine === 'indisponibilite').length === 1);
verifier('c’est le MÊME événement, reconnaissable à sa clé',
  oct.employes[0].items.find(i => i.origine === 'indisponibilite').sourceCle === 'indispo:ind-1');

// 3) Un motif qualifié n’est plus une décision à reprendre.
const qualifie = rapport({ indisponibilites: [Object.assign({}, INDISPO, { motif: 'conge_maternite', confirme_le: '2026-09-01T08:00:00Z' })] });
const item = qualifie.employes[0].items.find(i => i.origine === 'indisponibilite');
verifier('un congé maternité qualifié ET confirmé devient une information', item.statut === 'information');
verifier('son libellé nomme le motif', /^Congé maternité du /.test(item.libelle));
verifier('il ne compte plus dans « À vérifier »', qualifie.synthese.aVerifier === 0);

// 4) Les jours planifiés pendant l’absence ne deviennent pas des anomalies.
const planning = ['2026-09-01', '2026-09-02', '2026-09-03'].map(d => ({
  employee_id: VANESSA.id, date: d, statut: 'travail_normal', duree_heures: 7,
}));
const avecPlanning = rapport({ planning });
verifier('aucune alerte « présence prévue sans preuve » sur une absence déclarée',
  !avecPlanning.employes[0].items.some(i => i.typeItem === 'absence_a_verifier'));
verifier('les jours normalement travaillés sont comptés dans le détail',
  avecPlanning.employes[0].items.find(i => i.origine === 'indisponibilite').joursPlanifiesMois === 3);

// 5) La seule vraie contradiction reste signalée.
const avecPreuve = rapport({
  planning,
  audits: [{ date: '2026-09-02', quart: '1', employes_piste: [VANESSA.id], site: 'vito-sainte-marie' }],
  indisponibilites: [Object.assign({}, INDISPO, { motif: 'conge_maternite', confirme_le: '2026-09-01T08:00:00Z' })],
});
const contradictoire = avecPreuve.employes[0].items.find(i => i.origine === 'indisponibilite');
verifier('une présence constatée pendant l’absence rouvre la décision',
  contradictoire.contradiction === true && contradictoire.statut === 'a_verifier');

// 6) Configuration et arbitrages du mois ne sont plus mélangés.
const nonConfirme = rapport({ settings: [] });
verifier('un paramétrage à compléter est classé « configuration »',
  nonConfirme.bloqueurs.some(b => b.categorie === 'configuration'));
verifier('et compté séparément des éléments de paie',
  nonConfirme.synthese.configurationRequise >= 1);

// 7) Retour sans date connue : l'absence ne disparaît pas à l'horizon.
const sansFin = M.construireRapport({
  periode: '2027-03', employees: [VANESSA], settings: REGLAGE,
  indisponibilites: [Object.assign({}, INDISPO, { fin_indeterminee: true })],
  planning: [], audits: [], pointages: [], items: [], config: {},
});
const itemSansFin = sansFin.employes[0].items.find(i => i.origine === 'indisponibilite');
verifier('une fin indéterminée couvre encore un mois postérieur à date_fin',
  !!itemSansFin && itemSansFin.joursMois === 31);
verifier('le libellé dit franchement que le retour n’est pas daté',
  /— retour non daté$/.test(itemSansFin.libelle));

// 8) Reprise : la période se referme, elle n'est jamais réécrite.
const reprise = M.construireRapport({
  periode: '2026-09', employees: [VANESSA], settings: REGLAGE,
  indisponibilites: [Object.assign({}, INDISPO, { date_reprise: '2026-09-15' })],
  planning: [], audits: [], pointages: [], items: [], config: {},
});
const itemReprise = reprise.employes[0].items.find(i => i.origine === 'indisponibilite');
verifier('la reprise borne la période à la veille du retour', itemReprise.joursMois === 14);
verifier('le libellé annonce la reprise', /au 15\/09\/2026 \(reprise\)$/.test(itemReprise.libelle));
verifier('la date de début d’origine n’est jamais réécrite', itemReprise.evenementDebut === '2026-07-21');

// 9) Après la reprise, le salarié sort de « À vérifier ».
const apres = M.construireRapport({
  periode: '2026-10', employees: [VANESSA], settings: REGLAGE,
  indisponibilites: [Object.assign({}, INDISPO, { date_reprise: '2026-09-15' })],
  planning: [], audits: [], pointages: [], items: [], config: {},
});
verifier('le mois suivant la reprise ne rouvre aucune décision',
  !apres.employes[0].items.some(i => i.origine === 'indisponibilite'));

console.log(`\n${ok} vérifications passées.`);
