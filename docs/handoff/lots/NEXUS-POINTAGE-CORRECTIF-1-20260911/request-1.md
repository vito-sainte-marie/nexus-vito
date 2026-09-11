---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-POINTAGE-CORRECTIF-1-20260911
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=d5a8b77
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=d5a8b77
  - id: cause-verifiee
    classe: VERIFIED
    valeur: sequence_obligatoire_des_pauses_NEXUS-Pointage-v1_ligne_621
  - id: consequence-mesuree
    classe: VERIFIED
    valeur: 48_journees_sur_59_arretees_a_l_arrivee
  - id: causalite-des-24-services-ouverts
    classe: VERIFIED
    valeur: zero_pointage_sur_les_24_donc_lien_de_cause_NON_demontre
  - id: mecanisme-distinct
    classe: VERIFIED
    valeur: service_en_cours_sans_filtre_de_date
  - id: epreuve-parcours
    classe: VERIFIED
    valeur: 27_sur_27
  - id: doublons-existants
    classe: VERIFIED
    valeur: zero_en_test_et_en_production
  - id: eligibilite-renfort
    classe: HUMAN
    valeur: ARBITRAGE_FREDERIC_REQUIS_aucune_regle_inventee
  - id: planning-source-de-verite
    classe: HUMAN
    valeur: vide_en_test_fige_au_31_08_en_production
---
# Le départ ne dépend plus d'une pause

Lot correctif ouvert le 11/09/2026 sur décision de Frédéric Bragance, après le
parcours complet d'une caissière sur NEXUS Test. Il suspend la gate de
dimanche et retire `PRET_POUR_PRODUCTION` au lot
`NEXUS-PRODUCTION-READINESS-1-20260908`.

## Ce qui est établi, et à quel titre

### Cause VÉRIFIÉE — la séquence obligatoire des pauses empêchait le départ

`NEXUS-Pointage-v1.html`, avant correction :

```js
const ORDRE_TYPES = ['arrivee', 'pause_debut', 'pause_fin', 'depart'];
const prochainType = ORDRE_TYPES.find(t => !dejaFait[t]);
const bloque = !fait && !estProchain;
```

Seule l'étape suivante était pointable. Après l'arrivée, le seul bouton actif
était « Début pause ».

**Formulation exacte, telle que corrigée par l'Orchestrator :** le départ
n'était pas « désactivé jusqu'au lendemain ». Il était désactivé **jusqu'à
l'enregistrement successif de `pause_debut` puis `pause_fin`**. Une employée
qui prenait sa pause et la pointait pouvait partir le jour même ; une employée
qui n'en prenait pas, ou ne la pointait pas, ne le pouvait à aucun moment.

Vérifié à l'écran sur nexus-test, pas seulement lu : arrivée pointée, `Départ`
désactivé ; début de pause, fin de pause, `Départ` actif.

### Conséquence MESURÉE — 48 journées sur 59 se sont arrêtées à l'arrivée

Sur les 92 pointages de Production, regroupés par employé et par jour :

| issue de la journée | journées | période |
|---|---|---|
| arrivée seule, rien d'autre | **48** | 24/07 au 30/08/2026 |
| menée jusqu'au départ | **11** | 02/08 au 14/08/2026 |

Quatre journées pointées sur cinq n'ont jamais atteint le départ. Le dernier
pointage, tous employés confondus, date du **30/08/2026**.

### Causalité NON DÉMONTRÉE — les 24 services ouverts n'ont aucun pointage

Les 24 services `en_cours` de Production (04/09 au 11/09) ont été croisés avec
les pointages de l'employé à la date du service :

> **Aucun des 24 ne comporte le moindre pointage.**

Ils sont tous postérieurs à l'abandon complet de l'écran. Le verrou n'est donc
**pas** la cause directe de ces 24 cas. Il est un **contributeur vérifié de
l'abandon** qui les précède. Cette distinction est maintenue telle quelle : le
mécanisme est prouvé, son rôle dans ces 24 cas ne l'est pas.

### Mécanisme DISTINCT — un service `en_cours` récupéré sans filtre de date

`nexus-auth.js`, `nexusServiceCourant` : la lecture filtrait sur l'employé, le
site et le statut, jamais sur la date. Un quart laissé ouvert la veille
revenait comme service du jour. D'où, sur une arrivée à 10 h 33 :

```
Horaire prévu : 17:25          (le début du quart de la VEILLE)
Retard constaté : 1028 min     retard_min = 1028, ÉCRIT en base
quart : soir                   hérité du quart de la veille
```

Ce mécanisme est indépendant du précédent et se corrige séparément.

## Ce qui a été corrigé

| comportement | fichier |
|---|---|
| Le départ est possible dès l'arrivée pointée | `NEXUS-Pointage-v1.html` — `pointageDisponible()` |
| Une pause ouverte propose d'être close à l'heure du départ | idem — confirmation explicite, puis `pause_fin` **et** `depart` écrits séparément |
| Le service de référence est celui du jour, jamais celui de la veille | idem — `serviceDuJourSeulement()` ; `nexus-auth.js` — filtre de date locale |
| L'écran se réconcilie avec la base après envoi | idem — retrait du voile caméra |
| Relecture avant écriture, contre les doublons | idem |
| Plus de prise de poste imposée après la clôture | `nexus-auth.js` — `nexusPriseDePosteManquante` |
| Les rôles proposés se limitent au rôle administratif | `NEXUS-Prise-De-Poste-v1.html` |
| Aucun fichier ne survit à son pointage | `NEXUS-Pointage-v1.html` — `input.value = ''` dès la lecture |

Les huit règles canoniques de l'arbitrage métier sont tenues, y compris la 7 :
**aucun début ni aucune durée de pause n'est inventé rétroactivement.** La fin
posée à la demande de l'employée est l'instant réel de son départ.

Aucune durée minimale de pause n'est fixée. Une épreuve interdit qu'une telle
valeur se glisse dans le code sans nouvel arbitrage.

## Ce qui reste ouvert

- **`ARBITRAGE_FREDERIC_REQUIS` — éligibilité au renfort.** Aucune règle n'a
  été inventée. Le renfort reste proposé comme avant : les droits existants ne
  sont ni élargis ni restreints.
- **Le planning comme source de vérité.** `planning_shifts` est **vide en
  Test** et **figé au 31/08 en Production**, zéro ligne sur sept jours.
  Conditionner la prise de poste à cette source enfermerait tout le monde
  dehors. Décision à prendre séparément.
- **L'unicité en base.** Aucun index unique n'existe sur `pointages`. La
  détection est outillée (`outils/detecter-doublons-pointages.sql`) et rend
  **zéro doublon** dans les deux bases, sur les deux clés candidates. La clé
  n'est PAS figée : `(employee_id, date, type)` interdirait un transfert de
  site le même jour, `(employee_id, site, date, type)` l'autorise. Le modèle
  exact doit être arbitré avant d'écrire la migration.
- **La photo inattendue — anomalie non résolue, consentement et traçabilité.**
  Un fichier réel a atteint le stockage pour une arrivée que personne n'avait
  demandée, caméra refusée. L'instrumentation de provenance
  (`camera` / `repli_natif`) demande une colonne qui n'existe pas : elle est
  préparée, non appliquée, et **ne vaut pas explication du cas observé**.

## Ce que ce lot ne demande pas

Aucune action Production, aucune migration, aucun déploiement, aucune gate.
Le verdict reste `NON_PRET`, `aucun_blocage_non_resolu` reste `BLOQUE`,
l'autorisation reste `NON_AUTORISEE`.
