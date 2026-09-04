-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260818100734 · inventaire_comptages_idempotency_key
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Sprint 4bis — Réécriture Supabase par produit (17-18/08/2026)
-- Prépare l'écriture immédiate par produit (au lieu d'un lot final à la
-- validation) : chaque écriture porte une clé d'idempotence déterministe
-- (hash du contenu logique de l'événement), ce qui permet de réessayer
-- une écriture en toute sécurité après une coupure réseau sans jamais
-- créer de doublon fonctionnel. Colonne nullable et index partiel (ne
-- s'applique qu'aux nouvelles lignes qui la renseignent) : aucune ligne
-- historique n'est concernée ni cassée par cette migration, y compris les
-- lignes déjà en doublon naturel constatées avant cette migration (le
-- "dernier gagne" au tri par compte_le, déjà la convention de lecture
-- établie partout dans le projet, reste inchangée et gère ces doublons
-- historiques comme avant).
alter table public.inventaire_comptages
  add column if not exists idempotency_key uuid null;

create unique index if not exists inventaire_comptages_idempotency_key_uniq
  on public.inventaire_comptages (idempotency_key)
  where idempotency_key is not null;

comment on column public.inventaire_comptages.idempotency_key is
  'Clé déterministe (hash du contenu : quart+produit+type+valeur) posée côté client à l''écriture immédiate par produit (Sprint 4bis, 18/08/2026). Permet un retry réseau sûr via ON CONFLICT DO NOTHING (jamais un UPDATE — la table reste append-only, aucune policy RLS UPDATE n''existe et ne doit pas être ajoutée). NULL pour toutes les lignes historiques et pour les écritures qui ne passent pas par ce mécanisme (mouvements en lot, corrections manager).';
