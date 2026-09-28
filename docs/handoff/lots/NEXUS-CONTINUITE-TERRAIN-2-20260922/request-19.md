---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 19
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=4a49bf4 production=2bc7b39
  - id: refs-mesurees-checkout-frais
    classe: VERIFIED
    valeur: production-2bc7b39-pr65-fe36a8e-rebuild-20af9f6-rail-cb675ed
  - id: reseau-gh-indisponible-ce-canal
    classe: VERIFIED
    valeur: git-fetch-ls-remote-gh-version-tous-refuses
  - id: secrets-test-absents
    classe: VERIFIED
    valeur: aucune-valeur-lue-test-presence-booleen
  - id: composition-65-chaine-lineaire
    classe: VERIFIED
    valeur: merge-base-production-pr65-rebuild-ancetres-directs-aucun-transport-dangereux
  - id: login-canonique-identite-blob
    classe: VERIFIED
    valeur: hash-42f24e7b-identique-fichier-livre-374d724
  - id: login-candidat-defaut-persiste
    classe: VERIFIED
    valeur: hash-fb2b0169-url-production-en-dur-ilike
  - id: login-test-21-21-frais
    classe: VERIFIED
    valeur: test_login_pre_auth_non_enumerable_65_20260928-rejoue-sur-ce-checkout
  - id: regression-globale
    classe: VERIFIED
    valeur: 268-277-9-echecs-connus-inchanges
  - id: guardians
    classe: VERIFIED
    valeur: 1-finding-nexusstock-deja-connu-arch-002
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32-lots-15-avertissements-11-derogations-0-nouvelle-erreur
  - id: transport-candidat-push
    classe: NOT_APPLICABLE
    valeur: aucun-droit-ecriture-hors-branche-jetable-ce-canal
  - id: verification-supabase-test
    classe: NOT_APPLICABLE
    valeur: aucun-secret-reseau-test-ce-canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# `#65` réévalué à neuf — composition confirmée saine, correctif login re-prouvé, mêmes deux gestes hors de portée du canal

Déposée au titre de **Q76** (arbitrage a posteriori pour outillage, tests, preuve — aucun choix
métier/produit, aucun secret, aucune Production, aucun `main`). Ne remplace ni `request-17.md` ni
`request-18.md`, qui restent en attente sur leurs sujets propres (recette navigateur/gates #65 pour
le premier, `issues: write` pour le second). Répond à la mission « reprendre #65 jusqu'à
`PRET_GATE_CREATEUR` » du réveil du 28/09/2026 sur l'issue #28.

## 0. Ce que ce réveil a mesuré, distinct des mesures précédentes

`request-17.md` avait mesuré `push:false`/`pull:false` par un appel API GitHub direct. Ce canal-ci
ne permet aucun appel réseau du tout (`git fetch`, `git ls-remote`, `gh --version` lui-même, `curl`
— tous requièrent une approbation humaine indisponible dans ce run automatisé, vérifié un par un
dans cette session, pas supposé par réputation). Aucun secret Test (`NEXUS_TEST_DB_URL`,
`NEXUS_TEST_MANAGER_PIN`, etc.) n'est présent dans l'environnement (vérifié par test de présence
booléen, aucune valeur lue). La mesure des refs ci-dessous provient donc du checkout fourni à ce
job au moment de son déclenchement — pas d'une relecture réseau en direct, que ce canal ne permet
structurellement pas —, mais c'est un checkout frais de ce job précis, pas un SHA recopié d'un
document antérieur.

| Ref | Valeur | Date du commit |
|---|---|---|
| `origin/production` | `2bc7b39dd73a35d8031f850e202095370a1db85a` | 2026-09-21 — inchangée depuis `request-17.md`/`decision-10.md` |
| `origin/main` | `4a49bf4f5df328866249b3698c1ffaf2956976a4` | 2026-09-26 — avancée depuis le dernier relevé (5b047e0, 22/09), hors périmètre #65 |
| PR `#65` (`reception-regularisation-20260919`) | `fe36a8ebafb2a64dd1cc4f558424f3915749b4eb` | 2026-09-22 |
| candidat de preuve (`rebuild/carburants-65-20260922`) | `20af9f6fbfa435465c05245528ba112880b7be4b` | 2026-09-24 — identique au SHA cité par le réveil |
| rail (`handoff-continuite-20260920`, = HEAD de cette session) | `cb675ed96471aa60f4595bcdebd206d04734c078` | identique à la référence de rail vérifiée citée par le réveil |

## 1. Composition de `#65` face à Production — chaîne linéaire confirmée, pas de transport dangereux

`git merge-base --is-ancestor` confirme une chaîne strictement linéaire, pas une reconstruction
divergente :

```
production (2bc7b39) --3 commits--> PR #65 (fe36a8e) --5 commits--> rebuild candidat (20af9f6)
```

- **Delta métier** (`production..PR65`, 3 commits) : `fbf113b` (régularisation d'une réception
  passée sans prétendre l'avoir saisie le jour même), `ffb520b` (re-mesure de deux constantes
  rendues caduques), `fe36a8e` (intégration de la tête de Production + re-mesure de l'empreinte).
- **Infrastructure de preuve** (`PR65..rebuild`, 5 commits) : `290a217` (portage mécanique de la
  chaîne build/config, 7 fichiers), `664af98` (alignement garde build), `a31b2e4` (restauration
  minimale de `nexus-auth.js`, déjà arbitrée par `decision-9.md`/`decision-10.md`), `1ba8b88`
  (réalignement des deux harnais `NEXUS_CONFIG`), `20af9f6` (CI de preuve preview/recette).

Aucun des 5 commits d'infrastructure ne touche au delta métier des 3 premiers (`git diff --stat`
production↔rebuild : 28 fichiers, tous CI/build/config/tests, aucun fichier métier Carburants
touché en dehors de ceux déjà listés par `#65` lui-même). **Conclusion de cette étape** : pas de
« transport de fichiers entiers devenu dangereux » à corriger par une reconstruction fraîche — le
candidat actuel EST déjà la reconstruction minimale attendue, linéaire et traçable commit par
commit. Aucun geste de reconstruction supplémentaire n'est nécessaire à ce stade.

## 2. Correctif login (`374d724`) — re-prouvé à neuf sur ce checkout, pas rejoué aveuglément

`374d7244c5a912d9d4e34a1df6061378c8c285bd` vit sur une branche jetable
(`claude/issue-28-20260928-0105`), jamais intégrée au rail canonique ni au candidat. Cette session
en a réimporté les deux artefacts (fichier corrigé + test) et revérifié, sans réutiliser aucune
conclusion par confiance :

- **Identité du fichier canonique confirmée par hash de blob, pas par diff visuel** :
  `git rev-parse HEAD:NEXUS-Login-v1.html` = `42f24e7bae61b39663f99ab073e099543a45e87d`, strictement
  identique au blob du fichier livré par `374d724`. Le fichier canonique en service sur
  `handoff-continuite-20260920` lit toujours `window.NEXUS_CONFIG`, appelle toujours
  `.rpc("nexus_identifiant_de_connexion", { p_prenom: prenom })`, porte toujours un message de
  refus unique — le contrat n'a pas bougé depuis le 28/09.
- **Le candidat a toujours le défaut** : `git rev-parse origin/rebuild/carburants-65-20260922:
  NEXUS-Login-v1.html` = `fb2b01698bb2e64aaad5613d5b3854519ea5b0fb` (différent), et le contenu
  confirme encore l'URL Production codée en dur (`uzhjpqpctpvxytxpxoqz.supabase.co`) et le lookup
  `employees_public.ilike("nom", prenom)` — le motif d'énumération fermé le 04/09/2026 par
  `20260904175747_login_non_enumerable.sql`.
- **`test_login_pre_auth_non_enumerable_65_20260928.js` réexécuté sur ce checkout, à neuf** :
  **21/21**, y compris la détection réelle sur le SHA candidat actuel lu par git (pas une valeur
  recopiée) et les deux mutations négatives (URL en dur réintroduite, lookup `ilike` réintroduit).
  Aucun résultat n'a été supposé identique à celui de `374d724` : chaque vérification relit le
  contrat SQL et les deux fichiers depuis ce checkout.
- **Régression et gouvernance, mesurées fraîches** : `node run-tests.js` → 268/277, « Aucune
  régression : seuls les 9 échecs connus subsistent. » `node outils/guardians-router.js` → 1
  finding, la collision `NexusStock` déjà connue (dette ARCH-002 distincte, non liée). `node
  outils/handoff.js verifier` → conforme (32 lots, 15 avertissements préexistants, 11 dérogations,
  0 nouvelle erreur).

**Conséquence directe pour la contrainte du réveil** (« ne jamais compenser par
`GRANT SELECT ... TO anon` ») : ce point n'a pas été reconsidéré, le mécanisme SQL déjà en service
(`nexus_identifiant_de_connexion`) reste la seule voie retenue — confirmé, pas réinventé.

## 3. Les deux gestes hors de portée de ce canal — inchangés, vérifiés à neuf, pas supposés

1. **Transporter le fichier corrigé sur le candidat.** `NEXUS-Login-v1.html` est identique sur ce
   HEAD à l'artefact déjà livré ; il ne reste qu'à le déposer sur
   `rebuild/carburants-65-20260922`. Ce canal ne peut pousser que vers sa propre branche
   (`claude/issue-28-20260928-1434`) — aucun mécanisme, aucune commande `git push`/`gh` vers une
   autre branche n'est disponible ici, vérifié par tentative réelle cette session (`git fetch`,
   `git ls-remote`, `gh --version` tous refusés faute d'approbation possible dans ce run).
2. **Vérifier Supabase Test et rejouer la preuve candidate.** Aucun identifiant/URL Test
   (`NEXUS_TEST_DB_URL`, quatre PIN) n'est présent dans l'environnement de cette session — vérifié
   par test de présence, aucune valeur lue ni exposée. Ni la présence de la migration
   `20260904175747_login_non_enumerable` dans `supabase_migrations.schema_migrations` du projet
   Test, ni le comportement réel du RPC, ni la CI/preview du candidat, ni la recette navigateur ne
   sont donc vérifiables depuis ce canal.

Ces deux gestes sont exactement ceux déjà nommés par `374d724` §6 et par `request-17.md` §3 — non
rejoués comme méthode déjà prouvée impossible (anti-boucle respectée), seulement reconfirmés
comme toujours nécessaires et toujours hors de portée, avec les commandes exactes ci-dessous.

## 4. Verdict de la mission — `BLOQUE_CAUSE_RACINE`, cause précise et étroite

**`BLOQUE_CAUSE_RACINE`.** `PRET_GATE_CREATEUR` n'est pas déclaré : deux des cinq gates de `#65`
(recette navigateur authentifiée, vérification Supabase Test) restent ouvertes, et la CI/preview
n'a pas été rejouée sur le SHA candidat depuis cette session. La cause n'est ni un choix métier non
tranché ni un nouveau fait bloquant : c'est la même limite structurelle du canal `issue_comment`
que `request-17.md` a déjà établie par preuve API le 24/09 et que cette session reconfirme par
tentative réelle le 28/09 — absence de droits d'écriture au-delà de la branche jetable, absence de
secrets/réseau Test. Les deux prérequis logiciels (composition #65, correctif login) sont, eux,
désormais vérifiés et prêts à être transportés en un seul geste.

**Geste minimal exact, pour une session/un compte disposant de l'écriture sur
`rebuild/carburants-65-20260922` et du réseau/secrets Test :**

```
git fetch origin rebuild/carburants-65-20260922 handoff-continuite-20260920
git checkout -b lot/login-non-enumerable-corrige-65 origin/rebuild/carburants-65-20260922
git checkout origin/handoff-continuite-20260920 -- NEXUS-Login-v1.html
git commit -m "fix(login): porter le contrat pre-auth non enumerable (04/09) + config partagee sur le candidat #65"
git push origin lot/login-non-enumerable-corrige-65:rebuild/carburants-65-20260922

# Puis, avec accès udljdqxerrbbbajxubfn :
#   confirmer nexus_identifiant_de_connexion (présence + comportement, cf. §2 de 374d724) ;
#   si absente/différente, rejouer 20260904175747_login_non_enumerable.sql sur Test uniquement ;
#   rejouer le workflow "Preuve Test #65" sur le SHA résultant ;
#   confirmer la connexion Manager/Créateur/Employé Test puis la recette Carburants ;
#   revenir par un nouveau request-N.md canonique avec ces preuves — alors, et alors seulement,
#   PRET_GATE_CREATEUR pourra être évalué.
```

## 5. Ce que cette session ne fait pas

Ne pousse rien vers `handoff-continuite-20260920` ni vers aucune branche candidate — seulement vers
`claude/issue-28-20260928-1434`, via le mécanisme de PR habituel. Ne lit, ne demande ni n'expose
aucune valeur de PIN/secret. Ne déclenche aucun workflow. Ne rouvre pas le diagnostic 87→61 ni les
demandes dépassées. Ne touche pas à la protection de `main` (arbitrage séparé, hors mission). Ne
masque, ne supprime ni ne rend verte aucune dette.

## Interdits respectés

Aucun merge ni déploiement Production, aucune migration/écriture Supabase Production, aucun reset
Test historique, aucun nouveau contrat métier/UX/rôle/RLS/sécurité, aucun affaiblissement de
test/CONNUS, aucun secret/PIN/token lu ou exposé. `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste le rail canonique.
