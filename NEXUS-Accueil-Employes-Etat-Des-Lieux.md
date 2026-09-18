# Accueil employés — état des lieux avant travaux

Branche `accueil-employes-20260918`, partie de `52cd4a4` (Production du 18/09,
hotfix Angélique inclus). **Aucune modification de code à ce stade** : ce
document constate, puis propose un périmètre à arbitrer.

---

## 1. Ce qui existe déjà, et qui est bon

L'accueil employé n'est pas une page laissée de côté. Il a son propre
orchestrateur, `initAccueilEmploye()` (`NEXUS-App-v1.html:2234`), issu de la
refonte du 20/08/2026, et il est **piloté par le rôle du jour**, pas par le
rôle habituel de la fiche :

* `CAPACITES_ROLE_DEFAUT` (`:1983`) — matrice rôle du jour → modules (FDJ,
  réception carburant), combinée aux réglages de site existants (forfait
  Professional, `reception_carburant_role`) sans les remplacer.
* `roleADroitModule()` (`:1987`) — rôle inconnu ⇒ on **n'interdit pas**, on
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
il est traité par la matrice de l'accueil (`:1983`) et porte un libellé
(`LIBELLE_ROLE_JOUR`, `:1995`). Il est également géré par
`NEXUS-Assignations-v1.html`.

Mais `NEXUS-Prise-De-Poste-v1.html` ne propose que quatre rôles — pompiste,
caissière, renfort, manager. Un employé assigné « polyvalent » ne peut pas
prendre ce poste lui-même ; il le reçoit par assignation ou pas du tout.

C'est soit un rôle à retirer du code, soit un rôle à rendre sélectionnable.
Les deux se défendent ; ce qui ne se défend pas, c'est qu'il vive à moitié.

### 2.2 — La granularité de visibilité s'arrête à « manager / tous »

`PAGES_INDEX` ne connaît que trois valeurs de `role` : `all`, `manager`,
`createur` (`:2484`), valeurs testées en `:2604`-`:2606`. Toute finesse par
rôle du jour est donc codée en dur, au cas par cas, dans le filtre de
recherche (`:2593`) :

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

## 4. Ce qu'il manque pour démarrer

La consigne reçue s'arrête à « l'accueil employés, sur une branche » — la
phrase est coupée et le périmètre n'est pas donné. La branche est prête ; le
choix des lots 1 / 2 / 3, ou d'un tout autre sujet, revient à Frédéric.
