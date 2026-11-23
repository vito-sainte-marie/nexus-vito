-- Dates courtes, normalisation GTIN-14 des codes-barres (rapprochement seulement).
-- Additif : une fonction de calcul pure, et deux fonctions existantes reprises (meme signature, memes droits).
-- Aucune table, aucune colonne, aucune ligne touchee. Les cles historiques (cle_article, dates_courtes_cle_canonique,
-- dates_courtes_cle_groupe) et dates_courtes_normaliser_ean ne changent pas : le GTIN-14 sert a rapprocher, jamais a reecrire.
-- Retour arriere : docs/deploiement/retour-arriere-dates-courtes-gtin14-20261123.sql.

do $prerequis$
declare v_manque text[] := '{}'; v_n text;
begin
  if to_regclass('public.products') is null then v_manque := v_manque || 'products'; end if;
  if to_regclass('public.inventaire_ventes_import') is null then v_manque := v_manque || 'inventaire_ventes_import'; end if;
  foreach v_n in array array['dates_courtes_operer()', 'dates_courtes_caissier_autorise()', 'dates_courtes_normaliser_ean(text)',
    'dates_courtes_normaliser_libelle(text)', 'dates_courtes_prix_article(text,text,text,date)', 'dates_courtes_rechercher_produit(text,integer)'] loop
    if to_regprocedure('public.' || v_n) is null then v_manque := v_manque || v_n; end if;
  end loop;
  if array_length(v_manque, 1) is not null then
    raise exception 'prerequis_migrations : 20261121120000, 20261122120000, 20261122140000 : objets absents : %', array_to_string(v_manque, ', ') using errcode = 'P0001';
  end if;
end $prerequis$;

-- 1. gtin14 : forme commune de rapprochement. Chiffres seuls (espaces de bordure retires, toute lettre ou espace interne refuse),
-- longueurs 8, 12, 13 ou 14 seulement, completee a gauche par des zeros, cle mod-10 controlee. Sinon null.
-- 9, 10 et 11 chiffres ne sont jamais completes : un code incomplet n'est jamais pris pour un GTIN.
create or replace function gtin14(p_code text) returns text
language plpgsql immutable set search_path = public, pg_temp as $$
declare v_t text; v_g text; v_somme integer := 0; v_i integer;
begin
  v_t := btrim(coalesce(p_code, ''));
  if v_t !~ '^[0-9]+$' or length(v_t) not in (8, 12, 13, 14) then return null; end if;
  v_g := lpad(v_t, 14, '0');
  for v_i in 1..13 loop
    v_somme := v_somme + substr(v_g, v_i, 1)::integer * case when v_i % 2 = 1 then 3 else 1 end;
  end loop;
  if ((10 - v_somme % 10) % 10) <> right(v_g, 1)::integer then return null; end if;
  return v_g;
end $$;

-- 2. Recherche de produit : un code est cherche par GTIN-14 (en plus de l'ancienne forme). Une ligne par article distinct
-- (libelle normalise) : si plusieurs articles de la station portent le meme GTIN-14, ils sont tous renvoyes et la page
-- demande un choix manuel, rien n'est rapproche automatiquement. ean = forme EAN-13 a conserver (0 + 12 chiffres d'un UPC-A,
-- 13 derniers chiffres d'un GTIN-14 commencant par 0, 8 chiffres d'un GTIN-8) ; null pour un GTIN-14 logistique (n'ayant pas de zero initial).
create or replace function dates_courtes_rechercher_produit(p_requete text, p_limite integer default 20)
returns table (libelle text, ean text, rayon text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_site text; v_q text; v_g text; v_ean text; v_lim integer;
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
  v_g := gtin14(v_q);
  v_ean := dates_courtes_normaliser_ean(v_q);
  if v_g is not null or v_ean is not null then
    return query
      select s.libelle, s.ean, s.rayon from (
        select distinct on (dates_courtes_normaliser_libelle(c.article))
          c.article::text as libelle, c.ean, c.categorie::text as rayon
        from (
          select p.article, p.categorie, p.periode_fin, p.imported_at,
            coalesce(case when gtin14(p.code_barres) like '000000%' then right(gtin14(p.code_barres), 8)
                          when gtin14(p.code_barres) like '0%' then right(gtin14(p.code_barres), 13) end,
                     dates_courtes_normaliser_ean(p.code_barres)) as ean
          from products p
          where p.site = v_site and nullif(btrim(p.article), '') is not null
            and ((v_g is not null and gtin14(p.code_barres) = v_g)
              or (v_ean is not null and dates_courtes_normaliser_ean(p.code_barres) = v_ean))) c
        order by dates_courtes_normaliser_libelle(c.article), c.periode_fin desc, c.imported_at desc nulls last) s
      order by s.libelle
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

-- 3. Prix d'un article : le code est compare aussi par GTIN-14. Si le GTIN-14 du code designe plusieurs articles distincts
-- de la station (libelles normalises differents), la comparaison par code est abandonnee : pas de prix pris au hasard,
-- seul le libelle (s'il est donne) peut rapprocher.
create or replace function dates_courtes_prix_article(p_site text, p_ean text, p_libelle text, p_date date)
returns table (prix_achat numeric, prix_vente numeric, source text, periode_debut date, periode_fin date)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_g text := gtin14(p_ean); v_ean_p text := p_ean; v_ean_i text := p_ean;
begin
  if v_g is not null then
    if (select count(distinct dates_courtes_normaliser_libelle(p.article)) from products p
        where p.site = p_site and gtin14(p.code_barres) = v_g) > 1 then v_ean_p := null; end if;
    if (select count(distinct dates_courtes_normaliser_libelle(v.designation_brute)) from inventaire_ventes_import v
        where v.site = p_site and gtin14(v.code_barres_brut) = v_g) > 1 then v_ean_i := null; end if;
  end if;
  return query
    select p.prix_achat::numeric, nullif(p.prix_vente, 0)::numeric, 'products'::text, p.periode_debut::date, p.periode_fin::date
    from products p
    where p.site = p_site and p.prix_achat > 0 and p.periode_debut <= p_date
      and ((v_ean_p is not null and (dates_courtes_normaliser_ean(p.code_barres) = v_ean_p or (v_g is not null and gtin14(p.code_barres) = v_g)))
        or (p_libelle is not null and dates_courtes_normaliser_libelle(p.article) = p_libelle))
    order by (p.periode_fin >= p_date) desc, p.periode_fin desc, p.imported_at desc nulls last
    limit 1;
  if found then return; end if;
  return query
    select v.prix_achat_ht::numeric, nullif(v.prix_vente_ht, 0)::numeric, 'inventaire_ventes_import'::text, null::date, null::date
    from inventaire_ventes_import v
    where v.site = p_site and v.prix_achat_ht > 0 and v.importe_le::date <= p_date
      and ((v_ean_i is not null and (dates_courtes_normaliser_ean(v.code_barres_brut) = v_ean_i or (v_g is not null and gtin14(v.code_barres_brut) = v_g)))
        or (p_libelle is not null and dates_courtes_normaliser_libelle(v.designation_brute) = p_libelle))
    order by v.importe_le desc
    limit 1;
end $$;

revoke all on function gtin14(text) from public, anon, authenticated, service_role;
revoke all on function dates_courtes_rechercher_produit(text, integer) from public, anon, authenticated, service_role;
grant execute on function dates_courtes_rechercher_produit(text, integer) to authenticated;
revoke all on function dates_courtes_prix_article(text, text, text, date) from public, anon, authenticated, service_role;

comment on function gtin14(text) is 'Forme GTIN-14 de rapprochement (8, 12, 13 ou 14 chiffres, cle mod-10 controlee), null sinon. Ne reecrit jamais un code stocke.';
comment on function dates_courtes_rechercher_produit(text, integer) is 'Lot 2 + GTIN-14 : recherche de produit (libellé, EAN-13 à conserver, rayon). Un code qui désigne plusieurs articles les renvoie tous (choix manuel). Site lu depuis le compte, aucun prix ni vente.';
comment on function dates_courtes_prix_article(text, text, text, date) is 'Lot 5 + GTIN-14 : prix d''un article. Un GTIN-14 qui désigne plusieurs articles distincts de la station ne rapproche rien par le code.';
