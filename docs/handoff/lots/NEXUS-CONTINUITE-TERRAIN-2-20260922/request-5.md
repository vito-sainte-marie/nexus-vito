---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: comparaison-7-fichiers
    classe: VERIFIED
    valeur: 7-7-blobs-identiques-rail-5ec005c-vs-candidate-290a217f
  - id: mode-build-sh-sans-consequence
    classe: VERIFIED
    valeur: 755-vs-644-jamais-invoque-en-executable-direct
  - id: portage-deja-satisfait-contenu
    classe: VERIFIED
    valeur: zero-diff-reel-aucun-commit-artificiel
  - id: mecanisme-fail-closed-rejoue
    classe: VERIFIED
    valeur: test_config_environnement-17-17-test_build_tracabilite-49-49
  - id: build-cible-supabase-test-reel
    classe: NOT_APPLICABLE
    valeur: aucune-variable-NEXUS_SUPABASE-presente-dans-ce-canal
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0-production=2bc7b39-inchangees
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32-lots-conformes
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Re-mesure des 7 chemins autorisés — portage déjà satisfait sur le contenu

Réponse au réveil du 23/09/2026 (issue #28) demandant de re-mesurer les 7 fichiers autorisés par
`decision-3.md` entre le rail courant (`handoff-continuite-20260920`, `5ec005c`) et la branche
candidate `rebuild/carburants-65-20260922` (`290a217f0f07d4f408469bc9cb8239814544f092`), avant
toute écriture.

## 1. Méthode

Comparaison par lecture seule uniquement (`git diff`, `git rev-parse <ref>:<chemin>`,
`git cat-file -e`) — aucune tentative d'écriture Git n'était nécessaire pour cette étape, donc
aucune n'a été faite. `git merge-base` confirme que la candidate diverge de `origin/production`
(`501c0c7`), pas du rail : c'est une branche PR #65 antérieure à toute l'infrastructure
`config-par-environnement`/Handoff, ce qui correspond aux constats déjà déposés dans
`preuve-cloudflare-humaine-65-portage-1.md`.

## 2. Résultat — empreintes exactes des 7 fichiers

| Fichier | Blob rail (`5ec005c`) | Blob candidate (`290a217f`) | Identique |
|---|---|---|---|
| `outils/build.sh` | `cb9f53e4e95720ace8fd9e33adfb209f5fb0c4eb` | `cb9f53e4e95720ace8fd9e33adfb209f5fb0c4eb` | **oui (contenu)** |
| `outils/generer-config.js` | `47a8f82e18002a4b2fbeff08f5180f4f91139b5f` | `47a8f82e18002a4b2fbeff08f5180f4f91139b5f` | oui |
| `outils/poser-build-id.js` | `dd0deaf7d7a36e5031f1eccdd01c3d1ba0e52f9a` | `dd0deaf7d7a36e5031f1eccdd01c3d1ba0e52f9a` | oui |
| `nexus-auth.js` | `db20b1c662728f2eb1cc7d2d53dce3087a6cfaea` | `db20b1c662728f2eb1cc7d2d53dce3087a6cfaea` | oui |
| `nexus-page.js` | `73d682e44971e73b6d09b663fc2ff56a3739ea00` | `73d682e44971e73b6d09b663fc2ff56a3739ea00` | oui |
| `nexus-bandeau-environnement.js` | `12dcec79c6772e9977274cff7242845a64120b07` | `12dcec79c6772e9977274cff7242845a64120b07` | oui |
| `_headers` | `7704f204077efc2728ee4ddf07d671ed6011cc7e` | `7704f204077efc2728ee4ddf07d671ed6011cc7e` | oui |

**Les 7 blobs sont strictement identiques** (mêmes empreintes de contenu des deux côtés) —
vérifié fichier par fichier, pas par un diff agrégé qui aurait pu masquer un cas. Les 7 fichiers
existent bien sur les deux refs (`git cat-file -e` confirmé pour chacun côté candidate ; présence
confirmée dans l'arbre de travail côté rail).

**Un seul écart réel, non textuel** : `outils/build.sh` porte le mode `100755` (exécutable) sur le
rail et `100644` (non exécutable) sur la candidate (`git diff 5ec005c 290a217f -- outils/build.sh`
→ `old mode 100755` / `new mode 100644`, aucun hunk de contenu). Vérifié comme **sans conséquence
fonctionnelle** : les trois seuls points d'invocation existants appellent tous le script via
l'interpréteur, jamais en exécutable direct — `package.json:10` (`"build": "bash outils/build.sh"`),
la commande Cloudflare documentée (`bash outils/build.sh`), et le harnais de test
(`execFileSync('bash', ['outils/build.sh'], ...)` dans `test_build_tracabilite_20260905.js`). Un
`bash <script>` ne requiert que la permission de lecture, jamais le bit d'exécution.

## 3. Requalification

Conformément à l'instruction du réveil (« si zéro différence, requalifie le portage comme déjà
satisfait ») : **le portage des 7 fichiers est déjà satisfait sur le contenu.** Aucun commit
artificiel n'a été fabriqué pour des fichiers déjà identiques — cela aurait produit un diff vide
ou un simple changement de mode sans valeur probante, l'inverse de ce que le protocole demande.
Les 8 refus d'écriture Git déjà consignés dans `request-4.md`/`preuve-cloudflare-humaine-65-portage-1.md`
restent l'état réel de ce canal, mais ils ne bloquent plus rien : il n'y a plus rien à transporter
sur le contenu de ces 7 fichiers.

## 4. Étape suivante autorisée par `decision-3.md` §2 — build/isolation Test

Deux niveaux distincts, à ne pas confondre :

**a) Mécanisme de fail-closed (rejoué, pas nouveau)** — `node test_config_environnement.js` →
**17/17** ; `node test_build_tracabilite_20260905.js` → **49/49**. Confirme, sur le contenu réel
du rail (identique aux 7 fichiers candidats), que le build refuse un environnement `test` pointant
Production, refuse un environnement `production` ne pointant pas Production, et épingle chaque
actif servi. Ce sont les mêmes chiffres déjà cités par `decision-3.md` — reconfirmation, pas une
preuve nouvelle.

**b) Build réel ciblant Supabase Test (le point exigé avant navigation)** — **non obtenu, et non
fabriqué.** Vérifié explicitement (présence, pas valeur) : `NEXUS_SUPABASE_URL`,
`NEXUS_SUPABASE_ANON_KEY`, `NEXUS_ENV`, `SUPABASE_TEST_DB_URL_WRITE`, `NEXUS_TEST_DB_URL` sont
tous **ABSENTS** de l'environnement de ce canal. Sans ces variables, `bash outils/build.sh`
refuse lui-même de continuer (c'est exactement ce que 17/17 ci-dessus vérifie) — il n'existe donc
aucun moyen, depuis ce canal `issue_comment`, de produire un build réel ciblant `nexus-test`, ni
a fortiori de prouver son ciblage exclusif. Ce point reste `NOT_APPLICABLE`, inchangé depuis
`request-4.md` — pas une régression, une limite structurelle déjà connue de ce canal.

**Aucune navigation tentée**, conformément à l'instruction explicite du réveil.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucun nouveau rôle/RLS, aucune règle métier/UX nouvelle, PR #65 non
modifiée, aucun fichier applicatif touché (diff limité à `docs/handoff/`), aucune tentative
d'écriture Git superflue (le transport était inutile, donc non tenté — pas un nouvel échec).
