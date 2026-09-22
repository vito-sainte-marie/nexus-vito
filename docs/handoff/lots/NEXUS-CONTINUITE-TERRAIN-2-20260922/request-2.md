---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: b1-fermee
    classe: VERIFIED
    valeur: decision-1.md consommee, APPROVED_WITH_CONDITIONS
  - id: etude-isolation-test
    classe: VERIFIED
    valeur: etude-isolation-test-candidats-web-1.md depose
  - id: urltestdebranche-teste
    classe: VERIFIED
    valeur: 66/66 test_recette_navigateur_test_20260907.js
  - id: regression-globale
    classe: VERIFIED
    valeur: aucune regression, 9 echecs connus
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32 lots conformes
  - id: portage-config-candidats
    classe: NOT_APPLICABLE
    valeur: differe, necessite observation Cloudflare humaine
  - id: fdj-carburants-drift
    classe: NOT_APPLICABLE
    valeur: aucun acces Supabase Test depuis ce canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# B1 fermée ; étude et outillage §2.1 déposés ; §2.2 à §6 hors de portée de ce canal

## 1. B1 — fermée

`decision-1.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`) répond au point 1 de
`request-1.md` et est consommée : Audrey et Lydie sont remplaçantes manager légitimes, Audrey
est prioritaire et se connecte normalement depuis le 22/09/2026 (constaté par Frédéric — la
preuve d'aboutissement `last_sign_in_at` demandée par `request-1.md` est donc déjà acquise, pas
mesurée par Claude), Yannick garde ses droits de gérante, Angélique reste renfort sans
promotion. Aucun changement RLS/rôle/secret n'a été fait ni n'était requis.

## 2. §2.1 — isolation Test des candidats web : étude déposée, outillage minimal ajouté

`etude-isolation-test-candidats-web-1.md` (ce lot) établit :

- le mécanisme d'adressage Test (Cloudflare Pages, alias dérivé du nom de branche) existe déjà
  et n'a pas besoin d'être réinventé — `aliasCloudflare()` (dans
  `outils/recette-navigateur-test.js`) prend n'importe quel nom de branche, `urlTestDuRail()`
  ne fait que le spécialiser au rail du registre ;
- les deux causes réelles, déjà mesurées dans `dossier-decision-pr-62.md`/`dossier-decision-pr-65.md`,
  qui empêchent #62/#65 d'être testés : `nexus-auth.js` pré-refonte (932 lignes, Production en
  dur) et absence totale de la chaîne de build (`outils/build.sh`, `outils/generer-config.js`,
  `nexus-page.js`, `nexus-bandeau-environnement.js`) sur ces deux lignées ;
- un écart de formulation entre `request-1.md` (présent : « sert donc une page ») et les deux
  dossiers (conditionnel : « servirait ») — le check GitHub `Cloudflare Pages` est mesuré rouge
  sur `fe4e9a2` et `fe36a8e`, donc rien n'est actuellement servi pour ces deux SHA précis ; la
  cause du rouge n'est pas établie depuis ce canal.

Ajouté et prouvé (`outils/recette-navigateur-test.js`, `test_recette_navigateur_test_20260907.js`,
commit local de ce lot) : `urlTestDeBranche(nomDeBranche)`, qui dérive l'adresse Test d'une
branche EXPLICITEMENT nommée par l'appelant, en réutilisant `aliasCloudflare()` — aucune seconde
implémentation, aucun nom de branche codé en dur, aucun module nouveau. `urlTestDuRail()` est
inchangée. Suite complète rejouée : aucune régression (les mêmes 9 échecs connus, sans nouveau).
`handoff.js verifier` et le routeur Guardians restent conformes après ce dépôt.

**Non fait, délibérément** : le portage des quatre fichiers de configuration sur les branches
`rebuild/fdj-62-20260922`/`rebuild/carburants-65-20260922` elles-mêmes. L'étude le recommande
seulement après qu'un humain avec accès au tableau de bord Cloudflare ait observé ce qui est
réellement construit et servi aujourd'hui sur ces branches — ce canal n'a ni identifiant
Cloudflare ni accès réseau sortant.

## 3. §2.2, §3, §4, §5, §6 — hors de portée de ce canal, non entamés

Chacun de ces points est soit séquencé après le portage non fait au §2 ci-dessus
(#62 dossier complet, §5 dette de dérive « après sécurisation du mécanisme Test »), soit exige
un accès à Supabase Test/Production que ce canal GitHub Issue n'a jamais eu, de façon constante
depuis l'ouverture de cette issue le 06/09/2026 : aucune variable `NEXUS_TEST_DB_URL*`,
`SUPABASE_TEST_DB_URL*` ni `NEXUS_TEST_*_PIN` n'y est présente (vérifié par test de présence
booléen, sans jamais lire de valeur). Ce n'est pas un fait nouveau nécessitant un réveil : c'est
la même contrainte que tous les réveils précédents de cette issue ont rencontrée et documentée.
Rien n'a donc été entamé sur #62 (§3), #65 (§4), la dette de dérive Supabase Test (§5) ou le
reclassement des autres gates (§6), pour ne pas fabriquer une preuve que ce canal ne peut pas
obtenir.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucun fichier applicatif métier touché (diff limité à
`docs/handoff/`, `outils/recette-navigateur-test.js`, `test_recette_navigateur_test_20260907.js`).
