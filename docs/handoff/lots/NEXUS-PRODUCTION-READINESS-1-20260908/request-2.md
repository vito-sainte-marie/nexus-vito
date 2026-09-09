---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: rail-reconcilie
    classe: VERIFIED
    valeur: handoff.js verifier conforme, decisions consommees 90276b4 et ba1eed0
  - id: outil-enregistrer-lot
    classe: VERIFIED
    valeur: test_handoff_enregistrer_lot_20260909.js 7 sur 7, test_handoff_v2_20260905.js 53 sur 53
  - id: regression-globale
    classe: VERIFIED
    valeur: 227 sur 236, 9 echecs historiques identiques, 0 regression
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router 0 finding, verifier-apprentissage conforme 20 regles
  - id: inventaire-migrations
    classe: VERIFIED
    valeur: 21 migrations classees statiquement, voir branche claude/issue-28-20260909-0019
  - id: mesure-production-lecture-seule
    classe: NOT_APPLICABLE
    valeur: aucun identifiant ni acces reseau Production disponible dans ce canal Claude
  - id: preprod-anonymise
    classe: NOT_APPLICABLE
    valeur: non commence dans ce lot, propose en suite
  - id: fenetre-deploiement
    classe: NOT_APPLICABLE
    valeur: necessite lecture activite metier Production
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Réconciliation du rail, inventaire des migrations, et périmètre réellement exécutable depuis ce canal

Claude a réconcilié le rail sur sa branche de travail, consommé `decision-3.md` du lot Philosophie/Langage puis `decision-1.md` de ce lot, et ajouté une commande `outils/handoff.js enregistrer-lot <LOT_ID>` pour traiter le défaut `LOT_HORS_REGISTRE` sans dérogation. Les preuves annoncées sont : test dédié 7/7, Handoff v2 53/53, suite globale 227/236 avec les 9 échecs historiques inchangés, Guardians 0 finding et apprentissage conforme.

La candidate a été figée à `ba1eed0e833c354f556128dc0ee4b0619725ed1a`. Production `501c0c7` en est un ancêtre direct. Claude a inventorié 21 migrations entre Production et la candidate.

Les points à mesurer en priorité sont `20260905161500_seed_referentiel_advisor` et `20260905170000_reprise_et_unicite_shifts_en_cours`. Quatre migrations 16, 18, 19 et 20 sont explicitement orientées Test/CI et nécessitent une décision de package Production fondée sur leurs dépendances réelles, pas une promotion implicite.

Le canal Claude n'avait pas lui-même les moyens techniques de lire Supabase Production. Il a donc laissé les mesures Production, PREPROD anonymisé, la fenêtre de déploiement, le plan formel de réparation/rollback et les critères `Prêt pour Production` ouverts plutôt que de les inventer.

## Pourquoi un humain doit-il intervenir ici ?

Aucun arbitrage de fondateur n'est requis pour poursuivre la préparation hors Production. Les questions de portée Test/CI doivent d'abord être résolues par une analyse de dépendances et la doctrine d'environnements. Une gate humaine n'est requise que si cette analyse laisse un choix produit réel, si un PREPROD non anonymisé devient indispensable, ou lors de la gate finale Production.

## Source d'exécution

Ce request canonise le retour publié par Claude sur la branche `claude/issue-28-20260909-0019` et dans l'issue #28. Les fichiers techniques de cette branche ne sont pas considérés livrés tant qu'ils ne sont pas intégrés à `config-par-environnement` ou explicitement classés selon GOV-005.
