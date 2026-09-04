-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260801184423 · drop_employees_id_auth_users_fkey_for_vacataires
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- employees.id référençait auth.users(id) — cohérent pour les employés
-- réels (connectés à NEXUS), mais bloque la création automatique de
-- vacataires depuis l'import Google Sheets/Excel (01/08/2026) : un
-- vacataire repéré uniquement par son nom dans le classeur n'a et n'aura
-- jamais de compte Supabase Auth (il ne se connecte jamais à NEXUS), donc
-- toute tentative d'INSERT violait cette contrainte ("employees_id_fkey").
-- Confirmé en test réel : "Alex" (nouveau) échouait avec violation FK,
-- alors que "samantha" (employée existante, avec vrai compte Auth)
-- passait sans problème, puisqu'aucun INSERT n'était nécessaire pour elle.
-- Rien d'autre dans le code ne dépend de cette contrainte au niveau base
-- (les policies RLS comparent directement à auth.uid(), sans jointure via
-- cette FK) : la sécurité de connexion reste inchangée pour les employés
-- réels, seule la création de lignes "vacataire" sans compte est permise.
alter table public.employees
  drop constraint if exists employees_id_fkey;
