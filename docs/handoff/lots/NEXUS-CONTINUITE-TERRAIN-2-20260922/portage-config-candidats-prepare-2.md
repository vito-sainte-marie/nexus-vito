# Portage config candidats — préparé, pas appliqué

Répond au point 3 de la mission du 22/09/2026 : « préparer, sans l'appliquer à Production, le
plus petit portage de configuration nécessaire pour qu'un candidat web puisse être isolé sur
Supabase Test ». Rien n'est appliqué à `main`, `production`, ni à une branche candidate depuis ce
lot : ce document et le script qu'il documente sont un mécanisme prêt à l'emploi, pas une
exécution.

## 1. Correction d'un écart trouvé en préparant ce portage

`etude-isolation-test-candidats-web-1.md` §1 et §3.2 nomme « les quatre fichiers » (`outils/build.sh`,
`outils/generer-config.js`, `nexus-page.js`, `nexus-bandeau-environnement.js`) plus
`nexus-auth.js` séparément, soit cinq au total. **Cette liste est incomplète**, vérifié en lisant
réellement les deux fichiers qu'elle nomme :

1. `outils/build.sh` appelle `node outils/poser-build-id.js` à ses étapes 2 ET 3 (« identité de la
   génération », « vérification de l'arbre publié ») — absent de la liste, le build échouerait dès
   l'étape 2 (`poser-build-id.js` introuvable).
2. `outils/generer-config.js` **lit** (`fs.readFileSync`, ligne 201), sans jamais l'écrire,
   `_headers` — et refuse explicitement de continuer si ce fichier est absent ou ne porte pas la
   règle `Cache-Control: no-store` pour `/nexus-config.js` (« Le fichier `_headers` est absent : `nexus-config.js` serait servi sans `no-store` », `outils/generer-config.js:199`).

Les deux fichiers manquants ont été introduits par le même mouvement que les cinq déjà cités —
`_headers` le 2026-09-04 (commit `95cc92a`), `outils/poser-build-id.js` dans la même série A6/A14
— donc absents des mêmes candidats pré-refonte pour la même raison.

**La portée réelle est donc de SEPT fichiers, pas cinq.** Sans les deux manquants, un portage
suivant l'étude initiale se solderait par un `outils/build.sh` qui échoue en échec fermé — un
échec précis et sans ambiguïté, jamais une fausse configuration Test, mais un échec évitable en le
sachant à l'avance.

## 2. Le mécanisme préparé

`outils/porter-config-candidat-test.sh <checkout-local-de-la-branche-candidate>` (nouveau, ce lot)
copie exactement ces sept fichiers, tels qu'ils existent sur ce dépôt de travail (le rail), vers un
checkout **déjà extrait par l'appelant** — le script ne fetch, ne checkout, ni ne push rien
lui-même. Garde-fous, éprouvés par `test_porter_config_candidat_test_20260922.js` (9/9,
sandbox git local, aucun réseau) :

- refuse toute cible sur `main` ou `production`, avant toute copie ;
- refuse une cible qui n'est pas un dépôt git, ou HEAD détaché ;
- refuse de se prendre lui-même pour cible (le rail n'est jamais écrasé par le rail) ;
- refuse si un des sept fichiers source est absent de ce dépôt (portage interrompu, rien de plus
  modifié au-delà de ce point) ;
- ne committe jamais, ne pousse jamais — confirmé par une épreuve dédiée (le HEAD git de la cible
  ne bouge pas, les sept fichiers apparaissent en modifications NON indexées) ;
- une mutation négative confirme que retirer le garde-fou `main|production` du texte du script est
  bien détecté par l'épreuve qui le prouve.

## 3. Ce que ce document ne fait pas, délibérément

Il ne porte les sept fichiers sur `rebuild/fdj-62-20260922` ni `rebuild/carburants-65-20260922`
(ou toute branche candidate réelle). L'étude (§4-§5) reste valide et n'est pas rouverte : ce
portage doit être séquencé après qu'un humain avec accès au tableau de bord Cloudflare ait observé
ce qui est réellement construit et servi aujourd'hui pour un candidat — sans quoi appliquer ce
script changerait un système dont l'état actuel n'est pas mesuré depuis ce canal, qui n'a de toute
façon ni identifiant Cloudflare ni accès réseau sortant pour le faire ou pour le vérifier après
coup.

## 4. Prochain geste exécutable, une fois l'observation Cloudflare faite

```
bash outils/porter-config-candidat-test.sh <chemin-local-du-checkout-de-la-branche-candidate>
git -C <chemin> status
git -C <chemin> diff
# observer depuis Cloudflare ce que ce diff, une fois poussé, ferait construire et servir
# puis, seulement si concluant : commit + push humain, sur la branche candidate, jamais sur main/production
```

Aucun de ces gestes n'est exécuté par ce lot.
