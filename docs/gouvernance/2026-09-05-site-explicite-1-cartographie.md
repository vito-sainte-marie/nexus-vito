# SITE-EXPLICITE-1 — Phase 1 : cartographie

Établie le 05/09/2026 sur `nexus-baseline-1`. **Aucune correction appliquée.**
Aucun défaut supprimé, aucune policy modifiée, aucune insertion corrigée.

Toutes les mesures viennent de `nexus-test` (`udljdqxerrbbbajxubfn`). Les deux
preuves de comportement ont été faites **sous identité employé réelle**, en
transaction annulée.

## 1. Defaults de site encore présents

**54 colonnes**, sur 54 tables distinctes, ont pour défaut
`'vito-sainte-marie'::text` et sont `NOT NULL`.

La fiche de recette annonçait 58. L'écart n'est pas expliqué par une
correction : c'est la mesure du jour qui fait foi, et **54** est la valeur
constatée. L'ancien chiffre est probablement un comptage antérieur ou une
mesure faite sur la Production.

Fait structurant : **aucune** de ces 54 colonnes n'est protégée par le trigger
de normalisation `nexus_forcer_site_unique`. Ce trigger ne couvre que
`shifts` et `mission_catalog` — les deux seules tables portant *à la fois*
`site` et `site_id`, et précisément les deux qui **n'ont pas** de défaut.

> La protection existe là où le défaut est absent, et le défaut règne là où
> aucune protection n'existe.

### Ce qui protège réellement, table par table

Croisement des 54 tables avec leur politique `INSERT` :

| Classe | Tables | Ce qui se passe si le client n'envoie pas le site |
|---|---:|---|
| **RLS exige le bon site** | 41 | insertion **refusée** (`42501`) hors Sainte-Marie |
| **Aucune policy INSERT** | 10 | insertion refusée quel que soit le site |
| **RLS ne contrôle pas le site** | 3 | **le défaut décide** — `mission_completions`, `mission_progress`, `pointages` |

**44 tables sur 54 sont protégées par la RLS, pas par le défaut.** Le défaut
n'y est pas un risque de fuite : il est un risque de *panne silencieuse hors
Sainte-Marie*. Trois tables seulement laissent le défaut trancher — et ce sont
elles qui portent le risque de fuite.

## 2. Écritures applicatives sans `site_id` explicite

**48 écritures**, sur **37 tables**, dans 26 fichiers.

> **Correction de méthode.** Un premier balayage en annonçait 78 sur 58
> tables. Mon détecteur ne reconnaissait que `site:` et manquait la notation
> abrégée ES6 `{ site, … }`, utilisée notamment par `inventaire_quarts`.
> 30 des 78 étaient des faux positifs. Le chiffre retenu est **48**.

### Classement par conséquence réelle

| Classe | Tables | Conséquence |
|---|---:|---|
| **A** — la table n'a pas de colonne site | 7 | hors sujet |
| **B** — colonne site sans défaut, `NOT NULL` | 18 | l'insertion échouerait ; ces chemins fournissent le site autrement ou ne sont jamais exercés |
| **C** — défaut + aucune policy INSERT | 1 | insertion refusée |
| **D** — défaut + RLS exige le bon site | 9 | **fonctionnalité cassée hors Sainte-Marie** |
| **E** — défaut + RLS ne contrôle pas le site | 2 | **écriture sur le mauvais site, acceptée** |

### Classe E — le défaut décide

| Table | Chemin |
|---|---|
| `mission_completions` | `NEXUS-Missions-v1.html:1268` — parcours employé réel |
| `pointages` | `NEXUS-Debug-v1.html:199` — écran de mise au point |

### Classe D — cassé hors Sainte-Marie

| Table | Chemin |
|---|---|
| `inventaire_comptages` | `NEXUS-Inventaire-v1.html:636` — **le comptage lui-même** |
| `inventaire_mouvements` | `NEXUS-Inventaire-v1.html:788` · `nexus-inventaire-transferts-internes.js:195` |
| `fdj_shift_counts` | `NEXUS-FDJ-v1.html:1192` · `:2046` · `NEXUS-FDJ-Manager-v1.html:5184` |
| `fdj_stock_movements` | `NEXUS-FDJ-Manager-v1.html:3075` · `:3248` · `:3541` |
| `fdj_alertes` | `NEXUS-FDJ-Manager-v1.html:5467` |
| `mission_assignments` | `NEXUS-Assignations-v1.html:255` |
| `employee_contraintes` | `NEXUS-Planning-v1.html:354` |
| `employee_indisponibilites` | `nexus-paye-donnees.js:162` |
| `coach_daily_recommendations` | `nexus-coach-fdj-donnees.js:317` |

## 3. Preuves de comportement, sous identité employé réelle

### Classe D — le comptage est impossible hors Sainte-Marie

```
site du compte vu par la RLS : nexus-station-test
insert SANS site : REFUSE [42501] new row violates row-level security policy
                   for table "inventaire_comptages"
```

Ce n'est pas une hypothèse : sous le compte d'Employé Test A, l'écriture
centrale du comptage d'inventaire est refusée. **NEXUS ne sait compter un
inventaire que dans une seule station.**

### Classe E — l'écriture part sur le mauvais site, et disparaît

```
insert SANS site : ACCEPTE — ligne rattachee au site « vito-sainte-marie »
site reel de l'employe                : « nexus-station-test »
visible par le manager du site de l'employe : 0   (0 = la ligne lui echappe)
```

Trois conséquences en une : la donnée est **fausse** (mauvais site), elle est
**invisible** de son propre manager, et elle **contamine** les données de
Sainte-Marie.

## 4. Le profil créateur

`nexus_site_autorise(p_site)` — `SECURITY DEFINER`, `STABLE`. Ordre exact :

1. pas de compte authentifié → refus `42501` ;
2. `p_site` nul ou vide → refus `42501` ;
3. site du compte = site demandé → autorisé ;
4. **`je_suis_createur()` ET `sites.acces_createur_autorise = true`** → autorisé ;
5. sinon refus.

La garde est correctement fail-closed. Le problème n'est pas sa logique, c'est
que **personne ne l'exerce** :

| Mesure | Valeur |
|---|---|
| Comptes `est_createur = true` en Test | **0** |
| Sites avec `acces_createur_autorise = true` | **3 sur 3** |
| Politiques RLS contenant une branche créateur | **43** |
| Fonctions appelant `nexus_site_autorise` | 2 |

**43 politiques comportent une branche créateur qu'aucun compte ne peut
emprunter et qu'aucun test ne parcourt** — et les trois sites lui sont
ouverts. C'est le seul chemin transverse par conception, et le seul qui n'ait
jamais été éprouvé.

## 5. `site` et `site_id` — qui est la source de vérité

| Cas | Tables | Source de vérité |
|---|---:|---|
| Les deux colonnes coexistent | **2** (`shifts`, `mission_catalog`) | `site_id`, `site` en copie — garanti par `nexus_forcer_site_unique` |
| `site` seul | majorité des tables métier | `site` |
| `site_id` seul | `employees`, missions, planning | `site_id` |

La doctrine A3-1/A3-2 dit `site_id` source de vérité. **Elle n'est vraie que
pour les deux tables qui portent les deux colonnes.** Ailleurs, le nom de la
colonne varie et aucun contrat ne l'unifie : `pointages.site`,
`mission_completions.site_id`. Une correction devra choisir entre uniformiser
les noms — coûteux, risqué — et déclarer explicitement que le nom est libre
tant qu'une seule colonne existe.

## 6. Risques de migration

| Objet | Nombre | Risque |
|---|---:|---|
| Colonnes à défaut à retirer | 54 | retirer le défaut sur une colonne `NOT NULL` **casse toute écriture qui comptait dessus** — les 9 chemins de classe D deviendraient des `23502` au lieu de `42501` |
| Données héritées | à mesurer par table | les lignes déjà écrites gardent `'vito-sainte-marie'` ; **aucune reprise rétroactive sans règle métier validée** (A18) |
| Triggers | 2 | `nexus_forcer_site_unique` sur `shifts` et `mission_catalog` — le seul mécanisme de normalisation existant, à étendre plutôt qu'à dupliquer |
| Vues | 25 dont 17 `SECURITY DEFINER` | contournent la RLS de l'appelant ; toute correction du site doit vérifier qu'elles ne rouvrent pas ce qu'on ferme |
| Fonctions | 2 utilisant `nexus_site_autorise` | à recenser exhaustivement avant modification |
| Edge Functions | **0 en Test** | **impossible de vérifier en recette** qu'elles n'écrivent pas sans site — angle mort assumé |

## 7. Tests négatifs multi-site à prévoir

À écrire **avant** toute correction, et à faire échouer d'abord :

1. **écriture sans `site_id`** → refusée, ou normalisée sur le site du compte — jamais silencieusement rattachée à un autre site ;
2. **écriture avec un mauvais site** → refusée `42501`, sur les 54 tables ;
3. **lecture inter-site** → zéro ligne, dans les deux sens ;
4. **profil créateur** → lit les sites `acces_createur_autorise`, refusé ailleurs ; **exige de créer un compte créateur de test** ;
5. **caissier / pompiste / renfort** → bornés à leur site, chacun avec son compte ;
6. **fail-closed site absent ou incohérent** → aucune écriture, message explicite, jamais de repli ;
7. **épreuve négative de méthode** : un test qui passerait encore après suppression du garde n'est pas un test — chaque contrôle doit être éprouvé par mutation.

Le point 4 impose une précondition : **il n'existe aujourd'hui aucun compte
créateur**. Le créer est un préalable, pas une étape de correction.

## 8. Plan de correction proposé — non exécuté

| Étape | Contenu | Dépend de | Rollback |
|---|---|---|---|
| **0** | Créer les comptes de test manquants : créateur, pompiste, renfort | — | supprimer les comptes |
| **1** | Écrire les 7 familles de tests négatifs **et les faire échouer** | 0 | aucun effet applicatif |
| **2** | Corriger les 2 écritures de classe E — `mission_completions`, `pointages` | 1 | revert applicatif seul |
| **3** | Corriger les 9 écritures de classe D | 1 | revert applicatif seul |
| **4** | Étendre `nexus_forcer_site_unique` aux tables métier, par lots de risque décroissant | 2, 3 | `drop trigger`, la colonne reste |
| **5** | Retirer les défauts, table par table, **seulement** après que le trigger couvre la table | 4 | remettre le défaut — mais **les lignes écrites entre-temps ne se rejouent pas** |
| **6** | Vues `SECURITY DEFINER` et Edge Functions | 5 | lot distinct |

Ordre non négociable : **le trigger avant le retrait du défaut**. Retirer le
défaut d'abord transformerait chaque chemin non corrigé en erreur `NOT NULL`
en pleine exploitation. C'est la leçon de S-3 : l'ordre des gardes n'est pas
un détail.

L'étape 5 est la seule dont le rollback est incomplet, et cela doit être dit :
remettre un défaut ne réécrit pas les lignes déjà enregistrées.

## 9. Impact métier attendu

- **Fiabilité multi-site** : aujourd'hui, compter un inventaire est impossible
  hors Sainte-Marie. C'est le blocage le plus concret à un déploiement en
  seconde station.
- **Suppression des rattachements implicites** : plus aucune donnée ne part
  vers Sainte-Marie parce que personne n'a dit où elle allait.
- **Réduction du risque de fuite** : la classe E est une contamination
  croisée prouvée, pas théorique.
- **Préparation au multi-station** : NEXUS est aujourd'hui mono-station *par
  défaut de colonne*, pas par conception. C'est cet écart que le chantier
  ferme.
