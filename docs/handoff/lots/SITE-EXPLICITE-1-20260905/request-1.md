---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-20260905
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: defaults-site
    classe: VERIFIED
    valeur: 54 colonnes NOT NULL, 0 normalisee par trigger
  - id: protection-reelle
    classe: VERIFIED
    valeur: 41 RLS site, 10 sans insert, 3 defaut decide
  - id: ecritures-sans-site
    classe: VERIFIED
    valeur: 48 ecritures sur 37 tables, apres correction du detecteur
  - id: preuve-classe-d
    classe: VERIFIED
    valeur: 42501 sur inventaire_comptages sous identite employe reelle
  - id: preuve-classe-e
    classe: VERIFIED
    valeur: pointage accepte sur vito-sainte-marie, invisible du manager
  - id: profil-createur
    classe: VERIFIED
    valeur: 0 compte, 3 sites ouverts, 43 policies avec branche non parcourue
  - id: aucune-modification
    classe: VERIFIED
    valeur: aucun defaut, policy, insertion ni donnee touches
  - id: suite
    classe: VERIFIED
    valeur: 186/195
  - id: edge-functions
    classe: NOT_APPLICABLE
    valeur: 0 en Test - angle mort assume
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1 — Phase 1 : cartographie et preuves

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Permettre à NEXUS de fonctionner dans une seconde station sans rattacher silencieusement des données à Sainte-Marie. |
| `gain_attendu` | **Fiabilité** — aujourd'hui compter un inventaire hors Sainte-Marie est **impossible** (prouvé), et un pointage sans site part sur le mauvais site et **échappe à son propre manager** (prouvé). Gain direct : suppression d'une classe d'erreurs invisibles. Gain indirect : condition d'un déploiement multi-station. |
| `contrats_touches` | A3-1/A3-2 (`site_id` source de vérité) · RLS d'isolation par site · `nexus_forcer_site_unique` · `nexus_site_autorise` · défauts de colonne |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | Mesures en base · 2 preuves de comportement sous identité employé réelle · 7 familles de tests négatifs **avant** correction |
| `definition_de_termine` | Cartographie exhaustive, arbitrée, et plan de correction ordonné avec rollback. **Aucune correction en Phase 1.** |

**Segment d'Horizon servi** : *la journée NEXUS accompagne* — un employé d'une
autre station doit pouvoir travailler. Contribution indirecte à *Frédéric
manage* : sans ce chantier, chaque nouvelle station demanderait une
intervention manuelle.

## Résumé

Cartographie complète dans
`docs/gouvernance/2026-09-05-site-explicite-1-cartographie.md`.
**Aucun défaut supprimé, aucune policy modifiée, aucune insertion corrigée.**

Deux faits prouvés sous identité employé réelle, en transaction annulée,
dominent tout le reste.

**1. Le comptage d'inventaire est impossible hors Sainte-Marie.**

```
site du compte vu par la RLS : nexus-station-test
insert SANS site : REFUSE [42501] new row violates row-level security policy
                   for table "inventaire_comptages"
```

**2. Un pointage sans site part sur le mauvais site et échappe à son manager.**

```
insert SANS site : ACCEPTE — ligne rattachee au site « vito-sainte-marie »
site reel de l'employe                : « nexus-station-test »
visible par le manager du site de l'employe : 0   (0 = la ligne lui echappe)
```

## 1. Defaults de site — 54 colonnes

54 colonnes `NOT NULL` avec défaut `'vito-sainte-marie'`, sur 54 tables.
La fiche annonçait 58 ; **54** est la mesure du jour et fait foi.

Le fait structurant :

> **La protection existe là où le défaut est absent, et le défaut règne là où
> aucune protection n'existe.**

`nexus_forcer_site_unique` ne couvre que `shifts` et `mission_catalog` — les
deux seules tables portant `site` **et** `site_id`, et les deux qui n'ont
justement pas de défaut. **Zéro** des 54 colonnes à défaut est normalisée.

| Ce qui protège à l'insertion | Tables |
|---|---:|
| RLS exige le bon site → refus hors Sainte-Marie | **41** |
| Aucune policy INSERT → refus total | **10** |
| **Rien ne contrôle le site → le défaut décide** | **3** |

44 tables sur 54 sont donc protégées par la **RLS**, pas par le défaut. Pour
elles, le défaut n'est pas un risque de fuite mais de **panne silencieuse hors
Sainte-Marie**. Seules `pointages`, `mission_completions` et
`mission_progress` laissent le défaut trancher.

## 2. Écritures sans `site_id` — 48, sur 37 tables

> **Correction de méthode, signalée plutôt que masquée.** Mon premier balayage
> annonçait 78 écritures sur 58 tables. Le détecteur ne reconnaissait que
> `site:` et manquait la notation abrégée `{ site, … }` — 30 faux positifs.
> Le chiffre retenu est **48**. Un chiffre faux dans une cartographie destinée
> à fonder un plan de correction aurait produit un plan faux.

| Classe | Tables | Conséquence |
|---|---:|---|
| A — pas de colonne site | 7 | hors sujet |
| B — colonne sans défaut, `NOT NULL` | 18 | échouerait ; site fourni autrement ou chemin jamais exercé |
| C — défaut + aucune policy INSERT | 1 | refus |
| **D — cassé hors Sainte-Marie** | **9** | dont `inventaire_comptages` — *le comptage lui-même* |
| **E — le défaut décide** | **2** | `mission_completions` (parcours réel), `pointages` (écran Debug) |

## 3. Profil créateur

`nexus_site_autorise` est **correctement fail-closed** : refus sans compte,
refus sans site, autorisation si site du compte, sinon branche créateur
conditionnée à `sites.acces_createur_autorise`, sinon refus.

Le défaut n'est pas dans sa logique, il est dans son absence d'usage :

| Mesure | Valeur |
|---|---|
| Comptes `est_createur = true` en Test | **0** |
| Sites `acces_createur_autorise = true` | **3 sur 3** |
| Politiques RLS avec branche créateur | **43** |

**43 politiques contiennent un chemin transverse qu'aucun compte ne peut
emprunter et qu'aucun test ne parcourt**, avec les trois sites ouverts.

## 4. `site` / `site_id`

`site_id` n'est source de vérité **que** pour les 2 tables qui portent les
deux colonnes. Ailleurs une seule colonne existe et son nom varie
(`pointages.site`, `mission_completions.site_id`). La doctrine A3-1/A3-2 est
donc plus étroite que ce que la baseline laissait entendre.

## 5. Avis des Guardians

Chacun constate ; **aucun ne corrige ce qu'il audite**.

### Architecture Guardian

La normalisation du site existe, elle est correcte, et elle est appliquée
exactement là où elle n'était pas nécessaire. Deux tables sur 54, et ce sont
les deux sans défaut. C'est la même forme de défaut qu'en S-3 : un mécanisme
juste, placé au mauvais endroit de la chaîne.

**Avis : la correction doit étendre le trigger existant, jamais dupliquer sa
logique.** Cinquante-quatre gardes locaux seraient cinquante-quatre endroits
de divergence. Et l'ordre est non négociable — **trigger d'abord, retrait du
défaut ensuite** ; l'inverse transformerait chaque chemin non corrigé en
`23502` en pleine exploitation.

**Réserve** : le nom de colonne n'est pas unifié. Uniformiser 54 tables est
coûteux et risqué ; je recommande de **déclarer explicitement** que le nom est
libre tant qu'une seule colonne existe, plutôt que d'entreprendre un
renommage.

### Security & Isolation Guardian

Deux risques de nature différente, à ne pas confondre.

**Fuite — 3 tables.** Classe E : la donnée part sur le mauvais site, devient
invisible de son manager légitime et contamine un autre site. **Prouvé**, pas
supposé. C'est le risque le plus grave du registre, et il concerne
`pointages` — la table la plus écrite de NEXUS.

**Angle mort — 43 politiques.** La branche créateur est le seul chemin
transverse par conception. Aucun compte ne l'exerce, aucun test ne la
parcourt, et les trois sites lui sont ouverts. Je ne constate **aucune fuite**
aujourd'hui — je constate qu'elle serait **invisible** si elle existait.

**Avis : bloquant pour un déploiement multi-station, non bloquant pour la
baseline gelée**, qui est mono-station et le dit. Je ne demande aucune
correction en Phase 1.

**Exigence ferme** : ne retirer aucun défaut avant que la table soit couverte,
et **ne jamais affaiblir une policy pour faire passer une écriture**. Si une
écriture est refusée, c'est l'écriture qu'il faut corriger.

### QA / Regression Guardian

Rien de tout cela n'aurait été trouvé par la suite actuelle : aucun test
n'exerce une écriture depuis un site autre que Sainte-Marie. C'est la même
lacune qu'en S-3 — un contrat éprouvé sur des données que l'auteur façonne.

**Avis : les 7 familles de tests doivent être écrites AVANT toute correction,
et doivent d'abord échouer.** Un test écrit après la correction prouve que le
code fait ce qu'il fait, pas ce qu'il doit faire.

**Précondition bloquante** : la famille 4 exige un compte créateur, qui
**n'existe pas**. Le créer est un préalable, pas une étape de correction.

**Réserve de méthode** : mon propre balayage s'est trompé de 30 écritures.
J'exige que tout détecteur produit dans ce chantier soit lui-même éprouvé par
mutation avant d'être cru.

## 6. Plan par étapes — non exécuté

0. comptes de test manquants (créateur, pompiste, renfort) ·
1. les 7 familles de tests négatifs, **qui échouent** ·
2. classe E (2 écritures) · 3. classe D (9 écritures) ·
4. extension du trigger, par lots de risque décroissant ·
5. retrait des défauts, **table par table, après couverture** ·
6. vues `SECURITY DEFINER` et Edge Functions.

Rollback applicatif simple aux étapes 2 et 3, `drop trigger` à l'étape 4.
**L'étape 5 a un rollback incomplet** : remettre un défaut ne réécrit pas les
lignes enregistrées entre-temps. C'est dit maintenant, pas découvert après.

## Preuves

- Mesures en base : 54 colonnes · 41/10/3 · 48 écritures / 37 tables ·
  0 compte créateur · 3 sites ouverts · 43 policies · 25 vues.
- 2 preuves de comportement sous identité employé réelle, transaction annulée.
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.
- **Aucune modification** : ni défaut, ni policy, ni insertion, ni donnée.
- Aucun fichier applicatif touché ; ce lot n'ajoute que `docs/gouvernance/`.

## Risques / anomalies

1. **Mon détecteur s'est trompé de 30 écritures au premier passage.** Corrigé
   et signalé. La leçon vaut pour le chantier entier.
2. **Les Edge Functions sont un angle mort assumé** : zéro en Test, donc
   impossible de vérifier en recette qu'elles n'écrivent pas sans site.
3. **Le chiffre 58 de la fiche de recette n'est pas reproductible.** Je mesure
   54. L'écart n'est pas expliqué et je ne l'invente pas — il vient peut-être
   d'un comptage sur la Production, que je n'interroge pas.

## Questions pour arbitrage

**Q31 — Le nom de colonne doit-il être unifié ?** Recommandation : **non**.
Déclarer que le nom est libre tant qu'une seule colonne existe, et réserver
`site_id` source de vérité aux tables qui portent les deux. Renommer 54 tables
coûterait plus que le risque qu'il retire.

**Q32 — Par quoi commencer la Phase 2 ?** Recommandation : **étape 0 puis 1** —
les comptes manquants, puis les tests qui échouent. Corriger la classe E avant
d'avoir un test qui la démontre reproduirait exactement la faute de S-3.

**Q33 — L'écart 58 / 54 doit-il être élucidé avant la Phase 2 ?**
Recommandation : **non, mais il doit être tracé.** La Production n'est pas
interrogeable dans ce cadre, et la mesure de Test suffit à fonder le plan.

## Action attendue de ChatGPT

Arbitrer Q31, Q32, Q33 pour le `LOT_ID` **SITE-EXPLICITE-1-20260905** et
valider la cartographie. **Aucune correction n'est demandée ni autorisée par
cette demande.**
