-- Dates courtes, lot 2 : recherche de produit pour la page de relevé des employés.
-- Ajout seul : une fonction de lecture. Aucune table touchée, aucun droit élargi sur products.
-- Elle ne renvoie que le libellé, l'EAN et le rayon : jamais de prix, de vente, de marge ni de quantité.
-- Retour arrière : docs/deploiement/retour-arriere-dates-courtes-lot2-20261122.sql.

do $prerequis$
declare v_manque text[] := '{}'; v_n text;
begin
  if to_regclass('public.products') is null then v_manque := v_manque || 'products'; end if;
  foreach v_n in array array['dates_courtes_operer()', 'dates_courtes_caissier_autorise()', 'dates_courtes_normaliser_ean(text)', 'dates_courtes_normaliser_libelle(text)'] loop
    if to_regprocedure('public.' || v_n) is null then v_manque := v_manque || v_n; end if;
  end loop;
  if array_length(v_manque, 1) is not null then
    raise exception 'prerequis_migrations : 20261121120000 : objets absents : %', array_to_string(v_manque, ', ') using errcode = 'P0001';
  end if;
end $prerequis$;

-- Recherche par EAN (exact, forme normalisée) ou par morceau de nom (au moins 2 caractères, casse ignorée).
-- Site lu depuis le compte, jamais en paramètre. Un article par EAN (ou par libellé normalisé s'il n'a pas d'EAN), au plus 20 lignes.
create or replace function dates_courtes_rechercher_produit(p_requete text, p_limite integer default 20)
returns table (libelle text, ean text, rayon text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_site text; v_q text; v_ean text; v_lim integer;
begin
  if auth.uid() is null then
    raise exception 'non_authentifie : connexion requise' using errcode = 'P0001';
  end if;
  select e.site_id into v_site from employees e where e.id = auth.uid() and e.actif;
  if v_site is null then
    raise exception 'compte_inactif : compte inactif ou sans station' using errcode = 'P0001';
  end if;
  if not (dates_courtes_operer() or dates_courtes_caissier_autorise()) then
    raise exception 'droit_refuse : la recherche de produit est réservée aux employés habilités' using errcode = 'P0001';
  end if;
  v_q := btrim(coalesce(p_requete, ''));
  if length(v_q) < 2 then return; end if;
  v_lim := greatest(1, least(coalesce(p_limite, 20), 20));
  v_ean := dates_courtes_normaliser_ean(v_q);
  if v_ean is not null then
    return query
      select s.libelle, s.ean, s.rayon from (
        select distinct on (dates_courtes_normaliser_ean(p.code_barres))
          p.article::text as libelle, dates_courtes_normaliser_ean(p.code_barres) as ean, p.categorie::text as rayon
        from products p
        where p.site = v_site and dates_courtes_normaliser_ean(p.code_barres) = v_ean and nullif(btrim(p.article), '') is not null
        order by dates_courtes_normaliser_ean(p.code_barres), p.periode_fin desc, p.imported_at desc nulls last) s
      limit v_lim;
    return;
  end if;
  return query
    select s.libelle, s.ean, s.rayon from (
      select distinct on (coalesce(dates_courtes_normaliser_ean(p.code_barres), dates_courtes_normaliser_libelle(p.article)))
        p.article::text as libelle, dates_courtes_normaliser_ean(p.code_barres) as ean, p.categorie::text as rayon
      from products p
      where p.site = v_site and nullif(btrim(p.article), '') is not null
        and dates_courtes_normaliser_libelle(p.article) like '%' || replace(replace(replace(dates_courtes_normaliser_libelle(v_q), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      order by coalesce(dates_courtes_normaliser_ean(p.code_barres), dates_courtes_normaliser_libelle(p.article)), p.periode_fin desc, p.imported_at desc nulls last) s
    order by s.libelle
    limit v_lim;
end $$;

revoke all on function dates_courtes_rechercher_produit(text, integer) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_rechercher_produit(text, integer) to authenticated;

comment on function dates_courtes_rechercher_produit(text, integer) is 'Lot 2 : recherche de produit (libellé, EAN, rayon) pour la page de relevé. Site lu depuis le compte, employés habilités seulement, aucun prix ni vente.';
