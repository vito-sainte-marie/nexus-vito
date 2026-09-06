---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-2B-SECURITY-WRITE-GUARD-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: policies-avant-apres
    classe: VERIFIED
    valeur: 4 policies, dont un UPDATE qui n avait aucun with check
  - id: f1b-f2-rejouees
    classe: VERIFIED
    valeur: les deux passent de ACCEPTE a REFUSE 42501
  - id: chemins-illegitimes
    classe: VERIFIED
    valeur: 7 refus sous identite employe reelle
  - id: chemins-legitimes
    classe: VERIFIED
    valeur: pointage, completion et progression sur son site ACCEPTES
  - id: createur-sans-ecriture
    classe: VERIFIED
    valeur: refus 42501, aucune extension de privilege
  - id: contrats-distincts
    classe: VERIFIED
    valeur: mission_progress porte un contrat renforce, teste comme tel
  - id: classe-e-corrigee
    classe: VERIFIED
    valeur: detecteur 48/37 vers 47/36
  - id: rien-n-a-deborde
    classe: VERIFIED
    valeur: 54 defaults en place, classe D intacte, aucune policy affaiblie
  - id: suite
    classe: VERIFIED
    valeur: 188/197
  - id: harnais-ci
    classe: HUMAN
    valeur: les preuves vivent en transaction annulee, pas dans la suite
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# 2B-SECURITY-WRITE-GUARD — exécuté, retour avant toute extension

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Qu'un employé ne puisse écrire que sur son propre site, quel que soit le client utilisé. |
| `gain_attendu` | **Fiabilité et isolation** — fermeture d'un chemin par lequel une donnée pouvait être écrite sur un autre commerce, prouvé ouvert en Phase 2A. |
| `contrats_touches` | 4 policies : `pointages`, `mission_completions`, `mission_progress` (insert **et** update) |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | policies avant/après · F1b et F2 rejouées · chemins légitimes · chemins illégitimes · suite |
| `definition_de_termine` | Périmètre autorisé exécuté, preuves produites, retour Handoff. **Atteinte.** |

## Résumé

Périmètre strictement respecté : les 4 policies, la correction de classe E,
le rejeu F1b/F2, les tests de non-régression. **Aucun défaut retiré, aucune
classe D touchée, aucune policy affaiblie.**

## 1. Contrats métier — trois tables, trois règles

La condition majeure était de ne pas appliquer mécaniquement la même policy.
L'examen a montré trois contrats réellement différents.

| Table | Écrivains légitimes | `shift_id` | Règle retenue |
|---|---|:--:|---|
| `pointages` | l'employé seul — aucun chemin manager n'insère | non | site = site du compte |
| `mission_completions` | l'employé insère ; le manager **ajuste** par UPDATE, déjà borné au site | non | site = site du compte, INSERT seulement |
| `mission_progress` | l'employé seul | **NOT NULL** | **contrat renforcé** |

**`mission_progress` méritait mieux que la règle commune.** Son `shift_id` est
`NOT NULL` : une progression est toujours portée par un service, et un service
porte lui-même un employé et un site. Se contenter du site du compte aurait
laissé passer une progression rattachée au **service de quelqu'un d'autre**.
La policy exige donc les trois cohérences ensemble.

**Découverte au passage** : `employee_own_progress_update` n'avait **aucun
`with check`**. Une ligne pouvait donc être déplacée vers un autre site *après*
son insertion — un chemin qu'aucune policy d'insertion n'aurait rattrapé. Il
est fermé.

**Aucune branche d'écriture n'est ouverte au créateur.** Sa capacité
transverse est une capacité de **lecture** ; l'étendre à l'écriture aurait été
une extension de privilège que rien ne demande, et un test l'interdit
désormais.

## 2. Policies — avant / après

| Policy | Avant | Après |
|---|---|---|
| `insert_own_pointage` | `employee_id = auth.uid()` | `+ site = current_employee_site_id()` |
| `employee_own_completions_insert` | `employee_id = auth.uid()` | `+ site_id = current_employee_site_id()` |
| `employee_own_progress_upsert` | `employee_id = auth.uid()` | `+ site_id = compte` **+ cohérence avec le service** |
| `employee_own_progress_update` | `using` seul, **aucun `with check`** | `+ with check` employé et site |

## 3. Preuves en base, sous identité employé réelle

Transactions annulées. **Avant** la migration, rappel de Phase 2A :

```
F1b sans site   : ACCEPTE — rattaché à « vito-sainte-marie »
F2  site erroné : ACCEPTE — AUCUN CONTROLE
```

**Après :**

```
F1b sans site                          : REFUSE [42501]  (le défaut ne passe plus)
F2  site erroné                        : REFUSE [42501]
pointage pour un AUTRE employé         : REFUSE [42501]
completion site erroné                 : REFUSE [42501]
progression sur le service d'un AUTRE  : REFUSE [42501]  (contrat renforcé)
progression avec site incohérent       : REFUSE [42501]
CREATEUR écrivant sur un autre site    : REFUSE [42501]  (lecture transverse, pas écriture)
```

**Chemins légitimes, toujours ouverts :**

```
pointage sur son site                  : ACCEPTE
completion sur son site                : ACCEPTE
progression sur SON service            : ACCEPTE
```

Le défaut de colonne est toujours là — il ne peut simplement plus produire une
écriture acceptée : la policy le rattrape.

## 4. Classe E corrigée

`NEXUS-Missions-v1.html` déclare `site_id: SITE_ACTUEL`.
`NEXUS-Debug-v1.html` rattache chaque ligne migrée à un site connu.

Le détecteur passe de **48/37 à 47/36**. Le pointage du Debug **reste
compté** : son `insert` reçoit une variable, donc le site n'y est pas
vérifiable statiquement. C'est une limite du détecteur, pas un défaut —
elle est consignée par une épreuve dédiée plutôt que contournée en
assouplissant le motif.

## 5. Avis des Guardians

### Architecture Guardian

L'ordre imposé par l'arbitrage était le bon, et je le constate plutôt que je
ne le suppose : la policy fermée d'abord rend la correction du client
**vérifiable** — sans elle, on n'aurait jamais su si le client corrigé était
la cause du refus ou une coïncidence.

Le contrat renforcé de `mission_progress` est la preuve que la condition
« pas d'uniformité syntaxique » n'était pas rhétorique : trois policies
identiques auraient laissé ouvert le rattachement au service d'autrui.

**Avis : je ne demande toujours pas l'autorisation d'étendre le mécanisme de
normalisation.** La démonstration exigée avant la Phase 2B générale n'est pas
faite, et ce sous-lot ne l'a pas avancée.

### Security & Isolation Guardian

Le chemin prouvé ouvert en Phase 2A est fermé, et les sept refus le
démontrent sous identité réelle. Deux points comptent autant que la fermeture
elle-même : **aucune policy n'a été affaiblie** pour faire passer une
écriture, et **aucune écriture transverse n'a été concédée au créateur**.

**Réserve** : les 41 tables de classe RLS *devraient* refuser un site erroné,
mais je ne l'ai vérifié que sur `pointages`, `mission_completions` et
`mission_progress`. Je ne les déclare pas sûres — je déclare qu'elles n'ont
pas été éprouvées.

**Avis : le risque de fuite le plus grave du registre est traité.** Le reste
du chantier `site` est désormais un travail de fiabilité, plus de sécurité
immédiate.

### QA / Regression Guardian

Neuf vérifications structurelles ajoutées, dont deux qui gardent le
raisonnement plutôt que le résultat : que les trois contrats **ne soient pas
identiques**, et qu'aucune policy retirée ne reste sans recréation.

**Réserves, inchangées et non résolues** : les preuves vivent dans des
transactions annulées, **pas dans la suite** ; elles ne protègent contre
aucune régression future tant qu'un harnais CI connecté à Test n'existe pas.
Et `mission_progress` n'a aujourd'hui **aucune ligne** en Test : son contrat
renforcé est éprouvé par insertion synthétique, jamais par le parcours réel.

## 6. Ce qui reste intact — rien n'a débordé

- **54 defaults** de colonne : **tous en place**.
- **Classe D** — 9 écritures, dont `inventaire_comptages` : **non touchées**.
  Compter un inventaire reste impossible hors Sainte-Marie.
- **41 tables** de classe RLS : non éprouvées au site erroné.
- **Edge Functions** : 0 en Test, angle mort inchangé.
- **Vues `SECURITY DEFINER`** : hors périmètre.

## Preuves

- Migration `20260906020000_garde_ecriture_site.sql`, **Test uniquement**.
- 7 refus et 3 acceptations sous identité réelle, transactions annulées.
- `test_garde_ecriture_site_20260906.js` — 9 vérifications.
- `test_site_explicite_detecteur_20260905.js` — 10 vérifications.
- Suite `188/197`, mêmes 9 échecs historiques. Simulations au vert.
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Rollback

Migration inverse rétablissant les quatre policies dans leur forme
antérieure ; **aucune donnée n'est touchée**, donc le retour est complet — à
la différence du futur retrait des defaults, dont le rollback ne l'est pas.
La correction applicative de classe E est un revert de deux fichiers.

## Risques / anomalies

1. **Un pointage sans site est désormais refusé**, alors qu'il passait avant.
   C'est l'objectif ; mais tout chemin non identifié qui comptait sur le
   défaut cassera. Le seul chemin applicatif connu — l'écran Pointage —
   envoie déjà le site.
2. **`mission_progress` n'a aucune ligne en Test.** Le contrat renforcé est
   éprouvé synthétiquement, pas par un parcours réel.
3. **Le défaut de colonne subsiste** et masque toujours l'intention : la
   policy le neutralise, elle ne le supprime pas.

## Questions pour arbitrage

**Q37 — Étendre F2 aux 41 tables de classe RLS ?** Recommandation : **oui,
avant les classes D**. Elles devraient refuser, ce n'est pas prouvé — et
« devrait » est exactement le mot qui a précédé chaque défaut de cette
campagne.

**Q38 — Le contrat renforcé de `mission_progress` doit-il servir de modèle ?**
Recommandation : **oui, partout où une table porte un rattachement plus précis
que le site du compte**. Mais table par table, jamais par généralisation.

**Q39 — La classe D peut-elle être ouverte ?** Recommandation : **pas encore**.
Elle exige la démonstration Architecture + Security sur le mécanisme commun,
que je n'ai pas faite et que je ne demande pas à contourner.

## Action attendue de ChatGPT

Arbitrer Q37, Q38, Q39 pour le `LOT_ID`
**SITE-EXPLICITE-1-2B-SECURITY-WRITE-GUARD-20260906**. **Aucune extension du
chantier n'est demandée ni effectuée par cette demande.**
