-- SITE-EXPLICITE-1 / POMPISTE-DU-JOUR-TIMEZONE-GUARD (06/09/2026)
--
-- LE CONSTAT (lot SITE-EXPLICITE-1-NAMED-HELPERS-BEHAVIOR-PROOF-20260906,
-- decision-1.md, Q61/Q62). `est_pompiste_du_jour(p_site)` datait le service
-- par `heure_debut::date`, c'est-à-dire EN UTC, alors que la journée d'un
-- commerce se compte dans son fuseau (sites.timezone, A3-3). Un service de
-- soirée après 20h Martinique basculait au lendemain en UTC, et l'acteur
-- conservait ses droits de pompiste — écritures carburant réelles — toute la
-- journée-station suivante. Un service CLOS comptait aussi encore : la
-- fonction ne lisait jamais `shifts.statut`.
--
-- LE CONTRAT DE CORRECTION (decision-1.md) :
--   * la journée métier est calculée dans le fuseau du SITE CONCERNÉ ;
--   * la source du fuseau est sites.timezone, jamais une constante ;
--   * absence, vide ou fuseau IANA inconnu = FAIL CLOSED (refuse, n'autorise
--     jamais par défaut) ;
--   * Q62 — un droit d'écriture actif exige un service pompiste EN COURS,
--     pas seulement daté du jour : un service clos ne doit pas laisser
--     survivre silencieusement un droit d'écriture après la fin du service ;
--   * portée explicite par site conservée à l'identique (cas 2 du lot de
--     preuve : un renfort du même site, ou le même acteur sur un autre site,
--     ne doivent toujours PAS passer).
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--   * elle ne touche à AUCUNE des sept policies qui appellent
--     `est_pompiste_du_jour(site)` : `CREATE OR REPLACE FUNCTION` suffit,
--     et réécrire les policies dupliquerait un contrat déjà correct ;
--   * elle n'ouvre aucune classe D, ne retire aucun default, ne généralise
--     aucun trigger ;
--   * elle n'active aucun blocage CI — la garde statique (Q63, migration
--     jumelle côté outillage) reste en mode observation tant que la preuve
--     comportementale n'a pas eu lieu.
--
-- CE QUI RESTE À FAIRE, ET POURQUOI CE N'EST PAS ICI
--   La preuve comportementale exigée par decision-1.md — sept policies
--   dépendantes, service de soirée, minuit station, service à cheval sur
--   deux jours, autre site/fuseau — suppose une base Test vivante avec des
--   identités réelles (voir outils/reconstruire-base-test.sh : le mot de
--   passe vit dans le trousseau local, jamais dans ce dépôt ni dans une
--   variable d'environnement CI). Le canal qui a rédigé cette migration
--   (déclenchement @claude sur issue GitHub, workflow .github/workflows/
--   claude.yml) n'a ni réseau ni identifiant Supabase — le workflow le dit
--   lui-même : « aucun secret applicatif n'est exposé : ni Supabase, ni clé
--   de service ». Cette migration est donc rédigée et fail-closed par
--   construction, mais NON REJOUÉE : le registre des aides
--   (docs/gouvernance/garde-portee-site-aides.json) marque
--   `est_pompiste_du_jour` en `NON_EPROUVEE`, pas `CONFORME`, tant qu'une
--   session disposant de l'accès Test n'aura pas exécuté cette preuve.
--
-- ROLLBACK EXPLICITE (exigé par decision-1.md)
--   `CREATE OR REPLACE FUNCTION` ne réécrit pas l'histoire (A12) : revenir
--   au comportement précédent, si la preuve invalidait cette correction,
--   consiste à rejouer le corps de la fonction tel qu'il apparaissait dans
--   supabase/migrations/20260819105641_pont_jaugeage_carburant_inventaire.sql
--   (comparaison UTC, sans lecture de statut) dans un nouveau
--   `CREATE OR REPLACE FUNCTION` daté — jamais en modifiant ce fichier.

begin;

create or replace function public.est_pompiste_du_jour(p_site text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $$
declare
  v_fuseau text;
begin
  select s.timezone into v_fuseau from public.sites s where s.site_id = p_site;

  -- Fail closed : sites.timezone est NOT NULL et validé par
  -- nexus_valider_fuseau_site (A3-3) pour tout site existant, mais une aide
  -- de sécurité SECURITY DEFINER ne doit jamais supposer que cette garantie
  -- amont tient. Un site inconnu, un fuseau vide ou un nom que PostgreSQL ne
  -- reconnaît pas refusent — ils n'autorisent jamais par défaut.
  if v_fuseau is null or btrim(v_fuseau) = ''
     or not exists (select 1 from pg_timezone_names where name = v_fuseau) then
    return false;
  end if;

  -- Q62 : un droit d'écriture opérationnel courant, pas un service daté du
  -- jour par accident de calcul. `statut = 'en_cours'` exclut un service
  -- déjà clos (l'anomalie du cas 5 du lot de preuve) ; la comparaison de
  -- date au fuseau de la station exclut la bascule UTC (cas 4, l'anomalie
  -- principale) sans exiger la lecture d'un service futur ou passé au
  -- fuseau d'un autre commerce.
  return exists (
    select 1 from public.shifts sh
    where sh.employee_id = auth.uid()
      and sh.site = p_site
      and sh.role = 'pompiste'
      and sh.statut = 'en_cours'
      and (sh.heure_debut at time zone v_fuseau)::date = (now() at time zone v_fuseau)::date
  );
end;
$$;

comment on function public.est_pompiste_du_jour(text) is
  'Vrai si l''employé authentifié a un service EN COURS (Q62) avec role=pompiste sur ce site, ouvert à la journée-station courante calculée dans sites.timezone (A3-3, fail closed si le fuseau est absent/invalide). Corrige le 06/09/2026 l''ancien calcul en UTC (heure_debut::date) qui laissait un service de soirée conserver ses droits toute la journée-station suivante, et l''absence de lecture de statut qui laissait un service clos compter encore. Sert de garde RLS SECURITY DEFINER pour sept policies carburant (releves, releve_versions, jaugeage_statuts_jour, reception_visites, reception_visite_lignes). Preuve comportementale post-correction : voir docs/gouvernance/garde-portee-site-aides.json, statut NON_EPROUVEE tant qu''une session avec accès Test ne l''a pas rejouée.';

commit;
