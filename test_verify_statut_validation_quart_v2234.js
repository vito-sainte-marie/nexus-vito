// Test — Statut global de validation par quart (Historique Verify)
// (24/08/2026, v2.234, demande de Frédéric : "Amélioration UX — NEXUS
// Verify / Historique — je veux ajouter un statut global discret par
// quart, afin de savoir immédiatement si toutes les caisses attendues du
// quart ont bien été validées.")
//
// Décision actée avec Frédéric avant d'écrire le code (question posée en
// chat) : la validation d'un quart était jusqu'ici ATOMIQUE (un seul clic
// validait Piste ET Boutique ensemble). Pour qu'un vrai "Partiellement
// validé" (ex. 1/2 caisse validée) puisse apparaître au quotidien — pas
// seulement sur de vieilles lignes migrées — Frédéric a choisi de rendre
// la validation indépendante par caisse (migration
// split_validation_piste_boutique_audits_caisse : valide_le_piste/
// premiere_validation_le_piste/valide_par_piste + équivalents boutique).
//
// Ce test couvre NexusVerifyMoteur.statutValidationQuart, seule source du
// calcul (Article 11) — jamais un nombre de caisses codé en dur : dérivé
// des composantes (ecart_piste/ecart_boutique) réellement présentes sur la
// ligne.

const path = require('path');
require(path.join(__dirname, 'nexus-verify-moteur.js'));
const M = global.NexusVerifyMoteur;
const assert = require('assert');

if (!M) throw new Error('NexusVerifyMoteur ne s\'est pas attaché à global — vérifier le require.');
if (!M.statutValidationQuart) throw new Error('statutValidationQuart absent de NexusVerifyMoteur.');

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

// ------------------------------------------------------------
// 1) Aucune caisse validée -> 'en_attente', 0/2.
// ------------------------------------------------------------
{
  const a = { ecart_piste: 1.5, ecart_boutique: -0.5, valide_le_piste: null, valide_le_boutique: null };
  const r = M.statutValidationQuart(a);
  assert.strictEqual(r.etat, 'en_attente');
  assert.strictEqual(r.caissesAttendues, 2);
  assert.strictEqual(r.caissesValidees, 0);
  assert.strictEqual(r.dernierInstant, null);
  ok('statutValidationQuart — rien de validé -> en_attente, 0/2, aucun instant');
}

// ------------------------------------------------------------
// 2) Une seule caisse validée sur deux attendues -> 'partiel', 1/2
//    (exemple exact de Frédéric : "1/2 caisse validée · validation en
//    attente").
// ------------------------------------------------------------
{
  const a = {
    ecart_piste: 1.5, ecart_boutique: -0.5,
    valide_le_piste: '2026-08-24T09:00:00Z', premiere_validation_le_piste: '2026-08-24T09:00:00Z', valide_par_piste: 'emp1',
    valide_le_boutique: null, premiere_validation_le_boutique: null, valide_par_boutique: null,
  };
  const r = M.statutValidationQuart(a);
  assert.strictEqual(r.etat, 'partiel');
  assert.strictEqual(r.caissesAttendues, 2);
  assert.strictEqual(r.caissesValidees, 1);
  assert.strictEqual(r.dernierInstant, '2026-08-24T09:00:00Z');
  assert.strictEqual(r.dernierAuteurId, 'emp1');
  ok('statutValidationQuart — 1 caisse validée sur 2 -> partiel, 1/2, dernier instant = celle validée');
}

// ------------------------------------------------------------
// 3) Les deux caisses validées, jamais corrigées -> 'valide', 2/2, dernier
//    instant = le plus récent des deux (exemple : "2/2 caisses validées ·
//    clôturé à 21:14").
// ------------------------------------------------------------
{
  const a = {
    ecart_piste: 0, ecart_boutique: 0.2,
    valide_le_piste: '2026-08-23T20:50:00Z', premiere_validation_le_piste: '2026-08-23T20:50:00Z', valide_par_piste: 'emp1',
    valide_le_boutique: '2026-08-23T21:14:00Z', premiere_validation_le_boutique: '2026-08-23T21:14:00Z', valide_par_boutique: 'emp2',
  };
  const r = M.statutValidationQuart(a);
  assert.strictEqual(r.etat, 'valide');
  assert.strictEqual(r.caissesAttendues, 2);
  assert.strictEqual(r.caissesValidees, 2);
  assert.strictEqual(r.dernierInstant, '2026-08-23T21:14:00Z', 'le plus récent des deux -> boutique (21:14), pas piste (20:50)');
  assert.strictEqual(r.dernierAuteurId, 'emp2');
  ok('statutValidationQuart — 2/2 validées, jamais corrigées -> valide, dernier instant = le plus récent des deux');
}

// ------------------------------------------------------------
// 4) Les deux validées, mais une a été CORRIGÉE depuis (valide_le_X !=
//    premiere_validation_le_X) -> 'ajuste' (exemple : "Validé · ajusté à
//    09:32").
// ------------------------------------------------------------
{
  const a = {
    ecart_piste: 0, ecart_boutique: 0,
    valide_le_piste: '2026-08-24T09:32:00Z', premiere_validation_le_piste: '2026-08-23T20:50:00Z', valide_par_piste: 'emp3', // corrigée le lendemain matin
    valide_le_boutique: '2026-08-23T21:14:00Z', premiere_validation_le_boutique: '2026-08-23T21:14:00Z', valide_par_boutique: 'emp2',
  };
  const r = M.statutValidationQuart(a);
  assert.strictEqual(r.etat, 'ajuste');
  assert.strictEqual(r.caissesAttendues, 2);
  assert.strictEqual(r.caissesValidees, 2);
  assert.strictEqual(r.dernierInstant, '2026-08-24T09:32:00Z', 'la correction du 24/08 09:32 est plus récente que la validation boutique du 23/08');
  assert.strictEqual(r.dernierAuteurId, 'emp3');
  ok('statutValidationQuart — validation corrigée après coup -> ajuste, dernier instant = la correction');
}

// ------------------------------------------------------------
// 5) Une seule caisse ATTENDUE sur la ligne (ex. ligne legacy sans
//    boutique) -> caissesAttendues=1, jamais 2 codé en dur ; validée ->
//    'valide' 1/1.
// ------------------------------------------------------------
{
  const a = {
    ecart_piste: 3.1, ecart_boutique: null,
    valide_le_piste: '2026-08-20T18:00:00Z', premiere_validation_le_piste: '2026-08-20T18:00:00Z', valide_par_piste: 'emp1',
  };
  const r = M.statutValidationQuart(a);
  assert.strictEqual(r.caissesAttendues, 1, 'ecart_boutique absent -> 1 seule caisse attendue, pas 2');
  assert.strictEqual(r.caissesValidees, 1);
  assert.strictEqual(r.etat, 'valide');
  ok('statutValidationQuart — une seule composante présente sur la ligne -> attendues=1, jamais un 2 codé en dur');
}

// ------------------------------------------------------------
// 6) Aucune composante du tout (ligne totalement vide, cas limite) ->
//    en_attente, 0 attendues, jamais une exception.
// ------------------------------------------------------------
{
  const r = M.statutValidationQuart({ ecart_piste: null, ecart_boutique: null });
  assert.strictEqual(r.caissesAttendues, 0);
  assert.strictEqual(r.etat, 'en_attente');
  ok('statutValidationQuart — aucune composante -> en_attente, 0 attendues, jamais une exception');
}

// ------------------------------------------------------------
// 7) statutValidationQuart(null) -> null, jamais une exception (appelé
//    depuis une boucle de rendu, une ligne inattendue ne doit jamais
//    planter tout l'Historique).
// ------------------------------------------------------------
{
  assert.strictEqual(M.statutValidationQuart(null), null);
  assert.strictEqual(M.statutValidationQuart(undefined), null);
  ok('statutValidationQuart — entrée null/undefined -> null, jamais une exception');
}

console.log(`\n${n}/${n} tests passés — Statut global de validation par quart (v2.234).`);
