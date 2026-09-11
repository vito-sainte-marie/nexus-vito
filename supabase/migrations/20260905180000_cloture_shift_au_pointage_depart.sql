-- =====================================================================
-- S-2 · Un pointage de départ clôture le service actif (05/09/2026)
--
-- CE QUE LA RECETTE A PROUVÉ
--
-- Le 05/09/2026, Employé Test B a pointé son départ à 14:47, photo de mise
-- en alarme à l'appui. Son service est resté `en_cours`, heure_fin nulle.
-- NEXUS contenait ZÉRO update sur `shifts` : aucun code ne fermait jamais
-- un service, alors que la contrainte shifts_cloture_source_check nomme
-- explicitement la valeur 'pointage_depart' depuis l'origine.
--
-- POURQUOI UN TRIGGER, ET PAS UN APPEL DEPUIS L'ÉCRAN
--
-- « Un départ ferme le service » est une règle de la DONNÉE, pas une règle
-- d'écran. Un appel client aurait été deux allers-retours non atomiques —
-- exactement le défaut corrigé ici : un départ enregistré sans clôture.
-- Le trigger s'exécute dans la MÊME transaction que l'insert : soit les
-- deux, soit aucun.
--
-- Il rend aussi l'invariant impossible à oublier par un appelant futur :
-- l'écran d'aujourd'hui, une Edge Function demain, un import de reprise.
-- Aucune ligne de NEXUS-Pointage-v1.html n'est modifiée.
--
-- SECURITY INVOKER (le défaut) : la politique update_shifts autorise déjà
-- un employé à modifier son propre service. Passer en SECURITY DEFINER
-- contournerait un RLS qui fonctionne, sans aucune nécessité. Le trigger
-- conserve EXACTEMENT les droits de l'appelant et ne crée aucun privilège
-- supplémentaire : ce qu'il peut clôturer est ce que update_shifts lui
-- permet déjà de modifier.
-- =====================================================================

begin;

create or replace function public.nexus_cloturer_shift_au_depart()
returns trigger language plpgsql as $fn$
declare
  v_shift_id uuid;
  v_timezone text;
  v_lignes int;
begin
  -- Le service actif : CET employé, CE site, en cours. Le site fait partie
  -- de l'invariant — un mécanisme transverse ne doit pas reposer
  -- implicitement sur l'unicité globale d'un identifiant employé.
  --
  -- Le tri sur le plus récent subsiste bien que S-1 rende le cas
  -- impossible : défense contre un historique imparfait ou un import.
  select sh.id into v_shift_id
    from public.shifts sh
   where sh.employee_id = new.employee_id
     and sh.site_id     = new.site
     and sh.statut      = 'en_cours'
   order by sh.heure_debut desc
   limit 1;

  if v_shift_id is null then
    -- Aucun service actif. Le départ RESTE enregistré : la donnée réelle
    -- « l'employé est parti » vaut mieux qu'un refus parce qu'une prise de
    -- poste manque. Aucune clôture n'est inventée, et le cas reste
    -- détectable — un pointage 'depart' sans service clos en regard.
    raise notice 'Pointage de départ sans service actif (employé %, site %) — aucune clôture inventée.',
      new.employee_id, new.site;
    return new;
  end if;

  -- Le fuseau du commerce, source unique sites.timezone (A3-3).
  --
  -- FAIL-CLOSED : pointages.heure est un `time without time zone` exprimé
  -- en heure de la STATION, et shifts.heure_fin est un `timestamptz`.
  -- Écrire `new.date + new.heure` laisserait la session interpréter la
  -- combinaison — en UTC sur Supabase — et enregistrerait une fin de
  -- service décalée de 4 heures pour la Martinique. C'est exactement le
  -- défaut supprimé par C1/C2 : ne jamais laisser l'environnement deviner
  -- l'heure. Sans fuseau résolu, on ne clôture pas.
  select s.timezone into v_timezone
    from public.sites s where s.site_id = new.site;

  if v_timezone is null or btrim(v_timezone) = ''
     or not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception
      'Clôture du service % impossible : le commerce % ne déclare aucun fuseau horaire exploitable. Le pointage de départ est annulé plutôt que d''enregistrer une heure de fin interprétée dans un autre fuseau.',
      v_shift_id, new.site;
  end if;

  update public.shifts
     set statut         = 'termine',
         heure_fin      = (new.date + new.heure) at time zone v_timezone,
         cloture_source = 'pointage_depart',
         cloture_le     = now()
   where id = v_shift_id;

  get diagnostics v_lignes = row_count;

  -- Un UPDATE refusé par RLS ne lève AUCUNE exception : il affecte zéro
  -- ligne. La recette du 05/09/2026 l'a prouvé sur audits_caisse. Sans ce
  -- contrôle, le pointage serait enregistré et le service resterait
  -- ouvert — le défaut même que cette migration corrige.
  if v_lignes <> 1 then
    raise exception
      'Clôture du service % impossible : % ligne(s) modifiée(s) au lieu de 1. Le pointage de départ est annulé pour ne pas laisser un service ouvert.',
      v_shift_id, v_lignes;
  end if;

  return new;
end;
$fn$;

comment on function public.nexus_cloturer_shift_au_depart() is
  'S-2 (05/09/2026) — un pointage de départ clôture le service actif de l''employé sur son site, dans la même transaction. heure_fin est construite explicitement dans le fuseau du commerce (sites.timezone) : la combinaison date+heure laissée à la session serait interprétée en UTC et décalerait la fin de service. Sans service actif, le départ est conservé sans clôture inventée ; toute autre anomalie annule le pointage.';

drop trigger if exists nexus_cloturer_shift_au_depart on public.pointages;
create trigger nexus_cloturer_shift_au_depart
  after insert on public.pointages
  for each row when (new.type = 'depart')
  execute function public.nexus_cloturer_shift_au_depart();

commit;
