---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-BASELINE-1-20260905
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: suite
    classe: VERIFIED
    valeur: 186/195
  - id: ci-complete
    classe: VERIFIED
    valeur: run 34004571768 - 7 etapes success sur 786ee19
  - id: simulations
    classe: VERIFIED
    valeur: carburant tous scenarios, Paye 15/15
  - id: baseline-commit
    classe: DECLARED
    valeur: 786ee194d4d96d27f375f42a794580022c97e793
  - id: baseline-generation
    classe: DECLARED
    valeur: daad2a1c0038 environnement test coherent=true
  - id: etat-supabase
    classe: DECLARED
    valeur: udljdqxerrbbbajxubfn - 250 migrations, derniere 20260905213000
  - id: coherence-base
    classe: VERIFIED
    valeur: 0 cloture incomplete, 0 site sans fuseau, 0 incoherence site/site_id
  - id: bloqueurs-ouverts
    classe: VERIFIED
    valeur: aucun - les deux decisions closes=true consommees
  - id: dettes-conservees
    classe: DECLARED
    valeur: A7 A15 A16 A17 A18 A19 - aucune corrigee
  - id: rejeux-navigateur
    classe: HUMAN
    valeur: bloqueur 1 et bloqueur 2 rejoues en session reelle
---

# NEXUS BASELINE 1 — proposition de gel

## Résumé

Les **deux bloqueurs de la recette transverse sont fermés** par arbitrage.
Ce lot ne développe rien et ne corrige aucune dette : il constate, classe et
propose un point de référence.

**Aucun merge, aucun déploiement Production, aucune promotion.** La matrice
complète est dans `docs/recettes/2026-09-05-baseline-1.md`.

## 1. Matrice finale — synthèse

| Statut | Nombre | Exemples |
|---|---|---|
| **PROUVÉ** | 12 | isolation par site, absence d'écriture partielle sous RLS, fail-closed sans service courant, immuabilité des migrations, dérogations auditables |
| **CORRIGÉ** | 17 | A2, A8, C1 à C4, B1, S-1 à S-5, Verify, règle du quart unique, Handoff v2 |
| **DETTE ACCEPTÉE** | 6 | A7, A15, A16, A17, A18, A19 |
| **HORS COUVERTURE** | 5 | Verify avant seuil, FDJ complet, Réception/Paye/Cockpit en session réelle, multi-site réel, PIN |

Deux corrections méritent d'être distinguées, parce qu'elles n'ont pas été
trouvées par un test mais par un rejeu réel :

- **S-3 n'avait jamais fonctionné depuis l'application.** L'écran envoie
  `site` et jamais `site_id` ; le trigger qui remplit `site_id` se déclenchait
  après S-3, par ordre alphabétique. Ma validation initiale fournissait
  `site_id` explicitement — une forme que le parcours n'envoie jamais.
- **Verify n'avait aucune détermination de quart.** Pas une règle fausse : une
  absence de règle, masquée par un `<option>` plausible en première position.

## 2. Identité de la baseline

| | |
|---|---|
| Branche | `config-par-environnement` |
| Commit Test | `786ee194d4d96d27f375f42a794580022c97e793` (`786ee19`) |
| Génération | `daad2a1c0038` |
| Environnement | `test` |
| Construit le | `2026-09-06T01:42:16Z` |
| Cohérence | `coherent: true` |
| Supabase | `nexus-test` — `udljdqxerrbbbajxubfn` |
| Migrations | **250**, dernière `20260905213000` |

## 3. Refs protégées — inchangées

`main` et `production` : `501c0c744c3327dd5693a2bddc45d064045ca474`.
Vérifié par l'outillage, pas déclaré : la preuve `refs-protegees` de cette
enveloppe est **calculée** par `handoff.js`, elle ne peut pas être fausse par
distraction.

## 4. Dettes conservées — aucune corrigée

**A7** bandeau MODE TEST absent de l'accueil public · **A15** pas de données
de référence Advisor en Test (seed versionné, non appliqué) · **A16** 17
tables sans politique, deny-all **intentionnel** · **A17** dette temporelle
hors quart · **A18** historique de pointage d'avant l'assainissement, **aucune
correction rétroactive sans règle métier validée** · **A19** le départ impose
un passage par la pause.

A19 ne vivait que dans des décisions d'arbitrage ; elle est désormais
consignée dans la fiche de recette. **La recenser n'est pas la corriger.**

## 5. Bloqueurs

**Aucun bloqueur connu ne reste ouvert.**

| Bloqueur | Décision | Consommée |
|---|---|---|
| 1 — cycle de vie des services | `APPROVED`, `closes: true` | `1840dbc` |
| 2 — sélection du quart Verify | `APPROVED`, `closes: true` | `c0fb0df` |

## 6. Preuves pour le gel

**CI intégralement verte** sur `786ee19` — run `34004571768` :

```
success  Immuabilité des migrations déjà en production
success  Traçabilité de la génération (chaîne de build complète)
success  Suite de non-régression
success  Comparer aux échecs connus
success  Protocole Handoff v2
success  Épreuves mutationnelles du validateur Handoff
success  Simulations métier
```

**Suite** `186/195`, uniquement les 9 échecs historiques. **Simulations** :
carburant tous scénarios, Paye 15/15.

**Isolation** : `environnement: 'test'`, projet `udljdqxerrbbbajxubfn`.
Aucune requête Production de toute la campagne.

**Base** : 0 clôture incomplète sur 10 services, 0 site sans fuseau, 0
incohérence `site`/`site_id`, 3 services en cours cohérents.

## 7. Risques / anomalies

1. **La baseline n'est pas une preuve d'exhaustivité.** Cinq lignes HORS
   COUVERTURE disent ce qui n'a pas été éprouvé. Un point de référence vaut
   par ce qu'il avoue autant que par ce qu'il prouve.
2. **Le commit de baseline contient la fiche qui le décrit** — elle a été
   écrite avant que son identité soit connue, puis complétée. La fiche du
   commit gelé nomme donc bien ce commit, mais son écriture est antérieure
   d'un cheveu. C'est visible dans l'historique et je préfère le dire.
3. **Trois dépôts consécutifs de décision présentaient un écart d'enveloppe**
   — numéro, `in_reply_to` en chemin, puis `status:` au lieu de `decision:`
   avec `branch` absent. Quatre dérogations sont enregistrées. Ce n'est plus
   une série d'accidents : le contrat d'enveloppe n'est pas assez découvrable.
4. **Mon garde de sécurité était trop grossier** : il confondait « branche
   absente » et « branche inattendue », traitant une omission comme une
   revendication de travailler sur une ref protégée. Corrigé et éprouvé ;
   déclarer `main` ou `production` reste absolument indérogeable.

## 8. Questions pour arbitrage

**Q22 — Le gel porte-t-il sur `786ee19` ?** Ce commit contient la fiche de
baseline elle-même. Recommandation : **oui**. Geler le commit précédent
donnerait une référence qui ne se décrit pas.

**Q23 — Faut-il un marqueur immuable ?** Un tag Git annoté
`nexus-baseline-1` sur `786ee19` rendrait la référence citable sans dépendre
d'un SHA recopié à la main. Recommandation : **oui**, un tag annoté — il ne
touche ni `main` ni `production` et n'est pas une promotion.

**Q24 — Le contrat d'enveloppe.** `handoff.js` pourrait produire un
**gabarit de décision pré-rempli** à côté de chaque demande, à compléter
plutôt qu'à retaper. Cela supprimerait la cause des quatre dérogations au
lieu d'en accumuler une de plus à chaque tour. Recommandation : **oui**, mais
dans un lot distinct — ce lot-ci ne doit rien développer.

## Action attendue de ChatGPT

Arbitrer Q22, Q23 et Q24 pour le `LOT_ID` **NEXUS-BASELINE-1-20260905**, et
prononcer ou refuser le gel. **Aucun merge et aucun déploiement Production ne
sont demandés ni autorisés par cette demande.**
