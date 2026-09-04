-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821223005 · import_publier_stock_exclure_identiques
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Correctif I02 (audit Import) : stock_releves est un append-only sans
-- contrainte d'unicité — republier le même fichier pour la même date
-- créerait de vrais doublons physiques. On exclut désormais aussi les
-- lignes 'connue_identique' (déjà représentées à l'identique par un
-- relevé antérieur pour cette même date) de l'insertion. 'connue_modifiee'
-- reste insérée (nouvelle valeur réelle à cette date, ajout au
-- classicorique le "photo successive", jamais un remplacement silencieux).
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

  insert into public.stock_releves (site, releve_le, categorie, article, code_barres, quantite_theorique, importe_par)
  select
    v_batch.site,
    (v_batch.date_releve::timestamptz + (now()::time)),
    r.valeurs->>'categorie', r.valeurs->>'article', r.valeurs->>'code_barres',
    coalesce(nullif(r.valeurs->>'quantite_theorique','')::numeric, 0),
    v_batch.auteur_id
  from public.import_row_results r
  where r.batch_id = p_batch_id and r.statut not in ('rejetee','doublon_fichier','connue_identique');
  get diagnostics v_nb = row_count;

  update public.import_batches set statut = 'published', publie_le = now() where id = p_batch_id;

  insert into public.import_audit_log (batch_id, site, action, employe_id, details)
    values (p_batch_id, v_batch.site, 'publication', v_batch.auteur_id, jsonb_build_object('lignes_publiees', v_nb, 'intention', v_batch.intention));

  return query select v_nb;
end;
$$;
comment on function public.import_publier_stock is 'Publication atomique Stock instantané vers stock_releves (append). Exclut connue_identique/doublon_fichier/rejetee pour garantir l''idempotence (I02) malgré l''absence de contrainte d''unicité sur stock_releves.';
alter function public.import_publier_stock(uuid) set search_path = public;
