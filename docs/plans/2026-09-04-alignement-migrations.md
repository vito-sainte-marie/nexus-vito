# A12 — aligner l'historique des migrations *(TRAITÉ le 05/09/2026)*

> **Statut : corrigé.** Dépôt, `nexus-test` et production portent désormais le
> même numéro pour la migration concernée, et une barrière CI empêche la
> récidive. Ce document garde le diagnostic, parce que la leçon vaut plus que
> le correctif.
>
> **La règle retenue pour NEXUS :** une migration appliquée en production
> devient **immuable dans son identité**. Son nom et son contenu ne se
> « nettoient » plus a posteriori ; toute évolution passe par une nouvelle
> migration.

## Ce qui a été fait

| Source | Avant | Après |
|---|---|---|
| Dépôt | `20260904140000_fermer_lecture_anonyme_sites.sql` | **`20260904130807_…`** — `git mv`, contenu inchangé (md5 `894bda59…`) |
| `nexus-test` | version `20260904140000` | **`20260904130807`** — réparation d'historique, migration **non rejouée** |
| Production | `20260904130807` | **inchangée** — jamais touchée |

La réparation de `nexus-test` a été faite sous préconditions vérifiées :
`140000` présent exactement une fois, `130807` absent, nom conforme, et
abandon si plus d'une ligne était concernée. Contrôle après coup : total
inchangé (243), aucun nom modifié, une seule version changée, instructions
intactes.

## La barrière : `test_migrations_immuables_20260905.js`

Compare la branche `production` à la branche courante. Ne dépend d'aucun
secret ni d'aucun accès base. Échoue si :

1. un fichier de migration présent dans `production` **disparaît** ;
2. son **contenu réapparaît sous un autre nom** — le renommage exact est le
   cas principal, mais un copier-coller sous un nouveau timestamp
   contournerait un contrôle purement nominal ;
3. le **contenu** d'une migration déjà en production est **modifié**.

Message : « Cette migration est déjà enregistrée en production sous ce nom. La
renommer ou la dupliquer sous un nouveau numéro peut provoquer une
réapplication ou un historique incohérent. »

Vérifié contre l'histoire réelle :

    501c0c7  → passe
    95cc92a  → BLOQUE   disparue : 20260904130807_…
                        réapparue sous : 20260904140000_…

Le contrôle aurait arrêté le renommage avant le push, par les deux voies.

---

# Diagnostic d'origine (conservé)

Lot séparé. **Priorité : qu'aucune migration déjà appliquée en production ne
soit un jour interprétée comme nouvelle.** Rien ne se renomme avant arbitrage.

## Ce qui s'est passé

Pendant le lot A2, le commit `95cc92a` a renommé un fichier de migration :

    20260904130807_fermer_lecture_anonyme_sites.sql
    → 20260904140000_fermer_lecture_anonyme_sites.sql

L'intention était de réconcilier le dépôt avec la base de recette, qui avait
enregistré cette migration sous la version `20260904140000`. Le raisonnement
était juste pour `nexus-test` — et faux pour la production, qui l'avait
enregistrée sous `20260904130807`, exactement le nom que le fichier portait
avant.

Le fichier suivait la production. Il ne la suit plus.

## Pourquoi c'est le lot le plus sensible

Une migration est identifiée par sa version. Si le dépôt promu porte
`20260904140000` et que la base de production ne connaît que `20260904130807`,
l'outillage voit une migration **nouvelle** et l'applique sur une base où son
effet est déjà en place. Le contenu de celle-ci — révocation de droits,
recréation de politique — est probablement rejouable sans dégât, mais ce n'est
pas la question : le mécanisme, lui, est faux, et le prochain cas ne sera
peut-être pas rejouable.

C'est aussi un rappel de méthode : **une réconciliation faite dans un seul
sens n'est pas une réconciliation.** Il fallait comparer les trois sources —
dépôt, test, production — avant de toucher à un nom.

## État constaté au 04/09/2026

| Source | Version portée |
|---|---|
| Dépôt, branche `config-par-environnement` | `20260904140000` |
| Base `nexus-test` | `20260904140000` |
| Base de **production** | `20260904130807` |

Trois autres migrations existent sur `nexus-test` et pas en production — c'est
normal, elles n'ont pas été promues :

    20260904175723_verrouiller_rpc_stock_par_site
    20260904175747_login_non_enumerable
    20260904190027_site_unique_shifts_mission_catalog

## Déroulé proposé

1. **Comparer les trois historiques dans leur intégralité**, pas seulement les
   migrations du jour : dépôt (`git ls-tree`), `nexus-test` et production
   (`supabase_migrations.schema_migrations`). Produire la liste des versions
   présentes dans une source et absentes d'une autre, et celle des noms
   identiques portant des versions différentes. C'est cette seconde liste qui
   compte, et personne ne l'a encore établie en entier.
2. **Arbitrer le sens de l'alignement.** Recommandation : le dépôt suit la
   **production**, jamais l'inverse — c'est la base qu'on ne peut pas casser,
   et celle dont l'historique ne se réécrit pas. La divergence de `nexus-test`
   se corrige alors côté test, en mettant à jour la ligne de version de la
   base de recette.
3. **Revenir au nom `20260904130807`** pour la migration concernée, et aligner
   `nexus-test` sur cette version.
4. **Poser un contrôle automatique** : un outil qui compare l'historique du
   dépôt à celui d'une base et échoue si un même nom y porte deux versions.
   À lancer avant toute promotion. C'est ce contrôle qui aurait arrêté A12.
5. **Écrire la règle** dans le dépôt : la version d'une migration se fixe une
   fois, à sa création, et ne se renomme plus jamais après application dans
   une base quelconque.

## Ce qu'il ne faut pas faire

- Renommer quoi que ce soit avant que la comparaison des trois sources soit
  faite et relue.
- Aligner le dépôt sur `nexus-test` — c'est précisément l'erreur d'origine.
- Éditer la table `schema_migrations` de production. Elle est le registre de
  ce qui a réellement été appliqué ; on n'y touche pas pour arranger un nom.
- Traiter ce lot en même temps qu'un correctif fonctionnel. Il ne doit rien
  contenir d'autre.
