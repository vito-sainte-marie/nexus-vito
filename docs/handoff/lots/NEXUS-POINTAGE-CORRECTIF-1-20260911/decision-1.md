---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-POINTAGE-CORRECTIF-1-20260911
seq: 1
author: Frédéric Bragance (gate humaine)
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---

# Levée du blocage fonctionnel Pointage

**Déclarée par Frédéric Bragance, le 14/09/2026.**

## Ce qui est déclaré

Les trois conditions posées le 13/09/2026 pour le périmètre Pointage sont
remplies : **correctif appliqué, tests concluants, parcours navigateur réel
validé le 13/09/2026.**

Le blocage fonctionnel correspondant à `aucun_blocage_non_resolu` est **levé**,
sur la base des preuves consignées.

## Portée exacte, et ses limites

Cette déclaration porte **uniquement sur les défauts Pointage concernés** :

| défaut | relevé le | statut |
|---|---|---|
| Le départ était inatteignable sans pause | 11/09, parcours Caissière | corrigé, prouvé |
| La file hors ligne promettait un envoi que la base refusait | 13/09, Employé Test B | corrigé, prouvé |
| La portée « journée » au lieu du service, à sept endroits | 13/09 | corrigée, prouvée |

**Elle ne constitue aucune autorisation de déploiement Production.** Elle ne
vaut pas gate. Elle ne couvre aucun autre périmètre.

## Le verdict ne change pas

`NON_PRET` et `NON_AUTORISEE` restent en vigueur : les **six mesures
Production** sont périmées depuis le 12/09/2026 à 22:39 UTC, et le critère
`impacts_production_mesures_horodates` est BLOQUE tant qu'elles ne sont pas
rejouées et validées.

Lever un blocage n'en lève pas un autre. C'est d'ailleurs le sens de deux
critères distincts : l'un dit que le code tient, l'autre que la mesure est
fraîche. Aucun ne remplace l'autre.

## Les preuves sur lesquelles elle repose

**Mesurées en base, pas déclarées.** Employé Test B sur NEXUS Test, deux
services le même jour, tous deux clos par `pointage_depart`, `heure_fin ≥
heure_debut`, tous les pointages rattachés à leur service et porteurs d'un
`client_event_id` :

```
service 12:27:48 → 12:32:05   arrivee 12:27:58 · depart 12:32:05
service 12:48:23 → 22:20:50   arrivee 19:50:13 · pause_debut 19:50:27
                              · depart 22:20:50 · pause_fin 22:20:50
```

L'enchaînement `pause_fin` → départ → clôture → rafraîchissement immédiat, qui
était la dernière preuve manquante, est joué et vérifié.

**Épreuves** : `test_pointage_depart_sans_pause_20260911.js` 34/34,
`test_file_pointages_hors_ligne_20260911.js` 19/19,
`test_pointage_sans_service_20260913.js` 40/40,
`test_pointage_par_service_20260913.js` 29/29,
`test_pause_fin_par_service_20260913.js` 25/25,
`test_app_prochaine_action_par_service_20260913.js` 24/24.
Guardian QA : 0 finding sur 272 épreuves.

**Dossiers** : `defaut-file-hors-ligne-sans-service-1.md`,
`diagnostic-services-successifs-1.md`.

## Ce qui reste ouvert, et n'est pas couvert

Deux observations de **formulation**, volontairement hors de ce lot et non
corrigées — voir `observations-ux-parcours-13-09-1.md`. « Historique du
service » affiche en réalité toute la journée, et le libellé photo. Les
mélanger à un correctif fonctionnel obligerait à reprouver un parcours pour un
mot.

## Prochaine étape

Rejouer les six mesures Production, en lecture seule. Aucune écriture, aucune
migration, aucune gate proposée avant leur validation complète.
Protocole : `protocole-reprise-six-mesures-1.md`.
