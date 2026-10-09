<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-HEURES-VERIFY-PAYE-1-20261009/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=b17ac7a
  - id: audit
    classe: VERIFIED
    valeur: docs/plans/2026-10-09-audit-heures-verify-paye.md — 325 lignes, sept reponses du 12 avec file.line en regard
  - id: code-inchange
    classe: VERIFIED
    valeur: Phase A en lecture seule — aucun fichier applicatif modifie, seul le rapport est ajoute
  - id: supersession
    classe: DECLARED
    valeur: regle du 03-09-2026 heures par defaut si pas de planning, superseeded par le cahier des charges du 09-10-2026
  - id: surface-securite
    classe: VERIFIED
    valeur: audits_caisse deja restreint manager-gerant meme site par 20260728140338 lignes 76-79 — aucune RLS a toucher
  - id: migrations
    classe: DECLARED
    valeur: deux migrations necessaires, ecrites mais appliquees a aucun environnement — gate humaine
---
# Heures Verify / Paye — restitution de l'audit, conception, et les quatre points qui demandent un arbitrage

Objet : cahier des charges « Refonte coordonnée de NEXUS Verify et NEXUS Paye »
remis par Frédéric le 09/10/2026, périmètre station Vito Sainte-Marie Usine.

**Phase A terminée, en lecture seule.** Aucun fichier applicatif n'a été
modifié : le seul ajout au dépôt est le rapport d'audit,
`docs/plans/2026-10-09-audit-heures-verify-paye.md` (325 lignes), qui répond
aux sept questions du §12 avec la ligne de code en regard de chaque réponse.
Ce qui suit en est la synthèse, puis la conception proposée.

---

## 1 · Ce que l'audit a trouvé

Six écarts, et un seul endroit où les heures se calculent — la boucle par
journée de `construireRapport()`, `nexus-paye-moteur.js` lignes 248-311. Il
n'existe aucun second moteur d'heures dans le dépôt.

| # | écart au cahier des charges | emplacement | nature |
|---|---|---|---|
| 1 | Le planning plafonne les heures Verify | moteur 260 | règle de calcul |
| 2 | Les durées 7/8 h sont en dur, hors Paramètres Station | moteur 79-87 | paramétrage |
| 3 | La journée hors planning bloque tout le mois | moteur 300, 510, 661 + écran 77 | statut |
| 4 | La 8ᵉ heure est qualifiée supplémentaire d'office, deux fois | moteur 87 et 341 | qualification |
| 5 | Les retards dérivent du pointage, sans saisie manager | moteur 170, 320 | source |
| 6 | Aucune déclaration de renfort depuis Verify | absent | fonctionnalité neuve |

Trois constats méritent d'être énoncés avant toute correction, parce qu'ils
changent la taille du travail.

**Le barème est déjà juste.** `JOURS_HUIT_HEURES = [4,5,6]` et `7 + supp`
produisent dimanche→mercredi 7 h, jeudi→samedi 8 h, renfort 7 h : exactement
le tableau du §3. Aucune valeur n'est à changer, seulement leur emplacement.
De même, les horaires standards du renfort du §5.2 existent déjà tels quels
dans Paramètres Station — `renfort: { debut 09:00, fin 17:00, pause 13:00-14:00 }` —
et le moteur de paye ne les lit simplement jamais. Le §5.2 est un câblage,
pas une invention.

**Les heures hors planning ne sont pas perdues, elles sont bloquantes.** Sur
une journée confirmée par Verify et absente du planning, les heures sont
calculées au barème et **déjà ajoutées** à `heuresConfirmees` (ligne 293,
prouvé par `test_nexus_paye_bareme_heures.js`). Ce qui casse, c'est le statut :
l'item `presence_exceptionnelle` naît `a_verifier`, tout item `a_verifier`
devient un bloqueur (ligne 510), et le bouton « Valider le mois » est
`disabled` dès qu'un bloqueur existe (`NEXUS-Paye-v1.html` ligne 77). Une
journée pourtant constatée bloque donc la préparation de la paie du mois
entier. Le §4 n'appelle pas une correction de calcul, il appelle une
correction de statut.

**Le plafonnement par le planning n'est pas un accident.** Il applique une
instruction datée, consignée en tête de `test_nexus_paye_bareme_heures.js` :
« Pour les heures par défaut **si pas de planning**, Verify en fonction des
jours travaillés doit attribuer les heures travaillées » (03/09/2026). Le
cahier des charges du 09/10/2026 dit l'inverse — « Le planning ne doit pas
plafonner les heures justifiées par Verify » — et il est plus récent. Je prends
donc acte de la **supersession**, et je l'écris ici pour qu'elle soit un acte
tracé et non une réécriture silencieuse d'une consigne antérieure.

### Deux découvertes qui réduisent le travail

**Le rapprochement prévision / constat est déjà écrit, et branché nulle part.**
`nexus-planning-sheets-moteur.js` expose `rapprocherAvecVerify()`, qui rend
déjà par date et par quart `converge`, `prevusAbsents`, `presentsNonPrevus`,
`planningConnu` — très exactement la rubrique « Écarts Verify / Planning » du
§9 — et `resumerParEmploye()` lève déjà un `renfortProbable`. Aucun écran ne
les consomme ; seul `test_nexus_planning_sheets.js` les appelle. Le §9 est
largement un câblage.

**La déclaration d'un renfort n'élargit aucune surface de sécurité.**
`audits_caisse` n'accepte `insert`/`update` que pour `manager`/`gerant` sur son
propre site (`20260728140338`, lignes 76-79) ; les trois tables de paye leur
sont réservées de même. Une colonne de renfort portée sur `audits_caisse`
hérite donc d'un droit **déjà existant**, et l'interdiction du §10 — un salarié
Verify ne doit pas pouvoir toucher les règles de paie — est structurellement
satisfaite. Aucune politique RLS n'a besoin d'être touchée. Et comme
`audits_caisse_versions.valeurs` est un instantané jsonb de la ligne entière,
toute colonne ajoutée est historisée sans une ligne de code de plus : le §10
et le scénario §11 « modification d'une clôture existante » sont déjà outillés.

### Un aggravant, trouvé en chemin

La station peut déclarer son planning officiel dans Google Sheets
(`station_config.planning_source`). Dans ce cas `nexus-paye-donnees.js` ligne 28
range l'information dans `rapport.planningOfficiel` **après** le calcul : le
moteur ne la reçoit jamais et continue de plafonner sur `planning_shifts`, une
table qui n'est alors ni la prévision officielle ni nécessairement à jour.
Pendant ce temps l'écran affiche « PAYE la rapproche toujours des preuves
réelles Verify et Pointage » (ligne 67) — une affirmation plus large que ce que
le code fait. Inverser la règle du §3 referme cet écart par construction.

---

## 2 · Conception proposée (Phase B)

Séparée, comme le §12 l'exige, en changements de **calcul**, en **anomalies**
et en **corrections managériales**.

### Calcul

1. **Verify conduit, le planning ne plafonne plus.** `heuresJour` devient le
   barème du poste constaté dans Verify. La durée au planning n'est plus
   retenue comme montant ; elle devient le terme de comparaison qui produit un
   écart. Surface de dépendance mesurée et petite : `duree_heures` a un seul
   producteur (la fonction Postgres `generer_planning_mensuel`) et un seul
   consommateur (`nexus-paye-moteur.js` ligne 257).
2. **Durées de référence dans Paramètres Station**, sous
   `paye_config.durees_reference`, par jour de semaine, valeurs initiales
   identiques à l'actuel (7/7/7/8/8/8/7) pour qu'aucun mois ne change de
   montant à la migration. Le moteur les lit ; plus aucune durée en dur. Le
   renfort lit `station_config.horaires.renfort` et en déduit sa durée nette,
   au lieu du 7 h codé.
3. **Fin de la qualification automatique en heures supplémentaires.** Le
   barème rend une durée de référence, sans `heuresSupplementaires`. Le second
   mécanisme (item `heure_supplementaire` de 60 minutes, lignes 330-347) cesse
   d'être émis automatiquement. Le §3 est explicite : la qualification « relève
   d'un calcul distinct ».
4. **Consolidation avant calcul**, §6 : une même personne vue en caisse par
   Verify et par ailleurs annoncée en renfort sur le même créneau est comptée
   **une fois**, priorité à la caisse constatée ; un renfort déclaré deux fois
   le même jour sur deux clôtures est dédoublonné. Les services distincts et
   les chevauchements partiels sont diagnostiqués sans perdre les périodes
   réellement justifiées.

### Anomalies

5. **Rubrique « Écarts Verify / Planning », non bloquante.** L'item
   `presence_exceptionnelle` cesse de naître `a_verifier` et rejoint le chemin
   déjà existant des informations sans impact paie — `NEXUS-Paye-v1.html`
   ligne 73 rend déjà une section « Informations sans impact paie · n » avec le
   texte « ne bloquent pas le dossier », et ces items ne comptent pas parmi les
   bloqueurs. Alimentée par `rapprocherAvecVerify()`, enfin branché. Chaque
   anomalie porte le salarié, la date, la fonction prévue, la fonction
   constatée, la source de chaque information, la différence et son statut de
   traitement. Marquer une anomalie examinée, corrigée ou justifiée ne touche
   aucun montant — §9, « ne doit pas modifier silencieusement les heures ».

### Corrections managériales

6. **Retards : 0 par défaut, manager seulement.** La dérivation depuis
   `pointages.retard_min` est coupée. Les retards déjà enregistrés dans
   `nexus_paye_items` **restent** ; seule leur génération automatique cesse.
   Une saisie manager, motivée et tracée, les remplace.
7. **Horaire exceptionnel manager**, §5.4 : salarié, date, début, fin, pause,
   motif, auteur, date de modification ; durée nette recalculée par le moteur ;
   valeurs initiale et modifiée conservées ; les paramètres standards de la
   station restent intacts.

### Verify

8. **Bloc « Renfort présent pendant ce service ? »**, Non par défaut,
   compact, secondaire, persisté avec la clôture `audits_caisse` — upsert
   idempotent sur `(site, date, quart)`, ce qui répond au scénario §11 « panne
   réseau pendant la clôture » sans mécanique nouvelle. Oui révèle la liste des
   salariés **actifs et du site**, filtre déjà appliqué par le sélecteur
   existant (`.eq('site_id', SITE_ACTUEL).eq('actif', true)`) : le scénario
   « renfort d'un autre site non autorisé » est couvert d'emblée. Ce qui manque
   au sélecteur et que j'ajoute : la **recherche rapide** des §8.1 et §8.2. Les
   renforts déjà déclarés sont affichés pour éviter le doublon. Aucun horaire à
   ressaisir, rappel discret « 9 h-17 h, pause 1 h, soit 7 h ». Aucune boîte de
   dialogue navigateur : les erreurs du §8.3 doivent être reprenables sans
   perdre les autres données de clôture, ce qu'un `confirm()` ne sait pas
   faire — et qu'iOS en PWA ignore parfois purement.

---

## 3 · Ce que je fais sans attendre, et ce qui ne peut pas avancer sans vous

### Sous pré-autorisation, sur `config-par-environnement`

Conception, implémentation, épreuves et calibration des six écarts ci-dessus,
plus les quatorze scénarios de recette du §11 et la non-régression Verify
exigée (rapprochements de caisse, audits, mouvements, validations existantes —
y compris la validation scindée piste/boutique et les colonnes héritées
`valide_le` dont dépend « Mes Caisses »). Le §13 le dit : « Les corrections
techniques compatibles avec les règles métier ci-dessus doivent progresser
sans demandes de GO répétitives. »

J'**écris** les fichiers de migration nécessaires. Je n'en **applique aucun**,
ni sur Production ni sur Supabase Production.

### Gates humaines, que je ne franchis pas

- Toute migration Production. Deux sont requises : étendre les contraintes
  CHECK de `nexus_paye_items` (`type_item`, et `statut` si la rubrique prend un
  statut neuf) et ajouter la colonne de renfort sur `audits_caisse`. Le risque
  n'est pas théorique : l'en-tête de `20260903114744` rappelle qu'un type
  d'item inconnu de la contrainte fait échouer l'écriture **silencieusement**.
- Toute promotion en Production, son déploiement, ses données.

### Et une dette antérieure, toujours ouverte

Le cockpit Paye du mandat précédent est fusionné dans `production`, mais
l'environnement `github-pages` attend encore votre approbation pour le run
#37963691322. Tant qu'elle n'est pas donnée, **la page servie sur
`app.nexusconseil.net` est l'ancienne** — vérifié par `curl`, zéro occurrence
des marqueurs du cockpit. Aucune mise en Production réussie n'est déclarée.

---

## 4 · Les quatre points qui demandent votre arbitrage

Ils ne sont pas tranchés par le cahier des charges, et chacun touche ce que
voit le comptable ou ce que contiennent les mois déjà clos.

**Q1 — La 8ᵉ heure, dans le dossier comptable.** Aujourd'hui le PDF écrit
« X h supplémentaires sont déjà comprises dans les heures de présence (barème
jeudi/vendredi/samedi) ». Si la qualification automatique cesse, cette phrase
disparaît et le comptable voit 8 h de référence, sans mention de majoration.
Je propose de **retirer la qualification** et de conserver, à titre
d'information seulement, le repère « jour à 8 h » sans majoration calculée.
Confirmez-vous que la majoration relève bien d'un calcul hors NEXUS ?

**Q2 — Les mois déjà validés.** Le dossier PDF est régénéré depuis
l'instantané figé à la validation du mois : un changement de règle ne réécrit
donc pas un mois déjà validé, et c'est voulu. Je propose de **ne recalculer
aucun mois clos**. Confirmez-vous ?

**Q3 — Les items déjà enregistrés.** Les `retard` d'origine pointage et les
`heure_supplementaire` déjà écrits en base restent, par refus de destruction
(§4 : « Ne pas supprimer les données historiques »). Ils cesseront seulement
d'être produits. Confirmez-vous qu'on les laisse visibles tels quels ?

**Q4 — Le sens d'une case vide au planning.** Le moteur Sheets porte une règle
explicite de vous : « une case vide veut dire pas encore planifié, pas repos ».
Avec Verify qui conduit désormais les heures, une journée sans planning et
sans Verify reste donc **une inconnue**, pas une absence — je ne la compte ni
en heures ni en absence, et je la signale en écart. Confirmez-vous ?

Sur les six écarts eux-mêmes, aucune question : le cahier des charges les
tranche. Ces quatre-là sont les seuls endroits où je refuse de décider à votre
place.
