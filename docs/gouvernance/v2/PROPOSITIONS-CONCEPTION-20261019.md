# Propositions de conception de la boucle V2 (19/10/2026)

**Statut : propositions à confirmer. Aucune n'est une décision. Rien n'est appliqué.**

**Provenance.**
- Texte rédigé par ChatGPT, adressé à Frédéric à la deuxième personne, et relayé à Claude Guardian le 19/10/2026 à 10:12, heure de la Martinique (14:12 UTC).
- Il s'agit d'une **proposition de ChatGPT, revue avec l'autorité humaine** : l'accord de principe de Frédéric a été exprimé en conversation, pas inscrit sur le rail.
- Texte recopié mot pour mot dans `sources/proposition-chatgpt-20261019.txt`, sans en-tête ajouté.
- Empreinte sha256 de ce fichier : `33df10f3f6373b932530a78c2ddd20761843f396f20e38991d436917ad2156ed`. Elle ne garantit que l'intégrité du texte, pas son autorité.

**Trois niveaux à ne pas confondre.**
(a) proposition de ChatGPT ; (b) accord exprimé par Frédéric en conversation ; (c) décision inscrite sur le rail. Seul (c) est une décision. Ce document est de niveau (a), avec un accord (b) de principe seulement.

**Ce dépôt n'est pas une décision Handoff.** Il inscrit sur le rail un texte qui n'existait que dans une conversation. Sa portée est celle que lui donnera le GO de doctrine du lot R0, s'il est déposé.

**À confirmer par Frédéric, point par point** (la confirmation vaut quand elle est déposée sur le rail) :

| # | Point | Confirmé ? |
|---|---|---|
| 1 | Répartition des rôles (section 1) | à confirmer |
| 2 | Condition 1 : erreur de vocabulaire, refus et jamais correction silencieuse | à confirmer |
| 3 | Condition 2 : clôture automatique limitée aux conditions formelles | à confirmer |
| 4 | Condition 3 : motifs de réveil classés, non réduits | à confirmer |
| 5 | Objectif incontournable (section 3) | à confirmer |
| 6 | Tableau de performance (section 4) | à confirmer |

---

## 1. Répartition proposée

| Sujet | Proposition de conception (texte de ChatGPT) | Traduction dans le dossier |
|---|---|---|
| Transmission | GitHub Actions reste responsable du transport déterministe | Charte, ligne CI ; plan, ordre R0 à R7 |
| Arbitrage | ChatGPT API reste l'arbitre, avec des valeurs contrôlées par registre | Matrice D1 à D14 ; condition 1 ci-dessous |
| Exécution | Claude Code ou Claude relancé, selon l'ordre et leurs capacités réelles | Matrice D9 ; plan R6 (« Claude Code relancé tout seul » reste non acquis) |
| Contrôle | Guardian vérifie le sens, les preuves et l'identité de l'exécutant | Charte, ligne Guardian ; `docs/guardian/README.md` |
| Clôture | Automatisation possible uniquement après vérification du contrat et des preuves | Matrice E10, D2 ; condition 2 ci-dessous |
| Surveillance | Vigie indépendante avec détection de son propre silence | Charte, ligne Vigie ; plan R4 et R5 ; essai I |
| Autorité humaine | Réservée aux décisions sensibles, sans délégation implicite | Charte, ligne Frédéric ; condition 3 ci-dessous |

## 2. Les trois conditions

1. **Erreur de vocabulaire de l'arbitre.** Jamais corrigée en silence par la CI. Elle provoque un refus, puis éventuellement un nouvel arbitrage explicite. Après un nouvel échec, la boucle s'arrête avec une anomalie traçable.
   - Lignes de la matrice concernées : D8, D11, D12. La ligne D12 visait auparavant une lecture uniformisée des graphies de « pas de STOP » ; elle prévoit désormais une seule valeur admise, et le refus de toute autre.
2. **Clôture automatique.** La CI ne décide pas qu'une exécution est correcte sur le plan métier. Elle vérifie les conditions formelles, les empreintes et les preuves attendues. Ce qui demande un jugement reste à l'arbitre ou au contrôleur habilité.
   - Lignes concernées : E10, D2, D3.
3. **Motifs de réveil de Frédéric.** Leur nombre n'est pas réduit artificiellement. Ils sont classés selon leur risque et leur autorité légitime. Un cas n'est délégué que si sa sécurité est démontrée.
   - Charte : les motifs actuels de `ARBITRAGES-ACQUIS.json` (10 motifs dans `routage.frederic` et 6 dans `routage.arbitre`, comptés le 19/10) restent en vigueur jusqu'à cette démonstration. Le texte source écarte toute réduction proposée avant lui ; ce retrait est lui aussi à confirmer.

## 3. Objectif incontournable

> aucune écriture Test sans décision canonique préalable, aucune opération Production sans autorisation humaine vérifiable.

Chacune des deux moitiés devient un essai négatif du banc :
- écriture Test tentée sans décision canonique : refus mesuré (essai B) ;
- opération Production tentée par un agent, ou « autorisation humaine » venant d'une identité d'agent : refus mesuré (essais F et H).

## 4. Tableau de performance de la boucle

Alimenté automatiquement, avec des définitions stables. Les définitions et la référence mesurée sont dans `docs/guardian/preuves/MESURES-REFERENCE-20261008-20261018.md`.

| Indicateur demandé | Mesurable aujourd'hui | Source cible |
|---|---|---|
| Délai médian et maximal de décision | Non : la publication d'une demande et le dépôt de la décision ne sont pas reliés par un journal | Journal des transitions (R3) |
| Délai médian et maximal entre décision et exécution | Non, pour la même raison | R3 |
| Taux de tours complets, partiels, vides et en échec | Oui, par `docs/guardian/preuves/mesures-20261008-20261018/mesurer-boucle.py` | R3, puis la vigie (R4) |
| Arrêts silencieux détectés et durée de détection | Non : aucun mécanisme ne les détecte ; seuls des types d'arrêt ont été relevés dans le code | Vigie (R4) |
| Interventions humaines, par motif | Partiel : les arrêts adressés à Frédéric sont comptés, pas encore par motif | R3 |
| Décisions rejetées pour défaut de contrat ou d'identité | Non : aucun rejet n'est journalisé | R2 et R3 |
| Lots clôturés avec preuves complètes | Partiel : la consommation des clôtures est mesurable (`STATE.json`) ; « preuves complètes » reste à définir | R3, matrice E10 |

## 5. Ce que ces propositions ne valent pas

Elles ne valent GO pour aucun des points suivants :
- modification d'un workflow, d'une permission GitHub, d'un secret ou d'une identité ;
- armement de la vigie, d'une session Guardian planifiée ou de la nouvelle boucle ;
- écriture sur Supabase ;
- fusion vers `main` ou `production`, ou déploiement.

Chacun reste soumis à son propre lot et à l'autorisation qui lui revient.
