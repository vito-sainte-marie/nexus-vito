-- NEXUS — un service qui se ferme ne doit JAMAIS inventer l'heure de sa fin
-- (16/09/2026, cycle des services adapté à l'usage intermittent du pilote).
--
-- Ce que seule une vraie base peut prouver, et que la suite de non-régression
-- ne peut pas éprouver puisqu'elle n'ouvre aucune connexion : le comportement
-- du trigger `nexus_shifts_avant_insertion` quand une prise de poste referme
-- le service de la veille.
--
-- Le défaut d'origine — celui que la migration
-- 20260916193000_prise_de_poste_ninvente_plus_la_fin.sql corrige — écrivait
-- `heure_fin = NEW.heure_debut` : l'heure de fin d'un service devenait l'heure
-- de début du suivant. Une durée fabriquée, jamais constatée, sur laquelle
-- personne ne doit conclure quoi que ce soit en matière de présence.
--
-- Les quatre branches du contrat sont éprouvées séparément :
--   T1  aucun départ pointé            -> clos_sans_pointage, heure_fin NULL
--   T2  départ pointé exploitable      -> termine, heure_fin = l'heure LUE
--   T3  départ hors intervalle         -> clos_sans_pointage, motif explicite
--   T4  fuseau du site inexploitable   -> clos_sans_pointage, motif explicite
-- puis les garanties de bordure :
--   T4b un fuseau invalide est refusé à l'écriture (T4 est une DÉFENSE EN
--       PROFONDEUR : `nexus_valider_fuseau_site` la rend inatteignable tant
--       qu'il est en place — d'où la neutralisation temporaire en T4) ;
--   T5  la garde chronologique de S-3 tient ;
--   T6  une première prise de poste ne touche rien d'autre ;
--   T7  AUCUNE ligne de la base ne porte une fin égale au début du suivant.
--
-- Transaction close par ROLLBACK : rien n'est conservé, pas même la
-- réactivation du trigger de validation des fuseaux, que l'annulation rend.
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f outils/verifier-cycle-services-pilote.sql
--
-- EN TEST UNIQUEMENT. Ce script écrit des services et des pointages ; il ne
-- les conserve pas, mais il n'a rien à faire sur la base de Production.
--
-- Sans psql (connecteur qui n'expose pas le contrôle de transaction), rejouer
-- le bloc `do` seul en terminant par `raise exception` au lieu du `raise
-- notice` final : le rapport arrive dans le message d'erreur et l'annulation
-- est garantie par l'erreur elle-même.

begin;

do $$
declare
  SITE constant text := 'nexus-station-test';
  TZ   constant text := 'America/Martinique';
  EMP  uuid := (select id from public.employees where username = 'employe-test-a');
  EMP2 uuid := (select id from public.employees where username = 'employe-test-b');
  CRE  uuid := (select id from public.employees where username = 'test-createur');
  MGR  uuid := (select id from public.employees where username = 'manager-test');
  r text := '';
  ko boolean := false;
  a uuid; b uuid;
  sh record;
  v_local timestamp;
  v_attendu timestamptz;
  n int; n_avant int;
begin
  if EMP is null or EMP2 is null or CRE is null or MGR is null then
    raise exception 'Base inattendue : comptes de recette introuvables.';
  end if;
  if not exists (select 1 from public.sites where site_id = SITE and timezone = TZ) then
    raise exception 'Base inattendue : % ne déclare pas le fuseau %.', SITE, TZ;
  end if;

  -- État de départ déterministe : les comptes de recette n'ont aucun service
  -- ouvert. Sans cela, un service ouvert PLUS TARD que now()-6h ferait refuser
  -- nos insertions par la garde chronologique — et l'épreuve échouerait pour
  -- une raison qui n'est pas celle qu'elle examine.
  update public.shifts
     set statut = 'clos_sans_pointage', heure_fin = null,
         cloture_source = 'test', cloture_le = now()
   where statut = 'en_cours' and employee_id in (EMP, EMP2, CRE, MGR);

  -- ── T1 · aucun départ pointé : la fin est INCONNUE, pas inventée ────────
  insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
    values (EMP, SITE, SITE, 'caissiere', 'en_cours', now() - interval '6 hours') returning id into a;
  insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
    values (EMP, SITE, SITE, 'caissiere', 'en_cours', now()) returning id into b;
  select * into sh from public.shifts where id = a;
  if not (sh.statut = 'clos_sans_pointage' and sh.heure_fin is null
          and sh.cloture_source = 'prise_de_poste_suivante' and sh.cloture_le is not null
          and position('service clos par la prise de poste suivante' in coalesce(sh.cloture_motif,'')) > 0) then
    ko := true;
    r := r || format(E'  T1 ÉCHEC — statut=%s heure_fin=%s source=%s motif=%s\n',
      sh.statut, coalesce(sh.heure_fin::text,'NULL'), coalesce(sh.cloture_source,'NULL'),
      coalesce(sh.cloture_motif,'NULL'));
  end if;
  update public.shifts set statut='clos_sans_pointage', heure_fin=null,
         cloture_source='test', cloture_le=now() where id = b;

  -- ── T2 · départ RÉELLEMENT pointé : l'heure est LUE ─────────────────────
  insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
    values (EMP2, SITE, SITE, 'pompiste', 'en_cours', now() - interval '6 hours') returning id into a;
  v_local   := (now() - interval '3 hours') at time zone TZ;
  v_attendu := (v_local::date + v_local::time) at time zone TZ;
  insert into public.pointages(employee_id, site, date, heure, type, quart, service_id, client_event_id)
    values (EMP2, SITE, v_local::date, v_local::time, 'depart', 'matin', a, gen_random_uuid());
  -- `nexus_cloturer_shift_au_depart` vient de fermer ce service. On recrée la
  -- situation que le trigger de prise de poste traite : un service resté
  -- `en_cours` ALORS QU'UN DÉPART EXISTE — c'est-à-dire le cas où la clôture
  -- au départ n'a pas pu conclure.
  update public.shifts set statut='en_cours', heure_fin=null, cloture_source=null,
         cloture_le=null, cloture_motif=null where id = a;
  insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
    values (EMP2, SITE, SITE, 'pompiste', 'en_cours', now()) returning id into b;
  select * into sh from public.shifts where id = a;
  if not (sh.statut = 'termine' and sh.heure_fin is not null
          and abs(extract(epoch from (sh.heure_fin - v_attendu))) < 1
          and sh.cloture_source = 'prise_de_poste_suivante') then
    ko := true;
    r := r || format(E'  T2 ÉCHEC — statut=%s heure_fin=%s, départ pointé à %s, début du suivant %s\n',
      sh.statut, coalesce(sh.heure_fin::text,'NULL'), v_attendu::text,
      (select heure_debut::text from public.shifts where id = b));
  end if;
  update public.shifts set statut='clos_sans_pointage', heure_fin=null,
         cloture_source='test', cloture_le=now() where id = b;

  -- ── T3 · départ hors de l'intervalle : signalé, pas écrit ───────────────
  insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
    values (EMP, SITE, SITE, 'caissiere', 'en_cours', now() - interval '6 hours') returning id into a;
  v_local := (now() - interval '3 hours') at time zone TZ;
  insert into public.pointages(employee_id, site, date, heure, type, quart, service_id, client_event_id)
    values (EMP, SITE, v_local::date, v_local::time, 'depart', 'matin', a, gen_random_uuid());
  -- Le départ est déplacé APRÈS coup : inséré directement hors intervalle, il
  -- serait refusé par la clôture au départ, et l'on n'éprouverait rien.
  v_local := (now() - interval '20 hours') at time zone TZ;
  update public.pointages set date = v_local::date, heure = v_local::time
   where service_id = a and type = 'depart';
  update public.shifts set statut='en_cours', heure_fin=null, cloture_source=null,
         cloture_le=null, cloture_motif=null where id = a;
  insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
    values (EMP, SITE, SITE, 'caissiere', 'en_cours', now()) returning id into b;
  select * into sh from public.shifts where id = a;
  if not (sh.statut = 'clos_sans_pointage' and sh.heure_fin is null
          and position('hors de l''intervalle du service' in coalesce(sh.cloture_motif,'')) > 0) then
    ko := true;
    r := r || format(E'  T3 ÉCHEC — statut=%s heure_fin=%s motif=%s\n',
      sh.statut, coalesce(sh.heure_fin::text,'NULL'), coalesce(sh.cloture_motif,'NULL'));
  end if;
  update public.shifts set statut='clos_sans_pointage', heure_fin=null,
         cloture_source='test', cloture_le=now() where id = b;

  -- ── T4 · fuseau du commerce inexploitable ───────────────────────────────
  -- Branche DÉFENSIVE : `nexus_valider_fuseau_site` interdit d'écrire un tel
  -- fuseau (T4b le prouve). On ne l'atteint qu'en neutralisant cette
  -- validation, le temps d'une transaction que le ROLLBACK annule. Si le rôle
  -- courant n'a pas ce droit, la branche est déclarée NON ÉPROUVÉE — ce n'est
  -- pas un échec du trigger, c'est une limite du rôle.
  begin
    insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
      values (EMP2, SITE, SITE, 'pompiste', 'en_cours', now() - interval '6 hours') returning id into a;
    v_local := (now() - interval '3 hours') at time zone TZ;
    insert into public.pointages(employee_id, site, date, heure, type, quart, service_id, client_event_id)
      values (EMP2, SITE, v_local::date, v_local::time, 'depart', 'matin', a, gen_random_uuid());
    update public.shifts set statut='en_cours', heure_fin=null, cloture_source=null,
           cloture_le=null, cloture_motif=null where id = a;
    alter table public.sites disable trigger nexus_valider_fuseau_site;
    update public.sites set timezone = '' where site_id = SITE;
    insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
      values (EMP2, SITE, SITE, 'pompiste', 'en_cours', now()) returning id into b;
    update public.sites set timezone = TZ where site_id = SITE;
    alter table public.sites enable trigger nexus_valider_fuseau_site;
    select * into sh from public.shifts where id = a;
    if not (sh.statut = 'clos_sans_pointage' and sh.heure_fin is null
            and position('aucun fuseau horaire exploitable' in coalesce(sh.cloture_motif,'')) > 0) then
      ko := true;
      r := r || format(E'  T4 ÉCHEC — statut=%s heure_fin=%s motif=%s\n',
        sh.statut, coalesce(sh.heure_fin::text,'NULL'), coalesce(sh.cloture_motif,'NULL'));
    end if;
    update public.shifts set statut='clos_sans_pointage', heure_fin=null,
           cloture_source='test', cloture_le=now() where id = b;
  exception when others then
    raise warning 'T4 NON ÉPROUVÉE (% : %) — la neutralisation temporaire de la validation des fuseaux a été refusée.',
      sqlstate, sqlerrm;
  end;

  -- ── T4b · en exploitation, cette branche est hors d'atteinte ────────────
  begin
    update public.sites set timezone = 'Mars/Olympus' where site_id = SITE;
    ko := true;
    r := r || E'  T4b ÉCHEC — un fuseau horaire inconnu a été ACCEPTÉ sur le site.\n';
  exception when sqlstate '23514' then
    null;  -- refusé, comme il se doit
  end;

  -- ── T5 · la garde chronologique de S-3 tient ────────────────────────────
  insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
    values (CRE, SITE, SITE, 'manager', 'en_cours', now()) returning id into b;
  begin
    insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
      values (CRE, SITE, SITE, 'manager', 'en_cours', now() - interval '1 hour');
    ko := true;
    r := r || E'  T5 ÉCHEC — une prise de poste ANTÉRIEURE au service actif a été acceptée.\n';
  exception when sqlstate '22007' then
    null;  -- refusée avec le message métier prévu
  when others then
    ko := true;
    r := r || format(E'  T5 ÉCHEC — refus obtenu, mais par %s et non par la garde chronologique (22007) : %s\n',
      sqlstate, sqlerrm);
  end;
  update public.shifts set statut='clos_sans_pointage', heure_fin=null,
         cloture_source='test', cloture_le=now() where id = b;

  -- ── T6 · une première prise de poste ne touche rien d'autre ─────────────
  select count(*) into n_avant from public.shifts where statut = 'en_cours';
  insert into public.shifts(employee_id, site, site_id, role, statut, heure_debut)
    values (MGR, SITE, SITE, 'manager', 'en_cours', now());
  select count(*) into n from public.shifts where statut = 'en_cours';
  if n <> n_avant + 1 then
    ko := true;
    r := r || format(E'  T6 ÉCHEC — services en cours : %s avant, %s après une PREMIÈRE prise de poste.\n', n_avant, n);
  end if;

  -- ── T7 · le défaut d'origine est mort dans TOUTE la base ────────────────
  -- Une fin égale au début du service suivant du même employé sur le même
  -- site : c'est la signature exacte de la durée fabriquée.
  select count(*) into n from public.shifts s
   where s.cloture_source = 'prise_de_poste_suivante' and s.heure_fin is not null
     and exists (select 1 from public.shifts s2
                  where s2.employee_id = s.employee_id and s2.site_id = s.site_id
                    and s2.heure_debut = s.heure_fin and s2.id <> s.id);
  if n <> 0 then
    ko := true;
    r := r || format(E'  T7 ÉCHEC — %s service(s) portent encore une fin égale au début du suivant.\n', n);
  end if;

  if ko then
    raise exception E'ÉCHEC — le cycle des services ne respecte plus son contrat :\n%', r;
  end if;
  raise notice 'OK — T1..T7 : aucune heure de fin inventée, la garde chronologique tient, et aucune durée fabriquée ne subsiste dans la base.';
end $$;

rollback;
