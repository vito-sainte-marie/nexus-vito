-- B1 (05/09/2026) — la prise de poste devient un contrat unique et déterministe.
--
-- CE QUE LE REJEU RÉEL A RÉVÉLÉ. `NEXUS-Prise-De-Poste-v1.html` insère `site`
-- et jamais `site_id` ; c'est `shifts_site_unique` qui remplit `site_id`. Or
-- les triggers BEFORE d'un même événement se déclenchent par ORDRE
-- ALPHABÉTIQUE de nom, et `nexus_cloturer_shift_precedent` précède
-- `shifts_site_unique`. S-3 lisait donc un `new.site_id` encore NULL,
-- ne trouvait aucun service actif, concluait « rien à clôturer », et l'index
-- partiel de S-1 refusait l'insertion avec un 23505 incompréhensible.
--
-- S-3 n'a donc JAMAIS fonctionné depuis l'application. Mes essais initiaux
-- fournissaient `site_id` explicitement — une forme de données que le
-- parcours réel n'envoie jamais.
--
-- POURQUOI PAS UN RENOMMAGE. Faire passer la normalisation en premier en la
-- rebaptisant marcherait, et c'est précisément pourquoi il ne faut pas le
-- faire : un invariant métier qui dépend de l'ordre alphabétique de deux
-- noms n'est pas un invariant, c'est une coïncidence. Elle a tenu tant que
-- personne n'a pris deux postes de suite.
--
-- CE QUE FAIT CETTE MIGRATION. Sur `shifts`, à l'INSERT, un seul trigger
-- normalise l'identité du site PUIS clôture le service actif précédent. La
-- dépendance d'ordre disparaît parce qu'il n'y a plus deux acteurs.
--
-- Invariants A3-1/A3-2 préservés : `site_id` reste la source de vérité,
-- `site` sa copie contrôlée, et la règle de normalisation est INCHANGÉE —
-- elle est seulement extraite pour être appelée des deux endroits au lieu
-- d'être dupliquée. `mission_catalog` continue d'utiliser le même trigger
-- qu'avant, sans modification de comportement.

-- ── 1. La règle de site, extraite telle quelle ──────────────────────────
-- SECURITY DEFINER comme la fonction d'origine : elle interroge
-- current_employee_site_id(), qui doit rester lisible quel que soit
-- l'appelant.
create or replace function public.nexus_site_de_reference(p_site text, p_site_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference text;
  v_fourni    text;
begin
  if auth.uid() is not null then
    v_reference := public.current_employee_site_id();
    if v_reference is null then
      raise exception 'Écriture refusée : compte authentifié sans ligne employee, site indéterminable.'
        using errcode = '42501';
    end if;
  else
    v_reference := coalesce(p_site_id, p_site);
    if v_reference is null then
      raise exception 'Écriture refusée : ni site ni site_id fourni, et aucun compte pour trancher.'
        using errcode = '23502';
    end if;
  end if;

  foreach v_fourni in array array[p_site, p_site_id] loop
    if v_fourni is not null and v_fourni is distinct from v_reference then
      raise exception 'Écriture refusée : site « % » demandé, « % » attendu pour ce compte.',
        v_fourni, v_reference using errcode = '42501';
    end if;
  end loop;

  return v_reference;
end;
$$;

comment on function public.nexus_site_de_reference(text, text) is
  'B1 — LA règle de site, extraite de nexus_forcer_site_unique pour être appelée sans dupliquer sa logique. Comportement identique à l''original.';

-- ── 2. Le trigger historique délègue, sans changer de comportement ──────
create or replace function public.nexus_forcer_site_unique()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference text;
begin
  v_reference := public.nexus_site_de_reference(NEW.site, NEW.site_id);
  NEW.site    := v_reference;
  NEW.site_id := v_reference;
  return NEW;
end;
$$;

-- ── 3. Le contrat unique de prise de poste ──────────────────────────────
create or replace function public.nexus_shifts_avant_insertion()
returns trigger
language plpgsql
-- SECURITY INVOKER, comme S-3 : `update_shifts` autorise déjà un employé à
-- clôturer son propre service. La normalisation, elle, passe par une
-- fonction SECURITY DEFINER — le privilège reste borné à la lecture du site.
as $$
declare
  v_reference text;
  v_ancien    record;
  v_lignes    int;
begin
  -- (a) Identité du site, D'ABORD. C'est l'inversion qui manquait : sans
  -- elle, tout ce qui suit raisonne sur un site inconnu.
  v_reference := public.nexus_site_de_reference(NEW.site, NEW.site_id);
  NEW.site    := v_reference;
  NEW.site_id := v_reference;

  if NEW.statut is distinct from 'en_cours' then
    return NEW;  -- une insertion d'historique ne clôture rien
  end if;

  -- (b) Le service actif : CET employé, CE site — désormais connu.
  select sh.id, sh.heure_debut into v_ancien
    from public.shifts sh
   where sh.employee_id = NEW.employee_id
     and sh.site_id     = NEW.site_id
     and sh.statut      = 'en_cours'
     and sh.id         <> NEW.id
   order by sh.heure_debut desc
   limit 1
   for update;

  if v_ancien.id is null then
    return NEW;  -- première prise de poste : rien à clôturer, rien à signaler
  end if;

  -- Garde temporelle de S-3, conservée mot pour mot : une insertion
  -- antérieure ou égale au service actif n'est pas une prise de poste
  -- suivante, et ne doit pas s'autoriser à clôturer quoi que ce soit.
  if NEW.heure_debut <= v_ancien.heure_debut then
    raise exception
      'Prise de poste refusée : le service % est actif depuis %, postérieur ou égal à la nouvelle prise (%). Une insertion antérieure à un service actif n''est pas une prise de poste suivante.',
      v_ancien.id, v_ancien.heure_debut, NEW.heure_debut
      using errcode = '22007';
  end if;

  update public.shifts
     set statut         = 'termine',
         heure_fin      = NEW.heure_debut,
         cloture_source = 'prise_de_poste_suivante',
         cloture_le     = now()
   where id = v_ancien.id;

  -- Un UPDATE refusé par la RLS ne lève rien : il modifie zéro ligne, en
  -- silence. Sans ce contrôle on obtiendrait le symétrique du défaut que
  -- toute cette campagne a poursuivi — une clôture qui n'a pas lieu et que
  -- personne ne remarque.
  get diagnostics v_lignes = row_count;
  if v_lignes <> 1 then
    raise exception
      'Clôture du service précédent % impossible : % ligne(s) modifiée(s) au lieu d''une. Prise de poste refusée plutôt que deux services actifs.',
      v_ancien.id, v_lignes
      using errcode = '25000';
  end if;

  return NEW;
end;
$$;

comment on function public.nexus_shifts_avant_insertion() is
  'B1 (05/09/2026) — contrat unique de prise de poste : normalise l''identité du site PUIS clôture le service actif précédent, dans la même transaction. Remplace le couple nexus_cloturer_shift_precedent + shifts_site_unique à l''INSERT, dont l''ordre d''exécution dépendait de l''ordre alphabétique de leurs noms — ce qui rendait S-3 inopérant depuis l''application, qui n''envoie jamais site_id.';

-- ── 4. Bascule des triggers de `shifts` ─────────────────────────────────
-- L'ancien couple est remplacé à l'INSERT. `shifts_site_unique` subsiste
-- pour l'UPDATE, où aucune clôture n'a lieu et où la normalisation reste
-- nécessaire.
drop trigger if exists nexus_cloturer_shift_precedent on public.shifts;
drop trigger if exists shifts_site_unique on public.shifts;

create trigger nexus_shifts_avant_insertion
  before insert on public.shifts
  for each row
  execute function public.nexus_shifts_avant_insertion();

create trigger shifts_site_unique
  before update on public.shifts
  for each row
  execute function public.nexus_forcer_site_unique();

-- La fonction de S-3 n'est plus référencée par aucun trigger. On la retire
-- pour qu'il n'existe pas deux chemins de clôture dont un mort.
drop function if exists public.nexus_cloturer_shift_precedent();

-- ── 5. Contrôle fail-closed ─────────────────────────────────────────────
do $$
declare
  v_insert int;
  v_update int;
begin
  select count(*) into v_insert from pg_trigger t
   where t.tgrelid = 'public.shifts'::regclass and not t.tgisinternal
     and t.tgtype & 4 = 4;  -- BEFORE INSERT
  select count(*) into v_update from pg_trigger t
   where t.tgrelid = 'public.shifts'::regclass and not t.tgisinternal
     and t.tgtype & 16 = 16; -- UPDATE

  if v_insert <> 1 then
    raise exception 'B1 interrompu : % trigger(s) BEFORE INSERT sur shifts au lieu d''un seul. La dépendance d''ordre serait réintroduite.', v_insert;
  end if;
  if v_update <> 1 then
    raise exception 'B1 interrompu : % trigger(s) UPDATE sur shifts au lieu d''un seul.', v_update;
  end if;
end;
$$;
