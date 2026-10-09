# Audit des heures Verify / Paye — Phase A du cahier des charges du 09/10/2026

**Lecture seule. Aucun fichier applicatif n'a été modifié pour produire ce document.**
Branche `config-par-environnement`, HEAD `a08de05`, arbre propre.

Le cahier des charges §12 demande sept réponses précises avant toute
correction, et interdit de remplacer une règle « sans avoir identifié ses
dépendances ». Les voici, chacune rattachée à la ligne de code qui la porte.

---

## 1 · Où sont calculées les heures

À un seul endroit : `nexus-paye-moteur.js`, dans la boucle par journée de
`construireRapport()` (lignes 248-311). Il n'existe aucun second calcul
d'heures ailleurs dans le dépôt — ni dans l'écran, ni dans le PDF, ni dans
Verify.

Trois branches, et trois seulement, pour une journée donnée :

| cas | condition (ligne) | heures retenues |
|---|---|---|
| planning **et** preuve | `shiftsTravail.length && preuve` (255) | `heuresPlanning`, barème seulement si la durée planning vaut 0 (257-269) |
| planning sans preuve | 272 | aucune heure ; une série d'absence est ouverte |
| preuve sans planning | `!shiftsTravail.length && preuve` (284) | barème par poste constaté dans Verify (292-297) |

`shiftsTravail` est filtré sur `STATUTS_TRAVAIL = ['travail_normal','manager','renfort','transfert_site']`
(ligne 6). Tout le reste du module — carte salarié, dossier PDF, export CSV —
ne fait que lire `fiche.heuresConfirmees` et `variablesComptables()` (ligne
583), qui est explicitement la **seule** source d'agrégation partagée par
l'écran et le PDF.

## 2 · Comment les journées Verify sont reconnues

Par l'index de preuves construit lignes 160-180. Deux sources l'alimentent :

- `pointages` de type `arrivee` → `{ type: 'pointage' }` ;
- `audits_caisse`, pour chaque identifiant trouvé dans `employes_piste` ou
  `employes_boutique` → `{ type: 'verify' }`, ou `'verify+pointage'` si un
  pointage existait déjà.

Deux faits à retenir, tous deux vérifiés dans le code :

1. **Les audits ne sont pas filtrés sur `statut`** (ligne 160 : seul
   `dateDansMois` s'applique). Une clôture Verify non encore validée par le
   manager vaut donc déjà preuve de présence. C'est cohérent avec le §2 du
   cahier des charges — Verify est la source du constat — mais ce n'est écrit
   nulle part aujourd'hui, et le §11 demande une non-régression sur « les
   validations existantes » : le point doit être énoncé, pas découvert.
2. Le **poste** du jour ne vient pas du rôle NEXUS mais de la caisse
   réellement tenue : `posteDuJour()` (ligne 92) lit `employes_piste` →
   `pompiste`, `employes_boutique` → `caissier`, et ne retombe sur
   `employee.role` qu'à défaut. C'est déjà la hiérarchie voulue par le §2, et
   c'est déjà prouvé par `test_nexus_paye_bareme_heures.js` (cas Angélique,
   renfort au rôle, boutique dans Verify → payée caissière).

## 3 · D'où proviennent les durées 7 h et 8 h

De deux constantes **codées en dur dans le moteur**, pas de Paramètres Station :

```js
const JOURS_HUIT_HEURES = [4, 5, 6];           // ligne 79 — jeudi, vendredi, samedi
return { heures: 7 + supp, heuresSupplementaires: supp, poste };  // ligne 87
```

Le barème produit donc dimanche→mercredi 7 h, jeudi→samedi 8 h, renfort 7 h
tous les jours. **Il correspond exactement au tableau du §3 du cahier des
charges** : aucune valeur n'est à changer. Ce qui est à changer, c'est leur
emplacement — le §2 exige que les durées de référence vivent dans Paramètres
Station et soient réutilisées « sans duplication de règles contradictoires ».

Vérification faite dans `nexus-station.js` (lu intégralement) : ce module ne
contient **aucune** règle d'heures de paie. Il ne lit que
`station_config.horaires`, jamais `paye_config`. Et dans
`NEXUS-Parametres-Station-v1.html`, l'écran ne propose aujourd'hui aucun champ
de durée de référence caisse/piste. Il faut donc en créer, côté `paye_config`.

En revanche, et c'est la bonne nouvelle du §5.2 : **les horaires standards du
renfort existent déjà**, exactement tels que le cahier des charges les décrit
(`NEXUS-Parametres-Station-v1.html`, `HORAIRES_MODELE`, ligne 1138) :

```js
renfort: { debut: "09:00", fin: "17:00", pause_debut: "13:00", pause_fin: "14:00" }
```

soit 9 h-17 h, une heure de pause, 7 h nettes. Le moteur de paye ne les lit
jamais : il écrit `if (poste === 'renfort') return { heures: 7, ... }`. Le §5.2
est donc satisfiable par un câblage, pas par l'invention d'un paramètre.

## 4 · Comment les renforts sont actuellement traités

**Uniquement par le planning.** `posteDuJour()` ne renvoie `'renfort'` que
dans deux cas : un `planning_shifts.statut === 'renfort'` (ligne 98), ou le
rôle NEXUS en dernier recours (ligne 103).

Il n'existe **aucun chemin de déclaration d'un renfort depuis Verify**.
Vérifié par recherche sur tout le dépôt : `audits_caisse` ne porte aucune
colonne de renfort (définition de base lignes 575-612 du baseline, plus les
quatre migrations additives), et `NEXUS-Verify-v1.html` n'en écrit aucune. Le
§5 est donc du travail réellement neuf, pas une correction.

Le point d'ancrage naturel est l'upsert de clôture
(`NEXUS-Verify-v1.html` ligne 2963), pour trois raisons déjà acquises :

- il est **idempotent** sur `(site, date, quart)` — une clôture rejouée ne
  duplique rien, ce qui répond au scénario §11 « panne réseau pendant la
  clôture » sans mécanique nouvelle ;
- chaque modification est **versionnée avant écriture** dans
  `audits_caisse_versions` (`snapshotAuditAvantEcriture`, lignes 1179-1220),
  table dont la colonne `valeurs jsonb` copie la ligne entière : une colonne
  de renfort ajoutée demain est historisée **sans un seul ligne de code en
  plus**. Le §10 et le §11 (« modification d'une clôture existante →
  historique conservé ») sont donc déjà outillés ;
- le sélecteur d'employés existant (`chargerEmployesSite`, ligne 1148) filtre
  déjà `.eq('site_id', SITE_ACTUEL).eq('actif', true)`, ce qui satisfait
  d'emblée le §5.1 (« ne pas afficher les salariés inactifs ou appartenant à
  un autre site ») et le scénario §11 « renfort d'un autre site non
  autorisé ».

Ce qui manque au sélecteur : **le champ de recherche** exigé par les §8.1 et
§8.2. Le menu actuel rend la liste complète, sans filtre.

## 5 · Pourquoi la catégorie « heures hors planning » existe, et ce qu'elle fait réellement

C'est l'item `presence_exceptionnelle`, émis ligne 300, libellé « Présence
constatée hors planning de travail ».

**Ce qu'elle ne fait pas** : elle ne retire aucune heure. Les heures sont
calculées au barème ligne 293 et **déjà ajoutées à `heuresConfirmees`** avant
que l'item ne soit créé. Le scénario §11 « Verify confirme une journée absente
du planning → heures conservées » est donc **déjà satisfait sur le montant**,
et `test_nexus_paye_bareme_heures.js` le prouve (`fiche.heuresConfirmees === 7`).

**Ce qu'elle fait réellement**, et c'est là tout le grief du §4 : elle naît
avec `statut: 'a_verifier'`. Or cette valeur déclenche une chaîne de trois
conséquences :

1. `statutSalarie()` (ligne 661) renvoie `'a_verifier'` dès qu'un item porte
   ce statut — le salarié cesse d'être « Prêt » ;
2. ligne 510, **tout** item `a_verifier` devient un bloqueur de catégorie
   `element` ;
3. dans l'écran, `NEXUS-Paye-v1.html` ligne 77, le bouton « Valider le mois »
   est `disabled` dès que `RAPPORT.bloqueurs.length` est non nul.

Conclusion : une journée pourtant confirmée par Verify **bloque la préparation
de la paie du mois entier**, exactement ce que le §4 interdit. Le défaut n'est
pas dans le calcul, il est dans le statut et dans le gate de l'écran.

## 6 · La divergence centrale : le planning plafonne les heures

Ligne 260 :

```js
let heuresJour = heuresPlanning;
if (!(heuresPlanning > 0)) { /* barème seulement ici */ }
```

Dès que le planning porte une `duree_heures` non nulle, **c'est elle qui est
retenue, et le barème n'est jamais consulté**. Une caissière vue en boutique un
vendredi, avec un planning à 7 h, est donc comptée 7 h et non 8 h — ce que le
§3 et le scénario §11 ligne 4 refusent explicitement : « Le planning ne doit
pas plafonner les heures justifiées par Verify. »

Ce comportement n'est pas un accident. Il implémente une instruction datée,
consignée en tête de `test_nexus_paye_bareme_heures.js` : « Pour les heures par
défaut **si pas de planning**, Verify en fonction des jours travaillés doit
attribuer les heures travaillées » (03/09/2026). Le cahier des charges du
09/10/2026 supersède cette règle. Le fait est noté ici pour que la
substitution soit un acte conscient et tracé, pas une réécriture silencieuse.

**Surface de dépendance de `duree_heures`, mesurée** : un seul producteur et un
seul consommateur. Elle est écrite exclusivement par la fonction Postgres
`generer_planning_mensuel` (appelée `NEXUS-Planning-v1.html` ligne 598) ; aucun
front n'écrit cette colonne. Elle est lue en un seul endroit,
`nexus-paye-moteur.js` ligne 257 (plus `nexus-paye-donnees.js` ligne 11 pour le
`select`, les tests, et `simulations/executer-paye.js`). Inverser la règle
n'entraîne donc aucun effet de bord ailleurs dans l'application.

**Aggravant découvert pendant l'audit** : la station peut déclarer son planning
officiel dans Google Sheets (`station_config.planning_source ∈
{'nexus','google_sheets'}`, migration `20260902184726`). Dans ce cas,
`nexus-paye-donnees.js` ligne 28 range l'information dans
`rapport.planningOfficiel`, que **le moteur ne reçoit même pas** : le calcul
continue de plafonner sur `planning_shifts`, une table qui n'est alors ni la
prévision officielle ni nécessairement à jour. L'écran, lui, affiche « PAYE la
rapproche toujours des preuves réelles Verify et Pointage »
(`NEXUS-Paye-v1.html` ligne 67) — une affirmation plus large que ce que le code
fait.

## 7 · Les heures supplémentaires sont qualifiées automatiquement, à deux endroits

Le §3 avertit : « Le système ne doit pas transformer automatiquement toute
heure au-delà du planning en heure supplémentaire majorée. » Or :

- le barème lui-même qualifie la 8ᵉ heure : `heuresSupplementaires: supp`
  (ligne 87), cumulé dans `fiche.heuresSupplementairesParDefaut` (lignes 266,
  296), restitué comme `heuresDejaIncluses` à l'écran et dans le PDF
  (`nexus-paye-dossier-pdf.js` ligne 132 : « déjà comprises dans les heures de
  présence (barème jeudi/vendredi/samedi) ») ;
- un **second** mécanisme émet en plus un item `heure_supplementaire` de
  `config.minutes_heure_supp` (60 par défaut), lignes 330-347, sous conditions
  `jours_heure_supp`, `activites_heure_supp` et hors renfort.

Ce second bloc est **entièrement conditionné au planning** (`if (preuve &&
shiftsTravail.length)`, ligne 330) : il ne se déclenche jamais sur une journée
Verify absente du planning. Même remarque pour l'item `jour_ferie` (ligne 348),
logé dans le même bloc.

## 8 · Les retards dépendent du pointage

Le §7 pose quatre règles : 0 minute par défaut, aucun retard déduit d'une
absence de pointage, aucun déduit d'un écart Verify/planning, et seul le
manager enregistre un retard retenu.

État réel : les retards viennent **exclusivement** de
`pointages.retard_min` (index `retardParJour`, ligne 170), matérialisés en
items `retard` ou `retard_incoherent` avec `origine: 'pointage'` (ligne 320),
le seuil d'incohérence étant `config.retard_max_coherent_min || 180`. Aucune
saisie manager n'existe pour un retard. Le §7 impose donc de couper cette
dépendance, et l'avertissement « ne pas réintroduire indirectement une
dépendance au pointage » s'applique directement à ce chemin.

## 9 · Ce qui existe déjà et n'a pas besoin d'être inventé

Trois mécanismes utiles ont été trouvés pendant l'audit et ne sont pas câblés :

1. **Le rapprochement prévision / constat existe.**
   `nexus-planning-sheets-moteur.js` expose `rapprocherAvecVerify(shifts,
   audits, employes)`, qui rend déjà, par date et par quart : `converge`,
   `prevusAbsents`, `presentsNonPrevus`, `planningConnu`. C'est très exactement
   la rubrique « Écarts Verify / Planning » du §9. Elle n'est consommée
   aujourd'hui par **aucun écran** — seulement par `test_nexus_planning_sheets.js`.
2. **La présentation « sans impact paie » existe.** `NEXUS-Paye-v1.html`
   ligne 73 rend déjà une section « Informations sans impact paie » avec le
   texte « Ces éléments restent visibles pour la traçabilité mais ne bloquent
   pas le dossier ». Les items de statut `information` ne sont pas comptés dans
   les bloqueurs. La rubrique du §4 peut reprendre ce chemin au lieu d'en
   créer un.
3. **L'historisation d'une clôture Verify existe** (§4 ci-dessus) et couvre
   gratuitement toute colonne ajoutée.

## 10 · Écrans, tables, fonctions et exports concernés

**Tables.** `audits_caisse` (colonne de renfort à ajouter — additif),
`audits_caisse_versions` (aucun changement, couverture automatique),
`nexus_paye_items` (contraintes CHECK à étendre), `station_config.paye_config`
(clés de durées de référence à ajouter), `planning_shifts` (lecture seule,
rôle rétrogradé de source de calcul à source de prévision).

**Contraintes bloquantes, vérifiées dans les migrations.**
`nexus_paye_items.type_item` est un CHECK énuméré, réécrit une fois déjà par
`20260903114744_nexus_paye_items_types_evenement_rh.sql` — dont l'en-tête
rappelle le coût d'un oubli : « toute décision manager sur une carte d'absence
échouait donc silencieusement à l'écriture ». `origine` est également énuméré
(`manuel, planning, pointage, verify, fdj, indisponibilite`) et `statut` aussi
(`a_verifier, valide, exclu`). Tout nouveau type d'item, toute nouvelle
origine, exige donc une migration — et une migration Production est une gate
humaine.

**Permissions, vérifiées.** `audits_caisse` n'accepte `insert`/`update` que
pour `manager`/`gerant` sur son propre site
(`20260728140338`, lignes 76-79) ; `nexus_paye_items`,
`nexus_paye_employee_settings` et `nexus_paye_periodes` sont restreints aux
mêmes rôles (`20260902183550`) ; `audits_caisse_versions` accepte l'insert pour
tout employé du site et la lecture pour `manager`/`gerant` seulement. Deux
conséquences : la déclaration d'un renfort portée sur `audits_caisse`
**n'élargit aucune surface de sécurité** — elle hérite d'un droit déjà
existant ; et le §10 (« un salarié utilisant Verify ne doit pas pouvoir
modifier les règles de paie ») est **structurellement** satisfait, puisque les
tables de paye lui sont fermées. Aucune politique RLS n'a besoin d'être
touchée.

**Écrans.** `NEXUS-Verify-v1.html` (bloc renfort à la clôture, recherche dans
le sélecteur), `NEXUS-Paye-v1.html` (rubrique « Écarts Verify / Planning », fin
du gate sur les écarts, saisie manager d'un retard et d'un horaire
exceptionnel), `NEXUS-Parametres-Station-v1.html` (durées de référence).
`NEXUS-Planning-v1.html` et `NEXUS-Mon-Planning-v1.html` ne sont pas modifiés.

**Fonctions.** `heuresParDefautJour`, `posteDuJour`, `construireRapport`,
`statutSalarie`, `variablesComptables`, `lignesExport`, `dossierComptable`.

**Exports.** `lignesExport()` (CSV technique) et `dossierComptable()` + 
`nexus-paye-dossier-pdf.js` (sortie principale). Le PDF est régénéré depuis
l'instantané figé à la validation du mois : un changement de calcul ne
réécrit pas un mois déjà validé, et c'est voulu.

**Tests qui encodent le comportement actuel et devront être rejoués, certains
réécrits** : `test_nexus_paye_bareme_heures.js` (encode « si pas de planning »),
`test_nexus_paye_moteur.js` (construit des `duree_heures` 7/8 et un quart
`renfort`), `test_nexus_paye_correction_heures.js`,
`test_nexus_paye_dossier_comptable.js`, `test_nexus_paye_ecran_rendu.js`,
`test_nexus_paye_evenement_rh.js`, `test_nexus_paye_interface_guidee.js`,
`test_nexus_paye_periode_manuelle.js`, `test_nexus_paye_types_persistables.js`,
`simulations/executer-paye.js`. Non-régression Verify :
`test_verify_statut_validation_quart_v2234.js`,
`test_verify_versioning_restauration_v2272.js`,
`test_verify_operations_jours_exploitables_v2221.js`,
`test_verify_quart_automatique_20260905.js`,
`test_verify_import_sheets_coherence_v2274.js`,
`test_verify_motif_ecart_validation_v2268.js`.

**Contrainte d'écran à ne pas oublier** : `test_nexus_paye_ecran_rendu.js`
interdit `prompt(`, `alert(` et `confirm(` dans tout
`NEXUS-Paye-v1.html`. Verify, lui, en contient encore (ligne 1280). Le bloc
renfort ne doit pas en ajouter, le §8.3 demandant des erreurs
« compréhensibles » et reprenables sans perte des autres données de clôture —
ce qu'une boîte navigateur ne sait pas faire, et qu'iOS en PWA ignore parfois
purement.

---

## Synthèse : six écarts, et ce qu'ils coûtent

| # | écart au cahier des charges | emplacement | nature |
|---|---|---|---|
| 1 | Le planning plafonne les heures Verify | moteur ligne 260 | règle de calcul |
| 2 | Les durées 7/8 h sont en dur, hors Paramètres Station | moteur lignes 79-87 | paramétrage |
| 3 | La journée hors planning bloque tout le mois | moteur lignes 300, 510, 661 + écran ligne 77 | statut |
| 4 | La 8ᵉ heure est qualifiée supplémentaire d'office, deux fois | moteur lignes 87 et 341 | qualification |
| 5 | Les retards dérivent du pointage, sans saisie manager | moteur lignes 170, 320 | source |
| 6 | Aucune déclaration de renfort depuis Verify | absent | fonctionnalité neuve |

Aucun des six n'exige de toucher la Production, ses données ou ses politiques
de sécurité pour être **conçu et prouvé** sur le rail. Deux d'entre eux (3 et 6)
exigeront, pour être **mis en service**, une migration — donc une gate humaine.
