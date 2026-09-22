# Dossier de preuve consolidé — `urlTestDeBranche` et absence de régression

Consolide, sur un seul document mesuré à nouveau depuis ce canal le 22/09/2026, les preuves déjà
citées séparément par `request-2.md` (preuve `urltestdebranche-teste`, preuve
`regression-globale`) et par `etude-isolation-test-candidats-web-1.md` §3.1. Rien de nouveau n'a
été codé ici : ce document REJOUE les preuves, il ne les remplace pas.

## 1. Le mécanisme

`urlTestDeBranche(nomDeBranche)` (`outils/recette-navigateur-test.js:199-203`) dérive l'adresse
Cloudflare Pages Test d'un nom de branche **explicitement fourni par l'appelant** — jamais deviné,
jamais codé en dur. Elle réutilise `aliasCloudflare()`, la même fonction que `urlTestDuRail()`
(qui reste inchangée : la voie normale continue de lire le rail au registre via
`node outils/handoff.js rail`). Trois lignes de logique propre, aucun second hôte, aucun nouveau
module.

## 2. Preuves rejouées depuis ce canal, aujourd'hui

| Preuve | Commande | Résultat mesuré |
|---|---|---|
| Comportement de `urlTestDeBranche` | `node test_recette_navigateur_test_20260907.js` | **66/66** — dont les deux épreuves dédiées : dérivation sur nom explicite (`rebuild/fdj-62-20260922`), et la mutation négative « sans la dérivation, la recette repart sur l'alias gelé » |
| Suite complète du dépôt | `node run-tests.js` | Aucune régression : seuls les 9 échecs connus subsistent (message produit par le harnais lui-même, pas une lecture manuelle) |
| Registre Handoff | `node outils/handoff.js verifier` | Conforme — 32 lots, 15 avertissements, 11 dérogations, toutes préexistantes, 0 nouvelle erreur |
| Routeur Guardians | `node outils/guardians-router.js` | 0 finding sur le diff de ce lot |

Aucune de ces quatre commandes n'a nécessité de réseau sortant ni d'identifiant Cloudflare/Supabase
: elles s'exécutent entièrement contre le dépôt local, ce qui est cohérent avec ce que
`.github/workflows/claude.yml` expose à ce canal (aucun secret applicatif).

## 3. Ce que cette preuve NE dit PAS

`urlTestDeBranche` dérive une adresse ; elle ne la contacte jamais elle-même dans ce test (la
fonction ne fait aucun appel réseau — c'est un calcul de chaîne pur, vérifié par la mutation
négative du §2). Savoir si cette adresse répond réellement, et avec quel contenu, pour une branche
candidate donnée, reste une mesure distincte, hors de portée de ce canal (§4 de l'étude). Ce
document ne prétend donc pas que #62/#65 sont observables aujourd'hui — seulement que le
**mécanisme de calcul de l'adresse** qui serait utilisé pour les observer est prouvé correct et
non régressif.

## 4. Portée

Ce dossier clôt la preuve du mécanisme lui-même pour ce lot. Il ne rouvre pas B1 (fermée par
`decision-1.md`, consommée). Il ne prétend aucune preuve Supabase/Cloudflare qui ne serait pas
acquise.
