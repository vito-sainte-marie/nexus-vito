---
protocol: nexus-handoff/2
kind: decision
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6580784112
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41469622815), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6580784112. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `INVENTAIRE-CAISSE-RENFORT-20261102`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `57579b6370c24571e899f2090dda61e542f6d12c`, `HEAD` = `57579b6370c24571e899f2090dda61e542f6d12c`, SHA du run `57579b6370c24571e899f2090dda61e542f6d12c`, tête du rail `57579b6370c24571e899f2090dda61e542f6d12c`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Matrice, N=7 jours avec N=3 après écart confirmé, fenêtres 9 h 30–11 h 30 et 14 h 30–16 h 30, volumes 8 références pour le renfort et 6 en repli à respecter ; import Decenium éprouvé sur Test avant L2b ; alertes héritées classées avant la vue manager ; ordre « NEXUS d’abord » et toute nouvelle consigne terrain soumis à DECISION_METIER_NON_ARBITREE avant communication ; défaut A soumis à SECURITE_RLS_SITE_ID ; aucune opération Production dans ce lot. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Verdict

**APPROVED_WITH_CONDITIONS — closes: false.**

La conception est approuvée. Elle applique les décisions définitives de Frédéric sans demander de nouveau GO pour les paramètres expressément délégués à l’arbitre. Les futures portes restent attachées aux lots d’implémentation concernés.

### 1. Matrice retenue

| Moment | Acteur | Contenu | Contrôle |
|---|---|---|---|
| Début Q1, cible **5 h 45** | Caissière Q1 | **28 références cigarettes**, comptage à l’aveugle ; réception quantitative des produits livrés ce jour | Cycle entre la fermeture Q2 précédente et l’ouverture Q1 |
| Changement Q1/Q2 | Entrante seule | 28 cigarettes, CBD actif, produits du jour | Ce comptage unique clôt Q1 et ouvre Q2, conformément à la décision de Frédéric |
| Fermeture Q2 | Caissière Q2 | 28 cigarettes, CBD actif, produits du jour | Clôture du cycle, puis rapprochement avec l’export ventes + stock Decenium |
| Créneau calme Q1, **9 h 30–11 h 30** | Renfort | Roulement hors caisse | Mission déclenchée seulement si la charge opérationnelle le permet |
| Créneau calme Q2, **14 h 30–16 h 30** | Renfort ; repli caissière Q2 | Roulement hors caisse | Même règle ; report autorisé, sans dépasser le délai maximal |

Pour chaque mission de roulement :

- renfort : **8 références**, soit 6 planifiées et 2 surprises cachées avant saisie ;
- repli caissière Q2 : **6 références**, soit 5 planifiées et 1 surprise ;
- boissons comptées successivement **dépôt puis frigo**, avec conservation des deux sous-comptages ;
- huiles, lave-glace, liquide de refroidissement et petits articles entrent dans le même roulement ;
- chaque référence doit être comptée au moins une fois tous les **7 jours calendaires** ;
- une référence présentant un écart confirmé passe temporairement à **N = 3 jours**, jusqu’à deux cycles consécutifs sans écart.

Les horaires sont des fenêtres de déclenchement, non des obligations de quitter la caisse lorsqu’elle doit être tenue. Un report doit être replanifié avant l’échéance N.

### 2. Règles de contrôle

1. Si l’export couvre intégralement le cycle et permet d’en attribuer les ventes :

   **attendu = comptage précédent − ventes du cycle + entrées tracées du cycle**.

2. Si l’export prouve qu’il n’existe aucune vente sur tout le cycle :

   **comptage physique = stock Decenium correspondant**.

3. Si l’export est absent, incomplet ou incapable d’attribuer les ventes au cycle, le contrôle reste **non calculable** : il ne devient pas artificiellement une anomalie confirmée.

4. Le contrôle est à l’unité, avec **tolérance initiale nulle**. Une tolérance métier différente nécessiterait une décision ultérieure explicite.

5. Un premier écart déclenche un recomptage ciblé à l’aveugle. Il n’est « confirmé » qu’après persistance au recomptage, avec conservation des deux mesures et de leurs auteurs. La vue manager ne reçoit que ces écarts confirmés.

6. Toute correction du stock de départ est distincte du comptage d’origine, motivée, horodatée et attribuée. Elle ne réécrit jamais la mesure initiale.

### 3. Contestation de la frontière Q1/Q2

Le comptage de l’entrante reste la frontière officielle unique : aucun second comptage systématique de la sortante n’est ajouté.

En cas d’écart :

- recomptage ciblé immédiat des seules références litigieuses ;
- le manager peut demander à la sortante un comptage contradictoire ciblé si elle est encore disponible ;
- ce comptage constitue une preuve de contestation, pas une seconde frontière de quart ;
- toute correction ultérieure est tracée séparément, sans écraser le comptage de l’entrante.

### 4. Papier pendant les sept jours

La coexistence papier/NEXUS pendant sept jours est déjà décidée. En revanche, l’ordre nouveau **« NEXUS d’abord, papier ensuite »** est une consigne imposée aux employés : sa communication et son entrée en vigueur restent sous la porte `DECISION_METIER_NON_ARBITREE`.

Cette porte ne bloque ni la présente conception ni les développements et essais sur Test. Elle doit être franchie dans le message d’équipe avant application terrain.

### 5. Découpage et ordre des lots

Ordre retenu :

1. **L1 — fil caisse** : inscription effective de la caissière au quart, ouverture, changement, fermeture et comptages à l’aveugle.
2. **L2a — Photo Decenium sur Test** : éprouver de vrais fichiers, la couverture temporelle, les ventes et le stock, sans Production.
3. **L4a — défaut A** : correction de l’UPDATE du cycle d’observation. Porte obligatoire `SECURITE_RLS_SITE_ID`.
4. **L2b — contrôle par cycle** : calcul avec ventes, cas sans vente et état non calculable.
5. **L3 — roulement renfort** : fenêtres calmes, échéances N, sélection planifiée et surprises.
6. **L4b — anomalies manager** : classement préalable des alertes héritées, confirmation, vue manager et corrections tracées.
7. **L5 — détection de recopie** : après disponibilité d’un volume suffisant de comptages réels ; elle ne bloque pas le lancement des lots précédents.

L2 et L4 sont donc scindés afin que l’épreuve d’import sur Test puisse précéder la porte RLS, tandis que le contrôle opérationnel ne dépend pas d’un défaut A non résolu.

### 6. Portes

- **L1/L3** : toute nouvelle consigne terrain non déjà décidée doit être validée sous `DECISION_METIER_NON_ARBITREE` avant communication aux employés.
- **L4a** : porte `SECURITE_RLS_SITE_ID` avant toute modification de policy, RLS ou isolation `site_id`.
- **Chaque mise en Production** : porte `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`.
- Une éventuelle migration ou écriture de données Production relève séparément de `SUPABASE_PRODUCTION_MUTATION`.
- Les développements, essais sur Test, commits et pushs sur le rail restent libres dans leur périmètre conformément à `COMMIT_PUSH_RAIL_SANS_GO` et `PREAUTORISATIONS_CLAUDE`.

BRANCHE_DU_LOT: handoff-continuite-20260920

RAIL_LU: 57579b6370c24571e899f2090dda61e542f6d12c

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: INVENTAIRE-CAISSE-RENFORT-20261102
REQUEST: request-1.md
HEAD: 57579b6370c24571e899f2090dda61e542f6d12c
LEASE: aucun
GATE_STATE: G0, CI non requise pour ce lot de conception
PROOF_STATE: PROOF_VALID
CONDITIONS: Matrice, N=7 jours avec N=3 après écart confirmé, fenêtres 9 h 30–11 h 30 et 14 h 30–16 h 30, volumes 8 références pour le renfort et 6 en repli à respecter ; import Decenium éprouvé sur Test avant L2b ; alertes héritées classées avant la vue manager ; ordre « NEXUS d’abord » et toute nouvelle consigne terrain soumis à DECISION_METIER_NON_ARBITREE avant communication ; défaut A soumis à SECURITE_RLS_SITE_ID ; aucune opération Production dans ce lot.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
