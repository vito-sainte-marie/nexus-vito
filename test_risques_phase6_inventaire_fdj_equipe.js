// Cadrage risques Phase 6 (tâche #235, 18/08/2026) — tests de non-régression
// pour :
//   1) qualifierAlerteInventaire (nexus-risques-moteur.js) — 4e domaine
//      NexusRisques, motivé par l'incident Glaçons Crystal du 18/08/2026.
//   2) qualifierPonctualiteCollaborateur — 6e domaine, un signal PAR
//      collaborateur (jamais un agrégat de site), avec SEUIL_RETARDS_RECURRENTS
//      désormais centralisé.
//   3) domaineLabelSignal / sujetSignal — labels étendus pour inventaire/fdj/equipe.
//   4) régression stricte des domaines existants (marge/caisse/carburant).
//
// Exécution : node test_risques_phase6_inventaire_fdj_equipe.js

const path = require('path');
global.window = global;
require(path.join(__dirname, 'nexus-risques-moteur.js'));
const NexusRisques = global.NexusRisques;

let total = 0, ok = 0;
function assert(label, condition) {
  total++;
  if (condition) { ok++; console.log(`OK   - ${label}`); }
  else { console.log(`FAIL - ${label}`); }
}

// ------------------------------------------------------------
// 1) qualifierAlerteInventaire
// ------------------------------------------------------------

// 1.1 — gravité 'critique', 1ère alerte : Règle A2 majeure => risque_avere
// immédiat, même sans récurrence (miroir des autres domaines A2).
{
  const r = NexusRisques.qualifierAlerteInventaire({ gravite: 'critique', nbAlertesRecentes: 1, valeurEstimeeTotal: null });
  assert('Inventaire — gravité critique, 1ère fois => risque_avere', r.niveau === 'risque_avere');
}

// 1.2 — gravité 'attention', récurrence insuffisante : exposition (Règle B2).
{
  const r = NexusRisques.qualifierAlerteInventaire({ gravite: 'attention', nbAlertesRecentes: 1, valeurEstimeeTotal: null });
  assert('Inventaire — gravité attention, 1ère fois => exposition', r.niveau === 'exposition');
}

// 1.3 — gravité 'attention' mais récurrence suffisante (>=5, Règle A2 voie
// récurrence) => risque_avere par répétition.
{
  const r = NexusRisques.qualifierAlerteInventaire({ gravite: 'attention', nbAlertesRecentes: 5, valeurEstimeeTotal: null });
  assert('Inventaire — attention + 5 occurrences => risque_avere par récurrence', r.niveau === 'risque_avere');
}

// 1.4 — gravité inconnue/absente : aucune escalade qualitative, retombe sur
// Règle C/D pure (jamais une exception sur une donnée mal formée).
{
  const r1 = NexusRisques.qualifierAlerteInventaire({ gravite: null, nbAlertesRecentes: 1 });
  const r2 = NexusRisques.qualifierAlerteInventaire({ gravite: 'inconnue', nbAlertesRecentes: 3 });
  assert('Inventaire — gravité absente, 1 occurrence => anomalie (défaut)', r1.niveau === 'anomalie');
  assert('Inventaire — gravité non reconnue, 3 occurrences => signal_faible', r2.niveau === 'signal_faible');
}

// 1.5 — une estimation € déjà présente et significative prime sur le
// jugement qualitatif (même priorité que Phase 4/5) : gravité 'attention'
// seule ne vaudrait qu'exposition, mais un impactPotentielEur élevé peut
// suffire seul via la Règle B € normale.
{
  const r = NexusRisques.qualifierAlerteInventaire({ gravite: 'attention', nbAlertesRecentes: 1, valeurEstimeeTotal: 250 });
  assert('Inventaire — impact € significatif (250€) => exposition via Règle B, cohérent', r.niveau === 'exposition');
}

// ------------------------------------------------------------
// 2) qualifierPonctualiteCollaborateur
// ------------------------------------------------------------

// 2.1 — 1 retard isolé : anomalie (Règle D), jamais une conclusion hâtive.
{
  const r = NexusRisques.qualifierPonctualiteCollaborateur({ nbRetards: 1, totalPointages: 10 });
  assert('Équipe — 1 retard isolé => anomalie', r.niveau === 'anomalie');
}

// 2.2 — 2 retards : signal_faible (Règle C, SEUIL_RECURRENCE_SIGNAL_FAIBLE=2),
// pas encore le seuil "à surveiller".
{
  const r = NexusRisques.qualifierPonctualiteCollaborateur({ nbRetards: 2, totalPointages: 10 });
  assert('Équipe — 2 retards => signal_faible', r.niveau === 'signal_faible');
}

// 2.3 — SEUIL_RETARDS_RECURRENTS (3) atteint : majeure => risque_avere
// immédiat, même seuil que l'ancien littéral `n >= 3` de chargerDomaineEquipe.
{
  const r = NexusRisques.qualifierPonctualiteCollaborateur({ nbRetards: 3, totalPointages: 10 });
  assert('Équipe — 3 retards (SEUIL_RETARDS_RECURRENTS) => risque_avere', r.niveau === 'risque_avere');
  assert('SEUIL_RETARDS_RECURRENTS exporté vaut bien 3', NexusRisques.SEUIL_RETARDS_RECURRENTS === 3);
}

// ------------------------------------------------------------
// 3) domaineLabelSignal / sujetSignal — domaines Phase 6
// ------------------------------------------------------------
{
  const sInv = { domaine: 'inventaire', cle_signal: 'inventaire:produit:Glaçons Crystal 5kg' };
  assert('Label — inventaire => "Inventaire"', NexusRisques.domaineLabelSignal(sInv) === 'Inventaire');
  assert('Sujet — inventaire => nom de produit brut', NexusRisques.sujetSignal(sInv) === 'Glaçons Crystal 5kg');

  const sFdj = { domaine: 'fdj', cle_signal: 'fdj:quart:Q2' };
  assert('Label — fdj => "FDJ"', NexusRisques.domaineLabelSignal(sFdj) === 'FDJ');
  assert('Sujet — fdj => "Quart Q2" (même format que caisse)', NexusRisques.sujetSignal(sFdj) === 'Quart Q2');

  const sEquipe = { domaine: 'equipe', cle_signal: 'equipe:collaborateur:Jean Dupont' };
  assert('Label — equipe => "Équipe"', NexusRisques.domaineLabelSignal(sEquipe) === 'Équipe');
  assert('Sujet — equipe => nom du collaborateur brut', NexusRisques.sujetSignal(sEquipe) === 'Jean Dupont');
}

// ------------------------------------------------------------
// 4) Régression stricte — domaines Phase 1-5 inchangés
// ------------------------------------------------------------
{
  const rCaisse = NexusRisques.qualifierEcartCaisse({ ecartCumule: 50, total: 10, parStatut: { anomalie: 1, critique: 0 } });
  assert('Régression — qualifierEcartCaisse toujours fonctionnel', typeof rCaisse.niveau === 'string');

  const rMarge = NexusRisques.qualifierMargeCategorie({
    categorie: 'Test', margePctActuelle: 10, margeHistorique: [20, 22, 21], caActuel: 10000, caHistoriqueMoyen: 10000,
  });
  assert('Régression — qualifierMargeCategorie toujours fonctionnel', typeof rMarge.niveau === 'string');

  const rCarburant = NexusRisques.qualifierAutonomieCarburant({ autonomieJours: 1, seuilAlerteJours: 1.5, seuilVigilanceJours: 3 });
  assert('Régression — qualifierAutonomieCarburant toujours fonctionnel (risque_avere sous seuil alerte)', rCarburant.niveau === 'risque_avere');

  const sCarburant = { domaine: 'carburant', cle_signal: 'carburant:autonomie:go' };
  assert('Régression — label carburant toujours "Carburants"', NexusRisques.domaineLabelSignal(sCarburant) === 'Carburants');
  assert('Régression — sujet carburant go toujours "Gazole"', NexusRisques.sujetSignal(sCarburant) === 'Gazole');

  const sMarge = { domaine: 'marge', cle_signal: 'marge:categorie:Boissons' };
  assert('Régression — label marge toujours "Marge"', NexusRisques.domaineLabelSignal(sMarge) === 'Marge');
}

console.log(`\n${ok}/${total} assertions passées.`);
process.exit(ok === total ? 0 : 1);
