-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831233738 · preserver_releve_ouverture_lors_reception
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.nexus_preserver_releve_ouverture_lors_reception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.origine <> 'reception_livraison' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Une réception ne crée jamais à elle seule un faux relevé d'ouverture.
    -- La preuve physique reste dans les tables carburant_reception_*.
    return null;
  end if;

  -- Sur un UPSERT d'une réception le même jour qu'un jaugeage d'ouverture,
  -- on conserve la sémantique du relevé d'ouverture. Le version_num reçu est
  -- volontairement conservé afin que la prochaine correction ne réutilise
  -- jamais un numéro déjà présent dans carburant_releve_versions.
  new.stock_reel_go_cuve1 := old.stock_reel_go_cuve1;
  new.stock_reel_go_cuve2 := old.stock_reel_go_cuve2;
  new.stock_reel_sp95 := old.stock_reel_sp95;
  new.stock_reel_gnr := old.stock_reel_gnr;
  new.livraison_go := old.livraison_go;
  new.livraison_sp95 := old.livraison_sp95;
  new.livraison_gnr := old.livraison_gnr;
  new.mouvement_go := old.mouvement_go;
  new.mouvement_sp95 := old.mouvement_sp95;
  new.mouvement_gnr := old.mouvement_gnr;
  new.motif_mouvement := old.motif_mouvement;
  new.commentaire := old.commentaire;
  new.saisi_par := old.saisi_par;
  new.origine := old.origine;
  new.mesure_le := old.mesure_le;
  new.controle_statut := old.controle_statut;

  return new;
end;
$$;

revoke all on function public.nexus_preserver_releve_ouverture_lors_reception() from public;

drop trigger if exists trg_preserver_releve_ouverture_lors_reception on public.carburant_releves;
create trigger trg_preserver_releve_ouverture_lors_reception
before insert or update on public.carburant_releves
for each row
when (new.origine = 'reception_livraison')
execute function public.nexus_preserver_releve_ouverture_lors_reception();
