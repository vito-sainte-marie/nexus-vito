-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260901011059 · normaliser_ecarts_verify_aux_centimes
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.nexus_normaliser_ecarts_caisse_aux_centimes()
returns trigger
language plpgsql
as $$
begin
  new.ecart_piste := case when new.ecart_piste is null then null else round(new.ecart_piste, 2) end;
  new.ecart_boutique := case when new.ecart_boutique is null then null else round(new.ecart_boutique, 2) end;
  new.ecart_total := case when new.ecart_total is null then null else round(new.ecart_total, 2) end;
  new.ecart_piste_valide := case when new.ecart_piste_valide is null then null else round(new.ecart_piste_valide, 2) end;
  new.ecart_boutique_valide := case when new.ecart_boutique_valide is null then null else round(new.ecart_boutique_valide, 2) end;
  new.ecart_piste_origine := case when new.ecart_piste_origine is null then null else round(new.ecart_piste_origine, 2) end;
  new.ecart_boutique_origine := case when new.ecart_boutique_origine is null then null else round(new.ecart_boutique_origine, 2) end;
  return new;
end;
$$;

drop trigger if exists trg_normaliser_ecarts_caisse_aux_centimes on public.audits_caisse;
create trigger trg_normaliser_ecarts_caisse_aux_centimes
before insert or update on public.audits_caisse
for each row execute function public.nexus_normaliser_ecarts_caisse_aux_centimes();

update public.audits_caisse
set ecart_piste = case when ecart_piste is null then null else round(ecart_piste, 2) end,
    ecart_boutique = case when ecart_boutique is null then null else round(ecart_boutique, 2) end,
    ecart_total = case when ecart_total is null then null else round(ecart_total, 2) end,
    ecart_piste_valide = case when ecart_piste_valide is null then null else round(ecart_piste_valide, 2) end,
    ecart_boutique_valide = case when ecart_boutique_valide is null then null else round(ecart_boutique_valide, 2) end,
    ecart_piste_origine = case when ecart_piste_origine is null then null else round(ecart_piste_origine, 2) end,
    ecart_boutique_origine = case when ecart_boutique_origine is null then null else round(ecart_boutique_origine, 2) end
where (ecart_piste is not null and ecart_piste <> round(ecart_piste, 2))
   or (ecart_boutique is not null and ecart_boutique <> round(ecart_boutique, 2))
   or (ecart_total is not null and ecart_total <> round(ecart_total, 2))
   or (ecart_piste_valide is not null and ecart_piste_valide <> round(ecart_piste_valide, 2))
   or (ecart_boutique_valide is not null and ecart_boutique_valide <> round(ecart_boutique_valide, 2))
   or (ecart_piste_origine is not null and ecart_piste_origine <> round(ecart_piste_origine, 2))
   or (ecart_boutique_origine is not null and ecart_boutique_origine <> round(ecart_boutique_origine, 2));
