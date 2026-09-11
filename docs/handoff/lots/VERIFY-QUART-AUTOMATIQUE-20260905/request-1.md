---
protocol: nexus-handoff/2
kind: request
lot_id: VERIFY-QUART-AUTOMATIQUE-20260905
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: suite
    classe: VERIFIED
    valeur: 186/195
  - id: rejeu-reel-apres-seuil
    classe: HUMAN
    valeur: Quart 2 propose automatiquement, selecteur non touche
  - id: epreuve-negative
    classe: VERIFIED
    valeur: 7 mutations sur 7 detectees
  - id: regle-unique
    classe: VERIFIED
    valeur: aucun ecran ne reassemble la regle - test dedie
  - id: deploiement
    classe: DECLARED
    valeur: commit 9907039 generation daad2a1c0038 test coherent=true
  - id: a19-pause-obligatoire
    classe: NOT_APPLICABLE
    valeur: dette distincte
---

# Bloqueur Verify — sélection automatique du quart

## Résumé

Verify propose désormais le bon quart sans intervention. Rejeu réel après le
seuil Q2 : **Quart 2 proposé automatiquement**, sélecteur non touché.

La règle n'appartient plus à Verify : elle a rejoint `NexusStation`, et les
**cinq** écrans qui en dépendent l'appellent au lieu d'en porter chacun une
copie.

## Diagnostic

Verify n'avait **aucune** détermination de quart — pas une règle fausse, une
absence de règle. Son `<select id="v_quart">` listait « Quart 1 » en première
position et le navigateur la choisissait par simple position dans le DOM.
L'écran proposait donc Q1 à 21 h, et le manager devait corriger à la main.

Deux aggravations trouvées au passage :

- `document.getElementById('v_quart').value = '1'` dans
  `reinitialiserFormulaireNouveau()` : après chaque enregistrement, le
  formulaire retombait dans le défaut que le précédent venait d'éviter ;
- `value.trim() || '1'` à l'enregistrement : une absence de choix devenait
  Quart 1 **au moment même de l'écriture**, sans que personne ne l'ait décidé.

## Modifications

### La règle, une seule fois

`NexusStation.quartConfigureDuMoment(siteId, timezone, instant, client)` :
seuil configuré du site + heure locale de la station. Contrat de retour
identique à `fuseauDeLaStation` — `{ quart }` ou `{ indetermine }` qui dit
pourquoi. Vocabulaire neutre « 1 » / « 2 » ; chaque écran traduit.

`NexusStation.seuilDeBascule(siteId, client)` en est extrait pour les écrans
qui résolvent une fois puis tranchent plusieurs fois sans réseau.

**Ma première correction ne respectait pas la consigne** : elle ajoutait
`quartDuMomentVerify()`, une fonction locale — la cinquième copie, donc un
cinquième endroit où la règle peut diverger le jour où le seuil change. Elle
a été remplacée par une délégation de trois lignes.

### Cinq appelants convergent

| Écran | Avant | Après |
|---|---|---|
| Verify | *aucune règle* | délègue, vocabulaire `1`/`2` |
| FDJ | copie locale | délègue, `1`/`2` |
| Inventaire | copie locale | délègue, traduit `matin`/`soir` |
| Données manager | copie locale | délègue, client **injecté** préservé |
| Prise de poste | copie locale | `seuilDeBascule`, résolution en deux temps préservée |

Deux cas ont demandé du soin plutôt qu'une conversion mécanique. La couche de
données du manager reçoit son client par injection — c'est ce qui la rend
éprouvable sans réseau — donc la règle commune accepte un client optionnel.
Prise de poste tranche à **trois** endroits sans réseau : la rendre asynchrone
aurait été un recul, elle lit donc seulement le seuil par le chemin commun.

### Verify

Première `<option>` à `value=""` — elle ne désigne plus aucun quart, donc le
choix par défaut du navigateur n'est plus un quart plausible. Plus de `'1'` en
dur à la réinitialisation. L'enregistrement refuse un quart indéterminé avec un
message, au lieu de replier sur Q1.

**Extension assumée, hors du strict énoncé** : la date de départ venait de
`new Date()`, l'horloge de l'appareil. La laisser aurait mis une date de
téléphone à côté d'un quart de station — à 21:00 en Martinique, un appareil
réglé sur Paris est déjà au lendemain. Ma correction du quart aurait *créé*
cette incohérence ; la date passe donc au fuseau de la station, et un seul
endroit pose le contexte.

## Preuves

**Rejeu réel, après le seuil, sélecteur non touché** — session Manager Test,
navigation directe vers Verify, aucune autre action :

```
quart: "2"   libelle: "Quart 2"   date: "2026-09-05"
options: ["", "1", "2"]
```

Heure station ≈ 21:30 (`America/Martinique`), seuil configuré `quart2.normal`
= 13:00 → Quart 2. La première option vaut `""` et pourtant la valeur
sélectionnée est `"2"` : la détermination a bien eu lieu et a remplacé le
défaut vide. **Aucun avertissement en console.**

**Tests** : `test_verify_quart_automatique_20260905.js` (8 vérifications) et
`test_quart_horaires_configures_20260905.js` étendu (12), dont une nouvelle
assertion « la règle du quart n'existe qu'en un seul exemplaire ».

**C'est cette assertion qui a trouvé la cinquième copie**, dans Prise de
poste, que je n'avais pas vue en écrivant la correction.

**Épreuve négative** : 7 mutations, **7 détectées** — Verify réassemblant la
règle localement, un refus retombant sur Quart 1, la règle commune lisant
l'horloge de l'appareil, un seuil en dur, FDJ se remettant à traduire,
Inventaire cessant de traduire, Prise de poste relisant le seuil elle-même.
Plus tôt, 9 mutations sur la version Verify-locale, toutes détectées.

**Suite** : `186/195`, mêmes 9 échecs historiques. Simulations carburant et
Paye (15/15) au vert.

**Déploiement** : commit `9907039`, génération `daad2a1c0038`, `test`,
`coherent = true`. La génération a changé cette fois — `nexus-station.js` est
un actif épinglé, contrairement aux pages.

**Refs protégées** : `main` et `production` à `501c0c7`. Aucune écriture
Production, aucune migration.

## Risques / anomalies

1. **Aucune preuve automatisée du comportement** : la suite tourne sans
   réseau. Les propriétés structurelles sont gardées, le comportement est
   prouvé par le rejeu réel ci-dessus.
2. **Le cas « avant le seuil » n'est pas rejoué** : il faudrait attendre le
   matin. La bascule elle-même est éprouvée par les tests de bornes de C2,
   qui n'ont pas changé.
3. **A19 reste ouverte** et hors périmètre.

## Questions pour arbitrage

**Q20 — Faut-il rejouer Verify avant le seuil ?** Recommandation : **non**.
La décision `1 ou 2` appartient à `quartDepuisMinutes`, primitive pure déjà
éprouvée aux bornes par C2 ; Verify n'y ajoute rien. Attendre le matin
retarderait le gel de Test sans rien prouver de neuf.

**Q21 — Les cinq convergences suffisent-elles à clore la dette de
duplication ?** `NEXUS-Inventaire-Manager-v1.html` et
`nexus-horizon-operationnel.js` appellent encore `minutesLocalesStation`
directement, mais pour autre chose qu'un quart. Recommandation : **oui, la
dette est close** ; ces deux usages ne décident pas d'un quart, et les y
forcer élargirait le lot sans bénéfice.

## Action attendue de ChatGPT

Arbitrer Q20 et Q21 pour le `LOT_ID` **VERIFY-QUART-AUTOMATIQUE-20260905** et,
si la gate est satisfaite, fermer le bloqueur Verify (`decision-1.md`,
`closes: true`).
