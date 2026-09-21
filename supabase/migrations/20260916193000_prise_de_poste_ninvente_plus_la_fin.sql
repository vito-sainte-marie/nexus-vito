-- =====================================================================
-- P-1 (16/09/2026) — la prise de poste suivante n'invente plus l'heure
--                    de fin du service précédent.
--
-- CE QUE B1 ÉCRIT AUJOURD'HUI, ET POURQUOI C'EST FAUX
--
-- `nexus_shifts_avant_insertion` clôture bien le service actif précédent
-- — ce mécanisme fonctionne. Mais il le clôture en `termine` avec
-- `heure_fin = NEW.heure_debut`, c'est-à-dire l'instant de la NOUVELLE
-- prise de poste. Production porte déjà les deux lignes que ce calcul a
-- produites :
--
--   loane     14/09 10:11:50 → 16/09 10:36:00   soit 2 j 00 h 24, 0 pointage
--   angelique 14/09 20:18:36 → 15/09 09:50:07   soit 13 h 31,      0 pointage
--
-- Personne n'a travaillé 2 jours d'affilée. Ces durées ne sont pas des
-- mesures : ce sont des intervalles entre deux ouvertures d'écran, écrits
-- dans une colonne que les lecteurs futurs prendront pour une présence.
-- Aucun écran ne les affiche encore (la paye lit `planning_shifts`, pas
-- `shifts`) — c'est la seule raison pour laquelle le faux n'a pas encore
-- de conséquence. Il faut le corriger AVANT qu'un calcul s'en serve.
--
-- CE QUE S-3 SOUTENAIT, ET CE QUE NOUS LUI RÉPONDONS
--
-- S-3 (20260905190000) argumentait : « `new.heure_debut`, et rien
-- d'autre. […] C'est le fait vérifiable qu'à cet instant un nouveau
-- service a commencé, donc que l'ancien ne peut plus être actif. »
--
-- La prémisse est juste, la conclusion ne suit pas. « L'ancien ne peut
-- plus être actif » justifie de le FERMER ; cela ne justifie pas de le
-- déclarer `termine` À cet instant. Le modèle dispose déjà du statut qui
-- dit exactement ce que nous savons — `clos_sans_pointage`, posé par S-1
-- avec la règle « heure_fin = null, inconnue, jamais inventée ». S-3
-- avait ce statut sous la main et a préféré fabriquer une mesure.
--
-- C'est la même règle que S-1, appliquée au seul chemin qui y échappait.
--
-- CE QUE CETTE MIGRATION CHANGE — UNE SEULE CHOSE
--
-- La clôture du service précédent devient conditionnelle :
--
--   · un pointage de départ EXISTE pour ce service  → `termine`,
--     `heure_fin` = l'horodatage LU de ce départ (jamais NEW.heure_debut) ;
--   · aucun départ pointé, ou départ inexploitable  → `clos_sans_pointage`,
--     `heure_fin` NULL, `cloture_motif` explicite.
--
-- Dans les deux cas `cloture_source = 'prise_de_poste_suivante'` et
-- `cloture_le = now()` : la cause de la clôture, elle, n'a pas changé.
--
-- Tout le reste de B1 est conservé mot pour mot : la normalisation du
-- site EN PREMIER (c'était l'objet de B1 — sans elle le trigger raisonne
-- sur un site NULL), la garde chronologique, le `for update`, le contrôle
-- `row_count <> 1`. Cette migration ne touche ni les triggers, ni
-- `nexus_site_de_reference`, ni `nexus_forcer_site_unique`.
--
-- POURQUOI LE CAS « DÉPART POINTÉ » EXISTE ENCORE
--
-- S-2 (`nexus_cloturer_shift_au_depart`, AFTER INSERT sur `pointages`)
-- ferme normalement le service dès le départ pointé : un service portant
-- un départ ne devrait donc plus être `en_cours`. Il le reste quand S-2
-- n'a pas pu conclure — pointage posé sans `service_id` pendant qu'un
-- autre service était actif, départ antérieur au début, échec RLS
-- silencieux. Dans ce cas le départ EST une donnée réelle, enregistrée
-- par un employé : la perdre au profit d'un `clos_sans_pointage` serait
-- le défaut symétrique de celui que l'on corrige.
--
-- L'HEURE DE CE DÉPART — LA MÊME CONSTRUCTION QUE S-2, PAS UNE AUTRE
--
-- `pointages` stocke un couple `date` (date) + `heure` (time WITHOUT
-- time zone) : une heure locale, sans fuseau. C'est le piège C1/C2. S-2
-- le résout par `(date + heure) at time zone <fuseau du commerce>` et
-- refuse de conclure si le commerce ne déclare pas de fuseau exploitable.
-- Cette migration reprend CETTE construction, à l'identique — deux façons
-- de dater le même départ produiraient deux vérités.
--
-- `created_at` (timestamptz) serait plus simple, et faux : il date
-- l'enregistrement, pas le départ. Un pointage rejoué depuis la file
-- hors-ligne porte un `created_at` postérieur de plusieurs heures.
--
-- DIFFÉRENCE ASSUMÉE AVEC S-2 : FUSEAU MANQUANT
--
-- S-2 lève une exception quand le commerce ne déclare aucun fuseau — il
-- n'a rien d'autre à faire, sa seule raison d'être est cette conversion.
-- Ici, lever bloquerait la PRISE DE POSTE, alors que l'instruction du
-- 16/09 est explicite : « l'absence de pointage de départ ne doit pas
-- empêcher une prochaine prise de poste ». Un fuseau manquant nous prive
-- de l'heure, pas du droit de travailler. On clôt donc
-- `clos_sans_pointage` avec un motif qui NOMME la cause, et l'employé
-- prend son poste.
--
-- SECURITY INVOKER, inchangé : `update_shifts` autorise déjà un employé à
-- modifier son propre service et un manager ceux de son site. Cette
-- migration n'accorde aucun privilège et ne crée aucune fonction
-- SECURITY DEFINER. Si la RLS empêche l'appelant de LIRE le pointage de
-- départ, la lecture rend zéro ligne et l'on retombe sur la branche
-- prudente : `heure_fin` NULL. Une donnée invisible n'est jamais devinée.
--
-- PHASE PILOTE. NEXUS n'est pas utilisé systématiquement : un service sans
-- départ pointé est le cas NORMAL, pas une anomalie. Aucune conclusion de
-- présence ne doit être tirée d'un usage incomplet — d'où le motif, qui
-- dit « fin non enregistrée » et rien de plus.
-- =====================================================================

begin;

create or replace function public.nexus_shifts_avant_insertion()
returns trigger
language plpgsql
-- SECURITY INVOKER, comme B1 et S-3.
as $$
declare
  v_reference  text;
  v_ancien     record;
  v_lignes     int;
  v_depart     record;
  v_timezone   text;
  v_fin        timestamptz;
  v_motif      text;
begin
  -- (a) Identité du site, D'ABORD (B1, inchangé).
  v_reference := public.nexus_site_de_reference(NEW.site, NEW.site_id);
  NEW.site    := v_reference;
  NEW.site_id := v_reference;

  if NEW.statut is distinct from 'en_cours' then
    return NEW;  -- une insertion d'historique ne clôture rien
  end if;

  -- (b) Le service actif : CET employé, CE site (B1, inchangé).
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

  -- Garde chronologique de S-3, conservée mot pour mot.
  if NEW.heure_debut <= v_ancien.heure_debut then
    raise exception
      'Prise de poste refusée : le service % est actif depuis %, postérieur ou égal à la nouvelle prise (%). Une insertion antérieure à un service actif n''est pas une prise de poste suivante.',
      v_ancien.id, v_ancien.heure_debut, NEW.heure_debut
      using errcode = '22007';
  end if;

  -- (c) LE DÉPART A-T-IL ÉTÉ POINTÉ ? C'est la question que B1 ne posait
  -- pas. Rattachement STRICT par `service_id` : un pointage historique
  -- sans service (`null`) n'appartient à aucun service et ne peut donc
  -- dater la fin d'aucun — même égalité stricte que
  -- `dejaFaitDuService()` dans nexus-pointage-regles.js.
  select p.date, p.heure into v_depart
    from public.pointages p
   where p.service_id = v_ancien.id
     and p.type       = 'depart'
   order by p.date desc, p.heure desc
   limit 1;

  if v_depart.date is null then
    v_motif := 'Fin non enregistrée — service clos par la prise de poste suivante (phase pilote)';
  else
    select s.timezone into v_timezone
      from public.sites s
     where s.site_id = NEW.site_id;

    if v_timezone is null or btrim(v_timezone) = ''
       or not exists (select 1 from pg_timezone_names n where n.name = v_timezone) then
      -- Cf. « DIFFÉRENCE ASSUMÉE AVEC S-2 » : on ne bloque pas la prise
      -- de poste pour un réglage de commerce manquant.
      v_motif := 'Fin non enregistrée — départ pointé non convertible : le commerce ne déclare aucun fuseau horaire exploitable (phase pilote)';
    else
      v_fin := (v_depart.date + v_depart.heure) at time zone v_timezone;

      -- Bornes de vraisemblance. Un départ antérieur au début du service,
      -- ou postérieur à la prise de poste suivante, ne peut pas dater la
      -- fin de CE service : on le signale plutôt que de l'écrire.
      if v_fin < v_ancien.heure_debut or v_fin > NEW.heure_debut then
        v_motif := format(
          'Fin non enregistrée — départ pointé le %s à %s hors de l''intervalle du service, non retenu (phase pilote)',
          v_depart.date, v_depart.heure);
        v_fin := null;
      end if;
    end if;
  end if;

  -- (d) Clôture. Une seule écriture, deux formes exclusives.
  if v_fin is not null then
    update public.shifts
       set statut         = 'termine',
           heure_fin      = v_fin,           -- LU d'un pointage, jamais déduit
           cloture_source = 'prise_de_poste_suivante',
           cloture_le     = now()
     where id = v_ancien.id;
  else
    update public.shifts
       set statut         = 'clos_sans_pointage',
           heure_fin      = null,            -- inconnue, jamais inventée (S-1)
           cloture_source = 'prise_de_poste_suivante',
           cloture_le     = now(),
           cloture_motif  = v_motif
     where id = v_ancien.id;
  end if;

  -- Un UPDATE refusé par la RLS ne lève rien : il modifie zéro ligne, en
  -- silence (B1, inchangé).
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
  'P-1 (16/09/2026) — contrat unique de prise de poste : normalise l''identité du site PUIS ferme le service actif précédent, sans jamais inventer son heure de fin. Départ pointé pour ce service : statut « termine », heure_fin = horodatage lu du départ ((date + heure) at time zone du commerce, comme S-2). Sinon : « clos_sans_pointage », heure_fin NULL et cloture_motif explicite. Corrige B1/S-3, qui écrivaient heure_fin = heure de la NOUVELLE prise de poste — une durée fabriquée (2 j 00 h 24 en Production pour un service sans aucun pointage). Conserve de B1 la normalisation préalable du site, la garde chronologique, le verrou for update et le contrôle row_count.';

-- ── Contrôle fail-closed ────────────────────────────────────────────────
-- 1. Le trigger n'a pas bougé (cette migration ne redéfinit qu'une
--    fonction) : on VÉRIFIE qu'il pointe toujours sur elle, et qu'il reste
--    seul — la dépendance à l'ordre alphabétique que B1 a supprimée ne
--    doit pas revenir par une autre migration.
-- 2. La fonction installée est bien la nouvelle : on cherche dans son
--    corps le statut que B1 n'écrivait jamais. Sans ce contrôle, un
--    `create or replace` avalé sans effet passerait inaperçu.
do $ctrl$
declare
  v_insert  int;
  v_update  int;
  v_lie     boolean;
  v_source  text;
begin
  select count(*) into v_insert from pg_trigger t
   where t.tgrelid = 'public.shifts'::regclass and not t.tgisinternal
     and t.tgtype & 4 = 4;   -- BEFORE INSERT
  select count(*) into v_update from pg_trigger t
   where t.tgrelid = 'public.shifts'::regclass and not t.tgisinternal
     and t.tgtype & 16 = 16; -- UPDATE

  select exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.shifts'::regclass and not t.tgisinternal
       and t.tgtype & 4 = 4
       and p.proname = 'nexus_shifts_avant_insertion'
  ) into v_lie;

  select p.prosrc into v_source
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'nexus_shifts_avant_insertion';

  if v_insert <> 1 then
    raise exception 'P-1 interrompu : % trigger(s) BEFORE INSERT sur shifts au lieu d''un seul.', v_insert;
  end if;
  if v_update <> 1 then
    raise exception 'P-1 interrompu : % trigger(s) UPDATE sur shifts au lieu d''un seul.', v_update;
  end if;
  if not v_lie then
    raise exception 'P-1 interrompu : le trigger BEFORE INSERT de shifts n''appelle pas nexus_shifts_avant_insertion.';
  end if;
  if v_source is null or v_source not like '%clos_sans_pointage%' then
    raise exception 'P-1 interrompu : la fonction installée n''écrit pas clos_sans_pointage — le remplacement n''a pas eu lieu.';
  end if;
  if v_source like '%heure_fin      = NEW.heure_debut%' then
    raise exception 'P-1 interrompu : la fonction installée écrit encore heure_fin = NEW.heure_debut.';
  end if;
end;
$ctrl$;

commit;
