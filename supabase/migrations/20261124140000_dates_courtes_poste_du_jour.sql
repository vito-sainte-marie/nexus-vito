-- Dates courtes : le droit suit le POSTE DU JOUR, pas le poste préféré.
-- employees.role n'est que le poste préféré. Chaque jour l'employé choisit pompiste, caissière ou renfort (shifts.role, statut en_cours).
-- Renfort : ouvert. Caissière : seulement si l'accès caissier est ouvert pour la station. Pompiste : jamais.
-- Manager, gérant et créateur ne changent pas : dates_courtes_gestion() n'est pas touchée, aucun nouveau privilège.
-- Exception : on peut toujours terminer ou annuler SA PROPRE tournée EN_COURS, même après un changement de poste ou la fin du service.
-- shifts_role_check et la matrice des postes ne sont pas touchés.

-- 1. Poste du jour : 'pompiste' | 'caissiere' | 'renfort' | 'manager' | 'polyvalent' | null (aucun service en cours, compte inactif).
create or replace function dates_courtes_poste_du_jour() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select s.role from shifts s join employees e on e.id = s.employee_id
  where s.employee_id = auth.uid() and e.actif and s.statut = 'en_cours'
  order by s.created_at desc, s.id desc limit 1
$$;

-- 2. Accès caissier ouvert pour la station du compte (dernière ligne posée).
create or replace function dates_courtes_acces_caissier_ouvert() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select a.actif from dates_courtes_acces_caissier a
                    where a.site = (select e.site_id from employees e where e.id = auth.uid() and e.actif)
                    order by a.saisi_le desc, a.id desc limit 1), false)
$$;

-- 3. Peut opérer : gestion, OU renfort du jour, OU caissière du jour avec accès ouvert.
create or replace function dates_courtes_operer() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from employees e where e.id = auth.uid() and e.actif
      and (e.role in ('manager', 'gerant')
        or (e.est_createur and exists (select 1 from sites s where s.site_id = e.site_id and s.acces_createur_autorise))))
    or dates_courtes_poste_du_jour() = 'renfort'
    or (dates_courtes_poste_du_jour() = 'caissiere' and dates_courtes_acces_caissier_ouvert())
$$;

-- 4. Caissière du jour avec accès ouvert (gardée pour les appelants existants).
create or replace function dates_courtes_caissier_autorise() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select dates_courtes_poste_du_jour() = 'caissiere' and dates_courtes_acces_caissier_ouvert()
$$;

-- 5. Lecture de l'accès caissier : opérateurs, et caissière du jour (pour savoir si l'accès est ouvert).
drop policy if exists lecture_meme_site on dates_courtes_acces_caissier;
create policy lecture_meme_site on dates_courtes_acces_caissier for select to authenticated using (site = (select current_employee_site_id())
  and ((select dates_courtes_operer()) or (select dates_courtes_poste_du_jour()) = 'caissiere'));

-- 6. Terminer : exception pour sa propre tournée EN_COURS.
create or replace function dates_courtes_terminer_tournee(p_tournee uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_site text; t record; v_ver jsonb; v_propre boolean;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  v_site := current_employee_site_id();
  v_propre := v_site is not null and exists (select 1 from dates_courtes_tournees x
    where x.id = p_tournee and x.site = v_site and x.saisi_par = auth.uid() and x.etat = 'EN_COURS');
  if not (dates_courtes_operer() or dates_courtes_caissier_autorise() or v_propre) then
    raise exception 'droit_refuse : ce profil ne peut pas terminer de tournée de dates courtes' using errcode = 'P0001';
  end if;
  select * into t from dates_courtes_tournees x where x.id = p_tournee and x.site = v_site for update;
  if not found then raise exception 'introuvable : tournée inconnue pour cette station' using errcode = 'P0001'; end if;
  if t.saisi_par <> auth.uid() then
    raise exception 'tournee_interdite : on ne termine que sa propre tournée' using errcode = 'P0001';
  end if;
  v_ver := dates_courtes_version_tournee(p_tournee);
  if t.etat = 'EN_COURS' then
    update dates_courtes_tournees set etat = 'TERMINEE_A_CERTIFIER', terminee_par = auth.uid(), terminee_le = now(),
      version_empreinte = v_ver ->> 'empreinte', version_derniere_operation = v_ver ->> 'derniere_operation' where id = p_tournee;
    return jsonb_build_object('statut', 'terminee', 'etat', 'TERMINEE_A_CERTIFIER', 'version', v_ver);
  elsif t.etat = 'TERMINEE_A_CERTIFIER' then
    if t.version_empreinte is distinct from v_ver ->> 'empreinte' or t.version_derniere_operation is distinct from v_ver ->> 'derniere_operation' then
      update dates_courtes_tournees set version_empreinte = v_ver ->> 'empreinte', version_derniere_operation = v_ver ->> 'derniere_operation' where id = p_tournee;
    end if;
    return jsonb_build_object('statut', 'deja_terminee', 'etat', t.etat, 'version', v_ver);
  end if;
  raise exception 'etat_incompatible : la tournée est déjà % ', t.etat using errcode = 'P0001';
end $$;

-- 7. Annuler : exception pour sa propre tournée EN_COURS (le reste du corps est celui du lot B, inchangé).
create or replace function dates_courtes_annuler_tournee(p_tournee uuid, p_motif text, p_cle_idempotence text) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_site text; v_cle text; v_motif text; v_motif_ligne text; t record; v_nb integer := 0; v_gestion boolean; v_propre boolean;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  v_site := current_employee_site_id();
  if v_site is null then raise exception 'compte_inactif : compte inactif ou sans station' using errcode = 'P0001'; end if;
  v_gestion := dates_courtes_gestion();
  v_propre := exists (select 1 from dates_courtes_tournees x
    where x.id = p_tournee and x.site = v_site and x.saisi_par = auth.uid() and x.etat = 'EN_COURS');
  if not (v_gestion or dates_courtes_operer() or dates_courtes_caissier_autorise() or v_propre) then
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
  begin
    update dates_courtes_corrections c set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif_ligne
      where c.tournee_id = p_tournee and c.site = v_site and c.annule_le is null and c.delta < 0;
    update dates_courtes_corrections c set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif_ligne
      where c.tournee_id = p_tournee and c.site = v_site and c.annule_le is null;
    update dates_courtes_releves r set annule_le = now(), annule_par = auth.uid(), motif_annulation = v_motif_ligne
      where r.tournee_id = p_tournee and r.site = v_site and r.annule_le is null;
  exception when raise_exception then
    -- Un autre contrôle (une autre tournée) dépend de ces quantités : le plancher à zéro refuse. Tout est annulé, message clair.
    if sqlerrm like 'plancher_zero%' then
      raise exception 'plancher_zero : annulation impossible, un autre contrôle dépend des quantités de cette tournée' using errcode = 'P0001';
    end if;
    raise;
  end;
  update dates_courtes_tournees set etat = 'ANNULEE', annulee_le = now(), annulee_par = auth.uid(), motif_annulation = v_motif
    where id = p_tournee and site = v_site;
  return jsonb_build_object('statut', 'annulee', 'etat', 'ANNULEE', 'tournee_id', p_tournee, 'produits_annules', v_nb);
end $$;

-- 8. Droits : jamais anon, jamais public.
revoke all on function dates_courtes_poste_du_jour() from public, anon, authenticated, service_role;
grant execute on function dates_courtes_poste_du_jour() to authenticated;
revoke all on function dates_courtes_acces_caissier_ouvert() from public, anon, authenticated, service_role;
grant execute on function dates_courtes_acces_caissier_ouvert() to authenticated;
revoke all on function dates_courtes_operer() from public, anon, authenticated, service_role;
grant execute on function dates_courtes_operer() to authenticated;
revoke all on function dates_courtes_caissier_autorise() from public, anon, authenticated, service_role;
grant execute on function dates_courtes_caissier_autorise() to authenticated;
revoke all on function dates_courtes_terminer_tournee(uuid) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_terminer_tournee(uuid) to authenticated;
revoke all on function dates_courtes_annuler_tournee(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_annuler_tournee(uuid, text, text) to authenticated;

comment on function dates_courtes_poste_du_jour() is 'Dates courtes : poste choisi pour le service en cours du compte connecté (shifts.role, statut en_cours). Null sans service.';
comment on function dates_courtes_acces_caissier_ouvert() is 'Dates courtes : dernière ligne dates_courtes_acces_caissier de la station du compte connecté (actif ou non, faux par défaut).';
comment on function dates_courtes_operer() is 'Dates courtes : manager, gérant, créateur autorisé, OU renfort du jour, OU caissière du jour avec accès ouvert. employees.role n''est que le poste préféré. Pompiste : jamais.';
comment on function dates_courtes_caissier_autorise() is 'Dates courtes : caissière du jour (shifts.role) avec accès caissier ouvert pour la station.';
comment on function dates_courtes_terminer_tournee(uuid) is 'Dates courtes : termine sa propre tournée. Exception : on peut toujours terminer sa propre tournée EN_COURS, même après un changement de poste ou la fin du service.';
comment on function dates_courtes_annuler_tournee(uuid, text, text) is 'Dates courtes lot B : annule une tournée et tous ses produits (rien n''est supprimé). Auteur : sa tournée en cours, même après un changement de poste ; gestion : toute tournée non certifiée de la station. Motif 3 à 200 caractères obligatoire. Refus si une démarque active repose sur un produit de la tournée. Irréversible, idempotente, atomique.';
