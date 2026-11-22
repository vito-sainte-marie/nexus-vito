-- Retour arrière du lot 2.1 Dates courtes (nom de tournée généré, renommage tracé).
-- Rétablit dates_courtes_creer_tournee tel que défini par 20261121120000 : relancer d'abord ce corps, puis supprimer les objets du lot 2.1.
-- ATTENTION : supprime la trace des renommages. Les noms déjà inscrits dans dates_courtes_tournees.nom restent (aucune ligne réécrite).
begin;
drop function if exists dates_courtes_lire_tournees(uuid, text[]);
drop function if exists dates_courtes_renommer_tournee(uuid, text, text);
drop table if exists dates_courtes_renommages_tournee;
drop function if exists dates_courtes_renommage_immuable();
-- Fonction de création d'origine (lot 1) : security invoker, nom libre facultatif.
create or replace function dates_courtes_creer_tournee(p_nom text, p_cle_idempotence text) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_temp as $$
declare v_site text; v_id uuid; v_nom text := nullif(btrim(coalesce(p_nom, '')), ''); v_cle text;
begin
  if auth.uid() is null then raise exception 'non_authentifie : connexion requise' using errcode = 'P0001'; end if;
  if not (dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : ce profil ne peut pas créer de tournée de dates courtes' using errcode = 'P0001';
  end if;
  if p_cle_idempotence is null or length(btrim(p_cle_idempotence)) not between 1 and 100 then
    raise exception 'cle_idempotence_requise : clé d''idempotence de 1 à 100 caractères' using errcode = 'P0001';
  end if;
  if v_nom is not null and char_length(v_nom) > 100 then
    raise exception 'valeur_invalide : nom de 100 caractères au plus' using errcode = 'P0001';
  end if;
  v_site := current_employee_site_id(); v_cle := btrim(p_cle_idempotence);
  perform pg_advisory_xact_lock(hashtextextended(v_site || '|tournee|' || v_cle, 0));
  select t.id into v_id from dates_courtes_tournees t where t.site = v_site and t.cle_idempotence = v_cle;
  if found then return jsonb_build_object('statut', 'deja_enregistre', 'tournee_id', v_id); end if;
  begin
    insert into dates_courtes_tournees (site, nom, cle_idempotence) values (v_site, v_nom, v_cle) returning id into v_id;
  exception when unique_violation then
    raise exception 'cle_deja_utilisee : cette clé d''idempotence appartient à une autre tournée' using errcode = 'P0001';
  end;
  return jsonb_build_object('statut', 'cree', 'tournee_id', v_id);
end $$;
drop function if exists dates_courtes_nom_genere(text, uuid, timestamptz);
commit;
