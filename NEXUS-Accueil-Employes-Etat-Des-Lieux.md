# Accueil employés — état des lieux avant travaux

Branche `accueil-employes-20260918`, partie de `52cd4a4` (Production du 18/09,
hotfix Angélique inclus). Ce document a d'abord constaté l'existant, puis
proposé un périmètre à arbitrer.

> **Mise à jour du 18/09/2026.** Le périmètre a été arbitré depuis (voir §4) et
> un premier lot est livré sur cette branche : « l'accueil hors service ». Les
> numéros de ligne cités plus bas ont été retirés : ils périmaient à chaque
> commit, et un repère faux est pire qu'un repère absent. Les symboles cités
> (`initAccueilEmploye`, `CAPACITES_ROLE_DEFAUT`, …) se retrouvent par
> recherche dans `NEXUS-App-v1.html`.

---

## 1. Ce qui existe déjà, et qui est bon

L'accueil employé n'est pas une page laissée de côté. Il a son propre
orchestrateur, `initAccueilEmploye()` (dans `NEXUS-App-v1.html`), issu de la
refonte du 20/08/2026, et il est **piloté par le rôle du jour**, pas par le
rôle habituel de la fiche :

* `CAPACITES_ROLE_DEFAUT` — matrice rôle du jour → modules (FDJ,
  réception carburant), combinée aux réglages de site existants (forfait
  Professional, `reception_carburant_role`) sans les remplacer.
* `roleADroitModule()` — rôle inconnu ⇒ on **n'interdit pas**, on
  laisse passer (Article 5). Le bon réflexe.
* Les missions obligatoires, l'inventaire, FDJ, la réception et le jaugeage
  sont filtrés par ce même rôle du jour, avec les cas particuliers documentés
  (un renfort n'a pas de comptage, on n'interroge même pas la table).

**Conséquence directe du hotfix d'aujourd'hui, et elle est correcte** : un
pompiste qui prend désormais un poste de caissière voit l'accueil d'une
caissière — FDJ inclus. Rien à corriger de ce côté, la chaîne est cohérente.

## 2. Les trois écarts constatés

### 2.1 — `polyvalent` est un rôle du jour impossible à choisir

`polyvalent` existe en base (`shifts.role`, `mission_catalog.role_required`),
il est traité par la matrice de l'accueil et porte un libellé
(`LIBELLE_ROLE_JOUR`). Il est également géré par
`NEXUS-Assignations-v1.html`.

Mais `NEXUS-Prise-De-Poste-v1.html` ne propose que quatre rôles — pompiste,
caissière, renfort, manager. Un employé assigné « polyvalent » ne peut pas
prendre ce poste lui-même ; il le reçoit par assignation ou pas du tout.

C'est soit un rôle à retirer du code, soit un rôle à rendre sélectionnable.
Les deux se défendent ; ce qui ne se défend pas, c'est qu'il vive à moitié.

### 2.2 — La granularité de visibilité s'arrête à « manager / tous »

`PAGES_INDEX` ne connaît que trois valeurs de `role` : `all`, `manager`,
`createur`. Toute finesse par rôle du jour est donc codée en dur, au cas par
cas, dans le filtre de recherche :

* Pointage masqué si le site l'a désactivé ;
* Inventaire masqué pour un renfort.

Deux exceptions aujourd'hui, écrites à la main. C'est tenable à deux ; ça ne
l'est plus à six, et c'est la trajectoire connue de cet écran.

### 2.3 — La note de conception de l'accueil ne parle pas des employés

`NEXUS-Refonte-Accueil-Note-Conception.md` (24/07/2026) cadre l'accueil **du
Directeur** : Indice NEXUS, Capital NEXUS, Conseiller, 3 décisions. Le mot
« employé » n'y désigne que des écrans à ranger au niveau 4.

L'accueil employé a bien été refondu depuis (20/08), mais **sans note de
conception équivalente**. Les règles vivent dans les commentaires du code, qui
sont excellents et datés, mais dispersés. C'est ce qui rend aujourd'hui
difficile de répondre à « que doit voir Angélique en ouvrant NEXUS ? » sans
relire six cents lignes.

## 3. Périmètre proposé, par ordre de valeur

| # | Travail | Pourquoi maintenant | Risque |
|---|---|---|---|
| 1 | Trancher `polyvalent` : le rendre sélectionnable ou le retirer | Incohérence visible en base, et le hotfix du jour vient de rouvrir le sujet des rôles | Faible |
| 2 | Porter la finesse « rôle du jour » dans `PAGES_INDEX` | Supprime les exceptions codées en dur avant qu'elles se multiplient | Moyen — touche la navigation de tous |
| 3 | Écrire la note de conception « Accueil employés » | Fixe la règle hors du code, comme l'a été la règle de pointage | Nul |

## 4. Le périmètre arbitré, et ce qui a été livré

Cette section demandait un arbitrage ; il a été rendu le 18/09/2026 : « le
parcours doit guider Angélique et les autres employés : prendre ou reprendre
leur poste, voir leur rôle du jour, comprendre la prochaine action et accéder
directement aux missions correspondantes ».

Ce n'est aucun des trois lots proposés ci-dessus — c'est un quatrième écart,
que le tableau ne voyait pas parce qu'il regardait le code plutôt que l'écran
tel qu'un employé le reçoit. **Depuis le 16/09/2026, l'accueil est en catégorie
`consultation` : on peut l'ouvrir sans avoir pris son poste**, alors qu'il
était resté écrit pour quelqu'un en service.

### 4.1 — Lot livré : « l'accueil hors service »

Une seule notion introduite, `enService` — le service ouvert **aujourd'hui**, et
lui seul (un quart laissé ouvert la veille n'en est pas un, même règle que
l'écran Pointage). Six conséquences :

| Avant | Après |
|---|---|
| « Votre service est en cours · 3 actions à terminer », sans service | « Aucun poste en cours », ou « Consultation externe » |
| Prochaine action « Pointer l'arrivée » | « Prenez votre poste pour démarrer votre service » → prise de poste |
| Inventaire / FDJ / réception / jaugeage prescrits sans quart | Aucun contrôle de quart hors quart |
| Tuiles Missions / Inventaire / FDJ qui **rebondissent** (catégorie `operationnel`) | Les écrans réellement atteignables, plus le geste qui débloque le reste |
| Barre de progression à 0 % sur une journée qui n'a pas commencé | Barre masquée — et **toujours cochée** sur une journée terminée |
| Rôle du jour inconnu ⇒ ligne de statut sans rôle | Rôle affiché brut (même esprit que l'Article 5) |

**Ce que le lot ne fait pas, volontairement** : aucune écriture, aucune
redirection d'office. L'accueil propose la prise de poste, il ne l'impose pas —
« l'authentification n'est jamais une preuve de présence », et le seul `insert`
sur `shifts` reste le bouton « Confirmer » de la prise de poste.

Gardé par `test_accueil_hors_service_20260918.js` (63 contrôles), éprouvé par
`outils/mutation-accueil-hors-service.js` (13 défauts réintroduits un à un,
13 tués).

### 4.2 — Ce qui reste ouvert

Les trois lots du §3 (`polyvalent` à trancher, finesse de `PAGES_INDEX`, note de
conception) n'ont pas été touchés. Ils restent à arbitrer.
