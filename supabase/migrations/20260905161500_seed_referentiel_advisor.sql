-- =====================================================================
-- A15 · Référentiel Advisor — versionné (05/09/2026)
--
-- supabase/migrations/20260905161500_seed_referentiel_advisor.sql
--     (nom définitif, arbitré le 05/09/2026)
--
-- Migration réelle, créée après arbitrage. Le fichier de proposition a été
-- déplacé ici sans modification de son contenu SQL.
--
-- POURQUOI IL EXISTE
--
-- `advisor_rules` et `nexus_language_templates` viennent de
-- 20260101000000_baseline_pre_existing_schema.sql, dont l'en-tête dit :
-- « Extrait fidèlement d'un dump réel (supabase db dump --schema public) ».
--
-- Un dump de SCHÉMA capture la structure, jamais les DONNÉES. Et aucune
-- migration du dépôt ne contient d'insert dans ces deux tables. Le
-- référentiel n'existait donc QUE dans la base de production : toute base
-- reconstruite à partir des migrations naissait vide.
--
-- Constaté le 05/09/2026 sur nexus-test : la RPC
-- generer_message_controle_tenue_absent trouve 3 employés à signaler, lit
-- un body_template inexistant, et viole message_text NOT NULL trois
-- instructions plus loin. Ce n'était pas un bug de la fonction — c'était
-- une dépendance métier non reproductible.
--
-- CE QUI EST VERSIONNÉ, ET CE QUI NE L'EST PAS
--
-- Les 31 règles ont TOUTES site_id IS NULL : ce sont des règles PRODUIT,
-- pas des données d'un commerce. Vérifié avant export. Rien
-- d'environnement-spécifique n'est recopié :
--   * site_id                 -> jamais renseigné, les règles sont génériques ;
--   * created_at / updated_at -> laissés aux valeurs par défaut, ce sont
--                                des horodatages d'environnement ;
--   * advisor_messages        -> PAS versionné : ce sont des messages
--                                produits par un commerce réel, donc de la
--                                donnée d'exploitation, pas du référentiel.
--
-- Les identifiants (uuid) sont CONSERVÉS tels qu'en production : ils lient
-- advisor_rules.message_template_id aux gabarits, et advisor_messages.rule_id
-- aux règles. Les régénérer ferait diverger les environnements sans aucun
-- bénéfice, et casserait ces liens sur toute base déjà peuplée.
--
-- IDEMPOTENT : `on conflict (code) do update`. Rejouer cette migration sur
-- une base déjà peuplée met le libellé à jour sans créer de doublon et sans
-- casser les liens existants. `enabled` est repris tel quel : six règles sont
-- volontairement désactivées en production, c'est une décision produit.
-- =====================================================================

begin;

-- Les gabarits d'abord : advisor_rules.message_template_id les référence.
insert into public.nexus_language_templates
  (id, code, domain, message_type, tone, minimum_confidence, title_template,
   body_template, action_label_template, variables_schema, enabled)
values
  ('3f6812d3-73eb-41ca-8a6f-9328e52b63df', 'CAISSE_ECART_NON_JUSTIFIE', 'caisse', 'alerte', 'calme_precis', 'A', 'Écarts de caisse à justifier', '{{count}} clôture(s) de caisse présentent un écart non conforme sans justificatif enregistré sur les {{period}} derniers jours. Un commentaire ou une vérification du composant en écart permettrait de clôturer proprement ces quarts.', 'Vérifier et justifier ces quarts', '["count", "period", "confidence_label"]'::jsonb, true),
  ('9f24c5c5-523f-46d4-aefc-d793ecf2c7c8', 'CAISSE_ECART_RECURRENT', 'caisse', 'alerte', 'calme_precis', 'B', 'Écarts de caisse récurrents', 'Sur les {{period}} derniers jours, {{count}} clôture(s) de caisse ressortent en écart significatif. Une vérification globale de la procédure de comptage pourrait être utile avant que la récurrence ne s''installe durablement.', 'Revoir la procédure de comptage', '["count", "period", "confidence_label"]'::jsonb, true),
  ('207dbb9b-2672-4125-9c1e-898f793cf5e3', 'QUALITE_CONTROLE_TENUE_ABSENT', 'qualite', 'organisation', 'calme_precis', 'A', 'Contrôle de tenue à réaliser', 'Aucun contrôle de tenue n''a été enregistré pour {{employee_name}} depuis {{count}} jours. Un contrôle permettrait de rétablir la visibilité sur ce point avant qu''il ne devienne un angle mort.', 'Faire un contrôle de tenue', '["employee_name", "count", "confidence_label"]'::jsonb, true),
  ('03f33894-2c58-4a33-a911-e3cc66ca7e64', 'QUALITE_DEGRADATION_MALGRE_ACTIVITE', 'qualite', 'management', 'calme_precis', 'C', 'Activité en hausse, qualité à surveiller', 'Le chiffre d''affaires progresse de {{variation}} % sur la période, mais la réalisation des missions qualité recule sur la même fenêtre. Cette intensité commerciale semble peser sur les standards — un renfort ciblé sur les périodes de pointe serait pertinent. À vérifier avant de conclure : les données disponibles ne permettent pas encore d''affirmer un lien de cause à effet.', 'Vérifier la charge sur les périodes de pointe', '["variation", "period", "confidence_label"]'::jsonb, true),
  ('7f51c700-5163-4347-b944-3f3320ad4c28', 'QUALITE_MISSION_SANS_PREUVE_RECURRENTE', 'qualite', 'management', 'calme_precis', 'B', 'Missions qualité sans preuve', '{{count}} mission(s) qualité assignées à {{employee_name}} ont été validées sans la photo requise sur les {{period}} derniers jours. Un rappel de la procédure de validation pourrait être utile — plusieurs missions validées sans justificatif méritent d''être clarifiées avant de devenir une habitude.', 'Rappeler la procédure de validation', '["employee_name", "count", "period", "confidence_label"]'::jsonb, true),
  ('facf31b9-db0f-4fa4-920c-73ebf273220e', 'QUALITE_TENUE_NON_CONFORME_RECURRENTE', 'qualite', 'management', 'calme_precis', 'B', 'Contrôles de tenue à régulariser', 'Sur les {{period}} derniers jours, {{count}} contrôle(s) de tenue concernant {{employee_name}} sont ressortis non conformes. Un point individuel permettrait de clarifier ce qui empêche la conformité de s''installer durablement — l''écart semble lié à la régularité plutôt qu''à un refus.', 'Planifier un point avec {{employee_name}}', '["employee_name", "count", "period", "confidence_label"]'::jsonb, true)
on conflict (code) do update set
  domain = excluded.domain,
  message_type = excluded.message_type,
  tone = excluded.tone,
  minimum_confidence = excluded.minimum_confidence,
  title_template = excluded.title_template,
  body_template = excluded.body_template,
  action_label_template = excluded.action_label_template,
  variables_schema = excluded.variables_schema,
  enabled = excluded.enabled,
  updated_at = now();

-- Les 31 règles. `site_id` reste NULL : aucune n'appartient à un commerce.
insert into public.advisor_rules
  (id, code, name, domain, description, data_requirements, trigger_expression,
   severity_expression, confidence_expression, default_priority,
   message_template_id, cooldown_hours, action_type, escalation_delay_hours, enabled)
values
  ('44972fd1-de5d-432f-9225-455d0aaca71b', 'CAISSE_CLOTURE_MANQUANTE', 'Clôture caisse manquante', 'caisse', 'Un quart planifié sans audit caisse correspondant', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, false),
  ('23e8967f-683c-4de3-911c-8d179e04d1ed', 'CAISSE_ECART_NON_JUSTIFIE', 'Écart caisse non justifié', 'caisse', 'Écart non conforme sans commentaire renseigné', 'audits_caisse (site, date, quart, statut, commentaire, ecart_total)', 'audits_caisse.statut <> conforme ET commentaire vide/absent, sur les 14 derniers jours. Chaque audit correspondant est une occurrence distincte.', 'statut=critique -> haute · statut=anomalie/surveiller -> a_surveiller.', 'A — le statut et l''absence de commentaire sont des faits enregistrés directement, aucune extrapolation.', 'normale', '3f6812d3-73eb-41ca-8a6f-9328e52b63df', 72, NULL, null, true),
  ('4561e585-9769-424b-972a-19bc26b7e895', 'CAISSE_ECART_RECURRENT', 'Écart caisse récurrent', 'caisse', 'Écarts répétés au-delà du seuil sur plusieurs quarts/jours', 'audits_caisse (site, date, statut)', 'Au moins 2 audits avec statut in (anomalie, critique) pour le même site sur les 14 derniers jours.', 'Au moins 1 statut=critique dans la fenêtre -> haute · >=3 anomalies -> haute · =2 -> a_surveiller.', 'Fondée sur le nombre total d''audits enregistrés sur la fenêtre (pas seulement les anomalies) : >=6 -> A · >=3 -> B · <3 -> C.', 'normale', '9f24c5c5-523f-46d4-aefc-d793ecf2c7c8', 72, NULL, null, true),
  ('c85e82da-bf6e-45a2-9b48-e225c56ca20e', 'COMMERCE_ARRET_DETECTE', 'Arrêt détecté', 'commerce', 'Référence présente en T1, disparue en T2 (ex R7-ARRET)', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('4657698e-7b08-486f-90ce-36fb46c9cffd', 'COMMERCE_BAISSE_SIGNIFICATIVE', 'Baisse significative', 'commerce', 'CA en recul entre deux périodes (ex R2-BAISSE)', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('aca9d0f1-a7d3-400e-b632-141b4e261437', 'COMMERCE_DECISION_POSITIVE_RESULT', 'Résultat positif après décision', 'commerce', 'Décision appliquée suivie d''une amélioration mesurée', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, false),
  ('cb5144cf-d031-4fd7-95a8-136ed5df189e', 'COMMERCE_DEREFERENCEMENT_CANDIDAT', 'Déréférencement candidat', 'commerce', 'Ventes quasi nulles sur la période, CA immobilisé (ex R1-DEREF)', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('9561536e-8d5a-4738-a2ab-ddcbbabaaa09', 'COMMERCE_HAUSSE_OPPORTUNITE', 'Hausse opportunité', 'commerce', 'CA en progression entre deux périodes (ex R3-HAUSSE)', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('a94b6326-f5ba-4a54-ba53-328ff2c24968', 'COMMERCE_LOW_ROTATION_NOT_CHECKED', 'Faible rotation non contrôlée', 'commerce', 'Référence à faible rotation, aucun contrôle stock récent', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, false),
  ('99382994-4ce2-413d-8d9d-3334cb71cf29', 'COMMERCE_MARGE_FAIBLE', 'Marge faible', 'commerce', 'Marge % en dessous de la moyenne du rayon (ex R5-MARGE-FAIBLE)', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('e046704e-2591-47dd-bbbd-f90ea61064cc', 'COMMERCE_NOUVEAUTE_A_SUIVRE', 'Nouveauté à suivre', 'commerce', 'Référence apparue sur la période la plus récente (ex R6-NOUVEAUTE)', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('14e84924-ec19-4782-80fe-c3398e479740', 'COMMERCE_PLANOGRAMME_ECART', 'Écart planogramme', 'commerce', 'Écart entre facing observé et facing recommandé (ex R8-PLANOGRAMME)', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('d54a7ca0-e34c-4858-b42e-2983828dc3f5', 'COMMERCE_RENFORT_CLASSE_A', 'Renfort classe A', 'commerce', 'Produit classe A sous-représenté en facing (ex R4-RENFORT-A)', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('86cde085-b883-4a06-94ec-4a6a35d18d81', 'DATA_MISSING_FOR_DOMAIN', 'Donnée manquante pour un domaine', 'meta', 'Un domaine n''a reçu aucune donnée récente — le dire plutôt que rester silencieux', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('a0583103-a9ec-429d-9653-c08a25577498', 'EQUIPE_CHARGE_DESEQUILIBREE', 'Charge déséquilibrée', 'equipe', 'Répartition très inégale du nombre de missions entre employés', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('7d4f00df-c41d-427b-9447-4afcee81e4ab', 'EQUIPE_MISSION_COMPLETION_DECLINING', 'Taux de missions en baisse', 'equipe', 'Taux de réalisation des missions en baisse sur une fenêtre glissante', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('e8b40ea8-0ef3-41be-abf8-fe020b15a5cf', 'EQUIPE_PRISE_DE_POSTE_FRAGILE', 'Prise de poste fragile', 'equipe', 'Retard + missions d''ouverture incomplètes + rupture le même matin', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, false),
  ('7fa7ceaf-4e0e-4b32-9a7f-72d8ca3f021a', 'EQUIPE_PROGRESSION_POSITIVE', 'Progression positive', 'equipe', 'Série de missions conformes et prouvées pour un même employé', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('0703743b-fd74-4fdb-87b0-9fcb525436da', 'EQUIPE_RETARDS_CONCENTRES', 'Retards concentrés', 'equipe', 'Plusieurs retards mineurs concentrés sur le même créneau', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('77365bf9-7a7a-4004-b01f-5657aaada348', 'QUALITE_CONTROLE_TENUE_ABSENT', 'Contrôle tenue absent', 'qualite', 'Aucun contrôle enregistré depuis un délai paramétrable', 'controles_tenue (employee_id, date) + employees (actif, site_id)', 'Employé actif sans aucun controles_tenue depuis >=21 jours, ou jamais contrôlé.', 'Jamais contrôlé ou >=45 jours -> haute · 21-44 jours -> a_surveiller.', 'A — l''absence est constatée directement par comptage, ce n''est pas une extrapolation. (Ce que ça ne dit PAS : si la tenue est conforme ou non — seulement qu''on ne le sait pas.)', 'normale', '207dbb9b-2672-4125-9c1e-898f793cf5e3', 72, NULL, null, true),
  ('188b4261-132f-463a-a0a9-a5f8a4c94d60', 'QUALITE_DEGRADATION_MALGRE_ACTIVITE', 'Dégradation malgré activité', 'qualite', 'CA en hausse pendant que les missions qualité baissent', 'products (site, periode_fin, ca) + mission_completions (date) + mission_catalog (famille) + employees (site_id)', 'CA total en hausse sur les 30 derniers jours vs les 30 jours précédents, ET nombre de missions famille ''Qualité'' réalisées en baisse sur la même comparaison, pour le même site.', 'Information par défaut — ce croisement documente une corrélation, pas encore une preuve de causalité (cf. vocabulaire ''semble'' requis par le cadrage).', 'C par défaut, systématiquement — corrélation nouvelle jamais validée sur plusieurs cycles. À remonter en B seulement après confirmation manuelle répétée (retour manager, section 16).', 'normale', '03f33894-2c58-4a33-a911-e3cc66ca7e64', 72, NULL, null, true),
  ('d26d0472-8890-45d2-b5a9-29551d480e86', 'QUALITE_MISSION_SANS_PREUVE_RECURRENTE', 'Mission qualité sans preuve récurrente', 'qualite', 'Missions qualité validées sans photo de façon répétée', 'mission_completions (employee_id, mission_id, date, photo_fournie) + mission_catalog (famille, proof_required)', 'Au moins 2 missions de famille ''Qualité'' avec proof_required=true validées avec photo_fournie=false pour le même employee_id sur les 30 derniers jours.', '>=3 -> haute · =2 -> a_surveiller.', 'Fondée sur le volume total de missions qualité à preuve obligatoire réalisées par cet employé sur la période : >=4 -> A · >=2 -> B · sinon C.', 'normale', '7f51c700-5163-4347-b944-3f3320ad4c28', 72, NULL, null, true),
  ('97211633-6ef7-447d-8d5c-577fa89542b5', 'QUALITE_TENUE_NON_CONFORME_RECURRENTE', 'Tenue non conforme récurrente', 'qualite', 'Plusieurs contrôles non conformes pour le même employé', 'controles_tenue (employee_id, date, conforme)', 'Au moins 2 contrôles conforme=false pour le même employee_id sur les 30 derniers jours (fenêtre glissante).', '>=3 non-conformes sur 30j -> haute · =2 -> a_surveiller.', 'Fondée sur le nombre total de contrôles disponibles pour cet employé (pas seulement les non-conformes) : >=5 contrôles -> A · >=3 -> B · <3 -> C.', 'normale', 'facf31b9-db0f-4fa4-920c-73ebf273220e', 72, NULL, null, true),
  ('3b4628a0-5d88-4879-ad74-b44d5c5526a6', 'SECURITE_CONTROLE_ECHU', 'Contrôle sécurité échu', 'securite', 'Mission de sécurité récurrente non réalisée dans le délai', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, false),
  ('315a0e8f-7d87-4923-bd61-273df1c0335e', 'SECURITE_DONNEE_INSUFFISANTE', 'Donnée sécurité insuffisante', 'meta', 'Aucun audit sécurité structuré n''existe encore — signal d''honnêteté', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('d15261ca-eed8-4df6-b85f-72d64c59f68b', 'SECURITE_INCIDENT_CAISSE_SIGNALE', 'Incident caisse signalé', 'securite', 'Incident renseigné sur un quart de caisse', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('6c67de4c-03ff-45b5-afa3-9ca025a3c698', 'SECURITE_VALIDATION_TROP_RAPIDE', 'Validation trop rapide', 'securite', 'Mission sécurité multi-étapes validée en quelques secondes sans preuve', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('6535e211-8583-4730-9470-9c0d5694e6ad', 'STOCK_ECART_THEORIQUE_REEL', 'Écart théorique/réel', 'stock', 'Écart significatif lors d''un contrôle de stock', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('f2e9e677-2319-4992-a6f4-9f8813c2b984', 'STOCK_ROTATION_FAIBLE_NON_CONTROLEE', 'Rotation faible non contrôlée', 'stock', 'Référence à faible rotation jamais contrôlée récemment', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, false),
  ('8572024a-5931-49fe-a05a-91518cd6a5bb', 'STOCK_RUPTURE_PROBABLE', 'Rupture probable', 'stock', 'Stock proche de zéro alors que les ventes restent soutenues', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true),
  ('bc513e68-59ec-4100-8d5f-88f5b828642f', 'STOCK_SURSTOCK', 'Surstock', 'stock', 'Stock élevé, rotation faible', NULL, NULL, NULL, NULL, 'normale', null, 72, NULL, null, true)
on conflict (code) do update set
  name = excluded.name,
  domain = excluded.domain,
  description = excluded.description,
  data_requirements = excluded.data_requirements,
  trigger_expression = excluded.trigger_expression,
  severity_expression = excluded.severity_expression,
  confidence_expression = excluded.confidence_expression,
  default_priority = excluded.default_priority,
  message_template_id = excluded.message_template_id,
  cooldown_hours = excluded.cooldown_hours,
  action_type = excluded.action_type,
  escalation_delay_hours = excluded.escalation_delay_hours,
  enabled = excluded.enabled,
  updated_at = now();

-- Contrôle fail-closed : les trois générateurs appelés par Centre
-- Intelligence exigent une règle ET un gabarit. Si l'un manque, la migration
-- échoue ici plutôt que de laisser la RPC violer message_text NOT NULL des
-- semaines plus tard.
do $ctrl$
declare v_manquants text;
begin
  select string_agg(c, ', ' order by c) into v_manquants from (
    select c from unnest(array['QUALITE_CONTROLE_TENUE_ABSENT',
                              'CAISSE_ECART_NON_JUSTIFIE',
                              'CAISSE_ECART_RECURRENT']) as c
    where not exists (select 1 from public.advisor_rules r where r.code = c)
       or not exists (select 1 from public.nexus_language_templates t where t.code = c)
  ) t;
  if v_manquants is not null then
    raise exception 'A15 : référentiel incomplet pour %. Les générateurs de messages échoueraient sur message_text NOT NULL.', v_manquants;
  end if;
end
$ctrl$;

commit;
