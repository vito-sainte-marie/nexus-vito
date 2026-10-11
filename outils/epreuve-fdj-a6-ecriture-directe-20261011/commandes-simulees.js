'use strict';
// Simulation, pour les faux clients Supabase des tests, des commandes
// serveur introduites par A6 (migration 20261011090000). Fidèle au contrat
// SQL sur ce que les tests observent : lignes écrites, identité lue côté
// serveur, unicité (shift_id, version_num) -> 23505, upsert des rapports.
// Ce n'est PAS une preuve du SQL : la preuve est epreuve-test.sql (Test,
// sous rollback). Ici on ne fait que rendre aux écrans portés un client
// qui répond comme la base.

// Miroir de la liste fermée du `case p_action` de fdj_manager_journaliser.
const ACTIONS_AUTOMATIQUES = new Set([
  'fdj_chaine_retablie_automatiquement',
  'fdj_continuite_stock_a_verifier_posee',
  'fdj_continuite_stock_retablie_automatiquement',
]);
const ACTIONS_PERMISES = new Set([
  ...ACTIONS_AUTOMATIQUES,
  'exception_ecart_recalcule_revalide', 'derogation_manager',
  'inventaire_reference_valide', 'creation_manager', 'correction_manager',
  'fdj_propagation_correction_stock_amont',
]);

function creerCommandesA6(tables, options) {
  const opts = options || {};
  const acteur = opts.acteurId === undefined ? 'mgr-test' : opts.acteurId;
  const lignes = (t) => (tables[t] = tables[t] || []);
  const nouvelId = () => `id-${Math.random().toString(36).slice(2, 10)}`;

  return {
    fdj_manager_journaliser(a) {
      if (!ACTIONS_PERMISES.has(a.p_action)) {
        return { data: null, error: { code: '22023', message: `Action d'audit FDJ non prévue : ${a.p_action}` } };
      }
      const quart = lignes('fdj_shifts').find(s => s.id === a.p_shift_id);
      const ligne = {
        id: nouvelId(),
        site: quart ? quart.site : (opts.site || null),
        shift_id: a.p_shift_id,
        entite_type: a.p_entite_type,
        entite_id: a.p_entite_id,
        action: a.p_action,
        motif: a.p_motif,
        ancienne_valeur: a.p_ancienne_valeur,
        nouvelle_valeur: a.p_nouvelle_valeur,
        acteur_id: ACTIONS_AUTOMATIQUES.has(a.p_action) ? null : acteur,
      };
      lignes('fdj_audit_log').push(ligne);
      return { data: null, error: null };
    },
    fdj_manager_poser_releve_cloture(a) {
      const r = a.p_releve || {};
      const existantes = lignes('fdj_releves_cloture').filter(l => l.shift_id === a.p_shift_id);
      if (existantes.some(l => l.version_num === r.version_num)) {
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
      }
      const vmax = existantes.reduce((m, l) => Math.max(m, l.version_num || 0), 0);
      if ((r.version_num || 0) > vmax + 1) {
        return { data: null, error: { code: '22023', message: `Version ${r.version_num} hors séquence (dernière : ${vmax}).` } };
      }
      const prec = existantes.slice().sort((x, y) => (y.version_num || 0) - (x.version_num || 0))[0];
      const quart = lignes('fdj_shifts').find(s => s.id === a.p_shift_id) || {};
      // Identité et auteur : lus par la base selon le type, jamais reçus.
      let source, auteur;
      if (r.type_version === 'regularisation_manager') { source = quart; auteur = acteur; }
      else if (r.type_version === 'recalcul_automatique_chaine') {
        if (!prec) return { data: null, error: { code: '22023', message: 'Un recalcul exige une version précédente du relevé.' } };
        source = prec; auteur = null;
      } else if (r.type_version === 'validation_employe') {
        if (r.version_num !== 1) return { data: null, error: { code: '22023', message: 'Une validation employé est toujours la version 1.' } };
        source = quart; auteur = quart.employee_id;
      } else {
        return { data: null, error: { code: '22023', message: `Type de version non autorisé : ${r.type_version}` } };
      }
      const identite = { cree_par: auteur === undefined ? null : auteur };
      ['site', 'date', 'quart', 'employee_id'].forEach(c => { if (source[c] !== undefined) identite[c] = source[c]; });
      const ligne = Object.assign({ id: nouvelId() }, r, identite, { shift_id: a.p_shift_id });
      lignes('fdj_releves_cloture').push(ligne);
      return { data: ligne.id, error: null };
    },
    fdj_manager_enregistrer_rapports(a) {
      const rep = lignes('fdj_reports');
      const poser = (type, champs) => {
        const l = rep.find(x => x.shift_id === a.p_shift_id && x.type_rapport === type);
        if (l) Object.assign(l, champs, { saisi_par: acteur });
        else rep.push(Object.assign({ id: nouvelId(), shift_id: a.p_shift_id, type_rapport: type, saisi_par: acteur }, champs));
      };
      poser('journalier', { lots_payes_grattage: a.p_lots_payes_grattage, caisse_tirages: null });
      poser('temps_reel', { lots_payes_grattage: null, caisse_tirages: a.p_caisse_tirages });
      return { data: null, error: null };
    },
  };
}

module.exports = { creerCommandesA6 };
