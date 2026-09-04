-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831141635 · inventaire_conditionnement_auto_depuis_designation_et_import
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.nexus_inventaire_detecter_conditionnement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texte text;
  v_match text[];
  v_facteur integer;
begin
  if new.facteur_conditionnement is not null and new.facteur_conditionnement > 0 then
    return new;
  end if;

  v_texte := coalesce(new.designation, '');

  if new.code_barres is not null then
    select p.article
      into v_texte
    from public.products p
    where p.site = new.site
      and p.code_barres = new.code_barres
      and p.article is not null
    order by p.imported_at desc nulls last, p.periode_fin desc nulls last
    limit 1;

    v_texte := coalesce(v_texte, new.designation, '');
  end if;

  -- Formats reconnus : -10P / 10P et -P10 / P10 en fin de désignation.
  v_match := regexp_match(v_texte, '(?:^|[[:space:]_-])([0-9]{1,3})[[:space:]]*P[[:space:]]*$','i');
  if v_match is null then
    v_match := regexp_match(v_texte, '(?:^|[[:space:]_-])P[[:space:]]*([0-9]{1,3})[[:space:]]*$','i');
  end if;

  if v_match is not null then
    v_facteur := v_match[1]::integer;
    if v_facteur > 0 then
      new.facteur_conditionnement := v_facteur;
      new.conditionnement_source := case when new.code_barres is not null then 'designation_decenium' else 'designation_produit' end;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_inventaire_detecter_conditionnement on public.inventaire_zone_produit;
create trigger trg_inventaire_detecter_conditionnement
before insert or update of designation, code_barres, facteur_conditionnement
on public.inventaire_zone_produit
for each row
execute function public.nexus_inventaire_detecter_conditionnement();
