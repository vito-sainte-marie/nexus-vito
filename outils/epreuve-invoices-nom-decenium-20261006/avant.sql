-- Témoin : base à 20261005180000, AVANT la migration. Fixtures conservées
-- (commit) pour être relues après. Comptes fictifs : deux comptes distincts
-- qui partagent un e-mail, comme VERT PRE … / VERT PRE … DIVERS.
\set ON_ERROR_STOP 1
insert into public.sites(site_id, nom_entreprise, timezone) values ('site-decenium', 'Épreuve', 'Indian/Reunion');
insert into public.billing_periods(id, site, mois, annee) values ('00000000-0000-0000-0000-00000000b001', 'site-decenium', 9, 2026);
insert into public.clients(id, site, raison_sociale) values
  ('00000000-0000-0000-0000-00000000c001', 'site-decenium', 'VERT PRE Exemple'),
  ('00000000-0000-0000-0000-00000000c002', 'site-decenium', 'VERT PRE Exemple DIVERS');
-- Une ligne par valeur historique, plus NULL.
insert into public.invoices(billing_period_id, client_id, fichier_hash, methode_identification, statut)
select '00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000c001', 'h-' || coalesce(m, 'null'), m, 'identifiee'
from unnest(array['code_client','raison_sociale','siret','contenu','email','historique','manuel', null]) as m;
\unset ON_ERROR_STOP
do $$ begin
  insert into public.invoices(billing_period_id, client_id, fichier_hash, methode_identification, confiance_identification, statut)
  values ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000c002', 'h-decenium-avant', 'nom_decenium', 0.90, 'identifiee');
  raise exception 'ÉCHEC TEMOIN : nom_decenium accepté avant la migration';
exception when check_violation then
  if sqlerrm like '%invoices_methode_identification_check%' then raise notice 'OK TEMOIN'; else raise; end if;
end $$;
