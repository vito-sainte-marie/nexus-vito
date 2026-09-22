---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=6c3efcc
  - id: p0-1-fuseau-station
    classe: VERIFIED
    valeur: chargerStatutCarburantsHome+chargerControlesVerifyRestants_delegues_a_NexusStation.dateLocaleStation_repli_UTC_si_fuseau_absent
  - id: p0-1-cas-critique-19h59-20h00
    classe: VERIFIED
    valeur: instants_fixes_2026-09-21T00-00-00Z_reste_2026-09-20_continuite_jusqua_04h00UTC_minuit_local
  - id: p0-3-audits-non-valides
    classe: VERIFIED
    valeur: chargerControlesVerifyRestants_delegue_a_NexusVerifyMoteur.statutValidationQuart_valide_ou_ajuste_seulement
  - id: tests-nouveaux
    classe: VERIFIED
    valeur: test_continuite_terrain_p0_20260920.js_10_sur_10
  - id: non-regression-ciblee
    classe: VERIFIED
    valeur: verify_8sur8_carburant_commande_21sur21_app_donnees_1sur1_continuite_4sur4
  - id: non-regression-globale
    classe: DECLARED
    valeur: 261_sur_272_2_echecs_hors_liste_connue_non_imputables_a_ce_diff_cause_documentee_dans_le_corps
  - id: p0-2-donnee-valeur-effet-rollback
    classe: VERIFIED
    valeur: urgenceRaccourci_extrait_de_NEXUS-App-v1.html_FDJ-Analyse_urgence_0_FDJ-Manager_urgence_2_aucune_ecriture_production
  - id: b1-ferme
    classe: DECLARED
    valeur: aucune_promotion_aucun_changement_role_RLS_aucune_creation_reinitialisation_compte
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# P0-1/P0-3 préparés et prouvés en Test ; P0-2 chiffré, aucune écriture Production

Périmètre exécuté strictement conforme à `decision-1.md` : P0-1 et P0-3 en
code (aucun déploiement), P0-2 en préparation de donnée (aucune écriture
Production). B1 reste fermé — aucune promotion de compte, aucun changement de
rôle/RLS. Aucun merge/déploiement/migration Production. Aucune fusion #62/#65.
`config-par-environnement` non touchée.

## P0-1 — fuseau de la station dans les deux chargeurs Accueil

**Diagnostic confirmé** : les deux chargeurs qui datent "aujourd'hui" pour la
carte "Votre entreprise aujourd'hui" de `NEXUS-App-v1.html` calculaient tous
deux `new Date().toISOString().slice(0, 10)` — l'horloge UTC, jamais celle de
la station. America/Martinique est UTC-4 : dès 20 h locale, en plein service
du soir, cette date basculait déjà sur demain.

**Diff minimal** (aucune policy, aucune migration, aucun refactor) :

- `nexus-app-donnees.js` — `chargerStatutCarburantsHome(client, siteId,
  timezone)` : `aujourdhui` vient désormais de
  `NexusStation.dateLocaleStation(timezone)` quand un fuseau est fourni ;
  repli UTC identique à avant si le fuseau est absent (aucune régression pour
  un appelant qui ne le fournirait pas).
- `nexus-conseiller-donnees.js` — `chargerControlesVerifyRestants(client,
  siteId, timezone)` : même correctif, même primitive
  (`NexusStation.dateLocaleStation`, Article 11 — jamais un second calcul de
  date), même repli si le fuseau est absent.
- `NEXUS-App-v1.html` : le fuseau déjà résolu en tête d'`initPosteManager`
  (`FUSEAU_STATION`, via `NexusStation.fuseauDeLaStation`) est désormais
  transmis au second appel (`chargerControlesVerifyRestants`) — le premier
  (`chargerStatutCarburantsHome`) le recevait déjà, mais ne s'en servait pas
  pour calculer la date (voir P0-1 ci-dessus). Ajout de
  `<script src="nexus-verify-moteur.js">`, nécessaire à P0-3 (voir plus bas).

**Preuve du cas critique exigé** (`NexusStation.dateLocaleStation`, instants
fixés, indépendant de l'heure d'exécution) :

| instant réel (UTC) | heure locale Martinique | date métier avant correctif | date métier après correctif |
|---|---|---|---|
| 2026-09-20T23:59:00Z | 19:59 | 2026-09-20 | 2026-09-20 |
| 2026-09-21T00:00:00Z | **20:00** | **2026-09-21 (faux, service du soir en cours)** | **2026-09-20 (correct)** |
| 2026-09-21T03:59:00Z | 23:59 | 2026-09-21 (faux) | 2026-09-20 (correct — continuité jusqu'à la fermeture) |
| 2026-09-21T04:00:00Z | 00:00 (le lendemain, réel) | 2026-09-21 | 2026-09-21 |

Témoin de mutation exécuté contre les deux fichiers PRÉ-correctif (HEAD
`d9f1841`, jamais commité) : les deux défauts se confirment mécaniquement
(`chargerControlesVerifyRestants` interroge `date = 2026-09-21` au moment de
ce test — la journée métier réelle en cours, en Martinique, est le 2026-09-20 ;
la preuve porte donc sur un cas RÉELLEMENT en train de se produire, pas
seulement hypothétique).

**Ce qu'il resterait à faire pour un candidat Production** : néant pour ce
correctif précis — changement de code minimal, rétrocompatible, sans
migration ni RLS. Le fuseau vient de `sites.timezone` déjà en place. Reste
hors périmètre de ce lot : `NEXUS-Brief-v1.html` appelle la même fonction
partagée `chargerControlesVerifyRestants` SANS lui passer le fuseau (repli
UTC inchangé, dette distincte, déjà documentée ailleurs — non traitée ici
pour ne pas élargir le diff).

## P0-3 — compter les audits non validés, pas les quarts saisis

**Diagnostic confirmé** : `chargerControlesVerifyRestants` comptait les
`quart` distincts SAISIS dans `audits_caisse` (`quartsFaits`), jamais leur
statut de validation. Un audit saisi mais jamais validé par un manager
retombait donc à "aucun contrôle restant" — le chiffre affiché à l'Accueil ne
désignait pas le travail qui reste réellement, exactement le défaut n°1 relevé
par `request-1.md`.

**Correctif** (même fonction que P0-1, un seul diff) : délégation à
`NexusVerifyMoteur.statutValidationQuart` — la MÊME classification que NEXUS
Verify lui-même (`etat ∈ 'valide'|'ajuste'|'partiel'|'en_attente'`, Article
11). Un quart ne compte comme fait que si ses caisses attendues sont validées
(`'valide'` ou `'ajuste'`) ; `'partiel'` et `'en_attente'` restent comptés
comme travail restant. **La doctrine Verify elle-même n'est pas modifiée** —
aucun seuil, aucune classification nouvelle ; seule cette lecture cesse de
diverger d'elle.

Fonction partagée avec Brief (`nexus-brief-donnees.js::chargerControlesVerifyRestants`
délègue à la même fonction) : ce volet de la correction s'applique donc aussi
à Brief, qui souffrait du même défaut identique (Article 11 — laisser
diverger deux lectures de la même donnée aurait recréé le problème sous une
autre forme). Brief charge déjà `nexus-verify-moteur.js`.

**Impact exact sur le parcours du remplaçant** : la carte "Votre entreprise
aujourd'hui" (Accueil) et le Brief affichent désormais "contrôle(s) à
effectuer" tant qu'un audit saisi n'est pas réellement validé — ce qui reste
vrai tant que B1 (accès manager) n'est pas résolu : Angélique, en renfort,
peut saisir un audit mais pas le valider (voir `request-1.md`). Après ce
correctif, l'Accueil dit honnêtement "contrôle à effectuer" au lieu de
laisser croire que la caisse est réglée.

## Tests

`test_continuite_terrain_p0_20260920.js` (nouveau, 10/10) : cas critique
19:59→20:00 locale + continuité fermeture (instants fixés), wiring réel du
fuseau (stub sentinelle, indépendant de l'heure d'exécution CI), non-
régression du repli UTC quand le fuseau est absent (Brief), audit saisi non
validé / validation partielle / quart réellement validé / journée
entièrement validée (P0-3), et preuve P0-2 (voir plus bas).

Non-régression ciblée (portée directement concernée par ce diff) :
`node run-tests.js verify` 8/8 · `carburant_commande` 21/21 · `app_donnees`
1/1 · `continuite` (nouveau fichier inclus) 4/4.

Suite complète : `261/272`. Deux échecs supplémentaires par rapport à la
liste connue (`docs/qa/ECHECS-CONNUS.json`, 9 entrées, mesurée le 08/09) —
**ni l'un ni l'autre imputable à ce diff**, vérifié par lecture de code, pas
supposé :

- `test_migrations_immuables_20260905.js` — compare `supabase/migrations/`
  contre `origin/production` par `git`. Échoue par topologie de branche de ce
  checkout (`handoff-continuite-20260920`), sans rapport avec ce lot : aucun
  fichier sous `supabase/migrations/` n'apparaît dans ce diff.
- `test_handoff_v2_20260905.js` — un seul cas échoue
  (« handoff.js decision produit une enveloppe conforme par construction »),
  isolé dans son propre répertoire temporaire (`NEXUS_HANDOFF_DIR`), sans
  dépendance à `docs/handoff/STATE.json` ni à aucun fichier touché ici. La
  fixture du test code en dur `branch: config-par-environnement` comme valeur
  attendue ; l'outil écrit désormais la branche du rail actif
  (`BRANCHE_ACTIVE`, commit `d9f1841` cité dans ce réveil), qui vaut
  `handoff-continuite-20260920` sur ce rail. C'est la fixture qui n'a pas
  suivi l'alignement du validateur sur le rail actif — pas une régression de
  ce lot, ni un défaut du validateur lui-même (`handoff.js verifier` reste
  conforme avant et après ce diff, 31 lots, 0 nouvelle erreur).

Aucun des deux fichiers ni leur cause ne relève du périmètre P0-1/P0-2/P0-3.
Signalé sans contournement, conformément à l'instruction de ce réveil — ni
`outils/handoff.js`, ni le test, ni `docs/qa/ECHECS-CONNUS.json`, ni
`supabase/migrations/` n'ont été touchés.

## P0-2 — `station_config.raccourcis` (donnée, non appliquée)

**Valeur actuelle** (déclarée par `request-1.md`, non re-vérifiée en base
depuis ce canal — aucun accès Production ici) : l'entrée FDJ du site pilote
porte `NEXUS-FDJ-Analyse-v1.html`.

**Valeur proposée** : remplacer cette seule entrée par
`NEXUS-FDJ-Manager-v1.html`, à la même position dans le tableau JSON — aucun
autre élément de `station_config.raccourcis` touché.

**Écran/urgence impacté** : `NEXUS-App-v1.html`, tri par urgence du jour des
cartes "Vos raccourcis" (`urgenceRaccourci`/`trierParUrgenceDuJour`,
Accueil). N'affecte ni le libellé ni la description de la carte (déjà
correctes, `RACCOURCIS_CATALOGUE['NEXUS-FDJ-Analyse-v1.html']` existe) —
seul l'ordre d'affichage du jour est concerné.

**Effet démontré mécaniquement, sans accès Production** (extraction réelle de
`urgenceRaccourci` depuis `NEXUS-App-v1.html`, jouée avec le contexte réel
`alertesFdjNonVues: 22` cité par `request-1.md`) :

| href testé | urgence rendue |
|---|---|
| `NEXUS-FDJ-Analyse-v1.html` (valeur actuelle) | **0** — non reconnu, 22 alertes non vues restent invisibles dans le tri |
| `NEXUS-FDJ-Manager-v1.html` (valeur proposée) | **2** — reconnu, la carte FDJ remonte en tête si un autre signal n'est pas déjà à 3 |

**Mécanisme de rollback** : trivial et immédiat — `station_config.raccourcis`
est un tableau JSON sans effet de bord ni écriture dérivée ; remettre
`NEXUS-FDJ-Analyse-v1.html` à la même position restaure exactement l'état
actuel. Aucune migration, aucun code à revenir en arrière (aucun code n'est
proposé pour P0-2).

**Non appliqué** : aucune écriture Supabase, aucun accès Production tenté
depuis ce canal. Cette section reste une préparation chiffrée, dans l'attente
du GO Créateur explicite exigé par `decision-1.md`.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase (aucun accès
depuis ce canal), aucune écriture `station_config.raccourcis`/`public.rappels`
en Production, aucune promotion/réinitialisation de compte (B1 reste fermé),
aucune fusion #62/#65, `config-par-environnement` non touchée, aucun secret
exposé.

## Gate suivante

Conformément à `decision-1.md` : ce lot ne se déclare pas terminé. Arbitrage
attendu sur trois points laissés ouverts par `request-1.md` (B1, calendrier
P0-1/P0-3, porteur de `public.rappels`) et sur le GO Créateur explicite pour
P0-2. STOP à cette gate — aucune exécution supplémentaire dans ce lot sans
nouvelle décision.
