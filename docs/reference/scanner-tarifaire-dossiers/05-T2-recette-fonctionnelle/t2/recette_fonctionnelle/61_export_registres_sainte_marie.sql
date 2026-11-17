-- Export des registres actifs de vito-sainte-marie pour l'adaptateur. LECTURE SEULE : une seule requête SELECT.
-- Lit les vues d'état courant (versions actives) et la vue des exceptions effectives, filtrées sur le site.
-- Le résultat (JSON) est passé tel quel à comparer_registres_test.js.
select json_build_object(
  'site', 'vito-sainte-marie',
  'horodatage', now(),
  'est_projet_test', (select system_identifier from pg_control_system()) = 7678069749886157684,
  'familles', coalesce((select json_agg(json_build_object('site', site, 'famille_code', famille_code, 'libelle', libelle) order by famille_code) from v_tarif_familles_actifs where site = 'vito-sainte-marie'), '[]'),
  'rattachements', coalesce((select json_agg(json_build_object('site', site, 'portee', portee, 'rayon', rayon, 'article', article, 'code_barres', code_barres, 'famille_code', famille_code, 'motif', motif) order by cle) from v_tarif_rattachements_actifs where site = 'vito-sainte-marie'), '[]'),
  'seuils', coalesce((select json_agg(json_build_object('id', id, 'site', site, 'niveau', niveau, 'cible_niveau', cible_niveau, 'minimum', minimum, 'statut_minimum', statut_minimum, 'cible', cible, 'statut_cible', statut_cible) order by cle) from v_tarif_seuils_actifs where site = 'vito-sainte-marie'), '[]'),
  'reglages', coalesce((select json_agg(json_build_object('site', site, 'parametre', parametre, 'valeur', valeur) order by parametre) from v_tarif_reglages_actifs where site = 'vito-sainte-marie'), '[]'),
  'exceptions', coalesce((select json_agg(json_build_object('site', site, 'article', article, 'code_barres', code_barres, 'type', type, 'statut', statut, 'motif', motif, 'cond_prix_ttc', cond_prix_ttc, 'cond_tolerance_cout', cond_tolerance_cout, 'cond_cout_reference', cond_cout_reference, 'source', source) order by cle) from v_tarif_exceptions_effectives where site = 'vito-sainte-marie'), '[]'),
  'prixDecides', coalesce((select json_agg(json_build_object('id', id, 'site', site, 'article', article, 'code_barres', code_barres, 'nature', nature, 'prix_ttc', prix_ttc, 'decide_le', decide_le) order by cle) from v_tarif_prix_decides_actifs where site = 'vito-sainte-marie'), '[]'),
  'applications', coalesce((select json_agg(json_build_object('site', site, 'prix_decide_id', prix_decide_id, 'evenement', evenement, 'date_effet', date_effet, 'preuve_type', preuve_type)) from v_tarif_prix_application_actifs where site = 'vito-sainte-marie'), '[]'),
  'regimes', coalesce((select json_agg(json_build_object('site', site, 'article', article, 'code_barres', code_barres, 'regime', regime, 'raison', raison) order by cle) from v_tarif_regimes_prix_actifs where site = 'vito-sainte-marie'), '[]'),
  'controles', coalesce((select json_agg(json_build_object('site', site, 'portee', portee, 'rayon', rayon, 'article', article, 'code_barres', code_barres, 'etat', etat, 'type_element', type_element, 'raison', raison) order by cle) from v_tarif_controles_reglementaires_actifs where site = 'vito-sainte-marie'), '[]')
) as registres;
