---
protocol: nexus-handoff/2
kind: request
lot_id: SITE-EXPLICITE-1-CREATEUR-SITES-GUARD-20260906
seq: 1
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=501c0c7 production=501c0c7
  - id: protection-explicite
    classe: VERIFIED
    valeur: drapeau client refuse 42501 avec message, plus d incidence
  - id: autorite-plateforme-preservee
    classe: VERIFIED
    valeur: renommage accepte, creation acceptee, retrait d un site vide accepte
  - id: destruction-empechee
    classe: VERIFIED
    valeur: suppression d un commerce peuple refusee en nommant les 6 comptes
  - id: registre-aides
    classe: VERIFIED
    valeur: 2 aides non declarees revelees des sa mise en service
  - id: derogations-nominatives
    classe: VERIFIED
    valeur: 3 inscrites, chacune nommant Frederic Bragance
  - id: garde-zero-question
    classe: VERIFIED
    valeur: UNKNOWN 3 vers 0, VULNERABLE 0
  - id: mutations
    classe: VERIFIED
    valeur: 23 verifications, 6 mutations detectees apres correction de 2 tests
  - id: doctrine-connector
    classe: VERIFIED
    valeur: frontiere inscrite, aucune implementation
  - id: suite
    classe: VERIFIED
    valeur: 192/201
  - id: aides-par-lecture
    classe: HUMAN
    valeur: est_pompiste_du_jour validee sur lecture, pas sur comportement
  - id: derogations-update-delete
    classe: HUMAN
    valeur: fondees sur ma lecture de la doctrine, a confirmer
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---

# SITE-EXPLICITE-1-CREATEUR-SITES-GUARD — protection explicite, doctrine intégrée

## Contrat anti-dérive

| Champ | Valeur |
|---|---|
| `objectif_metier` | Que le créateur administre NEXUS sans pouvoir s'ouvrir lui-même l'accès aux données d'un client qui le refuse. |
| `gain_attendu` | **Sécurité** — une protection incidente devient explicite ; **fiabilité** — la garde passe à zéro question ouverte. |
| `contrats_touches` | 2 triggers sur `sites` ; 0 policy modifiée |
| `guardians_requis` | Architecture · Security & Isolation · QA / Regression |
| `preuves_exigees` | avant/après · chemins légitimes · registres · rollback |
| `definition_de_termine` | Gardes explicites, registres tenus, doctrine inscrite. **Atteinte.** |

## 1. Une contradiction que je n'ai pas voulu trancher en silence

L'arbitrage **Q55** demandait : *UPDATE d'un site par créateur uniquement
lorsque le contrat d'accès créateur du site l'autorise.*

La **doctrine fondatrice**, postérieure, dit : *le fait qu'un site refuse
l'accès fonctionnel du créateur à ses données métier ne retire pas au créateur
la propriété ni l'autorité sur la plateforme NEXUS elle-même.*

Appliquer Q55 à la lettre aurait permis à un client, **en basculant un
drapeau**, d'empêcher le créateur d'administrer la ligne de plateforme de son
propre commerce — nom, fuseau, retrait. Ce n'est pas ce que ce drapeau
protège.

### La ligne de partage retenue

> `acces_createur_autorise` **n'est pas de la structure de plateforme** : c'est
> l'expression du contrôle du client sur ses données. Tout le reste de la
> ligne `sites` est de la structure.

D'où un partage qui satisfait les deux textes :

| | |
|---|---|
| Le créateur garde l'autorité sur la ligne `sites` | **doctrine** |
| `acces_createur_autorise` devient **immuable** depuis toute identité authentifiée | **Q55, et plus strictement** |
| Supprimer un commerce portant des données d'un client est refusé | doctrine — administrer n'est pas détruire |

Chaque mutation sensible porte désormais **sa propre condition** ; aucune ne
dépend plus de `select_sites`.

## 2. Mécanismes

| Garde | Effet |
|---|---|
| `nexus_acces_createur_immuable` | `BEFORE UPDATE OF acces_createur_autorise` — refuse tout changement lorsque `auth.uid()` n'est pas nul. Une **migration** reste le seul chemin : acte tracé, revu en diff. |
| `nexus_site_supprimable` | `BEFORE DELETE` — refuse si des comptes employés sont rattachés, en **nommant leur nombre**. Les 57 clés étrangères restent le filet ; un `23503` ne dit pas *pourquoi*. |

**Les trois policies créateur sont inchangées**, volontairement : la doctrine
leur donne raison, et ce sont les gardes ci-dessus qui portent la condition.

## 3. Preuves — identités réelles, transaction annulée

```
1a. drapeau sur un site VISIBLE       : REFUSE [42501] « ce réglage appartient au client… »
1b. drapeau sur le site FERME         : 0 modifiee(s)  (invisible)
2.  LEGITIME administrer la ligne     : 1 modifiee(s)
3a. supprimer un commerce PEUPLE      : REFUSE [42501] « 6 compte(s) employé y sont rattachés »
3b. LEGITIME retirer un commerce VIDE : 1 supprime(s)
4.  LEGITIME creer un commerce        : ACCEPTE
```

La ligne **1a** est le cœur du lot : là où la protection était incidente, elle
est maintenant **explicite et motivée**. La ligne **1b** montre que la défense
en profondeur subsiste.

## 4. Registre des aides nommées — il a servi immédiatement

Créé conformément à Q57, il a **révélé deux aides non déclarées** dès sa mise
en service :

| Aide | Ce qu'elle contrôle |
|---|---|
| `est_pompiste_du_jour(p_site)` | l'acteur a un service de pompiste **ouvert ce jour sur ce site** |
| `est_receptionniste_livraison_du_jour(p_site, p_date)` | l'acteur a mené une visite de réception terminée **sur ce site, ce jour** |

Toutes deux lient l'**acteur au site demandé** — un contrôle *plus* spécifique
qu'une comparaison au site du compte. Déclarées, avec la réserve honnête :
leur contrat est éprouvé **par lecture**, pas encore par comportement.

Règles appliquées : une aide inconnue rend `UNKNOWN`, **jamais** `SAFE` ; une
aide déclarée **sans preuve** de son contrat ne compte pas non plus.

## 5. Dérogations — chacune nomme un humain

| Policy | Fondement |
|---|---|
| `createur_insert_sites` | **autorisation humaine explicite de Frédéric Bragance**, 06/09/2026 |
| `createur_update_sites` | doctrine fondatrice ; risque réel fermé par `nexus_acces_createur_immuable` |
| `createur_delete_sites` | doctrine fondatrice ; destruction empêchée par `nexus_site_supprimable` |

**Point d'honnêteté à arbitrer** : seule la première repose sur une phrase
explicite de Frédéric. Les deux autres, je les ai fondées sur la **doctrine**,
qui donne l'autorité de plateforme au créateur. C'est une lecture, pas une
citation — et si elle est trop large, elle doit être corrigée (Q58).

## 6. Frontière NEXUS Connector inscrite

`docs/gouvernance/FRONTIERE-CONNECTOR-SERVICE-ROLE.md` — **aucune
implémentation**.

Le point central : `service_role` classé `NOT_APPLICABLE` **n'est pas une
absolution**, c'est un **déplacement** du contrôle vers qui détient la clé. La
frontière tient aujourd'hui par un fait contingent — aucune fonction Edge en
Test, donc personne n'emprunte ce chemin. Ce fait disparaîtra avec le
Connector.

Les dix exigences de la décision sont inscrites, dont la septième qui me
paraît la plus importante : **aucune déduction silencieuse d'un site**, et
surtout pas de Sainte-Marie. C'est le défaut que tout ce chantier a servi à
éliminer ; le Connector ne doit pas le réintroduire par une porte technique.

Et une phrase que je verse au dossier : *une identité machine n'a pas moins
d'obligations qu'une identité humaine — elle en a davantage, parce qu'elle
agit sans témoin.*

## 7. État de la garde

| Classe | Avant | Après |
|---|---:|---:|
| `SAFE` | 209 | **209** |
| `VULNERABLE` | 0 | **0** |
| `UNKNOWN` | 3 | **0** |
| Dérogations | 0 | **3** |

**Zéro question ouverte dans le périmètre de la garde.**

## Avis des Guardians

### Security & Isolation Guardian

Le drapeau du client est désormais protégé **par une règle**, plus par un
effet de bord de la lecture. C'est exactement ce que je réclamais.

Le partage retenu me paraît juste : le créateur possède la plateforme, le
client possède le droit de dire non sur ses données, et **aucun des deux ne
peut annuler l'autre**.

**Réserve** : les deux nouvelles aides déclarées sont validées **par lecture**.
`est_pompiste_du_jour` conditionne des écritures carburant réelles ; je
voudrais la voir éprouvée par comportement avant l'activation bloquante.

### Architecture Guardian

La contradiction entre Q55 et la doctrine a été **résolue par une distinction,
pas par un arbitrage d'autorité** : quelle partie de la ligne `sites` relève
de la plateforme, quelle partie relève du client. C'est la bonne façon de
traiter deux textes qui semblent s'opposer.

Le registre d'aides a prouvé sa valeur en dix minutes : deux aides
encapsulaient un contrôle de portée sans que rien ne les déclare. Sans lui, la
garde serait devenue aveugle à la première refactorisation.

### QA / Regression Guardian

**Deux de mes propres tests laissaient passer une mutation.** L'un vérifiait
la *classe* sans le *motif* — or `UNKNOWN` est aussi la réponse par défaut,
donc il ne distinguait rien. L'autre testait `extraireRoles` sans son
**câblage** dans l'analyseur : supprimer la lecture de la clause `TO` ne
faisait échouer aucun test.

Corrigés, les six mutations sont détectées. Mais la leçon est générale :
**tester une fonction n'est pas tester son usage**, et vérifier un verdict
n'est pas vérifier qu'on sait pourquoi.

## Preuves

- Migration `20260906100000_garde_createur_sites.sql`, **Test uniquement**.
- 6 mesures sous identités réelles, transaction annulée.
- Garde : `UNKNOWN 3 → 0`, `VULNERABLE 0`, 3 dérogations nommées.
- `test_garde_portee_site_20260906.js` — **23 vérifications**, 6 mutations
  détectées.
- Registres : 5 aides déclarées, 3 dérogations, toutes complètes.
- Suite `192/201`, mêmes 9 échecs historiques.
- `main` et `production` : `501c0c7` — preuve calculée par l'outillage.

## Rollback

`drop trigger` sur les deux gardes ; les policies n'ont pas été modifiées, les
registres sont des fichiers. **Aucune donnée touchée.**

## Risques / anomalies

1. **Deux dérogations reposent sur ma lecture de la doctrine**, pas sur une
   phrase explicite — voir Q58.
2. **Les deux nouvelles aides sont validées par lecture**, pas par
   comportement.
3. **`service_role`** : frontière inscrite, non éprouvée — aucune fonction
   Edge en Test.
4. La garde reste **non bloquante**.

## Questions pour arbitrage

**Q58 — Les dérogations `update`/`delete` sont-elles correctement fondées ?**
Je les ai adossées à la doctrine. Si la gate estime qu'elles exigent une
phrase explicite de Frédéric comme `insert`, elles doivent être retirées du
registre en attendant.

**Q59 — Éprouver `est_pompiste_du_jour` par comportement avant l'activation
bloquante ?** Recommandation : **oui**. Elle conditionne des écritures
carburant réelles, et une aide déclarée sûre sur lecture seule est exactement
ce que le registre est censé empêcher.

**Q60 — Activer la garde en bloquant ?** Toutes les conditions posées sont
réunies : 0 `VULNERABLE`, 0 `UNKNOWN`, dérogations nominatives, tests par
mutation. Recommandation : **oui, après Q59**, avec la démonstration exigée
qu'une mutation volontaire fait bien échouer le workflow.

## Action attendue de ChatGPT

Arbitrer Q58, Q59, Q60 pour le `LOT_ID`
**SITE-EXPLICITE-1-CREATEUR-SITES-GUARD-20260906**. **Aucune activation
bloquante, aucune ouverture de la classe D, aucune extension n'est demandée.**
