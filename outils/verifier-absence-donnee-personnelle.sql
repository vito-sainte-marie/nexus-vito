-- NEXUS — PREUVE D'ABSENCE de donnée personnelle dans un PREPROD anonymisé.
--
-- CE QUE CE FICHIER FAIT. Il parcourt TOUTES les colonnes textuelles et JSONB
-- de TOUTES les tables du schéma `public`, et cherche la moindre occurrence
-- d'une valeur témoin. Il ne juge pas « ce qui ressemble à un nom » : il
-- cherche les valeurs RÉELLES, fournies au moment de l'exécution.
--
-- POURQUOI GÉNÉRIQUE PLUTÔT QU'UNE LISTE DE COLONNES. Une liste écrite à la
-- main vieillit à la première migration qui ajoute une colonne, et elle
-- vieillit en silence : la preuve continue de passer au vert sur un périmètre
-- qui a rétréci. Le parcours part d'`information_schema` à chaque exécution,
-- donc une colonne neuve est couverte le jour où elle apparaît.
--
-- LE JSONB EST INCLUS, et ce n'est pas un détail : `advisor_messages` interpole
-- des prénoms dans du texte généré, et `nexus_live_events.evidence` porte des
-- structures libres. Une preuve qui ne regarderait que les colonnes `text`
-- déclarerait « aucune donnée personnelle » sur une base qui en contient.
--
-- LES TÉMOINS NE SONT JAMAIS ÉCRITS ICI. Ce sont des valeurs de Production —
-- prénoms, noms, identifiants de connexion réels. L'appelant les dépose dans
-- une table temporaire `temoins(valeur text)` juste avant, et la supprime
-- juste après. Les committer reviendrait à publier ce qu'on cherche à
-- protéger.
--
-- FAIL CLOSED. Sans témoin, ce fichier REFUSE de conclure : il lève une
-- exception au lieu de rendre « aucune occurrence ». Une preuve qui ne trouve
-- rien parce qu'elle n'a rien cherché est le pire résultat possible — elle
-- autorise exactement ce qu'elle prétend interdire.
--
-- Usage :
--   create temp table temoins(valeur text);
--   \copy temoins from 'temoins.txt'      -- jamais dans le dépôt
--   \i outils/verifier-absence-donnee-personnelle.sql
--   drop table temoins;

do $$
declare
  c record;
  n_temoins integer;
  n_trouve integer;
  total integer := 0;
  colonnes integer := 0;
begin
  if to_regclass('pg_temp.temoins') is null then
    raise exception 'PREUVE IMPOSSIBLE : la table temporaire « temoins » n''existe pas. '
      'Sans valeur à chercher, une absence de résultat ne prouve rien.';
  end if;

  execute 'select count(*) from pg_temp.temoins where coalesce(btrim(valeur), '''') <> ''''' into n_temoins;
  if n_temoins = 0 then
    raise exception 'PREUVE IMPOSSIBLE : aucun témoin fourni. '
      'Une preuve qui ne cherche rien ne trouve rien, et ce n''est pas une preuve.';
  end if;
  raise notice 'Recherche de % témoin(s) dans toutes les colonnes textuelles et JSONB de public.', n_temoins;

  for c in
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and data_type in ('text', 'character varying', 'character', 'jsonb', 'json')
      and table_name in (select table_name from information_schema.tables
                         where table_schema = 'public' and table_type = 'BASE TABLE')
    order by table_name, column_name
  loop
    colonnes := colonnes + 1;
    -- `::text` couvre les deux familles d'un seul geste : une chaîne reste
    -- elle-même, un document JSON devient sa représentation textuelle, et un
    -- prénom interpolé dedans redevient cherchable.
    execute format(
      'select count(*) from public.%I t, pg_temp.temoins m
        where m.valeur is not null and btrim(m.valeur) <> ''''
          and t.%I::text ilike ''%%'' || m.valeur || ''%%''',
      c.table_name, c.column_name)
    into n_trouve;

    if n_trouve > 0 then
      total := total + n_trouve;
      raise warning 'DONNÉE PERSONNELLE TROUVÉE — %.% : % ligne(s)', c.table_name, c.column_name, n_trouve;
    end if;
  end loop;

  raise notice '% colonne(s) examinée(s).', colonnes;

  if total > 0 then
    raise exception 'PREPROD REFUSÉ : % occurrence(s) de donnée personnelle subsistent. '
      'Aucun agent ne doit accéder à cet environnement.', total;
  end if;

  raise notice 'Aucune occurrence des témoins fournis. Ce résultat ne couvre QUE ces témoins.';
end
$$;
