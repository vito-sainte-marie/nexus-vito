-- NEXUS Carburants — sécurité P0
-- Ces fonctions SECURITY DEFINER sont des fonctions de trigger uniquement.
-- Elles ne doivent jamais être appelables directement depuis PostgREST/RPC.

revoke execute on function public.nexus_journaliser_anomalie_reception_mesuree() from anon, authenticated;
revoke execute on function public.nexus_preserver_releve_ouverture_lors_reception() from anon, authenticated;
