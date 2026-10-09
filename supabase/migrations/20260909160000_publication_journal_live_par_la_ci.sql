-- SEC-022 — SEC-019 rendue reproductible : la CI publie le journal Live.
--
-- CE QUI MANQUAIT. `20260907222249_creer_nexus_live_events_test` crée la table
-- et ses deux politiques pour `authenticated`. Le droit d'écrire de la CI —
-- accordé par Frédéric le 08/09/2026 sous le nom SEC-019 — a été passé à la
-- main : ni le `grant`, ni la politique `publication_ci` n'existaient au dépôt.
-- La reconstruction du 09/09 les a donc perdus, et la publication du journal
-- serait restée muette sans que rien ne le dise.
--
-- QUATRIÈME DROIT DE LA MÊME FAMILLE trouvé ce jour-là, après SEC-018 (lecture
-- de `station_config`), SEC-020 (droits de table du semis) et SEC-021 (`usage`
-- sur le schéma). La cause commune n'est pas l'inattention : un accès accordé à
-- chaud pour débloquer ne laisse aucune trace reproductible, et rien ne le
-- réclame tant qu'on ne reconstruit pas depuis zéro.
--
-- LA LIMITE EST LE POINT ESSENTIEL, et elle est reprise à l'identique.
-- `with check (actor_role in ('ci','guardian'))` empêche la CI de signer un
-- événement au nom d'un humain ou de l'Orchestrator. Cette clause a REFUSÉ une
-- vraie usurpation le 08/09/2026 au soir : le producteur émettait des
-- événements signés `orchestrator` et `execution`, défaut qui dormait depuis
-- deux jours derrière le déterminisme des identifiants. La reproduire sans
-- cette clause rendrait le journal incapable de prouver ce qu'il raconte.
--
-- AUCUNE LECTURE ACCORDÉE, et c'est délibéré (SEC-003) : le rôle CI publie, il
-- ne lit pas. C'est pourquoi la publication se fait ligne à ligne, sans
-- `on conflict` — qui exigerait un droit de lecture.
--
-- TEST/CI UNIQUEMENT — à ne PAS appliquer en Production : le rôle
-- `nexus_ci_recette` n'y existe pas, et `nexus_live_events` est une table de
-- recette (voir `manifeste-migrations-production-1.md`, migration 18).
--
-- AUTORISATION HUMAINE : Frédéric Bragance, 08/09/2026 (SEC-019). Cette
-- migration n'accorde RIEN DE NOUVEAU.
--
-- Idempotente : rôle constaté, `drop policy if exists` avant création.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nexus_ci_recette') then
    raise notice 'Rôle nexus_ci_recette absent : migration Test/CI sans objet ici, ignorée.';
    return;
  end if;

  execute 'grant insert on public.nexus_live_events to nexus_ci_recette';

  execute 'drop policy if exists publication_ci on public.nexus_live_events';

  execute $pol$
    create policy publication_ci on public.nexus_live_events
      for insert to nexus_ci_recette
      with check (actor_role = any (array['ci', 'guardian']))
  $pol$;
end
$$;
