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
    valeur: 21 migrations classees statiquement, voir inventaire-migrations-1.md
  - id: mesure-production-lecture-seule
    classe: NOT_APPLICABLE
    valeur: aucun identifiant ni acces reseau Production disponible dans ce canal
  - id: preprod-anonymise
    classe: NOT_APPLICABLE
    valeur: non commence dans ce lot, propose en suite
  - id: fenetre-deploiement
    classe: NOT_APPLICABLE
    valeur: necessite lecture activite metier Production, meme obstacle
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Réconciliation du rail, inventaire des migrations, et périmètre réellement exécutable depuis ce canal

## 1. Réconciliation du rail (fait avant tout le reste)

`decision-3.md` de `NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908` (`closes: true`,
auteur Frédéric Bragance) clôturait ce lot alors que `STATE.json` était encore
sur `derniere_decision: decision-2.md`. En le vérifiant, `handoff.js verifier`
a révélé un second défaut, plus large : `NEXUS-PRODUCTION-READINESS-1-20260908`
lui-même — `request-1.md` et `decision-1.md`, tous deux déposés par un commit
direct — était présent sous `docs/handoff/lots/` mais totalement absent de
`STATE.json.lots` (code `LOT_HORS_REGISTRE`). Ce n'est pas un défaut de forme
d'un champ d'enveloppe (les deux fichiers sont conformes par construction :
`protocol`, `kind`, `branch`, vocabulaire de décision, `in_reply_to` — tout y
est) : c'est le registre lui-même qui ignorait l'existence du lot. Tant que ce
code reste bloquant, `verifier` échoue pour l'ensemble du registre et
`consommer` refuse pour N'IMPORTE quel lot — pas seulement celui-ci.

Plutôt qu'une dérogation ponctuelle (qui tolère un écart sans le corriger), une
commande a été ajoutée à `outils/handoff.js` : `enregistrer-lot <LOT_ID>`.
Elle rejoue exactement les mêmes contrôles que `verifier` sur les enveloppes
du lot AVANT de l'inscrire dans `STATE.json.lots`, et refuse si elles ne sont
pas conformes — elle ne fait donc jamais apparaître un lot mal formé. Ce n'est
pas une dérogation : aucune règle n'est assouplie, aucun fichier n'est
réécrit. Traité sous Q76 (outillage/rail Handoff, aucun choix métier, aucun
secret, aucune Production, aucun `main`).

Séquence exécutée, dans cet ordre :
1. `node outils/handoff.js enregistrer-lot NEXUS-PRODUCTION-READINESS-1-20260908`
2. `node outils/handoff.js consommer NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908` (ferme ce lot, `decision-3.md`)
3. `node outils/handoff.js consommer NEXUS-PRODUCTION-READINESS-1-20260908` (`decision-1.md`, `APPROVED`, `closes: false`)
4. `node outils/handoff.js miroirs`

## 2. Ce qui a été réellement exécuté du périmètre de ce lot

Point de départ : ce checkout est, pour la première fois de tout ce fil sur
l'issue #28, réellement raciné sur `config-par-environnement`
(`HEAD = ba1eed0e833c354f556128dc0ee4b0619725ed1a`, ancêtre confirmé de
`origin/config-par-environnement`) — l'obstacle structurel documenté depuis
le 06/09/2026 (`issue_comment` racinant systématiquement sur `main`) semble
résolu (`origin/main` porte désormais `10c65d0 — ci(claude): couper la
branche de travail depuis config-par-environnement`).

**Candidate figée** : `ba1eed0e833c354f556128dc0ee4b0619725ed1a` (HEAD de
`config-par-environnement` au démarrage du lot, identique au commit de
`decision-1.md`). `origin/production` (`501c0c7`) en est un ancêtre direct,
sans divergence.

**Item 3 (inventaire des migrations) — fait, statique, sans accès Production** :
21 migrations séparent `production` de la candidate. Chacune lue et classée
par type d'exécution (schéma/RLS, fonction différée, écriture au déploiement)
et, quand elle touche des données, par impact (`supprimées` / `écrasées` /
`complétées` / `corrigées`). Détail complet dans
`inventaire-migrations-1.md` (même répertoire). Deux points d'attention
identifiés qui devront être mesurés en priorité dès qu'un accès Production
en lecture existe :
- `20260905161500_seed_referentiel_advisor` : upsert sur des tables dont les
  données n'existaient QUE dans Production (insérées hors migration) — impact
  réel (`complétées` vs `écrasées`) inconnu sans comparer les valeurs actuelles ;
- `20260905170000_reprise_et_unicite_shifts_en_cours` : repair one-shot de
  services `en_cours` bloqués — nombre de lignes concernées en Production
  inconnu sans lecture.

Un point non tranché est signalé sans être décidé : 4 migrations (16, 18, 19,
20 du tableau) sont scopées Test/CI par leur propre contenu — leur promouvoir
ou les exclure explicitement de la procédure Production est un jugement de
fondateur, pas un fait déterministe.

## 3. Ce qui n'a PAS été fait, et pourquoi — honnêtement, pas par défaut de volonté

**Item 2 (mesure Production en lecture seule)** — non fait. Ce canal GitHub
Issue n'a jamais eu, à aucun moment de ce fil depuis le 06/09/2026,
d'identifiants ou d'accès réseau vers un projet Supabase Production ou Test
(seul `outils/etat-deploiement.js` et les scripts CI Test lisent des secrets
`NEXUS_TEST_*`, jamais un équivalent Production). Le réveil autorise l'ACTION
(lecture seule Production) ; il ne crée pas les MOYENS de la faire depuis ce
canal précis. Provisionner un accès Production — même strictement lecture
seule — est une nouveauté qui élargirait la surface de sécurité (nouveau
jeton/rôle avec portée Production) : `CLAUDE.md` la classe explicitement
parmi les gates humaines jamais pré-autorisées (« toute nouveauté qui élargit
la surface de sécurité : nouveau jeton, nouvelle capacité d'écriture, nouvel
accès »), même quand la lecture qu'il permettrait est elle-même autorisée.
Je ne l'ai donc ni fait ni contourné.

**Items 6 à 8 (PREPROD anonymisé, preuve d'absence de données personnelles,
répétition des migrations dessus)** — non commencés. Concevoir un schéma
d'anonymisation qui préserve fidèlement volumes/relations/anomalies tout en
prouvant l'absence de données personnelles réelles est un travail de fond
(mapping table par table, preuve vérifiable, pas une déclaration) que je n'ai
pas voulu improviser dans le temps de cette session au risque de produire une
preuve d'anonymisation qui ait l'air correcte sans l'être — exactement le
genre de chose que ce protocole existe pour empêcher. Proposition pour la
suite : un lot dédié, qui peut démarrer dès maintenant en autonomie
(outillage/conception, aucun secret, aucune Production) sans attendre l'accès
Production de l'item 2.

**Item 9 (plan de réparation en avant / rollback)** — partiellement déductible
de l'inventaire (migrations 3 et 6 sont les deux seules qui repositionnent des
données existantes ; un rollback code de chacune est un `DROP`/`CREATE OR
REPLACE` symétrique documentable) mais pas rédigé formellement ici — proposé
comme suite de ce même lot plutôt que fabriqué à la hâte.

**Item 10 (fenêtre de déploiement)** — nécessite une lecture de l'activité
métier réelle (services en cours, écritures critiques) : même obstacle que
l'item 2, non fait.

**Item 11 (critères `Prêt pour Production` dans NEXUS Live)** — non
implémenté dans ce lot : NEXUS Live affiche déjà un verdict global
(Normal/Vigilance/Intervention) et une timeline humaine (travaux du
08-09/09/2026, hors de ce lot) ; y ajouter un état `Prêt pour Production`
spécifique dépend directement des critères de gate qui restent à définir
avec Frédéric au moment de la gate finale — le faire maintenant risquerait de
figer une définition avant qu'elle soit éprouvée.

**Item 12 (Production Readiness Report + procédure canonique)** — ce fichier
et `inventaire-migrations-1.md` en sont la première partie mesurée et
honnête (rail réconcilié, inventaire complet) ; le rapport complet reste à
compléter par les items 2/6-11 dans un ou plusieurs lots suivants.

## Preuves

- rail réconcilié : `handoff.js verifier` conforme (29 lots, 10
  avertissements — tous préexistants —, 6 dérogations), les deux
  `consommer` réussis avec les commits `90276b4` (decision-3 Philosophie) et
  `ba1eed0` (decision-1 Readiness), identiques aux commits canoniques cités
  dans les réveils ;
- outillage : `outils/handoff.js enregistrer-lot`, testé par
  `test_handoff_enregistrer_lot_20260909.js` (7/7, dont un refus d'enveloppe
  non conforme — branche protégée — et une mutation négative confirmant
  qu'aucun lot refusé n'apparaît dans `STATE.json.lots`) ; suite existante
  `test_handoff_v2_20260905.js` repassée à 53/53 (elle échouait avant cette
  correction, sur le registre réel, à cause du même défaut `LOT_HORS_REGISTRE`) ;
- non-régression globale : `node run-tests.js` → 227/236, les 9 échecs
  strictement identiques à la liste historique tolérée par la CI (inventaire,
  réception, chaîne temporelle — DOM/mocks absents de cet environnement),
  0 régression imputable ;
- Guardians : `outils/guardians-router.js` → 0 finding ;
  `outils/verifier-apprentissage.js` → conforme (20 règles) ;
- inventaire migrations : lecture statique des 21 fichiers, aucun accès
  Supabase nécessaire ni tenté.

## Pourquoi un humain doit-il intervenir ici ?

Il n'intervient pas pour ce retour : aucune contradiction canonique, aucun
choix métier tranché de mon fait. Deux points restent à sa main, nommés sans
être décidés : le sort des 4 migrations Test/CI (promouvoir ou exclure
explicitement), et — de façon plus structurante — le fait que ce canal ne
peut techniquement pas avancer sur les items 2/10 (mesure/fenêtre Production)
sans qu'un accès Production en lecture soit provisionné par un mécanisme qui,
lui, franchit une gate humaine (nouveau secret/rôle), même si l'usage qui en
serait fait reste strictement en lecture.
