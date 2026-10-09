-- SITE-EXPLICITE-1 / CREATEUR-SITES-GUARD (06/09/2026)
--
-- LE CONSTAT. Les trois policies créateur sur `sites` n'ont aucune condition
-- de portée. Un créateur pouvait, en droit, modifier `acces_createur_autorise`
-- — le drapeau par lequel un commerce REFUSE l'accès du créateur à ses
-- données. L'escalade ne se matérialisait pas, mais seulement parce que
-- `select_sites` masque les sites fermés : une protection réelle, mais
-- INCIDENTE, qu'un élargissement futur de la lecture aurait rouverte.
--
-- LA TENSION, ET COMMENT ELLE EST TRANCHÉE. L'arbitrage Q55 demandait de
-- restreindre l'UPDATE créateur aux sites qui l'autorisent. La doctrine
-- fondatrice du 06/09/2026 dit l'inverse sur ce point précis : « le fait
-- qu'un site refuse l'accès fonctionnel du créateur à ses données métier ne
-- retire pas au créateur la propriété ni l'autorité sur la plateforme NEXUS
-- elle-même ».
--
-- Appliquer Q55 à la lettre aurait permis à un client, en basculant un
-- drapeau, d'empêcher le créateur d'administrer la ligne de plateforme de son
-- propre commerce — nom, fuseau, retrait. Ce n'est pas ce que le drapeau
-- protège.
--
-- La ligne de partage est celle de la doctrine :
--
--     le créateur contrôle NEXUS ; le client contrôle l'usage de ses données.
--
-- Or `acces_createur_autorise` N'EST PAS une donnée de structure : c'est
-- l'expression du contrôle du client sur ses données. Tout le reste de la
-- ligne `sites` est de la structure de plateforme.
--
-- D'où le partage retenu, qui satisfait les deux textes :
--   * le créateur garde l'autorité sur la ligne `sites` (doctrine) ;
--   * `acces_createur_autorise` devient IMMUABLE par toute identité
--     authentifiée — le créateur ne peut pas s'ouvrir lui-même une porte que
--     le client a fermée (Q55, et plus strictement qu'elle ne demandait) ;
--   * supprimer un commerce qui porte encore des données est refusé : ce
--     serait détruire les données d'un client, pas administrer la plateforme.
--
-- Chaque mutation sensible porte donc sa propre condition, et aucune ne
-- dépend plus de `select_sites`.

-- ── 1. Le drapeau du client ne se lève pas depuis l'application ─────────
create or replace function public.nexus_acces_createur_immuable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.acces_createur_autorise is distinct from old.acces_createur_autorise then
    -- `auth.uid()` est nul hors session : une migration — acte tracé, revu en
    -- diff — reste le seul chemin pour changer ce drapeau. C'est voulu : ce
    -- réglage engage le client, il ne se modifie pas au fil d'un écran.
    if (select auth.uid()) is not null then
      raise exception
        'Accès créateur du commerce « % » : ce réglage appartient au client et ne se modifie pas depuis l''application (% → %).',
        old.site_id, old.acces_createur_autorise, new.acces_createur_autorise
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.nexus_acces_createur_immuable() is
  'CREATEUR-SITES-GUARD — le créateur contrôle NEXUS, le client contrôle l''usage de ses données. acces_createur_autorise exprime ce contrôle : aucune identité authentifiée ne le modifie, créateur compris.';

drop trigger if exists nexus_acces_createur_immuable on public.sites;
create trigger nexus_acces_createur_immuable
  before update of acces_createur_autorise on public.sites
  for each row
  execute function public.nexus_acces_createur_immuable();

-- ── 2. Retirer un commerce n'est pas détruire ses données ───────────────
-- Cinquante-sept clés étrangères pointent vers `sites` : une suppression
-- échouerait déjà en `23503`. Mais un `23503` ne dit pas POURQUOI, et la
-- consigne demandait une condition propre à cette opération destructive.
create or replace function public.nexus_site_supprimable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employes int;
begin
  select count(*) into v_employes from public.employees where site_id = old.site_id;
  if v_employes > 0 then
    raise exception
      'Commerce « % » non supprimable : % compte(s) employé y sont rattachés. Retirer un commerce de la plateforme est une opération d''administration ; supprimer les données d''un client n''en est pas une.',
      old.site_id, v_employes
      using errcode = '42501';
  end if;
  return old;
end;
$$;

comment on function public.nexus_site_supprimable() is
  'CREATEUR-SITES-GUARD — le créateur peut retirer un commerce vide de la plateforme, jamais un commerce portant encore les données d''un client.';

drop trigger if exists nexus_site_supprimable on public.sites;
create trigger nexus_site_supprimable
  before delete on public.sites
  for each row
  execute function public.nexus_site_supprimable();

-- ── 3. Les policies créateur sont INCHANGÉES ────────────────────────────
-- Volontairement. La doctrine leur donne raison : administrer la plateforme
-- est une capacité du créateur. Ce sont les deux gardes ci-dessus qui portent
-- désormais la condition, explicitement, au lieu de la laisser à la policy de
-- lecture. `createur_insert_sites` est autorisé par gate humaine et inscrit
-- au registre des dérogations.

-- ── Contrôle fail-closed ────────────────────────────────────────────────
do $$
declare v_manquants text := '';
begin
  if not exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
                  where c.relname='sites' and t.tgname='nexus_acces_createur_immuable') then
    v_manquants := v_manquants || 'nexus_acces_createur_immuable ';
  end if;
  if not exists (select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
                  where c.relname='sites' and t.tgname='nexus_site_supprimable') then
    v_manquants := v_manquants || 'nexus_site_supprimable ';
  end if;
  if v_manquants <> '' then
    raise exception 'CREATEUR-SITES-GUARD interrompu : % absent(s)', v_manquants;
  end if;
end;
$$;
