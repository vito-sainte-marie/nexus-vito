-- Rougit : AUTRESITE NONAUTORISE QDEUXSIX
-- Débranche l'isolation par site et par employé des audits Verify.
alter table public.audits_caisse disable row level security;
