-- Empreintes du référentiel Advisor — SELECT-only, à exécuter contre Production
-- ============================================================================
-- Rend une seule ligne JSON : une empreinte md5 courte par `code`, pour les
-- deux tables que la migration 20260905161500_seed_referentiel_advisor écrit.
--
-- Pourquoi des empreintes et pas les valeurs : la comparaison exigerait de
-- faire transiter environ quinze mille caractères de texte métier. Une seule
-- divergence de transcription fabriquerait un faux « ÉCRASÉE » que rien ne
-- signalerait. Ici, seules 37 empreintes de douze caractères circulent.
--
-- Normalisation — elle DOIT rester identique à celle de
-- `outils/comparer-referentiel-advisor.js`, qui calcule la même empreinte à
-- partir du fichier de migration :
--   * séparateur chr(31) ;
--   * toute valeur nulle remplacée par la marque ∅ (sans elle, concat_ws
--     saute les nuls et deux lignes différentes rendraient la même empreinte) ;
--   * `variables_schema` (jsonb) réduit à ses éléments texte TRIÉS et joints
--     par une virgule, pour qu'un ordre de rendu jsonb ne passe pas pour une
--     divergence de contenu ;
--   * la colonne `id` est volontairement absente : `on conflict (code) do
--     update` ne la touche pas, un identifiant divergent serait sans effet.
--
-- Écrire le résultat dans le lot sous le nom empreintes-production-advisor-
-- AAAAMMJJ.json, puis :
--   node outils/comparer-referentiel-advisor.js <ce-fichier.json>
-- ============================================================================

with t as (
  select code, md5(concat_ws(chr(31),
    coalesce(code,'∅'), coalesce(domain,'∅'), coalesce(message_type,'∅'), coalesce(tone,'∅'),
    coalesce(minimum_confidence,'∅'), coalesce(title_template,'∅'), coalesce(body_template,'∅'),
    coalesce(action_label_template,'∅'),
    coalesce((select string_agg(v, ',' order by v) from jsonb_array_elements_text(variables_schema) v),'∅'),
    coalesce(enabled::text,'∅'))) as empreinte
  from public.nexus_language_templates),
r as (
  select code, md5(concat_ws(chr(31),
    coalesce(code,'∅'), coalesce(name,'∅'), coalesce(domain,'∅'), coalesce(description,'∅'),
    coalesce(data_requirements,'∅'), coalesce(trigger_expression,'∅'), coalesce(severity_expression,'∅'),
    coalesce(confidence_expression,'∅'), coalesce(default_priority,'∅'),
    coalesce(message_template_id::text,'∅'), coalesce(cooldown_hours::text,'∅'),
    coalesce(action_type,'∅'), coalesce(escalation_delay_hours::text,'∅'),
    coalesce(enabled::text,'∅'))) as empreinte
  from public.advisor_rules)
select jsonb_build_object(
  'mesure_le', now(),
  'nexus_language_templates', (select jsonb_object_agg(code, left(empreinte,12)) from t),
  'advisor_rules', (select jsonb_object_agg(code, left(empreinte,12)) from r)) as empreintes;
