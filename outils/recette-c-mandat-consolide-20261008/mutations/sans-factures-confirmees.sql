-- Rougit : QDEUXSIX
-- Débranche le calcul serveur des factures différées confirmées (B4).
alter table public.audits_caisse disable trigger trg_audits_caisse_factures_differees;
