-- Le simulateur ne doit être déclenchable que par pg_cron (rôle postgres) —
-- jamais directement par un client anon/authenticated.
revoke all on function public.nexus_simulate_cash_sale(text) from public, anon, authenticated;
