-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821222616 · import_pipeline_publication_atomique
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ============================================================
-- Publication atomique (P0 technique de l'audit Import : "une coupure
-- réseau ne doit jamais laisser un import à moitié publié"). Chaque
-- fonction s'exécute comme une seule transaction Postgres — succès ou
-- rollback complet, jamais d'état intermédiaire visible.
--
-- SECURITY INVOKER (par défaut) : la RLS des tables cibles (products,
-- stock_releves, panier_moyen_quotidien, campagnes_nexus_imports)
-- continue de s'appliquer avec les droits réels de l'appelant — ces
-- fonctions ne contournent aucune permission, elles ne font que
-- garantir l'atomicité de plusieurs écritures liées.
-- ============================================================

create or replace function public.import_publier_ventes(p_batch_id uuid)
returns table(lignes_publiees integer)
language plpgsql
as $$
declare
  v_batch record;
  v_nb integer;
begin
  select * into v_batch from public.import_batches where id = p_batch_id;
  if not found then
    raise exception 'Import introuvable ou non accessible.';
  end if;
  if v_batch.intention not in ('ventes_catalogue','campagne') then
    raise exception 'Cette fonction ne publie que les intentions ventes_catalogue/campagne.';
  end if;
  if v_batch.statut <> 'ready' then
    raise exception 'Import non prêt à être publié (statut actuel : %).', v_batch.statut;
  end if;
  if v_batch.periode_debut is null or v_batch.periode_fin is null then
    raise exception 'Période manquante — publication impossible.';
  end if;

  update public.import_batches set statut = 'publishing' where id = p_batch_id;

  -- Remplacement propre de la période visée (même sémantique que
  -- l'écran actuel : un import = la vérité complète pour sa période).
  -- Les anciennes lignes ne sont pas perdues : elles restent tracées
  -- dans le batch précédent (import_rows_raw / import_row_results),
  -- jamais supprimées de l'historique d'import, seulement de la table
  -- de lecture courante "products".
  delete from public.products
    where site = v_batch.site and periode_debut = v_batch.periode_debut and periode_fin = v_batch.periode_fin;

  insert into public.products (site, periode_debut, periode_fin, categorie, article, code_barres, quantite, prix_achat, prix_vente, tva, ca, marge, imported_by)
  select
    v_batch.site, v_batch.periode_debut, v_batch.periode_fin,
    r.valeurs->>'categorie', r.valeurs->>'article', r.valeurs->>'code_barres',
    nullif(r.valeurs->>'quantite','')::numeric, nullif(r.valeurs->>'prix_achat','')::numeric, nullif(r.valeurs->>'prix_vente','')::numeric,
    nullif(r.valeurs->>'tva','')::numeric,
    coalesce(nullif(r.valeurs->>'ca','')::numeric, 0), coalesce(nullif(r.valeurs->>'marge','')::numeric, 0),
    v_batch.auteur_id
  from public.import_row_results r
  where r.batch_id = p_batch_id and r.statut not in ('rejetee');
  get diagnostics v_nb = row_count;

  if v_batch.intention = 'campagne' and v_batch.campagne_id is not null and v_batch.phase is not null then
    delete from public.campagnes_nexus_imports where campagne_id = v_batch.campagne_id and phase = v_batch.phase;
    insert into public.campagnes_nexus_imports (site, campagne_id, phase, periode_debut, periode_fin, importe_par)
    values (v_batch.site, v_batch.campagne_id, v_batch.phase, v_batch.periode_debut, v_batch.periode_fin, v_batch.auteur_id);
  end if;

  update public.import_batches set statut = 'published', publie_le = now() where id = p_batch_id;
  if v_batch.remplace_batch_id is not null then
    update public.import_batches set statut = 'superseded' where id = v_batch.remplace_batch_id and statut = 'published';
  end if;

  insert into public.import_audit_log (batch_id, site, action, employe_id, details)
    values (p_batch_id, v_batch.site, 'publication', v_batch.auteur_id, jsonb_build_object('lignes_publiees', v_nb, 'intention', v_batch.intention));

  return query select v_nb;
end;
$$;
comment on function public.import_publier_ventes is 'Publication atomique Ventes/Catalogue et Campagne vers products (+ campagnes_nexus_imports si campagne). Transaction unique : tout ou rien.';

create or replace function public.import_publier_stock(p_batch_id uuid)
returns table(lignes_publiees integer)
language plpgsql
as $$
declare
  v_batch record;
  v_nb integer;
begin
  select * into v_batch from public.import_batches where id = p_batch_id;
  if not found then raise exception 'Import introuvable ou non accessible.'; end if;
  if v_batch.intention <> 'stock_theorique' then raise exception 'Cette fonction ne publie que stock_theorique.'; end if;
  if v_batch.statut <> 'ready' then raise exception 'Import non prêt à être publié (statut actuel : %).', v_batch.statut; end if;
  if v_batch.date_releve is null then raise exception 'Date de relevé manquante — publication impossible.'; end if;

  update public.import_batches set statut = 'publishing' where id = p_batch_id;

  -- stock_releves est un historique de photos successives, jamais
  -- remplacé : chaque batch ajoute sa propre photo horodatée, comme le
  -- fait l'écran actuel.
  insert into public.stock_releves (site, releve_le, categorie, article, code_barres, quantite_theorique, importe_par)
  select
    v_batch.site,
    (v_batch.date_releve::timestamptz + (now()::time)),
    r.valeurs->>'categorie', r.valeurs->>'article', r.valeurs->>'code_barres',
    coalesce(nullif(r.valeurs->>'quantite_theorique','')::numeric, 0),
    v_batch.auteur_id
  from public.import_row_results r
  where r.batch_id = p_batch_id and r.statut not in ('rejetee','doublon_fichier');
  get diagnostics v_nb = row_count;

  update public.import_batches set statut = 'published', publie_le = now() where id = p_batch_id;

  insert into public.import_audit_log (batch_id, site, action, employe_id, details)
    values (p_batch_id, v_batch.site, 'publication', v_batch.auteur_id, jsonb_build_object('lignes_publiees', v_nb, 'intention', v_batch.intention));

  return query select v_nb;
end;
$$;
comment on function public.import_publier_stock is 'Publication atomique Stock instantané vers stock_releves (append, jamais de remplacement — cohérent avec le modèle historique de photos successives).';

create or replace function public.import_publier_panier(p_batch_id uuid)
returns table(lignes_publiees integer)
language plpgsql
as $$
declare
  v_batch record;
  v_nb integer;
begin
  select * into v_batch from public.import_batches where id = p_batch_id;
  if not found then raise exception 'Import introuvable ou non accessible.'; end if;
  if v_batch.intention <> 'panier_moyen' then raise exception 'Cette fonction ne publie que panier_moyen.'; end if;
  if v_batch.statut <> 'ready' then raise exception 'Import non prêt à être publié (statut actuel : %).', v_batch.statut; end if;

  update public.import_batches set statut = 'publishing' where id = p_batch_id;

  insert into public.panier_moyen_quotidien (site, date, nb_tickets, panier_moyen_ht, panier_moyen_ttc, importe_par)
  select
    v_batch.site, (r.valeurs->>'date')::date,
    coalesce(nullif(r.valeurs->>'nb_tickets','')::integer, 0),
    nullif(r.valeurs->>'panier_moyen_ht','')::numeric, nullif(r.valeurs->>'panier_moyen_ttc','')::numeric,
    v_batch.auteur_id
  from public.import_row_results r
  where r.batch_id = p_batch_id and r.statut not in ('rejetee','doublon_fichier')
  on conflict (site, date) do update set
    nb_tickets = excluded.nb_tickets,
    panier_moyen_ht = excluded.panier_moyen_ht,
    panier_moyen_ttc = excluded.panier_moyen_ttc,
    importe_par = excluded.importe_par,
    importe_le = now();
  get diagnostics v_nb = row_count;

  update public.import_batches set statut = 'published', publie_le = now() where id = p_batch_id;

  insert into public.import_audit_log (batch_id, site, action, employe_id, details)
    values (p_batch_id, v_batch.site, 'publication', v_batch.auteur_id, jsonb_build_object('lignes_publiees', v_nb, 'intention', v_batch.intention));

  return query select v_nb;
end;
$$;
comment on function public.import_publier_panier is 'Publication atomique Panier moyen vers panier_moyen_quotidien (upsert site+date, cohérent avec le comportement existant).';
