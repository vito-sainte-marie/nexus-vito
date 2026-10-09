-- SEC-021 — le droit d'ENTRER dans le schéma, en amont de tous les autres.
--
-- CE QUE CETTE MIGRATION RÉPARE, ET POURQUOI IL A FALLU TROIS ESSAIS.
-- Après la reconstruction complète du 09/09/2026, le semis de recette échouait
-- en CI sur « relation audits_caisse does not exist » alors que la table
-- existait parmi les 162 recréées.
--
-- Premier diagnostic : les droits de table manquaient (SEC-020). C'était vrai,
-- et insuffisant — le message n'a pas changé. Mesure suivante :
--
--   has_schema_privilege('nexus_ci_recette','public','USAGE')  ->  false
--   has_table_privilege(... ,'public.audits_caisse','INSERT')  ->  true
--
-- Le rôle avait les droits sur les tables et pas le droit d'entrer dans le
-- schéma qui les contient. PostgreSQL répond alors « relation does not exist »,
-- exactement comme pour une table absente : le message décrit ce que le rôle
-- VOIT, pas ce qui existe. C'est ce qui a fait chercher au mauvais endroit
-- deux fois de suite.
--
-- CAUSE RACINE. `outils/reconstruire-base-test.sh` refait le schéma avec
-- `drop schema public cascade; create schema public;` puis accorde `usage` à
-- `anon`, `authenticated` et `service_role` — les rôles que Supabase pose à la
-- création d'un projet. `nexus_ci_recette` a été créé plus tard, à la main :
-- son `usage` n'était donc écrit nulle part, et disparaissait à chaque
-- reconstruction. Aucune CI verte ne pouvait le révéler.
--
-- HIÉRARCHIE À RETENIR : `usage` sur le schéma conditionne tout le reste. Sans
-- lui, un `grant` de table est inerte et une politique RLS ne s'applique à
-- rien. Les trois droits trouvés ce jour-là — SEC-018, SEC-020, celui-ci — sont
-- la même faute à trois étages : un accès accordé à chaud, qui ne laisse
-- aucune trace reproductible, et que rien ne réclame tant qu'on ne reconstruit
-- pas.
--
-- PORTÉE. `usage` sur le seul schéma `public`, pour le seul rôle
-- `nexus_ci_recette`. Ce droit n'ouvre AUCUNE table par lui-même : il rend
-- seulement visibles celles dont les privilèges sont accordés ailleurs, et
-- lisibles les lignes que les politiques RLS autorisent. Il n'accorde ni
-- création, ni suppression d'objet.
--
-- TEST/CI UNIQUEMENT — à ne PAS appliquer en Production : le rôle
-- `nexus_ci_recette` n'y existe pas.
--
-- AUTORISATION HUMAINE : Frédéric Bragance, 08/09/2026 (SEC-019). Cette
-- migration n'accorde RIEN DE NOUVEAU : elle rend reproductible un accès déjà
-- décidé, déjà en usage, et perdu par la reconstruction.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nexus_ci_recette') then
    raise notice 'Rôle nexus_ci_recette absent : migration Test/CI sans objet ici, ignorée.';
    return;
  end if;

  execute 'grant usage on schema public to nexus_ci_recette';
end
$$;
