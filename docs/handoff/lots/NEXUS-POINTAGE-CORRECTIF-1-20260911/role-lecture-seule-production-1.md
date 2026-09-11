# `nexus_prod_readonly` — créé, vérifié, et volontairement sans mot de passe

**11/09/2026.** Créé en Production sur autorisation explicite de Frédéric
Bragance. Aucune donnée métier modifiée, aucune migration, aucun déploiement.

## Pourquoi il ne peut pas encore se connecter

Le rôle est créé **`NOLOGIN`**. C'est délibéré : poser son mot de passe depuis
cette conversation le ferait transiter par un appel d'outil, donc par un
journal. La garantie 6 l'interdit sans réserve.

**Le mot de passe sera posé par Frédéric Bragance lui-même**, et je ne le
verrai jamais.

## Les garanties, mesurées et non déclarées

Vérifié sur **217 tables** des schémas `public`, `auth` et `storage` :

| droit | tables où le rôle l'a |
|---|---|
| INSERT | **0** |
| UPDATE | **0** |
| DELETE | **0** |
| TRUNCATE | **0** |
| SELECT | 5 tables entières + 2 en colonnes choisies |

| garantie | état |
|---|---|
| ni superutilisateur, ni `CREATEDB`, ni `CREATEROLE`, ni réplication | **oui** |
| membre d'aucun rôle | **oui** (`membre_de` nul) |
| propriétaire d'aucun objet | **oui** (0 objet) |
| ne contourne pas la RLS | **oui** (`rolbypassrls = false`) |
| transaction en lecture seule | **oui** (`default_transaction_read_only = on`) |
| `USAGE` sur le schéma `auth` | **non** |
| `USAGE` sur le schéma `storage` | **non** |
| `CREATE` dans `public` | **non** |
| lecture de `public.employees` (noms) | **non** |
| lecture de `pointages.photo_url` (URL signée) | **non** |

Un `statement_timeout` de 120 s est posé : un audit ne doit pas pouvoir
occuper Production indéfiniment.

## Ce qu'il peut lire, et rien d'autre

- `pointages` — uniquement `id, employee_id, site, date, type, heure, quart, retard_min, heure_debut_quart, photo_echec_technique`
- `shifts` — uniquement `id, employee_id, site, site_id, statut, quart, role, heure_debut, heure_fin, cloture_source`
- `sites`, `station_config`, `mission_catalog`, `advisor_rules`, `nexus_language_templates`

Ni noms, ni PIN, ni médias, ni URL signées, ni données `auth`.

## Ce qui reste à faire, et par qui

1. **Frédéric** pose le mot de passe :
   Supabase → projet Production → `Database` → `Roles` → `nexus_prod_readonly`,
   ou par SQL Editor. Le rôle doit passer `LOGIN`.
2. **Frédéric** dépose l'entrée `nexus-prod-db-readonly` dans son trousseau,
   contenant l'URL complète.
3. **Moi**, alors seulement : la garantie 7 — prouver qu'une écriture de
   contrôle est **refusée**, dans une transaction annulée aussitôt. Sans
   connexion, elle ne peut être ni tentée ni démontrée, et le mandat dit de
   s'arrêter là.
4. Puis la preuve du backfill et les six re-mesures.

**Tant que la garantie 7 n'est pas démontrée, aucune extraction n'a lieu.**
