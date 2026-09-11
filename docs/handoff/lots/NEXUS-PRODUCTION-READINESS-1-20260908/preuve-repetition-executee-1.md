# Répétition PREPROD-équivalente — PREUVE EXÉCUTÉE

Date : 2026-09-09
Environnement : `nexus-test` (`udljdqxerrbbbajxubfn`). Aucune opération Production.
Critère visé : `repetition_migrations_recette_reussie`, jusqu'ici `INCONNU`.

## Ce qui a été exécuté

`nexus-test` a été **reconstruit depuis zéro** : schéma `public` supprimé,
privilèges par défaut reposés avant rejeu, puis rejeu intégral des migrations
versionnées, dans leur ordre réel.

```
Les 262 migrations se rejouent intégralement sur une base vide.
   tables : 162   ·   vues : 25   ·   RLS : 162 table(s) protégée(s)
```

Puis la chaîne complète a été lancée contre cet environnement reconstruit
(run `34360255750`, commit `10dce11`) :

```
Aucune régression : seuls les 9 échecs connus subsistent.
Instantané conforme à la station Test (fuseau_horaire, cuves_carburants,
                                       carburant_commande_config).
Version servie confirmée : 10dce112e99a82c7d9226c683ec00c2cb1963e5b
  Commande recommandée : 23 000 L de SP95 + 13 000 L de GO
  · UI Carburants (CARB-004) : satisfaite
  · Accès Live REFUSÉ au manager : satisfaite
  · Accès Live ACCORDÉ au Créateur : satisfaite
```

La commande recommandée est **identique** à celle obtenue avant reconstruction :
le moteur rend le même verdict sur un environnement rebâti, ce qui est la
propriété que cette répétition devait établir.

État final mesuré : 265 migrations (les 262 plus les trois correctifs de droits
ci-dessous), 187 tables, la station de recette et ses 4 comptes reliés à
`auth.users`, 57 lignes semées dans `audits_caisse`.

## Ce que la répétition a TROUVÉ

Quatre tentatives ont été nécessaires. Aucune n'a échoué sur un incident : les
quatre ont nommé un défaut réel, invisible en CI verte depuis des jours.

| Défaut | Nature |
|---|---|
| `db.<ref>.supabase.co` ne publie qu'une **IPv6**, tombée en cours de rejeu | tuait `psql` sans message ; une panne réseau se lisait comme un mauvais mot de passe |
| Deux **captures** échouaient sur des tables absentes | une table inexistante est une erreur de compilation, pas une valeur nulle : le script devenait irrelançable quand il était le plus utile |
| **SEC-018**, **SEC-020**, **SEC-021**, **SEC-022** | quatre droits accordés à chaud, vivant en base et nulle part au dépôt |
| Le **semis** omettait deux colonnes `NOT NULL` | écrit en observant un schéma à moitié reconstruit |

Les quatre droits sont la même faute à quatre étages : `usage` sur le schéma,
droits de table, politique de publication, lecture de configuration. Sans
`usage`, un droit de table est inerte et une politique RLS ne s'applique à
rien — et PostgreSQL répond « relation does not exist », ce qui fait chercher
une table manquante là où manque un privilège.

**La cause commune n'est pas l'inattention.** Un accès accordé pour débloquer
ne laisse aucune trace reproductible, et rien ne le réclame tant qu'on ne
reconstruit pas depuis zéro. C'est précisément ce qu'une répétition sert à
révéler, et c'est ce qui serait apparu en Production.

## Ce qui reste NON prouvé, et doit rester `INCONNU`

- **PREPROD anonymisé** (`preprod_anonymise_ou_equivalent`) : non construit. La
  répétition a eu lieu sur `nexus-test`, dont les données sont de recette et non
  une copie de Production. Elle établit que les migrations s'appliquent sur une
  base VIDE, pas qu'elles s'appliquent sur quatre mois d'historique réel.
- Le **journal Live** est restauré partiellement : les 4 autorisations humaines
  et leurs questions, horodatages d'origine compris. Les relevés machine
  antérieurs n'ont pas été retranscrits — reproductibles, et les recopier à la
  main aurait introduit un risque d'erreur. Le journal compte 17 événements là
  où il en comptait 73 : cette ligne le dit plutôt que de laisser croire à une
  continuité.
