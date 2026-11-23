-- Dates courtes lot 3 : « Suivi des contrôles DLC » (lecture seule, gestion).
-- UNE fonction de lecture, deux modes : liste (sans p_tournee) et détail (avec p_tournee).
-- security invoker : la RLS existante (lecture_meme_site, lecture_gestion_meme_site, select_employees) s'applique ;
-- aucun nouvel octroi sur les tables, aucune écriture. Refus explicite hors dates_courtes_gestion().
-- Anomalies : uniquement celles qui se déduisent des données stockées. « Code ambigu » n'est pas stocké : non affiché.

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
           (select count(*) from rel r where r.tournee_id = tr.id and r.annule_le is null) as produits,
           (select count(*) from an_prod where an_prod.tournee_id = tr.id) + (select count(*) from an_sans where an_sans.tournee_id = tr.id) as anomalies
    from tr left join employees a on a.id = tr.saisi_par
  )
  select case when p_tournee is null then
    jsonb_build_object(
      'a_certifier_total', v_a_certifier,
      'tournees', coalesce((select jsonb_agg(jsonb_build_object(
          'id', l.id, 'nom', l.nom, 'auteur', l.auteur, 'etat', l.etat, 'jour', l.jour, 'debut', l.debut, 'fin', l.fin,
          'produits', l.produits, 'anomalies', l.anomalies)
        order by case l.etat when 'TERMINEE_A_CERTIFIER' then 1 when 'CORRECTION_DEMANDEE' then 2 when 'EN_COURS' then 3 else 4 end, l.saisi_le desc) from liste l), '[]'::jsonb))
  else
    (select jsonb_build_object(
      'tournee', jsonb_build_object('id', l.id, 'nom', l.nom, 'auteur', l.auteur, 'etat', l.etat, 'jour', l.jour, 'debut', l.debut, 'fin', l.fin,
                 'produits', l.produits, 'anomalies', l.anomalies),
      'produits', coalesce((select jsonb_agg(jsonb_build_object(
          'id', r.id, 'libelle', coalesce(r.nom_libre, r.libelle_normalise, r.libelle_vu, r.ean), 'ean', r.ean,
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

comment on function dates_courtes_suivi_controles(date, date, uuid) is 'Dates courtes lot 3 : suivi des contrôles DLC pour la gestion de la station. Sans p_tournee : liste de la période (31 jours au plus) et nombre de tournées à certifier ; avec p_tournee : détail (produits, anomalies déduites du stocké, historique). security invoker, lecture seule.';
