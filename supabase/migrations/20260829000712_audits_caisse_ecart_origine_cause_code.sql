-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260829000712 · audits_caisse_ecart_origine_cause_code
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 28/08/2026, v2.268 — "Analyse des écarts" (cadrage Frédéric) : audits_caisse
-- n'avait ni écart initial immuable ni motif structuré, contrairement à
-- fdj_cash_controls (ecart_origine/motif_ecart, v2.266/v2.267). Additif
-- uniquement, aucune colonne existante touchée.
alter table audits_caisse
  add column if not exists ecart_piste_origine numeric,
  add column if not exists ecart_boutique_origine numeric,
  add column if not exists cause_code_piste text,
  add column if not exists cause_code_boutique text;

comment on column audits_caisse.ecart_piste_origine is 'Écart piste constaté à la toute première écriture de ce quart (site,date,quart) — jamais réécrit ensuite, y compris par une resaisie employé ou une régularisation manager. Constat d''origine, voir NEXUS-Verify-v1.html.';
comment on column audits_caisse.ecart_boutique_origine is 'Écart boutique constaté à la toute première écriture de ce quart — jamais réécrit ensuite. Même règle que ecart_piste_origine.';
comment on column audits_caisse.cause_code_piste is 'Motif structuré de l''écart piste (menu réduit si écart ramené à 0, ''non_explique'' automatique si l''écart persiste) — distinct du commentaire libre commentaire_validation_piste.';
comment on column audits_caisse.cause_code_boutique is 'Motif structuré de l''écart boutique — même principe que cause_code_piste.';
