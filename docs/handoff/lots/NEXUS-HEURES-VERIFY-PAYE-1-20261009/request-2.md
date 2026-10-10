---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=b17ac7a
  - id: refs-protegees
    classe: VERIFIED
    valeur: origin/main=d6093b7 origin/production=b17ac7a — inchangees, locales en retard jamais en avance
  - id: suite
    classe: VERIFIED
    valeur: npm test code sortie 0 — 268/277, aucune regression hors des 9 echecs connus, 15/15 simulations Paye
  - id: epreuves
    classe: VERIFIED
    valeur: 24/24 Verify renfort, 58/58 cockpit, 38/38 consolidation, 30/30 durees reference, 11/11 donnees renfort, 8/8 garde migrations
  - id: mutations
    classe: VERIFIED
    valeur: 20/20 sur les trois fichiers Paye, 9/9 sur le moteur, 7/7 sur la garde migrations — chaque fichier restaure a son sha1
  - id: langage
    classe: VERIFIED
    valeur: LANG-003 conforme — 1480 tirets cadratin, aucun ajout
  - id: migration
    classe: DECLARED
    valeur: 20261009120000 appliquee a aucun environnement, citee EXCLUE au manifeste, colonnes sondees avant ecriture
  - id: surface-securite
    classe: VERIFIED
    valeur: aucune permission creee, aucune RLS touchee, aucune dependance tierce — Verify charge un module du depot
  - id: production-servie
    classe: HUMAN
    valeur: approbation github-pages du run 37963691322 toujours due — la page servie est l ancienne
  - id: a-arbitrer
    classe: DECLARED
    valeur: enroulement 24h de dureeNetteHeures, et heuresExceptionnelles comme axe de provenance
---
# Heures Verify / Paye — restitution de l'implémentation et de la recette

Les phases C et D sont faites. Ce document dit ce qui a été appliqué, ce qui
a été prouvé, ce qui ne l'est pas, et les deux points nouveaux que je n'ai pas
tranchés seuls parce qu'ils relèvent du métier.

Les quatre questions de `request-1.md` (Q1 à Q4) restent ouvertes et ne sont
pas reposées ici. Rien dans ce lot ne les présuppose : le code livré est
compatible avec les deux réponses possibles de chacune.

## 1 · Les règles effectivement appliquées

**Les durées de référence ont quitté le code** (§2, §3). La table 7/7/7/7/8/8/8
ne vivait que dans `nexus-paye-moteur.js` ; elle est désormais lisible et
corrigible dans les Paramètres Station, et stockée dans
`station_config.paye_config`, un jsonb qui existait déjà. Le gris des champs
vient de la constante du moteur, pas d'une table recopiée — c'est pourquoi
l'écran charge le moteur. Un champ vide laisse s'appliquer la durée NEXUS ;
une valeur hors bornes est refusée en nommant le jour, parce que le moteur la
replierait en silence et que le manager croirait avoir changé la paie.

**Le planning ne plafonne plus rien** (§2, §3). Le calcul part de la journée
constatée dans Verify et de la durée de référence du jour. Un écart avec le
planning est signalé, jamais soustrait.

**La catégorie « heures hors planning à valider » a disparu comme blocage**
(§4). Les heures restent au calcul ; l'écart devient une ligne de la rubrique
« Écarts Verify / Planning », avec `statut: 'information'` et
`impactPaye: false`. La clé d'item historique
`presence-exceptionnelle:<id>:<date>` et son `typeItem` sont conservés, pour
que les décisions managériales déjà prises restent attachées à leur ligne.
Aucune donnée historique n'est supprimée.

**Trois règles supprimées étaient encore encodées dans les simulations** :
l'heure supplémentaire déduite d'office de la 8ᵉ heure (§3) et deux retards
déduits d'un pointage (§7). Elles affirment maintenant la règle en vigueur.

**Les retards sont à zéro par défaut et manuels** (§7). Aucun retard n'est
déduit d'une absence de pointage ni d'un écart Verify/planning. Le moteur ne
contient plus aucune lecture de `retard_min` — une épreuve l'exige. Seul un
`['manager','gerant']` peut en enregistrer un, avec motif obligatoire.

**Verify déclare un renfort sans jamais lire le planning** (§5, §8). Bloc
compact, « Non » par défaut et aucun autre champ ; « Oui » révèle la liste des
salariés actifs de ce site avec recherche. Aucun horaire à saisir : la durée
standard vient des Paramètres Station. `employes_renfort` n'est jamais dans
l'upsert principal — il s'écrit à part, après la clôture réussie, de sorte
qu'un échec du renfort ne fasse perdre ni la clôture ni le reste de la saisie.

**Aucun double comptage** (§6). Le moteur consolide les postes du jour dans un
`Set` avant calcul, et applique la priorité caisse confirmée > renfort. Une
caissière déclarée aussi en renfort le même jour compte une fois. Un renfort
déclaré deux fois sur deux clôtures compte une fois.

**Le cockpit sépare le calcul des anomalies** (§9). Les heures retenues, les
jours confirmés, les heures de caisse, de piste et de renfort, les corrections
du manager, les retards et les éléments à examiner sont distincts. Le marquage
d'une anomalie n'écrit que son statut et sa note : le traitement d'une
anomalie ne modifie aucune heure.

## 2 · Ce que la recette a mesuré

| épreuve | vérifications |
|---|---|
| `test_verify_renfort_declaration_20261009.js` | 24/24 |
| `test_nexus_paye_ecarts_manager_20261009.js` | 58/58 |
| `test_nexus_paye_consolidation_20261009.js` | 38/38 |
| `test_parametres_station_durees_reference_20261009.js` | 30/30 |
| `test_nexus_paye_donnees_renfort_20261009.js` | 11/11 |
| `test_migrations_exigees_par_le_code_20260911.js` | 8/8 |

`npm test` : code sortie 0, **268/277**, aucune régression hors des neuf échecs
connus, **15/15** simulations Paye. `LANG-003 : conforme — 1480`.

Les quatorze scénarios du §11 sont couverts : douze par l'épreuve de
consolidation, qui conduit le vrai moteur ; §11-12 (renfort d'un autre site)
et §11-13 (panne réseau pendant la clôture) par l'épreuve Verify. La non-
régression du §11 est mesurée sur les rapprochements de caisse, les audits,
les mouvements et les validations existantes.

**Les épreuves sont prouvées par mutation**, parce qu'un test vert ne dit rien
de ce qu'il attraperait : 20/20 sur les trois fichiers Paye, 9/9 sur le moteur,
7/7 sur la garde des migrations. Chaque fichier restauré à son empreinte
d'origine, vérifiée par sha1.

## 3 · Deux défauts trouvés dans mon propre travail

Ils sont écrits ici parce qu'ils ont été trouvés en mesurant, et qu'ils
auraient pu passer.

**Mes cinq tuiles du §9 se lisaient comme additives.** Une journée corrigée par
le manager incrémente `heuresExceptionnelles` ET son seau de poste : le total
est juste, mais 4,5 h de renfort suivies de 4,5 h de corrections donnaient 9 h
à l'œil. La tuile dit maintenant « Dont corrections du manager », déjà
comprises dans les trois lignes au-dessus. Correction d'affichage seule, aucun
calcul touché, et les deux épreuves asservissent désormais l'arithmétique
réelle : `caisse + piste + renfort === heuresConfirmees`.

**La garde des migrations ne voyait pas les deux colonnes que je voulais lui
confier.** Trois angles morts, dont un antérieur : elle ne lisait que les
`.html` alors que la moitié du code vit dans les modules `nexus-*.js` ; elle
n'attrapait qu'un champ en début de ligne alors qu'un payload court s'écrit
`.update({ employes_renfort: ids })` sur une seule ligne ; et sa détection de
migration acceptait le nom de colonne dans les quatre-vingts caractères
suivant `add column`, fenêtre que le `comment on column` suivant satisfaisait,
si bien qu'une colonne renommée restait vue comme créée. Une garde aveugle est
pire qu'absente : elle rassure.

## 4 · La migration, et pourquoi elle reste dehors

`20261009120000_nexus_paye_items_types_heures_verify.sql` ajoute
`audits_caisse.employes_renfort`, `nexus_paye_items.detail`, et étend les
contraintes CHECK de `statut` et `type_item`. **Elle n'est appliquée à aucun
environnement** et citée **EXCLUE** au manifeste de promotion. `request-1.md`
annonçait deux migrations ; il en faut une seule, les deux changements tenant
dans le même fichier, et les durées de référence étant parties dans un jsonb
déjà existant.

Ce qui rend cette attente tenable n'est pas une promesse mais une sonde :
chaque écran interroge la colonne avant de l'écrire et masque la
fonctionnalité si la base ne la connaît pas. Le bloc Renfort de Verify et les
deux chemins d'écriture nouveaux de Paye se masquent donc d'eux-mêmes
aujourd'hui. La garde des migrations imprime cet état nommément à chaque
exécution, au lieu de le taire :

```
audits_caisse.employes_renfort — migration en attente de gate humaine, colonne sondée avant écriture
nexus_paye_items.detail       — migration en attente de gate humaine, colonne sondée avant écriture
```

L'invariant jugé est une alternative, non un relâchement : une colonne que le
code écrit voyage avec sa migration citée INCLUSE, **ou bien** le code la sonde
et se masque sans elle. Le jour où la migration entre à un manifeste, la
première branche prend le relais.

Aucune permission n'est créée. `audits_caisse` était déjà restreint aux
manager et gérant du même site par `20260728140338` : aucune RLS n'a été
touchée. Verify n'écrit ni règle de paye ni paramètre station — une épreuve
l'exige. Verify charge `nexus-paye-moteur.js`, un module du dépôt, sans
dépendance tierce : la surface de sécurité est inchangée.

## 5 · Les deux points qui demandent votre arbitrage

**A — Un horaire qui passe minuit, ou une erreur de saisie ?**
`dureeNetteHeures` enroule à vingt-quatre heures : 17:00 → 09:00 rend 15 h au
lieu d'un refus. C'est volontaire pour un renfort qui passe minuit, et je ne
l'ai pas changé. Mais rien ne distingue aujourd'hui ce service de nuit d'une
inversion de champs par le manager. Faut-il alerter au-delà d'une durée nette
de douze heures, ou laisser le manager seul juge ? J'ai mesuré le comportement
tel qu'il est et l'ai consigné dans l'épreuve ; je ne l'ai pas arbitré.

**B — `heuresExceptionnelles` est un axe de provenance, pas un quatrième seau.**
Le total est exact et les épreuves le tiennent, mais le dossier comptable et les
exports devront choisir : montrer les corrections comme une colonne de
provenance à côté des postes, ou comme une ligne distincte. Tant que ce n'est
pas tranché, le cockpit dit « Dont », ce qui est vrai et prudent.

## 6 · Ce qui reste non prouvé, et doit être dit

- **Safari iOS n'est vérifié que statiquement.** Le §8.2 demande un
  comportement stable sur connexion lente et au double tap. Les épreuves
  mesurent le DOM et les chemins d'écriture, pas un vrai appareil.
- **Progression n'est pas branchée sur le moteur d'écarts central** et garde
  sa propre lecture. Hors périmètre de ce lot, toujours ouvert.
- **La migration n'a jamais été exécutée**, donc les contraintes CHECK
  étendues ne sont vérifiées que par lecture du SQL, pas par la base.
- **La dette du mandat précédent reste entière** : l'approbation de
  l'environnement `github-pages` pour le run #37963691322 n'est pas donnée.
  Tant qu'elle ne l'est pas, la page servie sur `app.nexusconseil.net` est
  l'ancienne, et aucune mise en Production n'est déclarée réussie.

## 7 · Ce que je demande

Un arbitrage sur **A** et **B** du §5, et sur Q1 à Q4 de `request-1.md`.
Aucune autorisation de Production n'est demandée dans ce document : la
migration reste dehors, et j'attends la gate humaine pour elle comme pour le
déploiement.
