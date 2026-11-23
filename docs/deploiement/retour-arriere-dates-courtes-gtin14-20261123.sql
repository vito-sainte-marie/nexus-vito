-- Retour arriere de 20261123100000_dates_courtes_gtin14.sql.
-- Restaure les corps de dates_courtes_rechercher_produit (lot 2, 20261122140000) et dates_courtes_prix_article (lot 5, 20261122120000),
-- puis retire gtin14(text). Aucune donnee n'a ete ecrite par la migration : rien a restaurer cote tables.
begin;

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

create or replace function dates_courtes_prix_article(p_site text, p_ean text, p_libelle text, p_date date)
returns table (prix_achat numeric, prix_vente numeric, source text, periode_debut date, periode_fin date)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  return query
    select p.prix_achat::numeric, nullif(p.prix_vente, 0)::numeric, 'products'::text, p.periode_debut::date, p.periode_fin::date
    from products p
    where p.site = p_site and p.prix_achat > 0 and p.periode_debut <= p_date
      and ((p_ean is not null and dates_courtes_normaliser_ean(p.code_barres) = p_ean)
        or (p_libelle is not null and dates_courtes_normaliser_libelle(p.article) = p_libelle))
    order by (p.periode_fin >= p_date) desc, p.periode_fin desc, p.imported_at desc nulls last
    limit 1;
  if found then return; end if;
  return query
    select v.prix_achat_ht::numeric, nullif(v.prix_vente_ht, 0)::numeric, 'inventaire_ventes_import'::text, null::date, null::date
    from inventaire_ventes_import v
    where v.site = p_site and v.prix_achat_ht > 0 and v.importe_le::date <= p_date
      and ((p_ean is not null and dates_courtes_normaliser_ean(v.code_barres_brut) = p_ean)
        or (p_libelle is not null and dates_courtes_normaliser_libelle(v.designation_brute) = p_libelle))
    order by v.importe_le desc
    limit 1;
end $$;

revoke all on function dates_courtes_rechercher_produit(text, integer) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_rechercher_produit(text, integer) to authenticated;
revoke all on function dates_courtes_prix_article(text, text, text, date) from public, anon, authenticated, service_role;
drop function if exists gtin14(text);

commit;
