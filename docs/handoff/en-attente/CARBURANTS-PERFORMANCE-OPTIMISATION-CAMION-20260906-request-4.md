<!-- DEMANDE PRÉPARÉE, NON PUBLIÉE. Ce fichier n'est PAS dans le registre :
     docs/handoff/lots/ seul fait foi, et outils/handoff.js ne lit pas ce
     répertoire. `handoff.js demande` a refusé la publication le 07/09/2026 —
     NEXUS-ORCHESTRATION-REPAIR-1-20260907 est encore ouvert et le protocole ne
     tient qu'un lot actif. Déposer le fichier à la main dans lots/ contournerait
     précisément la garde qui a raison. À publier PAR L'OUTIL, sans réécriture,
     dès que REPAIR-1 aura reçu sa decision-2. -->

# Request-4 — delta transporté, rail réparé, preuve UI obtenue

## 1) Points 1 à 5 de `decision-3.md` — faits

**Transport (points 1-2).** Le delta prouvé sur `claude/issue-28-20260907-1232` est
sur `config-par-environnement` au commit `cc572f6`. Les deux fichiers sont repris
**octet pour octet** — sha256 identiques à ceux de la branche Claude, vérifiés :

```
nexus-carburant-commande-moteur.js                        d69c5f97…3a7ba8e
test_carburant_commande_p0_traversee_reliquat_20260907.js 8f47e1d4…f2e667d
```

Rien d'autre n'a été repris. `nexus-carburants-p0-fixes.js`,
`nexus-carburant-commande-donnees-core.js` et `nexus-carburant-moteur.js` ne
présentaient aucun diff avec la branche Claude — vérifié fichier par fichier, et
non déduit du fait que la décision l'affirmait. `NEXUS-Carburants-Pilotage-v1.html`
n'a pas été touchée.

La prémisse du correctif a été revérifiée sur le HEAD canonique plutôt que crue :
`evaluerScenarioCommande` (ligne 614) pose bien `stockPrevuLivraisonL` dans l'objet
`scenarioMaintenant`, jamais à la racine de l'évaluation ; `pourOptimisation`
(ligne 1451) faisait déjà cet aplatissement quelques lignes plus haut dans le
même fichier.

**Rejeu (point 3).** Mutation refaite sur le HEAD canonique :
correctif retiré → `AssertionError: attendu 36000, obtenu 35000` ;
correctif présent → 2/2. Suite complète **195/204**, les 9 échecs connus
inchangés, simulations vertes, CI GitHub verte.

**Déploiement (point 4).** NEXUS Test sert `39d6b4d`. L'actif JavaScript servi a
été retéléchargé et comparé au fichier canonique : **identique octet pour octet**.

**Preuve UI (point 5).** Obtenue. Détail complet dans
`docs/recettes/2026-09-07-carb-004-preuve-ui.md`. Lecture de l'objet réel dans la
page, pas de l'affichage :

```
optimiseur brut   sp95 23 606 + go 12 394 = 36 000
après arrondi     sp95 23 000 + go 12 000 = 35 000
reliquat récupéré 1 000 L sur go
refus motivé      sp95 — « Capacité disponible à la livraison insuffisante »
total à l'écran   36 000 L
```

## 2) Le rail d'intégration est réparé — cause mesurée

`actions/checkout` plaçait bien l'arbre sur `config-par-environnement`, mais
`claude-code-action` crée **ensuite** sa propre branche de travail et, sans
`base_branch`, la coupe depuis la branche par défaut du dépôt :

```
git merge-base claude/issue-28-20260907-1232 origin/main                     -> 645116b
git merge-base claude/issue-28-20260907-1232 origin/config-par-environnement -> 501c0c7
```

Le seul ancêtre commun avec la branche canonique était la baseline gelée : 260
fichiers de faux diff. Corrigé sur `main` au commit `10c65d0`, **un seul fichier**,
sur autorisation humaine explicite de Frédéric du 07/09/2026. `production` reste
à `501c0c7`. Ce n'est pas un droit d'écriture sur la branche canonique : Claude
continue de pousser sur sa seule branche `claude/issue-N-*`, mais son diff ne
contient désormais que le delta réel.

## 3) Registre remis d'aplomb

`STATE.json` avait décroché de ses propres fichiers (il pointait `request-2` alors
que `request-3` et `decision-3` étaient déposées) et le dossier
`NEXUS-ORCHESTRATION-REPAIR-1-20260907` existait sous `lots/` sans y figurer.
Même cause dans les deux cas : les runs Claude concernés étaient racinés sur
`main` et n'avaient donc ni `STATE.json` ni `outils/handoff.js` dans leur arbre.

`decision-3.md` est consommée (`587ecd7`). REPAIR-1 est inscrit tel qu'il est,
sans `consomme_le` — personne n'a jamais enregistré la consommation de sa
`decision-1.md`, et la dater après coup inventerait un acte qui n'a pas eu lieu.

Les deux défauts d'enveloppe de `request-3.md` (`status` et `token_mode` absents)
ne portaient aucun code : le registre n'offrait donc que « réécrire le fichier ».
`outils/handoff.js` leur en donne un, qualifié par le lot, et deux dérogations
nommées par Frédéric couvrent le fichier sans le réécrire. Mutation : code retiré
→ la suite Handoff échoue ; remis → 50/50.

## 4) Ce que la recette a découvert, et qui n'était pas dans le périmètre

**La base Test ne contenait aucune donnée carburant.** 0 jaugeage, 0 quart avec
litrage, 0 commande. La première tentative de preuve UI n'a donc rien prouvé :
l'écran répondait « données insuffisantes », le moteur refusant correctement
d'inventer. Le jeu de données de recette est versionné dans
`outils/recette-carburants-test.sql`, calculé hors ligne contre le vrai moteur
**avant** toute écriture, idempotent et non destructeur.

**Les cuves de la station Test ne sont pas celles de ViTO** (sp95 23 750 contre
28 761 ; go 21 850 contre 28 553). Le mécanisme prouvé est le même, les volumes
ne sont pas ceux du terrain.

## 5) Dette ouverte, non corrigée volontairement

`capaciteDisponibleLivraison(limite, stockPrevu) = limite − stockPrevu` : quand le
stock projeté à la livraison est **négatif** (station à sec avant le camion), la
capacité calculée dépasse la limite de remplissage et le moteur peut recommander
un volume que la cuve ne peut pas recevoir — observé sur 914 combinaisons du
balayage, dont sp95 25 000 L pour une limite de 23 750 L. Comportement
**pré-existant, étranger à CARB-004**. Aucune correction n'est faite : corriger au
passage une garde de capacité sans arbitrage serait l'élargissement que le
Handoff interdit. Le scénario de recette ne s'appuie pas dessus.

## 6) Erreurs de méthode, consignées

1. Un premier balayage a rendu « 0 combinaison » alors qu'il **ne tournait pas** :
   le faux `console` du banc n'avait pas de `.info`, chaque évaluation levait une
   exception avalée par un `catch` silencieux. Diagnostiqué sur un cas unique
   avant d'élargir, plutôt que conclu du zéro.
2. Le second en a rendu 914, dont la première recommandait 25 000 L dans une cuve
   de 23 750 — le cas dégénéré du §5. Un filtre de plausibilité physique a alors
   ramené le compte à **zéro**, révélant que les paliers de stock balayés étaient
   tous trop bas. Relancé sur des stocks réalistes : 195 combinaisons cohérentes.
3. J'ai un moment cru le bouton « Simuler une commande » cassé. Il ne l'était
   pas — mes clics le basculaient un nombre pair de fois. Aucun défaut déclaré.

## 7) Guardians

- **Architecture & Cohérence** : PASS — moteur seul propriétaire ; aucune logique
  ajoutée au transport ; le SQL de recette est un jeu de données, pas du code métier.
- **Security & Isolation** : PASS — Test uniquement ; `production` à `501c0c7` ;
  `main` modifiée sur le seul fichier de workflow, sur autorisation humaine
  explicite ; PIN saisi par Frédéric, jamais lu ni conservé.
- **Business Rules** : PASS — 36 000 L reste une cible atteinte seulement si sûre
  et absorbable ; le refus motivé coexiste avec la récupération dans la même réponse.
- **QA/Regression** : PASS — 195/204, 9 échecs connus inchangés, CI verte,
  mutation négative rejouée sur le HEAD canonique et sur l'écran réel.
- **Continuité** : l'incident de rail est corrigé à sa cause, pas contourné.

## 8) Production

`NOT_APPLICABLE` — aucune requête Production, aucun merge, aucun déploiement.

## Questions à arbitrer

**Q67 — Le lot peut-il être clos ?** Les points 1 à 5 de `decision-3.md` sont
faits et prouvés. Recommandation : **oui**.

**Q68 — La dette « capacité surestimée sur stock projeté négatif » ouvre-t-elle
un lot ?** Elle peut faire recommander un volume non livrable. Recommandation :
**oui, un lot distinct** — jamais un correctif glissé dans celui-ci.

**Q69 — La recette Carburants Test doit-elle devenir automatique ?** Elle est
aujourd'hui manuelle et dépend d'une saisie de PIN humaine. Le script
`outils/recette-navigateur-test.js` n'est pas sur la branche canonique et attend
des noms de secrets qui n'existent pas. Recommandation : **le traiter dans
`NEXUS-ORCHESTRATION-REPAIR-1`**, qui porte déjà ce rapatriement.
