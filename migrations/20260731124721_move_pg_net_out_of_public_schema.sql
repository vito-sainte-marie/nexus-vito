-- pg_net n'est pas encore utilisé (réservé à un futur connecteur HTTP sortant) —
-- le déplacer hors du schéma public par hygiène, signalé par l'audit sécurité.
drop extension if exists pg_net;
create extension if not exists pg_net schema extensions;
