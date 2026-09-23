---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: diagnostic-reproduit
    classe: VERIFIED
    valeur: extraction-reelle-290a217-178-fichiers-node-verifier-echec-identique-CI
  - id: fix-mecanique-teste
    classe: VERIFIED
    valeur: pose-puis-verifier-760-refs-coherentes
  - id: classification-cause
    classe: VERIFIED
    valeur: portage-incomplet-garde-historique-incompatible
  - id: risque-voie-b-identifie
    classe: DECLARED
    valeur: recommit-nexus-build-js-reintroduit-defaut-commit-perime-A6
  - id: workflow-edit-hors-permission
    classe: DECLARED
    valeur: aucune-modification-.github-workflows-dans-ce-canal
  - id: portage-code-non-applique
    classe: NOT_APPLICABLE
    valeur: aucun-acces-ecriture-vers-rebuild-carburants-65-20260922-depuis-ce-canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Cause exacte du rouge #65 reproduite ; correction hors de portée de ce canal — STOP, pas de contournement

Réponse au réveil du 23/09/2026 (issue #28, poursuite technique déterministe, sans gate Créateur).

## 1. Reproduction réelle, pas supposée

Le contenu exact de `rebuild/carburants-65-20260922` (`290a217f0f07d4f408469bc9cb8239814544f092`) a été
reconstitué fichier par fichier (`git show <sha>:<chemin>`, 178 fichiers — les 174 `.html`/`.js` de
racine que `poser-build-id.js` inspecte, plus `outils/poser-build-id.js`, `outils/build.sh`,
`outils/generer-config.js`, `.gitignore`) dans une copie locale, puis `node outils/poser-build-id.js
--verifier` a été exécuté réellement contre cette copie. Sortie obtenue, identique à celle du run CI
`35805992451` :

```
ÉCHEC — identité de génération NEXUS

`nexus-build.js` annonce la génération « 20260904-0104 », le contenu servi vaut « 59d2bdec4dd3 ».

    Un actif a changé après la construction, ou le fichier a été édité à la main.
```

## 2. Cause exacte

`290a217` porte exactement le geste annoncé (« chaine de build/config du rail, 7 fichiers,
mécanique ») : il remplace l'ancien `outils/poser-build-id.js` (identifiant = horodatage, présent
avant portage — cf. `request-3.md` §3, « pré-refonte ») par la version du rail, qui calcule une
**empreinte de contenu** et exige que `nexus-build.js` la porte réellement. Le portage a copié le
script, mais pas les trois pièces qui rendent ce script vrai sur ce dépôt :

1. **`nexus-build.js` reste suivi par git sur la branche candidate**, avec le contenu périmé de
   l'ancien format (`id: '20260904-0104', commit: 'b2190e5'` — littéralement le commit dont le
   décalage avait motivé toute la refonte, cf. l'en-tête du nouveau script : « le pied de page
   annonçait le commit b2190e5 alors que neuf commits avaient été déployés depuis »).
2. **`.gitignore` du candidat ne liste pas `nexus-build.js`** (vérifié : `git show 290a217:.gitignore`),
   contrairement à celui du rail (`handoff-continuite-20260920`), qui l'ignore — cohérent avec le
   commentaire du nouveau script : « `nexus-build.js` n'est plus versionné ».
3. **`test_build_tracabilite_20260905.js` — le test qui aurait détecté ce trou avant tout push — est
   absent du candidat** (vérifié : absent des 1146 fichiers du commit).

L'étape CI « Cohérence des épingles de cache » du candidat (héritée de `fe36a8e`, inchangée par le
portage) appelle directement `node outils/poser-build-id.js --verifier`, sans jamais faire tourner
`outils/build.sh` (qui génère `nexus-build.js` avant de le vérifier). Avec l'ancien script, cette
étape était tautologique — elle relisait la valeur qu'elle-même avait déjà committée. Avec le
nouveau script, elle recalcule une vraie empreinte de contenu : elle ne peut donc plus jamais
correspondre à un `nexus-build.js` committé à l'avance, quel qu'il soit.

**Classement : portage incomplet, sur une garde historique désormais incompatible avec le nouveau
script.** Ce n'est ni une incohérence réelle de l'arbre applicatif, ni un défaut du nouveau script
lui-même — `node outils/poser-build-id.js` (sans `--verifier`) suivi de `--verifier` passe
proprement sur ce même contenu (rejoué ci-dessous), preuve que rien n'est cassé dans le code porté.

## 3. Correctif mécanique validé, puis délibérément NON appliqué

Rejouer `node outils/poser-build-id.js` (pose) sur la copie reconstituée régénère `nexus-build.js`
et re-épingle les 91 fichiers concernés (`?v=20260904-0104` → `?v=59d2bdec4dd3`, valeur identique
partout avant comme après) ; `--verifier` repasse alors au vert :

```
Génération 59d2bdec4dd3 — 760 référence(s) épinglée(s), toutes cohérentes.
```

Ce correctif n'a **pas** été committé, pour deux raisons cumulatives :

- **Il exigerait de committer `nexus-build.js`** avec un champ `commit` qui ne pourrait référencer
  que le commit *avant* celui qui le porterait réellement (le problème est circulaire par
  construction : on ne peut pas connaître son propre SHA au moment où on écrit le fichier qui le
  contient). C'est très exactement le défaut que toute la refonte a été écrite pour éliminer, et que
  `test_build_tracabilite_20260905.js` éprouve explicitement (« nexus-build.js n'est plus versionné »,
  49/49 vérifié sur ce dépôt à l'instant). Le committer sur la branche candidate réintroduirait ce
  défaut précis sur exactement la branche qui doit rejoindre le rail qui vient de le corriger —
  un risque de régression documentée, pas une simple préférence de style.
- **La correction complète (celle qui ne recrée pas ce défaut) demande de modifier
  `.github/workflows/tests.yml`** — soit pour y ajouter `outils/build.sh` (ou au minimum
  `node outils/generer-config.js && node outils/poser-build-id.js`) avant `--verifier`, soit pour
  retirer entièrement cette étape et laisser `test_build_tracabilite_20260905.js` (une fois porté)
  couvrir l'invariant depuis la suite `run-tests.js`, comme le fait déjà le rail. Éditer
  `.github/workflows/*` est explicitement hors des permissions d'outillage de ce canal.

Conformément à l'instruction du réveil (« si la correction exigerait de désactiver une garde,
modifier une règle métier, RLS/rôle/sécurité ou accepter un risque matériel, STOP et publie un
request canonique »), aucun contournement n'a été tenté : ni committer un `nexus-build.js`
sciemment défectueux pour faire passer la CI, ni modifier `.github/workflows/tests.yml` sans
permission.

## 4. Ce qui reste bloqué, sans contournement tenté

Comme documenté dans `request-3.md` (5 tentatives d'écriture refusées vers cette même branche dans
une session antérieure), ce canal ne dispose d'aucune voie d'écriture vers
`rebuild/carburants-65-20260922` — seule la lecture (`git show`, `git cat-file`, `git diff` contre
un ref) fonctionne ici. Le mécanisme mécanique décrit au §3 reste donc à exécuter par une session
avec écriture réelle sur cette branche, une fois l'arbitrage ci-dessous rendu.

## 5. Arbitrage demandé

Deux voies, ni l'une ni l'autre choisie unilatéralement :

- **Voie A (recommandée)** : porter aussi `.gitignore` (ajout de `nexus-build.js`) et
  `test_build_tracabilite_20260905.js` sur `rebuild/carburants-65-20260922`, puis modifier
  `.github/workflows/tests.yml` de cette branche pour que « Cohérence des épingles de cache » exécute
  `bash outils/build.sh` (avec des valeurs `NEXUS_ENV`/`NEXUS_SUPABASE_URL`/`NEXUS_SUPABASE_ANON_KEY`
  de test, aucune n'étant un secret — la clé anon est publiable) au lieu de `--verifier` seul, à
  l'identique de ce que `test_build_tracabilite_20260905.js` éprouve déjà en copie jetable sur le
  rail. Aligne la branche candidate sur la garde réelle du rail, sans dette nouvelle.
- **Voie B (repli)** : committer un `nexus-build.js` régénéré tel quel sur la branche candidate
  (correctif §3), en acceptant explicitement la réintroduction temporaire, sur cette seule branche,
  du défaut d'identité que la refonte du 05/09/2026 a supprimé — jusqu'à ce que la Voie A soit faite.

Aucune des deux n'a été appliquée dans ce lot : la Voie A touche un fichier hors permission
d'édition de ce canal, la Voie B accepte un risque de régression documentée. Retour par ce
`request-4.md` plutôt qu'un choix silencieux.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucune modification RLS/rôle/règle métier/UX, PR #65 elle-même non
modifiée, aucun fichier `.github/workflows/*` créé ou modifié, aucun fichier applicatif touché
(diff limité à `docs/handoff/`), aucun contournement des restrictions d'écriture de ce canal, aucun
`nexus-build.js` défectueux committé pour faire passer la CI.
