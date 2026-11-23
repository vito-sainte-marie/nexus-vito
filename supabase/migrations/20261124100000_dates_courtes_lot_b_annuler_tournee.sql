-- Dates courtes lot B : « Annuler une tournée ».
-- Une tournée annulée l'est avec tous ses produits relevés : ils ne comptent plus (quantités, Prévention des pertes), rien n'est supprimé,
-- la tournée reste visible dans le suivi (état « Annulée », auteur, heure, motif). Irréversible : aucune fonction de rétablissement.
-- Droits : un employé n'annule que sa propre tournée EN_COURS ; la gestion (manager, gérant, créateur) toute tournée non certifiée de sa station ;
-- une tournée certifiée jamais ; une autre station jamais. Aucun nouveau privilège : même modèle que dates_courtes_terminer_tournee.

-- 1. Colonnes et contraintes
alter table dates_courtes_tournees
  add column if not exists annulee_le timestamptz,
  add column if not exists annulee_par uuid references employees(id),
  add column if not exists motif_annulation text;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.dates_courtes_tournees'::regclass and contype = 'c'
             and (conname = 'dates_courtes_tournees_cloture'
                  or (pg_get_constraintdef(oid) like '%EN_COURS%' and pg_get_constraintdef(oid) like '%CORRECTION_DEMANDEE%' and conname <> 'dates_courtes_tournees_cloture'
                      and pg_get_constraintdef(oid) not like '%terminee_par%'))
  loop
    execute format('alter table dates_courtes_tournees drop constraint %I', c.conname);
  end loop;
end $$;

alter table dates_courtes_tournees add constraint dates_courtes_tournees_etat_valide
  check (etat in ('EN_COURS', 'TERMINEE_A_CERTIFIER', 'CERTIFIEE', 'CORRECTION_DEMANDEE', 'ANNULEE'));

-- Clôture : les états terminés gardent la règle d'origine ; ANNULEE exige l'annulation complète, avec ou sans clôture préalable
-- (annulée en cours : pas de clôture ; annulée par la gestion après clôture : la clôture reste tracée, tout ou rien).
alter table dates_courtes_tournees add constraint dates_courtes_tournees_cloture check (
  (etat = 'EN_COURS' and terminee_par is null and terminee_le is null and version_empreinte is null
     and annulee_le is null and annulee_par is null and motif_annulation is null)
  or (etat in ('TERMINEE_A_CERTIFIER', 'CERTIFIEE', 'CORRECTION_DEMANDEE') and terminee_par is not null and terminee_le is not null and version_empreinte is not null
     and annulee_le is null and annulee_par is null and motif_annulation is null)
  or (etat = 'ANNULEE' and annulee_le is not null and annulee_par is not null and char_length(btrim(coalesce(motif_annulation, ''))) between 3 and 200
     and ((terminee_par is null and terminee_le is null and version_empreinte is null)
          or (terminee_par is not null and terminee_le is not null and version_empreinte is not null)))
);

-- 2. Une tournée annulée n'accepte plus aucun geste ni renommage.
create or replace function dates_courtes_porte_tournee(p_site text, p_tournee uuid, p_geste timestamptz) returns text
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare t record;
begin
  if pg_trigger_depth() = 0 then
    raise exception 'appel_interdit : cette fonction ne s''appelle que depuis un déclencheur' using errcode = 'P0001';
  end if;
  if not exists (select 1 from employees e where e.id = auth.uid() and e.actif and e.site_id = p_site) then
    raise exception 'site_interdit : station différente de celle de la personne connectée' using errcode = 'P0001';
  end if;
  select * into t from dates_courtes_tournees x where x.id = p_tournee and x.site = p_site for update;
  if not found then
    raise exception 'tournee_inconnue : tournée inconnue pour cette station' using errcode = 'P0001';
  end if;
  if t.saisi_par <> auth.uid() then
    raise exception 'tournee_interdite : on ne saisit que dans sa propre tournée' using errcode = 'P0001';
  end if;
  if t.etat = 'ANNULEE' then
    raise exception 'tournee_annulee : la tournée est annulée, on ne peut plus y saisir' using errcode = 'P0001';
  end if;
  if t.etat = 'EN_COURS' then return 'normal'; end if;
  if p_geste <= t.terminee_le then
    if t.etat = 'CERTIFIEE' then update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER' where id = p_tournee; end if;
    return 'apres_cloture';
  end if;
  if t.etat = 'TERMINEE_A_CERTIFIER' then
    raise exception 'tournee_terminee : la tournée est terminée, un nouveau geste appelle une demande de correction ou une nouvelle tournée' using errcode = 'P0001';
  end if;
  if t.etat = 'CERTIFIEE' then update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER' where id = p_tournee; end if;
  return 'rectification';
end $$;

create or replace function dates_courtes_renommer_tournee(p_tournee uuid, p_nom text, p_cle_idempotence text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_site text; v_nom text; v_cle text; t dates_courtes_tournees%rowtype; v_ancien text; v_deja dates_courtes_renommages_tournee%rowtype;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  select e.site_id into v_site from employees e where e.id = auth.uid() and e.actif;
  if v_site is null then raise exception 'compte_inactif : compte inactif ou sans station' using errcode = 'P0001'; end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères obligatoire' using errcode = 'P0001';
  end if;
  v_cle := btrim(p_cle_idempotence);
  v_nom := btrim(regexp_replace(regexp_replace(coalesce(p_nom, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
  if char_length(v_nom) not between 1 and 60 then
    raise exception 'valeur_invalide : le nom doit faire de 1 à 60 caractères' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|renommage|' || v_cle, 0));
  select * into v_deja from dates_courtes_renommages_tournee r where r.site = v_site and r.cle_idempotence = v_cle;
  if found then
    if v_deja.tournee_id <> p_tournee then raise exception 'cle_deja_utilisee : cette clé est déjà utilisée par une autre opération' using errcode = 'P0001'; end if;
    return jsonb_build_object('statut', 'deja_enregistre', 'tournee_id', p_tournee, 'nom', v_deja.nouveau_nom);
  end if;
  select * into t from dates_courtes_tournees x where x.id = p_tournee and x.site = v_site for update;
  if not found then raise exception 'tournee_introuvable : tournée introuvable dans cette station' using errcode = 'P0001'; end if;
  if not (dates_courtes_gestion() or (t.saisi_par = auth.uid() and (dates_courtes_operer() or dates_courtes_caissier_autorise()))) then
    raise exception 'droit_refuse : seul l''auteur de la tournée ou la gestion peut la renommer' using errcode = 'P0001';
  end if;
  if t.etat = 'CERTIFIEE' then
    raise exception 'tournee_certifiee : une tournée certifiée ne peut plus être renommée' using errcode = 'P0001';
  end if;
  if t.etat = 'ANNULEE' then
    raise exception 'tournee_annulee : une tournée annulée ne peut plus être renommée' using errcode = 'P0001';
  end if;
  v_ancien := coalesce(t.nom, dates_courtes_nom_genere(t.site, t.saisi_par, t.saisi_le));
  if v_ancien = v_nom then
    return jsonb_build_object('statut', 'inchange', 'tournee_id', p_tournee, 'nom', v_nom);
  end if;
  insert into dates_courtes_renommages_tournee (site, tournee_id, ancien_nom, nouveau_nom, renomme_par, cle_idempotence)
    values (v_site, p_tournee, v_ancien, v_nom, auth.uid(), v_cle);
  update dates_courtes_tournees set nom = v_nom where id = p_tournee and site = v_site;
  return jsonb_build_object('statut', 'renomme', 'tournee_id', p_tournee, 'nom', v_nom);
end $$;

-- 3. Annuler une tournée. Atomique : tout ou rien. Idempotente : une seconde annulation renvoie « deja_annulee ».
create or replace function dates_courtes_annuler_tournee(p_tournee uuid, p_motif text, p_cle_idempotence text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_site text; v_cle text; v_motif text; v_motif_ligne text; t record; v_nb integer := 0; v_gestion boolean;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  v_site := current_employee_site_id();
  if v_site is null then raise exception 'compte_inactif : compte inactif ou sans station' using errcode = 'P0001'; end if;
  v_gestion := dates_courtes_gestion();
  if not (v_gestion or dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : ce profil ne peut pas annuler de tournée de dates courtes' using errcode = 'P0001';
  end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères obligatoire' using errcode = 'P0001';
  end if;
  v_cle := btrim(p_cle_idempotence);
  v_motif := btrim(regexp_replace(regexp_replace(coalesce(p_motif, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
  if char_length(v_motif) not between 3 and 200 then
    raise exception 'motif_invalide : le motif doit faire de 3 à 200 caractères' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|annulation|' || v_cle, 0));
  select * into t from dates_courtes_tournees x where x.id = p_tournee and x.site = v_site for update;
  if not found then raise exception 'introuvable : tournée inconnue pour cette station' using errcode = 'P0001'; end if;
  if t.etat = 'ANNULEE' then
    return jsonb_build_object('statut', 'deja_annulee', 'etat', 'ANNULEE', 'tournee_id', p_tournee, 'produits_annules', 0);
  end if;
  if t.etat = 'CERTIFIEE' then
    raise exception 'tournee_certifiee : une tournée certifiée ne peut pas être annulée' using errcode = 'P0001';
  end if;
  if not v_gestion then
    if t.saisi_par <> auth.uid() then
      raise exception 'tournee_interdite : on n''annule que sa propre tournée' using errcode = 'P0001';
    end if;
    if t.etat <> 'EN_COURS' then
      raise exception 'etat_incompatible : seule une tournée en cours peut être annulée par son auteur' using errcode = 'P0001';
    end if;
  end if;
  if exists (select 1 from dates_courtes_demarques d
             where d.site = v_site and d.annule_le is null
               and d.retrait_id in (select r.id from dates_courtes_retraits r where r.tournee_id = p_tournee and r.site = v_site)) then
    raise exception 'demarque_active : une démarque repose sur un produit de cette tournée, annulez d''abord la démarque' using errcode = 'P0001';
  end if;

  v_motif_ligne := left('Tournée annulée : ' || v_motif, 500);
  select count(*) into v_nb from dates_courtes_releves r where r.tournee_id = p_tournee and r.site = v_site and r.annule_le is null;
  -- Les corrections négatives d'abord : les annuler ne peut que relever le total du produit (plancher à zéro respecté).
  update dates_courtes_corrections c set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif_ligne
    where c.tournee_id = p_tournee and c.site = v_site and c.annule_le is null and c.delta < 0;
  update dates_courtes_corrections c set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif_ligne
    where c.tournee_id = p_tournee and c.site = v_site and c.annule_le is null;
  update dates_courtes_releves r set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif_ligne
    where r.tournee_id = p_tournee and r.site = v_site and r.annule_le is null;
  update dates_courtes_tournees set etat = 'ANNULEE', annulee_le = now(), annulee_par = auth.uid(), motif_annulation = v_motif
    where id = p_tournee and site = v_site;
  return jsonb_build_object('statut', 'annulee', 'etat', 'ANNULEE', 'tournee_id', p_tournee, 'produits_annules', v_nb);
end $$;

revoke all on function dates_courtes_annuler_tournee(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_annuler_tournee(uuid, text, text) to authenticated;
comment on function dates_courtes_annuler_tournee(uuid, text, text) is 'Dates courtes lot B : annule une tournée et tous ses produits (rien n''est supprimé). Auteur : sa tournée en cours ; gestion : toute tournée non certifiée de la station. Motif 3 à 200 caractères obligatoire. Refus si une démarque active repose sur un produit de la tournée. Irréversible, idempotente, atomique.';

-- 4. Lecture des tournées : ajoute l'annulation (qui, quand, pourquoi) pour que l'écran Relevé affiche « Annulée par … à HH:MM · motif ».
drop function if exists dates_courtes_lire_tournees(uuid, text[]);
create function dates_courtes_lire_tournees(p_tournee uuid default null, p_etats text[] default null)
returns table (id uuid, nom text, nom_personnalise boolean, etat text, saisi_le timestamptz, commencee_a text, saisi_par uuid,
               annulee_le timestamptz, annulee_par_nom text, annulee_a text, motif_annulation text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_site text; v_gestion boolean; v_tz text;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  select e.site_id into v_site from employees e where e.id = auth.uid() and e.actif;
  if v_site is null then raise exception 'compte_inactif : compte inactif ou sans station' using errcode = 'P0001'; end if;
  if not (dates_courtes_gestion() or dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : cette action est réservée au personnel autorisé de la station' using errcode = 'P0001';
  end if;
  v_gestion := dates_courtes_gestion();
  v_tz := coalesce(nullif((select s.timezone from sites s where s.site_id = v_site), ''), 'America/Martinique');
  return query
    select t.id, coalesce(t.nom, dates_courtes_nom_genere(t.site, t.saisi_par, t.saisi_le)), t.nom is not null, t.etat, t.saisi_le,
           to_char(t.saisi_le at time zone v_tz, 'FMHH24" h "MI'), t.saisi_par,
           t.annulee_le, ea.nom, to_char(t.annulee_le at time zone v_tz, 'HH24:MI'), t.motif_annulation
    from dates_courtes_tournees t left join employees ea on ea.id = t.annulee_par
    where t.site = v_site and (p_tournee is null or t.id = p_tournee)
      and (p_etats is null or t.etat = any (p_etats))
      and (t.saisi_par = auth.uid() or (v_gestion and p_tournee is not null))
    order by t.saisi_le desc;
end $$;
revoke all on function dates_courtes_lire_tournees(uuid, text[]) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_lire_tournees(uuid, text[]) to authenticated;
comment on function dates_courtes_lire_tournees(uuid, text[]) is 'Dates courtes : tournées de la personne connectée (ou une tournée précise pour la gestion), avec nom affiché, heure de début au fuseau de la station et, pour une tournée annulée, qui, quand et pourquoi.';

-- 5. Suivi des contrôles : état « Annulée » (dernier groupe), non compté « à certifier », historique « Annulée par … ».
create or replace function dates_courtes_suivi_controles(p_du date, p_au date, p_tournee uuid default null) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  v_site text; v_tz text; v_res jsonb; v_a_certifier integer;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not dates_courtes_gestion() then
    raise exception 'droit_refuse : le suivi des contrôles est réservé au manager, au gérant et au créateur' using errcode = 'P0001';
  end if;
  v_site := current_employee_site_id();
  if v_site is null then raise exception 'compte_inactif : compte inactif ou sans station' using errcode = 'P0001'; end if;
  v_tz := coalesce(nullif((select s.timezone from sites s where s.site_id = v_site), ''), 'America/Martinique');

  if p_tournee is null then
    if p_du is null or p_au is null then raise exception 'valeur_invalide : période requise' using errcode = 'P0001'; end if;
    if p_du > p_au then raise exception 'valeur_invalide : la date de début dépasse la date de fin' using errcode = 'P0001'; end if;
    if p_au - p_du + 1 > 31 then raise exception 'periode_trop_longue : la période ne peut pas dépasser 31 jours' using errcode = 'P0001'; end if;
  elsif not exists (select 1 from dates_courtes_tournees t where t.id = p_tournee and t.site = v_site) then
    raise exception 'introuvable : tournée inconnue pour cette station' using errcode = 'P0001';
  end if;

  select count(*) into v_a_certifier from dates_courtes_tournees t where t.site = v_site and t.etat = 'TERMINEE_A_CERTIFIER';

  with tr as (
    select t.* from dates_courtes_tournees t
    where t.site = v_site
      and ((p_tournee is null and (t.saisi_le at time zone v_tz)::date between p_du and p_au) or t.id = p_tournee)
  ),
  rel as (
    select r.* from dates_courtes_releves r join tr on tr.id = r.tournee_id and tr.site = r.site
  ),
  an0 as (
    select r.tournee_id, r.id as releve_id, 'code_incomplet' as code from rel r where r.annule_le is null and r.ean ~ '^[0-9]{9,11}$'
    union all select r.tournee_id, r.id, 'code_logistique_provisoire' from rel r where r.annule_le is null and r.provisoire
    union all select r.tournee_id, r.id, 'article_texte_libre' from rel r where r.annule_le is null and r.nom_libre is not null
    union all select r.tournee_id, r.id, 'modifiee_apres_cloture' from rel r where r.annule_le is null and (r.rectification or r.recu_apres_cloture)
    union all select c.tournee_id, c.releve_id, 'modifiee_apres_cloture' from dates_courtes_corrections c
      join tr on tr.id = c.tournee_id and tr.site = c.site
      where c.annule_le is null and (c.rectification or c.recu_apres_cloture)
  ),
  -- Une paire (produit, anomalie) ne compte qu'une fois : liste et détail partagent ce compte.
  an_prod as (
    select distinct a.tournee_id, a.releve_id, a.code from an0 a
    where exists (select 1 from rel r where r.id = a.releve_id and r.annule_le is null)
  ),
  an_sans as (
    select distinct a.tournee_id, a.code from an0 a
    where not exists (select 1 from rel r where r.id = a.releve_id and r.annule_le is null)
  ),
  liste as (
    select tr.id,
           coalesce(tr.nom, 'Contrôle DLC · ' || coalesce(nullif(left(btrim(a.nom), 30), ''), 'équipe') || ' · ' || to_char(tr.saisi_le at time zone v_tz, 'DD/MM')) as nom,
           a.nom as auteur,
           tr.etat,
           to_char(tr.saisi_le at time zone v_tz, 'YYYY-MM-DD') as jour,
           to_char(tr.saisi_le at time zone v_tz, 'HH24:MI') as debut,
           to_char(tr.terminee_le at time zone v_tz, 'HH24:MI') as fin,
           tr.saisi_le,
           ea.nom as annulee_par, to_char(tr.annulee_le at time zone v_tz, 'HH24:MI') as annulee_a, tr.motif_annulation,
           (select count(*) from rel r where r.tournee_id = tr.id and r.annule_le is null) as produits,
           (select count(*) from an_prod where an_prod.tournee_id = tr.id) + (select count(*) from an_sans where an_sans.tournee_id = tr.id) as anomalies
    from tr left join employees a on a.id = tr.saisi_par left join employees ea on ea.id = tr.annulee_par
  )
  select case when p_tournee is null then
    jsonb_build_object(
      'a_certifier_total', v_a_certifier,
      'tournees', coalesce((select jsonb_agg(jsonb_build_object(
          'id', l.id, 'nom', l.nom, 'auteur', l.auteur, 'etat', l.etat, 'jour', l.jour, 'debut', l.debut, 'fin', l.fin,
          'produits', l.produits, 'anomalies', l.anomalies,
          'annulee_par', l.annulee_par, 'annulee_a', l.annulee_a, 'motif_annulation', l.motif_annulation)
        order by case l.etat when 'TERMINEE_A_CERTIFIER' then 1 when 'CORRECTION_DEMANDEE' then 2 when 'EN_COURS' then 3 when 'CERTIFIEE' then 4 else 5 end, l.saisi_le desc) from liste l), '[]'::jsonb))
  else
    (select jsonb_build_object(
      'tournee', jsonb_build_object('id', l.id, 'nom', l.nom, 'auteur', l.auteur, 'etat', l.etat, 'jour', l.jour, 'debut', l.debut, 'fin', l.fin,
                 'produits', l.produits, 'anomalies', l.anomalies,
                 'annulee_par', l.annulee_par, 'annulee_a', l.annulee_a, 'motif_annulation', l.motif_annulation),
      'produits', coalesce((select jsonb_agg(jsonb_build_object(
          'id', r.id, 'libelle', coalesce(r.nom_libre, r.libelle_vu, r.libelle_normalise, r.ean), 'ean', r.ean,
          'date_limite', r.date_limite, 'quantite', r.quantite,
          'anomalies', coalesce((select jsonb_agg(an_prod.code order by an_prod.code) from an_prod where an_prod.releve_id = r.id), '[]'::jsonb))
          order by r.date_limite, r.saisi_le) from rel r where r.tournee_id = l.id and r.annule_le is null), '[]'::jsonb),
      'anomalies_sans_produit', coalesce((select jsonb_agg(an_sans.code order by an_sans.code) from an_sans where an_sans.tournee_id = l.id), '[]'::jsonb),
      'historique', coalesce((select jsonb_agg(h order by h ->> 'le') from (
          select jsonb_build_object('type', 'commencee', 'le', tr.saisi_le, 'hhmm', l.debut, 'jour', l.jour, 'par', l.auteur) as h
          union all
          select jsonb_build_object('type', 'terminee', 'le', tr.terminee_le, 'hhmm', l.fin, 'jour', to_char(tr.terminee_le at time zone v_tz, 'YYYY-MM-DD'), 'par', e.nom)
            from employees e where e.id = tr.terminee_par and tr.terminee_le is not null
          union all
          select jsonb_build_object('type', 'annulee', 'le', tr.annulee_le, 'hhmm', l.annulee_a, 'jour', to_char(tr.annulee_le at time zone v_tz, 'YYYY-MM-DD'),
                 'par', l.annulee_par, 'motif', tr.motif_annulation) where tr.annulee_le is not null
          union all
          select jsonb_build_object('type', 'renommee', 'le', rn.renomme_le, 'hhmm', to_char(rn.renomme_le at time zone v_tz, 'HH24:MI'),
                 'jour', to_char(rn.renomme_le at time zone v_tz, 'YYYY-MM-DD'), 'par', e.nom, 'ancien', rn.ancien_nom, 'nouveau', rn.nouveau_nom)
            from dates_courtes_renommages_tournee rn left join employees e on e.id = rn.renomme_par where rn.tournee_id = tr.id and rn.site = v_site
          union all
          select jsonb_build_object('type', 'certifiee', 'le', c.certifiee_le, 'hhmm', to_char(c.certifiee_le at time zone v_tz, 'HH24:MI'),
                 'jour', to_char(c.certifiee_le at time zone v_tz, 'YYYY-MM-DD'), 'par', e.nom, 'observations', c.observations)
            from dates_courtes_certifications c left join employees e on e.id = c.certifiee_par where c.tournee_id = tr.id and c.site = v_site
          union all
          select jsonb_build_object('type', 'correction_demandee', 'le', d.demandee_le, 'hhmm', to_char(d.demandee_le at time zone v_tz, 'HH24:MI'),
                 'jour', to_char(d.demandee_le at time zone v_tz, 'YYYY-MM-DD'), 'par', e.nom, 'motif', d.motif, 'produits', cardinality(d.releves_vises), 'reponse', d.reponse)
            from dates_courtes_demandes_correction d left join employees e on e.id = d.demandee_par where d.tournee_id = tr.id and d.site = v_site
        ) x), '[]'::jsonb))
     from liste l join tr on tr.id = l.id)
  end into v_res;
  return v_res;
end $$;

revoke all on function dates_courtes_suivi_controles(date, date, uuid) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_suivi_controles(date, date, uuid) to authenticated;

comment on function dates_courtes_suivi_controles(date, date, uuid) is 'Dates courtes lot 3 : suivi des contrôles DLC pour la gestion de la station. Sans p_tournee : liste de la période (31 jours au plus) et nombre de tournées à certifier ; avec p_tournee : détail (produits, anomalies déduites du stocké, historique). security invoker, lecture seule. Lot B : état « Annulée » (auteur, heure, motif).';
