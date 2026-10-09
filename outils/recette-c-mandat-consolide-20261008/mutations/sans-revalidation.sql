-- Rougit : QDEUXSEPT
-- Débranche le drapeau « nouvelle validation requise » (B5).
alter table public.audits_caisse disable trigger trg_audits_caisse_revalidation;
