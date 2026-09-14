# Les trois branches « trousseau » comparées au candidat

**10/09/2026.** Candidat `config-par-environnement`. Les trois branches
suspectées de faire doublon avec le correctif déjà intégré :

- `claude/issue-28-20260909-1054`
- `claude/issue-28-20260909-1213`
- `claude/issue-28-20260909-1455`

---

## Réponse courte

**Elles ne font PAS doublon.** Le défaut qu'elles corrigent est bien réparé
dans le candidat, mais elles portent trois choses de plus qui n'y sont pas.

---

## Ce qui EST couvert par le candidat

**Le défaut du trousseau lui-même.** Les trois branches corrigent le même
point : `security find-generic-password` était exigé avant même de regarder si
`NEXUS_TEST_DB_URL` était fournie, ce qui tuait toute reconstruction sur un
runner Linux.

Vérifié par témoin, pas par lecture : `test_credential_seulement_si_necessaire`
passe **10/10** sur le candidat, y compris sa mutation négative qui rejoue le
fichier d'avant correctif. Les trois scripts concernés ne réclament plus de
credential quand l'URL est là, et le refus de la référence Production reste
avant toute tentative de connexion.

Sur ce point précis, rapatrier n'apporterait rien.

## Ce qui N'EST PAS dans le candidat

Cinq fichiers, tous absents — vérifié un par un avec `git cat-file` :

| fichier | branche | nature |
|---|---|---|
| `outils/resoudre-connexion-test.sh` | 1054 | **outil neuf** (132 lignes) |
| `test_resoudre_connexion_test_20260909.js` | 1054 | épreuve (169 lignes) |
| `test_reconstruction_sans_trousseau_20260909.js` | 1213 | épreuve (106 lignes) |
| `test_connexion_test_url_avant_trousseau_20260909.js` | 1455 | épreuve (92 lignes) |
| `test_handoff_rattraper_demande_20260909.js` | 1455 | épreuve (169 lignes) |

### 1 · La résolution de connexion, extraite en outil partagé

`outils/resoudre-connexion-test.sh` factorise le choix direct/pooler que le
candidat porte **en double**, recopié dans `reconstruire-base-test.sh` et
`repeter-lot-production-readiness-test.sh`.

Le comportement est couvert dans le candidat ; **la duplication ne l'est pas**.
C'est une dette de forme, pas un défaut.

### 2 · `handoff.js rattraper` — et c'est le point qui compte

La branche 1455 ajoute une commande `rattraper` que le candidat n'a pas :
vérifié, zéro occurrence de « rattrap » dans son `handoff.js`, et la liste des
commandes diffère d'exactement cette entrée.

Son commentaire décrit le problème mot pour mot :

> Rattrape `STATE.json.lots[lot].derniere_demande` quand un `request-N.md` a été
> déposé DIRECTEMENT (commit humain/Orchestrator, pas `handoff.js demande`) sur
> un lot déjà enregistré. […] `verifier` bloque et donc `consommer` refuse pour
> TOUT le registre.

**J'ai réparé ce cas à la main deux fois aujourd'hui** — pour
`request-5`/`decision-5`, puis pour `request-6`/`decision-6`. La seconde fois a
fait échouer la CI et empêché la recette navigateur de tourner. Une commande
existait pour ça, sur une branche que personne n'avait rapatriée.

C'est l'illustration exacte de ce qu'une branche en rade coûte : non pas du
travail perdu, mais du travail **refait**, plus mal, deux fois.

---

## Ce que je recommande

**Les trois branches ne doivent pas être classées « doublon ».** Ce serait
faux, et ça perdrait la commande `rattraper` ainsi que quatre épreuves.

Trois voies, par ordre de préférence :

1. **Rapatrier sélectivement** : la commande `rattraper` et son épreuve, puis
   les trois épreuves de connexion. L'outil `resoudre-connexion-test.sh` peut
   suivre ou non — c'est du confort, pas une correction.
2. **Rapatrier en entier**, en acceptant que les correctifs de scripts
   fassent doublon avec les miens et devront être arbitrés ligne à ligne.
3. **Classer au registre** avec un motif honnête : « défaut couvert autrement,
   MAIS `rattraper` et quatre épreuves abandonnées sciemment ». Cette voie est
   défendable, à condition que l'abandon soit écrit, pas implicite.

**Ce que je n'ai pas fait :** je n'ai rapatrié ni classé quoi que ce soit.
Fusionner du travail d'un autre canal ou déclarer son sort au registre sont
deux gestes qui appartiennent à Frédéric.

## Limites de cette comparaison

- Elle porte sur la **présence de fichiers et de commandes**, pas sur une
  relecture ligne à ligne des correctifs de scripts. Deux corrections du même
  défaut peuvent diverger dans le détail sans que cette comparaison le voie.
- Les branches `1735` et `2038`, qui publient `request-6` et `request-7`, ne
  sont pas traitées ici : elles portent du handoff, pas du trousseau.
