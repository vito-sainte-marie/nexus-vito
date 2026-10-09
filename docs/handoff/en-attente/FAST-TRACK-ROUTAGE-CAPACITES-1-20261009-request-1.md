<!-- en-attente wake_to: ChatGPT -->
# request-1 — une autorisation n'est pas une capacité : routage Fast Track par capacité de canal

## Pourquoi ce lot est en attente, pas publié directement

Au moment de ce travail, `GO-G1-MIGRATIONS-REGULARISATION-1-20261009` est
`ATTENTE_DECISION` (`request-3.md`) et porte déjà `decision-1.md` dans son
historique. `outils/handoff.js demande` refuse donc mécaniquement tout nouveau
lot — vérifié en conditions réelles, pas supposé :

```
REFUS — le lot GO-G1-MIGRATIONS-REGULARISATION-1-20261009 est actif (ATTENTE_DECISION) et porte déjà une décision dans son historique (decision-1.md).
Un seul lot actif à la fois : terminez ce lot (consommez sa décision la plus récente, ou laissez-le sans nouvelle demande) avant d'en ouvrir un autre.
```

Le corps est rangé dans `docs/handoff/en-attente/` selon la forme née le
07/10/2026, avec un consommateur réel (`consommer` / `publier-en-attente`) et
deux gardes (`EN_ATTENTE_NON_PUBLIEE`, `EN_ATTENTE_MALFORMEE`). Rien n'a été
écrit à la main dans `lots/`.

Et la file le publiera : vérifié, pas supposé. Sur un worktree jetable détaché à
`b910ae9`, G1 marqué `DECISION_CONSOMMEE`, `publier-en-attente` rend « G1 est
fermé — publication de … (rail `handoff-continuite-20260920`, wake_to ChatGPT) »,
engendre `request-1.md` avec une enveloppe conforme par construction et ses trois
preuves remesurées (`main=d6093b7 production=56eb6e3`, merge-base `501c0c7`,
139 fichiers applicatifs), ôte la marque `<!-- en-attente … -->`, retire l'entrée
de la file, et `verifier` reste vert à 41 lots. Le worktree a été détruit ; le
registre réel n'a pas bougé. C'est exactement l'oubli vert de GOUVERNANCE que
cette épreuve exclut.

## L'incident du 09/10/2026, mesuré

`decision-1.md` du lot G1 a rendu `BLOCKED` avec
`STOP_REQUIRED: SUPABASE_PRODUCTION_MUTATION` et `OWNER_NEXT: Frédéric`. Le GO
de Frédéric est arrivé en commentaire de l'issue #28 portant
`@claude NEXUS_BASE_BRANCH=…`. Cette mention route dans
`.github/workflows/claude.yml` — le seul canal dont l'enveloppe Supabase est
**Test en lecture seule**. L'autorisation était acquise ; la capacité n'existait
pas. Le réveil s'est arrêté, et comme rien ne distinguait « pas le droit » de
« pas les moyens », la seule issue visible était de redemander une autorisation
déjà donnée.

Quatre défauts, nommés :

- **D1** — aucune déclaration de capacité par canal. Le registre connaissait des
  rôles (`Claude`, `ChatGPT`, `Frédéric`), jamais des pouvoirs.
- **D2** — `NEXT_ACTION_CONTRACT` nomme un **rôle** (`OWNER_NEXT`), jamais la
  capacité qu'exige `ACTION_NEXT` ni le canal qui la détient. « Claude » désigne
  trois canaux aux pouvoirs différents.
- **D3** — `OWNER_NEXT: Frédéric` + un GO en commentaire d'issue re-route dans le
  canal incapable. Le transfert de responsabilité n'était pas outillé.
- **D4** — `PROGRESS_FINGERPRINT` et `FAST_TRACK_STALL` (règle 11) n'existaient
  qu'en prose dans `SKILL.md`. Rien ne les calculait, donc rien ne les opposait à
  un réveil répété.

## Ce qui est corrigé, et comment c'est prouvé

Un commit sur le rail : `b910ae9` — 10 fichiers, 1312 insertions, 9 suppressions.
Branche `claude/fast-track-routage-capacites-20261009`, basée sur le rail
`58a828b`. Rien n'est poussé, `main` et `production` ne sont pas touchés.

**D1 — `docs/handoff/CAPACITES-CANAL.json` + `outils/capacites-canal.js`.**
Chaque canal déclare ses capacités avec une **preuve** typée : `ENVELOPPE` (le
fichier qui définit ses pouvoirs) ou `EXERCEE` (le geste réellement accompli).
Une capacité DÉCLARÉE est une opinion ; une capacité EXERCÉE est un fait. La
preuve `ENVELOPPE` de `github-actions-claude` pour
`SUPABASE_PRODUCTION_ECRITURE` nomme `.github/workflows/claude.yml` à
`origin/main`, avec la liste **fermée** de ses 5 secrets et 5 permissions, et
`exige: ["TEST_READ_ONLY"]`. Une épreuve lit le vrai fichier au vrai ref : si
quelqu'un y ajoute un secret Production, la garde rougit.

**D2 — `CHAMPS_CONTRAT` passe de 13 à 15 champs** dans
`outils/escalade-humaine.js` : `CAPACITE_REQUISE`, `OWNER_NEXT`,
`EXECUTANT_NEXT`, `ACTION_NEXT`. `blocMandat` les propage dans tout corps de
réveil sans autre intervention. `SKILL.md` est mis au même niveau, ce qui garde
verte la garde de cohérence croisée code↔doctrine qui existait déjà.

**D3 — la question de capacité en quatrième position** dans
`outils/classification-canal.js` : **après** le STOP fermé, **avant** le
destinataire. Tant que l'autorisation manque, nommer un exécutant mandaterait un
geste non autorisé ; dès qu'elle est acquise, c'est la capacité qui décide où le
geste part, et le rôle déclaré ne suffit plus. Un geste qu'un autre canal sait
exécuter rend `CHANNEL_LIMITATION / CAPACITE_CANAL_INSUFFISANTE` — jamais
`BLOCKED_TECHNIQUE`, conformément à l'acquis `LIMITATION_CANAL_NON_STOP`.
Seul « personne n'en est capable » rend `BLOCKED_TECHNIQUE`.

**D4 — `outils/empreinte-progression.js`, câblé dans `tests.yml`.** L'empreinte
est le SHA-256 tronqué de six champs normalisés (LOT, REQUEST, HEAD, GATE_STATE,
BLOCKER, ACTION_NEXT) ; elle voyage dans le corps publié sous
`<!-- nexus-empreinte: … -->`. Le réveil lit l'historique du canal une fois,
recalcule, et si l'empreinte y figure déjà, s'arrête en `FAST_TRACK_STALL` sans
rien publier — et **sans écrire `numero`**, dont l'écriture relancerait le relais.
`ANTERIEURES_TOLEREES = 0` : « deux fois de suite » veut dire que publier avec
une occurrence déjà présente ferait la deuxième.

Mesuré de bout en bout contre le vrai registre, `gh` stubé : le vecteur exact de
l'incident — corps changé, état inchangé — rend désormais
`BLOCKED FAST_TRACK_STALL` et ne publie rien. La contre-épreuve, garde retirée,
restitue le défaut : republication et `numero=28` écrit. Le détecteur a été
calibré sur le vrai dépôt avant d'être câblé.

Épreuves : `test_routage_capacites_canal_20261009.js` 24/24,
`test_empreinte_progression_20261009.js` 25/25,
`test_relais_arbitre_openai_20261007.js` réparé 19/19 (le passage à 15 champs
cassait sa fixture — vraie régression, vraiment corrigée). Les trois tournent en
CI : `run-tests.js` découvre les épreuves **par glob**, pas par déclaration ;
aucune ligne à ajouter dans `tests.yml`.

Suite complète rejouée avant et après, sur un worktree détaché au rail
`58a828b` : **la même paire d'échecs préexistants** —
`test_fast_track_anti_pause_20261007.js` et `test_handoff_v2_20260905.js`. Les
deux passent seuls (60 s et 71 s) et meurent sur le `timeout: 90000` de
`run-tests.js` sous parallélisme 8 de cette machine. Aucune régression imputable
à ce lot.

`node outils/handoff.js verifier` : « registre, enveloppes et STATE.json
conformes (40 lot(s), 17 avertissement(s), 13 dérogation(s)) ».

## Ce qui n'est pas corrigé, et pourquoi

- `outils/reveil-orchestrateur.js` ne **calcule** pas encore `CAPACITE_REQUISE`
  et `EXECUTANT_NEXT` depuis le registre : ils s'affichent en gabarit. Le
  mécanisme de décision existe et est prouvé ; son remplissage automatique est un
  lot d'outillage à part.
- Aucun secret, aucune permission Production n'a été ajouté au workflow
  automatique. Aucune migration Production n'a été faite dans ce correctif
  d'infrastructure — consigne explicite de Frédéric, respectée.
- `.github/workflows/claude.yml` n'est pas modifié : il vit sur `main`, gate
  humaine. `canalCourant()` déduit le canal de `NEXUS_CANAL` ou de
  `GITHUB_ACTIONS`, donc aucune modification n'est strictement requise.

## Les quatre conditions de l'arbitrage a posteriori, vérifiées une à une

1. **Aucun choix métier ou produit** — outillage, gardes, épreuves, câblage CI.
2. **Aucun secret** — ni lu, ni créé, ni tourné ; aucune dépendance ni harnais
   tiers. `CAPACITES-CANAL.json` **nomme** les secrets autorisés de `claude.yml`
   par leur identifiant pour les borner ; il n'en lit aucune valeur.
3. **Aucune action Production** — ni Supabase Production, ni NEXUS Production.
4. **Aucune modification de `main`** — `main=d6093b7` inchangé.

Les quatre tiennent ensemble : `OUTILLAGE_A_POSTERIORI` s'applique.

## L'état réel du lot G1 — correction d'une prémisse

G1 **n'attend pas son exécution**. Elle a eu lieu le 09/10/2026 : registre
298→304 mesuré à 10:38:29, post-contrôles verts, advisors propres,
`origin/production` intact au moment de la mesure, aucune PR, aucun déploiement,
six migrations par `execute_sql` et jamais `apply_migration`. `decision-1.md`
(`BLOCKED`, `closes: true`) fermait `request-1.md` ; `request-2.md` puis
`request-3.md` ont rouvert le lot, qui est donc `ATTENTE_DECISION` et attend une
**`decision-2.md`** en réponse à `request-3.md`. Il attend une décision, pas un GO. Limite déjà énoncée dans `request-3.md` : aucun instantané advisors
d'avant-G1.

« Préparer la reprise de G1 » signifie donc préparer sa **clôture**, puis le
chemin à préflight rafraîchi des gates restantes (G2 PR/déploiement, G3 recette
navigateur, G4/G5 reprises d'audit) — chacune sous son propre GO. Rejouer les
migrations serait à la fois inutile et contraire à la consigne.

## Choix de conception soumis à arbitrage

1. **`HEAD` est porté au domaine, non au push.** L'empreinte prend
   `git log -1 --format=%H -- docs/handoff`, pas `GITHUB_SHA`. Justification :
   `PROOF_CACHE` porte déjà ses preuves par domaine — « `docs/handoff/**`
   n'invalide pas une preuve Paye ou FDJ ». Avec `GITHUB_SHA`, tout commit
   étranger au Handoff changerait l'empreinte et rouvrirait la boucle de réveils
   que ce lot ferme. Inscrit dans `SKILL.md`, affirmé par deux épreuves.
   **Question : confirmez-vous cette portée ?**

2. **Un acquis est proposé, pas ajouté.** `CAPACITE_REQUISE` mériterait une
   entrée dans `ARBITRAGES-ACQUIS.json` — « une autorisation acquise ne vaut pas
   capacité : chercher le canal capable est une `CHANNEL_LIMITATION`, pas une
   question à Frédéric ». Je ne l'ai **pas** ajoutée : c'est
   `CHANGEMENT_DOCTRINE`, motif du palier `frederic`.
   **Question : l'arbitre la retient-il, et sous quelle formulation ?**

3. **Fenêtre de 15 champs.** Le contrat refuse désormais une réponse d'arbitre à
   13 champs. Une réponse en vol à un réveil publié avant `b910ae9` serait
   rejetée — bruyamment (exit 2, motif imprimé), jamais silencieusement. Si une
   telle réponse existe, elle doit être reformulée avec les trois champs.

4. **`claude.yml` candidat, optionnel.** Déclarer `NEXUS_CANAL` explicitement
   dans `claude.yml` rendrait le canal courant lisible sans déduction. Ce serait
   un fichier candidat plus une note « à appliquer sur `main` » pour Frédéric,
   suivant le motif existant. **Question : vaut-il la peine ?**

## Ce qui est demandé

Un arbitrage a posteriori sur `b910ae9`, et une réponse aux quatre questions
ci-dessus. Si l'arbitrage est favorable et la décision `closes: true`, la suite
est la clôture de G1, puis les gates restantes sous leurs GO respectifs.
