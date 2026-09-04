# Migrations NEXUS

Ce dossier contient l'historique **complet** des migrations appliquées à la
base de production, récupéré le 04/09/2026.

## Pourquoi cette récupération

Le dépôt ne contenait que **47 fichiers** alors que Supabase avait enregistré
**237 migrations appliquées**. La plupart avaient été passées via le tableau
de bord ou l'API et n'existaient dans aucun fichier — dont des créations de
tables entières.

Conséquence, mesurée et non supposée : rejouer les 47 fichiers sur une base
vide s'arrêtait à la 33ᵉ, sur `relation "public.carburant_reception_anomalies"
does not exist`, et ne reconstruisait que **56 tables sur 161**. Le dépôt
n'était donc pas la source de vérité du schéma.

Supabase conserve le SQL de chaque migration appliquée dans
`supabase_migrations.schema_migrations.statements`. Les 237 ont été relues de
là, sans mot de passe de production et sans écraser l'historique par un
nouveau baseline aplati : **la vraie histoire est conservée, migration par
migration.**

## Validation

Rejouées sur le projet `nexus-test` remis à zéro :

| | |
|---|---|
| Migrations rejouées | 237 |
| Échecs | 1, sans rapport — une politique sur `storage.objects`, hors du schéma vidé |
| Tables obtenues | **161** — identique à la production |
| Vues obtenues | **25** — identique à la production |
| RLS actif | 161 tables sur 161 |

## Règles

- Les numéros de version sont ceux **enregistrés par Supabase**, pas des
  horodatages choisis à la main. C'est ce qui garantit qu'un `db push` ne
  rejouera jamais une migration déjà appliquée.
- Toute nouvelle migration doit passer par le dépôt, jamais par le tableau de
  bord : c'est exactement ce qui avait creusé l'écart.
- Les fichiers antérieurs à cette récupération restent consultables dans
  l'historique Git, avec leurs commentaires de doctrine.
