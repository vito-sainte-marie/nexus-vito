-- FDJ Fiabilisation Étape 7 (18/08/2026) — voir NEXUS-Data-Dictionary-v2.md v2.146
alter table public.fdj_site_settings
  add column if not exists fenetre_acces_quart_min integer not null default 30;
