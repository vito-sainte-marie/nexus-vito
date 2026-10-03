-- ÉPREUVE DE BORNAGE — l'écriture accordée le 03/10/2026 au rôle CI sur
-- `public.station_config` ne va PAS plus loin que les deux identifiants
-- synthétiques de request-20.
--
-- CE QU'ELLE MESURE, ET POURQUOI ELLE EXISTE. SEC-023 accorde à
-- `nexus_ci_recette` une écriture sur `station_config` pour que l'épreuve
-- request-20 puisse s'exécuter. Une autorisation bornée dont personne ne
-- mesure la borne est une autorisation générale qui s'ignore. Cette épreuve
-- est la borne rendue observable.
--
-- ELLE REFUSE DE CONCLURE SOUS UNE AUTRE IDENTITÉ. C'est sa première partie, et
-- ce n'est pas une politesse : `postgres` est `rolbypassrls = t` sur nexus-test
-- (mesuré le 03/10/2026). Exécutée sous `postgres`, chaque écriture passerait et
-- l'épreuve serait VERTE en ayant mesuré l'exact contraire de ce qu'elle
-- affirme. Elle doit donc s'arrêter plutôt que de rendre un vert faux. C'est
-- aussi pourquoi elle n'a pas pu être exercée depuis un poste : le 03/10/2026,
-- `set role nexus_ci_recette;` sous `postgres` a répondu
-- `ERROR: permission denied to set role "nexus_ci_recette"` — l'option `SET` de
-- l'appartenance manque, et `pg_has_role(…,'MEMBER')` qui rendait `t` était le
-- signal trompeur, `…,'USAGE'` à `f` le signal honnête.
--
-- TOUT TIENT DANS UNE TRANSACTION ANNULÉE. Aucune ligne ne survit, y compris
-- celles du contre-témoin.
--
-- CONTRE-TÉMOIN. Les parties 2 et 3 constatent des REFUS. Un refus est aussi ce
-- qu'on obtient quand rien n'a été accordé du tout : seules, elles seraient
-- vertes même si SEC-023 n'avait jamais été appliquée. La partie 4 écrit donc
-- VRAIMENT sur les deux identifiants autorisés. Sans elle, l'épreuve ne
-- distinguerait pas « bien borné » de « rien ne marche ».
--
-- TEST/CI UNIQUEMENT — le rôle `nexus_ci_recette` n'existe pas en Production.

\echo '=== ÉPREUVE DE BORNAGE SEC-023 — station_config / nexus_ci_recette ==='

-- PARTIE 0 — l'identité. Sans elle, tout le reste est décoratif.
do $$
declare v_bypass boolean;
begin
  if not (current_user = 'nexus_ci_recette'
          or current_user like 'nexus_ci_recette.%') then
    raise exception using errcode = 'P0001', message = format(
      'BORNAGE-000 — ÉPREUVE NON CONCLUANTE : connectée comme « %s ». Le bornage ne se mesure que sous nexus_ci_recette ; sous un rôle propriétaire ou rolbypassrls, chaque écriture passe et le vert serait faux.',
      current_user);
  end if;

  select rolbypassrls into v_bypass from pg_roles where rolname = current_user;
  if coalesce(v_bypass, false) then
    raise exception using errcode = 'P0001', message = format(
      'BORNAGE-000 — ÉPREUVE NON CONCLUANTE : « %s » contourne la RLS (rolbypassrls). Aucune politique ne la bornerait.',
      current_user);
  end if;

  raise notice 'BORNAGE-000 OK : identité « % », soumise à la RLS.', current_user;
end
$$;

begin;

-- PARTIE 1 — les droits NON accordés, qui ne se bornent pas par ligne et
-- doivent donc être absents de la table entière.
do $$
declare v_droit text;
begin
  foreach v_droit in array array['delete', 'truncate', 'references', 'trigger']
  loop
    if has_table_privilege(current_user, 'public.station_config', v_droit) then
      raise exception using errcode = 'P0001', message = format(
        'BORNAGE-001 ÉCHEC : le rôle CI détient « %s » sur station_config. Ce droit ne se borne pas par ligne : il devait rester absent.',
        upper(v_droit));
    end if;
  end loop;
  raise notice 'BORNAGE-001 OK : ni DELETE, ni TRUNCATE, ni REFERENCES, ni TRIGGER.';
end
$$;

-- PARTIE 1bis — le bornage en COLONNES. Les cinq colonnes que l'épreuve
-- request-20 renseigne sont ouvertes ; une colonne voisine non citée ne l'est
-- pas. Sans ce second volet, « aucune colonne n'est ouverte » passerait.
do $$
declare v_col text;
begin
  foreach v_col in array array['site', 'prix_carburants', 'horaires',
                               'fuseau_horaire', 'updated_at']
  loop
    if not has_column_privilege(current_user, 'public.station_config', v_col, 'insert') then
      raise exception using errcode = 'P0001', message = format(
        'BORNAGE-002 ÉCHEC : la colonne « %s », que l''épreuve request-20 renseigne, n''est pas ouverte à l''insertion.',
        v_col);
    end if;
  end loop;

  foreach v_col in array array['planning_source', 'planning_codes_sites']
  loop
    if has_column_privilege(current_user, 'public.station_config', v_col, 'insert') then
      raise exception using errcode = 'P0001', message = format(
        'BORNAGE-002 ÉCHEC : la colonne « %s » est ouverte à l''insertion alors que l''épreuve ne la renseigne pas. Le droit a été élargi au-delà du nécessaire.',
        v_col);
    end if;
  end loop;

  raise notice 'BORNAGE-002 OK : cinq colonnes ouvertes à l''insertion, et pas une sixième.';
end
$$;

-- PARTIE 2 — LE CŒUR : une écriture sur la station de recette est REFUSÉE.
-- `nexus-station-test` est un site réel de la recette ; le rôle y a une lecture
-- légitime depuis SEC-018, et il ne doit pas y gagner une écriture.
do $$
begin
  insert into public.station_config (site, prix_carburants, horaires, updated_at)
  values ('nexus-station-test', '{}'::jsonb, '{}'::jsonb, now());

  raise exception using errcode = 'P0001', message =
    'BORNAGE-003 ÉCHEC : l''insertion sur « nexus-station-test » a été ACCEPTÉE. Le bornage aux deux identifiants synthétiques ne tient pas.';
exception
  when insufficient_privilege then
    raise notice 'BORNAGE-003 OK : insertion refusée sur nexus-station-test (%).', sqlstate;
end
$$;

-- PARTIE 3 — une mise à jour sur la station de recette ne touche AUCUNE ligne.
-- Le droit de colonne est là (PARTIE 1bis l'a mesuré) : ce qui filtre ici est
-- le `using` de la politique, et rien d'autre.
do $$
declare n integer;
begin
  update public.station_config set updated_at = now()
   where site = 'nexus-station-test';
  get diagnostics n = row_count;

  if n <> 0 then
    raise exception using errcode = 'P0001', message = format(
      'BORNAGE-004 ÉCHEC : la mise à jour a touché %s ligne(s) de « nexus-station-test ».', n);
  end if;
  raise notice 'BORNAGE-004 OK : mise à jour sur nexus-station-test → 0 ligne.';
exception
  when insufficient_privilege then
    raise exception using errcode = 'P0001', message =
      'BORNAGE-004 NON CONCLUANT : refus par privilège et non par politique. Le droit de colonne UPDATE manque, donc cette partie ne mesure pas la RLS.';
end
$$;

-- PARTIE 4 — CONTRE-TÉMOIN : les deux identifiants autorisés sont bien
-- écrivables. Sans ce volet, un droit entièrement absent rendrait les parties
-- 2 et 3 vertes.
do $$
begin
  insert into public.station_config (site, prix_carburants, horaires, updated_at)
  values ('nexus-test-repro-23502-neuf', '{"sp95": 1.70}'::jsonb, '{}'::jsonb, now());

  insert into public.station_config (site, prix_carburants, horaires, updated_at)
  values ('nexus-test-repro-23502-existant', '{"sp95": 1.71}'::jsonb, '{}'::jsonb, now())
  on conflict (site) do update set
    prix_carburants = excluded.prix_carburants,
    updated_at = excluded.updated_at;

  raise notice 'BORNAGE-005 OK : les deux identifiants synthétiques sont écrivables (contre-témoin).';
end
$$;

rollback;

-- PARTIE 5 — après l'annulation : rien ne subsiste.
do $$
declare n integer;
begin
  select count(*) into n from public.station_config
   where site in ('nexus-test-repro-23502-neuf', 'nexus-test-repro-23502-existant');
  if n <> 0 then
    raise exception using errcode = 'P0001', message = format(
      'BORNAGE-006 ÉCHEC : %s ligne(s) synthétique(s) subsistent après le rollback.', n);
  end if;
  raise notice 'BORNAGE-006 OK : aucune ligne synthétique résiduelle.';
end
$$;

\echo 'ÉPREUVE DE BORNAGE SEC-023 : toutes les parties ont passé.'
