-- Storage : créer les buckets que le code utilise mais qu'aucune migration
-- ne créait (04/09/2026).
--
-- Constat lors de la première reconstruction complète de nexus-test : la
-- base rebâtie ne contenait qu'UN bucket sur les trois de la production.
-- `logos-sites` et `preuves-missions` avaient été créés à la main dans le
-- tableau de bord et n'existaient dans aucune migration — alors que le code
-- applicatif s'en sert : `storage.from('logos-sites')` pour le logo des
-- sites, et le bucket des preuves pour les photos de missions.
--
-- Sans cette migration, un environnement reconstruit laisse échouer tout
-- envoi de photo ou de justificatif — un défaut invisible tant qu'on ne
-- compare que le nombre de tables.
--
-- Les politiques d'accès de storage.objects, elles, étaient bien portées par
-- les migrations : les 9 politiques sont identiques entre production et base
-- reconstruite. Seuls les contenants manquaient.
--
-- Idempotente : `on conflict do nothing`, pour pouvoir être rejouée sans
-- effet sur un environnement où les buckets existent déjà.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos-sites',      'logos-sites',      true,  null, null),
  ('preuves-missions', 'preuves-missions', false, null, null)
on conflict (id) do nothing;
