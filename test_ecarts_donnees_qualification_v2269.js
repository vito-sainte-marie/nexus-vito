// Test — v2.269-2 (28/08/2026) : nexus-ecarts-donnees.js — rôle employé
// transmis, montantRetenu/impactPaye/activiteInhabituelle posés sur
// chaque ligne normalisée, qualification rattachée, upsert de
// qualification correctement formé.

const path = require('path');
const assert = require('assert');
const DIR = '/sessions/dazzling-compassionate-ride/mnt/image nexus project';
require(path.join(DIR, 'nexus-ecarts-moteur.js'));
require(path.join(DIR, 'nexus-ecarts-donnees.js'));
const D = globalThis.NexusEcartsDonnees;

let n = 0;
function ok(label) { n++; console.log('OK —', label); }

(async () => {

const NOMS = { 'fred-id': 'Fred' };
const ROLES = { 'fred-id': 'manager' };

// ------------------------------------------------------------
// 1) normaliserControlesFdj — rôle transmis, activité inhabituelle
// détectée pour un manager avec écart réel, montant retenu cohérent.
// ------------------------------------------------------------
{
  const shifts = [
    {
      id: 'sh1', date: '2026-08-23', quart: '1', employee_id: 'fred-id',
      fdj_cash_controls: { id: 'c1', ecart: 120.38, ecart_origine: 120.38, resultat_controle: 'a_regulariser', motif_ecart: null, valide_le: '2026-08-23T20:00:00Z', valide_par: 'fred-id' },
    },
  ];
  const lignes = D.normaliserControlesFdj(shifts, NOMS, ROLES);
  assert.strictEqual(lignes.length, 1);
  const l = lignes[0];
  assert.strictEqual(l.employeeRole, 'manager');
  assert.strictEqual(l.activiteInhabituelle, true, 'manager avec écart réel -> signalé (jamais exclu, jamais une accusation) : ' + JSON.stringify(l));
  assert.strictEqual(l.montantRetenu, 0, 'excédent restant non régularisé -> montant retenu 0, jamais 120.38');
  assert.strictEqual(l.impactPaye, null, 'jamais déduit automatiquement (P2, hors scope)');
  assert.strictEqual(l.qualification, undefined, 'qualification posée seulement par chargerEcartsConsolides, pas par ce normaliseur isolé');

  ok('normaliserControlesFdj — rôle manager transmis, activité inhabituelle détectée, montant retenu jamais confondu avec l\'excédent constaté');
}

// ------------------------------------------------------------
// 2) normaliserAuditsVerify — un caissier normal n'est jamais signalé.
// ------------------------------------------------------------
{
  // v2.285 (P0) — employes_piste: ['dylan-id'] rend Dylan réellement
  // attribué à la caisse Piste (employee_id 'dylan-id' ici n'est que
  // l'auteur/manager de l'audit, sans rapport avec l'attribution).
  const audits = [
    { id: 'a1', date: '2026-08-20', quart: '1', employee_id: 'dylan-id',
      ecart_piste: -12, ecart_piste_origine: -12, ecart_piste_valide: null, valide_le_piste: '2026-08-20T18:00:00Z', valide_par_piste: 'mgr', cause_code_piste: 'erreur_saisie',
      ecart_boutique: null, employes_piste: ['dylan-id'], employes_boutique: [] },
  ];
  const lignes = D.normaliserAuditsVerify(audits, { 'dylan-id': 'Dylan' }, { 'dylan-id': 'caissier' });
  assert.strictEqual(lignes[0].activiteInhabituelle, false, 'un caissier n\'est jamais signalé comme inhabituel');
  assert.strictEqual(lignes[0].montantRetenu, -12, 'manque expliqué -> retenu = le montant négatif réel');

  // Rétrocompatibilité : appel à 2 arguments (sans rôle) ne doit jamais
  // planter — employeeRole reste simplement null.
  const lignesSansRole = D.normaliserAuditsVerify(audits, { 'dylan-id': 'Dylan' });
  assert.strictEqual(lignesSansRole[0].employeeRole, null, 'sans carte de rôles fournie -> null, jamais une exception');
  assert.strictEqual(lignesSansRole[0].activiteInhabituelle, false);

  ok('normaliserAuditsVerify — rôle caissier jamais signalé, montant retenu correct pour un manque expliqué, rétrocompatible sans rôle fourni');
}

// ------------------------------------------------------------
// 3) arrondi à la normalisation — un écart quasi-nul (dérive flottante)
// doit devenir un vrai zéro, jamais un "+0,00 €" fantôme dans "à
// vérifier".
// ------------------------------------------------------------
{
  const shifts = [
    { id: 'sh2', date: '2026-08-24', quart: '2', employee_id: null,
      fdj_cash_controls: { id: 'c2', ecart: 0.0049, ecart_origine: null, resultat_controle: '', motif_ecart: null, valide_le: null, valide_par: null } },
  ];
  const lignes = D.normaliserControlesFdj(shifts, {}, {});
  // 0.0049 arrondi -> 0.00 -> situation 'aucun_ecart' (origine aussi
  // inconnue) -> AUCUNE ligne produite, jamais un "+0,00 €" à vérifier.
  assert.strictEqual(lignes.length, 0, 'un écart qui arrondit à zéro sans origine connue ne doit jamais apparaître comme "à vérifier" : ' + JSON.stringify(lignes));
  ok('normaliserControlesFdj — un écart quasi-nul par dérive flottante est correctement traité comme un vrai zéro (jamais un "+0,00 €" fantôme)');
}

// ------------------------------------------------------------
// 4) chargerEcartsConsolides — qualification rattachée à la bonne ligne
// (mock Supabase minimal, vérifie le format de l'upsert).
// ------------------------------------------------------------
{
  function mockClient(tables) {
    return {
      from(table) {
        return {
          select() { return this; },
          eq() { return this; },
          upsert(payload, opts) { this._lastUpsert = { payload, opts }; return Promise.resolve({ error: null, _capture: { table, payload, opts } }); },
          then(resolve) { resolve({ data: tables[table] || [], error: null }); },
        };
      },
    };
  }

  const tables = {
    employees: [{ id: 'fred-id', nom: 'Fred', role: 'manager' }],
    audits_caisse: [],
    fdj_shifts: [{
      id: 'sh1', date: '2026-08-23', quart: '1', employee_id: 'fred-id',
      fdj_cash_controls: { id: 'c1', ecart: 120.38, ecart_origine: 120.38, resultat_controle: 'a_regulariser', motif_ecart: null, valide_le: null, valide_par: null },
    }],
    nexus_ecarts_qualifications: [{
      site: 'vito-sainte-marie', source_module: 'fdj', source_control_id: 'c1', activite: 'fdj',
      type_qualification: 'activite_inhabituelle', motif: 'remplacement_absent', note: 'Absence de Dylan', qualifie_par: 'mgr-id', qualifie_le: '2026-08-24T09:00:00Z',
    }],
  };
  const client = mockClient(tables);
  const lignes = await D.chargerEcartsConsolides(client, 'vito-sainte-marie', {});
  assert.strictEqual(lignes.length, 1);
  assert.ok(lignes[0].qualification, 'la qualification déjà posée doit être rattachée à la ligne correspondante');
  assert.strictEqual(lignes[0].qualification.motif, 'remplacement_absent');

  ok('chargerEcartsConsolides — qualification déjà posée correctement rattachée à sa ligne (source_module+source_control_id+activite)');
}

// ------------------------------------------------------------
// 5) enregistrerQualificationActiviteInhabituelle — forme exacte de
// l'upsert (clé de conflit, type_qualification fixe).
// ------------------------------------------------------------
{
  let capture = null;
  const client = {
    from(table) {
      return {
        upsert(payload, opts) { capture = { table, payload, opts }; return Promise.resolve({ error: null }); },
      };
    },
  };
  await D.enregistrerQualificationActiviteInhabituelle(client, {
    site: 'vito-sainte-marie', sourceModule: 'fdj', sourceControlId: 'c1', activite: 'fdj',
    motif: 'remplacement_absent', note: 'Absence de Dylan', qualifiePar: 'mgr-id',
  });
  assert.strictEqual(capture.table, 'nexus_ecarts_qualifications');
  assert.strictEqual(capture.payload.type_qualification, 'activite_inhabituelle');
  assert.strictEqual(capture.payload.motif, 'remplacement_absent');
  assert.strictEqual(capture.opts.onConflict, 'source_module,source_control_id,activite,type_qualification', 'la clé de conflit doit correspondre EXACTEMENT à la contrainte unique de la migration');

  ok('enregistrerQualificationActiviteInhabituelle — upsert conforme à la contrainte unique réelle de nexus_ecarts_qualifications');
}

console.log(`\n${n} tests passés.`);
})();
