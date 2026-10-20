---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R1-IDENTITES-PROVENANCE-20261019
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
---
# GOV-R1-IDENTITES-PROVENANCE-20261019 : voie A mise en œuvre — rouge puis vert, cas de contrôle vert

**Domaine :** gouvernance. **Préparé par :** Claude Code, dans le périmètre délégué par Frédéric (request-4, cité par decision-3). **Nature :** compte-rendu d'exécution déléguée, avec les preuves exigées par decision-3. Cette demande ne sollicite pas un nouvel arbitrage de fond : elle rapporte E1 à E5 rouges puis vertes et le cas de contrôle, pour que le lot se ferme sur cette base si l'arbitre l'estime complet.

## Ce qui a été exécuté, dans le périmètre délégué

1. `outils/provenance.js` (nouveau) code les trois codes d'arrêt validés par decision-2 (`PROVENANCE_NON_ETABLIE`, `PROVENANCE_INVALIDE`, `PROVENANCE_INSUFFISANTE`) :
   - une décision humaine (`author` ∉ {`ChatGPT`, `NEXUS Orchestrator`, `Claude`}) doit déclarer explicitement `provenance.niveau` (1 ou 2 — jamais 3, inatteignable sous la voie A, quel que soit le compte qui commite) ;
   - une décision `author: ChatGPT` n'est acceptée à la **consommation** que matérialisée par la CI : si l'enveloppe porte `provenance: {mode: github_actions_relay, reference: <URL>}` (forme fixée par decision-3), l'outil vérifie par l'API GitHub que la référence désigne un commentaire de `github-actions[bot]`, citant un run de `tests.yml` dont l'étape de relais a réussi, au contrat identique à la décision — « les valeurs de l'enveloppe ne suffisent jamais seules » ; à défaut de ce champ (décisions historiques, dont decision-3 elle-même), l'outil vérifie l'identité git du commit qui a déposé la décision (`github-actions[bot]`, celle que `tests.yml:678-679` pose réellement) ;
   - une API indisponible (réseau, jeton, 5xx) est un **arrêt explicite** (`arret: true`), jamais un repli silencieux vers un succès.
2. `outils/handoff.js` :
   - `lireEnveloppe` lit `provenance:` comme un objet imbriqué (niveau, mode, reference), à côté des listes d'objets déjà lues ;
   - `nouvelleDecision` (commande `decision`) exige la déclaration **au dépôt** pour un auteur humain (E1, E4) ; pour `ChatGPT`, le dépôt reste permissif et capte simplement la référence déjà disponible (`--provenance-reference`, ou `COMMENTAIRE` — déjà exportée par l'étape de matérialisation de `tests.yml` pour tout son `run:`, donc **aucune ligne de `tests.yml` n'a changé**) ;
   - `consommer` appelle la garde de provenance avant toute écriture de `DECISION_CONSOMMEE` ;
   - `verifier` valide la **forme** d'un champ `provenance` quand il est présent, sans jamais l'exiger rétroactivement sur l'historique (append-only : aucune décision déjà déposée n'est invalidée par ce lot).
3. `test_provenance_falsification_20261020.js` : E1 à E5 et le cas de contrôle.

## Preuve ROUGE avant le code

Épreuves écrites contre `outils/handoff.js` et `outils/provenance.js` **avant** leur câblage (provenance.js existait déjà comme logique pure, mais `handoff.js` ne l'appelait pas) :

```
7/16 épreuves passent.
  ECHEC  E1 : --auteur "Frédéric Bragance" sans aucune preuve est refusé au dépôt
  ECHEC  E1 (contre-épreuve) : le même dépôt avec niveau et référence explicites passe
  ok     E4 : une décision humaine qui revendique le niveau 3 est insuffisante
  ECHEC  E4 : au dépôt, --provenance-niveau 3 est refusé (le compte partagé ne prouve jamais le niveau 3)
  ok     E4 (contre-épreuve) : un compte qui n'est pas vito-sainte-marie n'est pas davantage exempté
  ok     E2a / E2b / E2c (logique pure déjà correcte, non câblée dans handoff.js)
  ok     E3 : une API injoignable produit un arrêt explicite (logique pure)
  ECHEC  E3 : handoff.verifierProvenanceDecision relaie l'arrêt sans jamais consommer — fonction absente
  ECHEC  E5 : décision ChatGPT déposée directement par un agent — fonction absente
  ECHEC  E5 (cas de contrôle) : committée par github-actions[bot] — fonction absente
  ECHEC  E5 (cas de contrôle) : matérialisée par la CI (API conforme) — fonction absente
  ok     E5 : au dépôt, --auteur ChatGPT sans référence n'écrit aucune provenance (déjà le cas, rien à câbler)
  ECHEC  E5 : au dépôt, --auteur ChatGPT avec COMMENTAIRE écrit la forme prescrite — option CLI absente
  ECHEC  lireEnveloppe lit un champ provenance comme un objet — parseur non étendu
```

Les ECHEC listés ci-dessus sont ceux qui exigeaient le câblage dans `outils/handoff.js` (option CLI, `lireEnveloppe`, `verifierProvenanceDecision`, garde dans `consommer`) : ils confirment que l'outil actuel ne faisait rien de ces contrôles, exactement les constats rouges de `epreuves-falsification-provenance.md`.

## Preuve VERTE après le code

```
16/16 épreuves passent.
```

Toutes les épreuves E1 à E5 listées ci-dessus passent, y compris leurs contre-épreuves (E1, E4) et les deux formes du **cas de contrôle E5** : une décision `ChatGPT` committée par `github-actions[bot]` sans le nouveau champ (le cas historique, dont decision-3 elle-même), et une décision `ChatGPT` portant `provenance: {mode: github_actions_relay}` vérifiée par une API simulée conforme.

## Régression mesurée, et corrigée dans le même commit

`node outils/handoff.js verifier` reste vert sur le registre réel (75 lots, 18 avertissements, 13 dérogations — identique à avant ce lot : **aucune décision historique n'est invalidée**, conformément à l'append-only).

La suite de non-régression a été rejouée sur les 19 fichiers `test_*.js` qui requièrent `outils/handoff.js` (le seul module touché, avec `outils/provenance.js`, nouveau). Deux régressions réelles ont été trouvées et corrigées :

- `test_boucle_tour_vide_20261015.js` et `test_handoff_file_en_attente_20261007.js` déposent, dans leurs bancs d'épreuve, une décision `author: ChatGPT` committée sous une identité git de test (`epreuve`) — exactement ce que E5 doit désormais refuser. Ces épreuves ne portent pas sur la provenance : leur commit de dépôt initial est désormais fait sous l'identité `github-actions[bot]`, celle que `tests.yml` pose réellement à la matérialisation (`tests.yml:678-679`). Les deux suites sont repassées à 14/14 et 8/8.

Une divergence non liée à ce lot a été observée et écartée : `test_relais_arbitre_openai_20261007.js` compare `GITHUB_SHA` (gelé par l'environnement de cette session, à la valeur de `main` lue en tout début de session) à la tête réelle du dépôt — qui avance à chaque commit de travail. Elle aurait échoué pour tout commit fait dans cette session, sur du code non touché par ce lot ; `env GITHUB_SHA=<HEAD réelle>` fait repasser les deux cas à vert, confirmant qu'il s'agit d'un artefact d'environnement de session et non d'une régression de ce lot.

## Hors périmètre, non touché

Conformément au périmètre délégué (request-4) : aucune ligne de `.github/workflows/tests.yml`, aucun workflow d'armement, aucune permission, aucun secret, aucune identité, aucun connecteur. La règle des niveaux (condition 3 de decision-2) n'est pas modifiée : le code l'applique (niveau 2 suffit sur Test/doctrine, niveau 3 reste hors de portée). La voie B (identité distincte ou clé de signature, protection du rail R7) n'est pas entamée. L'incident SQL d'ETAPE5 reste ouvert, non traité.

## Limite résiduelle, déjà consignée

Le repli « identité git du commit » (pour les décisions `ChatGPT` sans le nouveau champ `provenance`) et la vérification par API (quand il est présent) partagent la même limite que `epreuves-falsification-provenance.md` nomme déjà pour E5 : un job `claude.yml` utilisant le même jeton que le relais pourrait committer ou poster sous la même identité `github-actions[bot]`. Ce risque résiduel est renvoyé à R2 et à la voie B ; il n'est pas résolu par la voie A, et cette demande ne prétend pas le résoudre.

## Preuve des conditions de decision-3

Les conditions de `decision-3.md` :

1. **Exécuter et consigner E1 à E5 rouges avant tout code, puis vertes après le code avec le cas de contrôle vert.** Respectée : voir « Preuve ROUGE avant le code » et « Preuve VERTE après le code » ci-dessus — 7/16 puis 16/16, cas de contrôle inclus (les deux formes : committeur CI et API).
2. **Utiliser le champ provenance défini dans decision-3.** Respectée : `provenance: {niveau, mode: github_actions_relay, reference: <URL>}`, écrit tel quel par `nouvelleDecision` et relu tel quel par `lireEnveloppe` (épreuve dédiée).
3. **Vérifier E5 par l'API sans repli silencieux.** Respectée : `verifierGithubActionsRelay` relit l'API (`gh api`, injectable pour l'épreuve) ; une API indisponible rend `arret: true` et jamais un succès (épreuve E3).
4. **Ne modifier ni tests.yml, workflow d'armement, permission, secret, identité, connecteur, Production, règle des niveaux, voie B ou ETAPE5.** Respectée : voir « Hors périmètre, non touché ». Le seul fichier de workflow concerné (`tests.yml`) n'apparaît dans aucun diff de ce lot ; la variable `COMMENTAIRE` qu'il exporte déjà est seulement **lue**.
5. **Ne clore le lot qu'après dépôt des preuves vertes.** Respectée : cette demande ne porte pas `closes: true` ; la clôture, si elle a lieu, revient à la décision qui répond à cette demande.
