# Dossier de décision — PR #65, régularisation d'une réception carburant passée

Établi le 22/09/2026. Ce dossier s'arrête à un **GO / NO GO de fusion**. Il ne demande ni
déploiement, ni migration Supabase Production : ce sont des gates distinctes, postérieures.

## 1. Le candidat

| | |
|---|---|
| PR | [#65](https://github.com/vito-sainte-marie/nexus-vito/pull/65) — « Réception carburant : une réception passée se régularise sans jamais prétendre avoir été saisie le jour même » |
| Branche | `reception-regularisation-20260919` (non protégée) |
| **SHA candidat** | **`fe36a8ebafb2a64dd1cc4f558424f3915749b4eb`** |
| Base | `production` = `2bc7b39dd73a35d8031f850e202095370a1db85a` |
| `mergeable` / `mergeable_state` | `true` / `unstable` |

**Le SHA a été relu depuis GitHub, pas repris de confiance** :
`gh api repos/vito-sainte-marie/nexus-vito/git/ref/heads/reception-regularisation-20260919`
→ `fe36a8ebafb2a64dd1cc4f558424f3915749b4eb`, identique à `gh api …/pulls/65 → .head.sha`.

`gh pr view --json headRefOid` rendait encore l'ancien `ffb520b` avec `CONFLICTING/DIRTY` : il
est périmé et a été écarté.

Le SHA poussé est *identique* au commit local d'intégration ; l'égalité de SHA vaut donc
preuve d'égalité d'arbre.

## 2. Ce que le candidat contient

3 commits en avance sur `production`, **0 en retard** — `merge-base` = la tête de `production`.
Le candidat ne dépend d'aucun rail.

```
fe36a8e  Integrer la tete de production, et re-mesurer l'empreinte
ffb520b  Empreinte de l'artefact : re-mesurer les deux constantes que la migration rend caduques
fbf113b  Réception carburant : une réception passée se régularise sans jamais prétendre
         avoir été saisie le jour même
```

17 fichiers, +1 600 / −35 : deux écrans (`NEXUS-Carburant-Reception-v1.html`,
`NEXUS-Carburants-Pilotage-v1.html`), deux modules de données (`nexus-reception-donnees.js`,
`nexus-carburant-donnees.js`), dix épreuves, la constante d'empreinte, et **une** migration —
`20260919103000_carburant_reception_regularisation_releve_manuscrit.sql`. Le dépôt passe de 276
à 277 migrations.

**Aucune instruction destructrice**, ni active ni en commentaire : recherche de `drop
table|drop column|drop schema|drop database|truncate|delete from|drop policy` sur la migration —
zéro correspondance.

`git merge-tree --write-tree production fe36a8e` : fusionne proprement, aucun conflit.

## 3. Les preuves ordinaires, sur ce SHA exact

Run **35763232850** — workflow `Tests`, `success`, 2026-09-22T17:50:37Z. Job `non-regression`,
**11 étapes, 11 vertes**, la même liste que pour #62 (étapes 1 à 11, de « Set up job » à
« Guardian Philosophie NEXUS — rapport »).

L'étape 8, « Infrastructure — empreinte de l'artefact », est verte : les deux constantes ont
été re-mesurées avec la migration (`MIGRATIONS_REELLES_NOMBRE = 277`, empreinte `e23c091f…`).
C'est l'objet du commit `ffb520b`.

Check-runs sur `fe36a8e` :

| Check | Conclusion | Requis par le ruleset `production` ? |
|---|---|---|
| `non-regression` (×2 : `push` + `pull_request`) | success | **oui** |
| `Construire et éprouver l'artefact` | success | **oui** |
| `Cloudflare Pages` | failure | non |
| `Déployer sur GitHub Pages` | skipped | non |
| `Supabase Preview` | skipped | non |

**Les deux checks requis sont verts** — d'où `unstable` et non `blocked`. `Cloudflare Pages`
est rouge sur toutes les branches du dépôt depuis toujours, ne publie rien, n'est pas requis :
ce n'est pas une régression de #65.

**Rien n'a été déployé.** Le workflow `Déploiement Production (GitHub Pages)` (run 35763455359)
est `success`, mais son job `Déployer sur GitHub Pages` est `skipped` ; seul « Construire et
éprouver l'artefact » a tourné. Vérifié job par job.

## 4. Ce qui n'existe pas pour ce SHA — à ne pas convertir en succès

> « Inscrire explicitement au dossier que la recette navigateur profonde n'existe pas pour leur
> SHA. Ne pas transformer son absence en succès ou en preuve équivalente. » — Frédéric, 22/09.

**La recette navigateur profonde n'existe pas pour `fe36a8e`.** Absence **structurelle**, pas
échec ni saut. `.github/workflows/tests.yml` sur ce SHA ne contient aucune occurrence de
`NEXUS_REF_EST_LE_RAIL`, `recette navigateur`, `Playwright`, `PostgreSQL Test` ni `journal
Live` — zéro pour chacun. 8 étapes nommées déclarées, 11 exécutées, contre 48 déclarées sur le
rail.

Conséquences, sans les adoucir :

- **Aucune preuve « SHA attendu ↔ SHA servi »** pour `fe36a8e`. Celle du 22/09 porte sur
  `a4e86c0`, qui ne contient ni le code ni la migration de #65. Elle ne se transporte pas.
- **Aucun parcours navigateur** exécuté contre ce code. Or ce lot porte précisément une règle
  d'écran — une date d'effet distincte de la date de saisie — et deux écrans modifiés. Les dix
  épreuves Node vertes décrivent l'intention du code ; elles ne montrent pas l'écran servi.
- La migration **n'a été appliquée à aucune base** au titre de ce SHA : aucune connexion
  PostgreSQL Test dans ce run.
- Un vert à 11/11 ici ne se compare pas à un vert à 51/51 sur le rail.

Cause identique à #62 : la preuve profonde est réservée à la ref déclarée rail au registre.
Déclarer `reception-regularisation-20260919` rail pour l'obtenir recréerait le défaut qu'on
vient de supprimer. Question renvoyée par le Créateur à une évolution d'architecture CI séparée.

## 5. Ce qu'une fusion n'accomplit pas

- **Fusionner ne déploie pas.** Gate Pages distincte.
- **Fusionner n'applique pas la migration.** Base Production à 276, dépôt à 277 après fusion :
  écart de 1, résorbé par une gate Supabase Production distincte, non demandée ici.
- **Ordre avec #62 :** les deux fusionnent chacun proprement sur `production`, mais **pas l'un
  sur l'autre**. `git merge-tree fe4e9a2 fe36a8e` rend un conflit, un seul, de contenu, dans
  `.github/deploiement/test_empreinte_artefact_20260915.js` — les constantes d'empreinte (277
  ici, 288 pour #62, 289 en réalité une fois les deux fusionnés). Conflit **textuel et
  visible**. Le second fusionné devra re-mesurer ses deux constantes, sinon l'étape 8 rougira
  sur `production`.

## 6. La décision demandée

**GO / NO GO de fusion de #65 vers `production`**, sur le SHA
`fe36a8ebafb2a64dd1cc4f558424f3915749b4eb` et lui seul. Si la tête de la branche bouge,
l'autorisation tombe et le dossier est à refaire.

Aucune fusion Production automatique. Aucun déploiement et aucune migration Production ne sont
demandés par ce dossier, quelle que soit la réponse.

## 7. Verdict rendu le 22/09/2026 — NO GO temporaire

Frédéric, en session : **NO-GO temporaire de fusion Production — preuves Test profondes
manquantes.** « Ce ne sont pas des rejets fonctionnels. Les candidats peuvent être bons ; leur
dossier de preuve n'est simplement pas encore au niveau requis pour Production. » Et sur ce
candidat précisément : « Pour #65, le périmètre est beaucoup plus petit — 3 commits et 1
migration — mais la même lacune de preuve existe. »

## 8. Ce qui a été mesuré depuis, et ce que la mesure a révélé

Mesuré le 22/09/2026 contre la vraie base Test (`db.udljdqxerrbbbajxubfn.supabase.co`), mot de
passe lu au trousseau, **essai refermé par `rollback`**, migration préalablement vérifiée
transaction-compatible.

- **Essai à blanc : `exit 0`.** Mais avec **9 NOTICE « column … already exists, skipping »**.
- **Différence d'objets à l'intérieur de la transaction : 0 objet créé, 0 objet détruit.** Sur
  Test, cette migration est un **no-op strict**.

### 8.1 Pourquoi ce no-op est un résultat, pas un succès

Les colonnes existent déjà sur Test. Or **aucune** des 276 migrations de l'arbre `production` ne
déclare `regularisation_motif` ni `mode_saisie`, et aucune des 11 versions hors-bande de Test
(`20260904175747` … `20260909170000`) n'approche du 19/09. Le schéma de Test a donc été avancé
par du DDL direct, hors du système de migrations.

Conséquence à énoncer franchement : **la migration de #65 n'a jamais été prouvée créer quoi que
ce soit, nulle part.** Elle est muette sur Test parce que Test a déjà dérivé ; sur Production,
sa fusion serait sa **première application réelle**. L'essai vert ci-dessus prouve qu'elle ne
casse rien là où son effet est déjà acquis. Il ne prouve pas son effet.

Le schéma Production n'a pas pu être relu en contrepartie : le secret en lecture seule
(`nexus-prod-db-readonly`) est bien présent, mais ni l'hôte direct ni le pooler n'ont répondu
depuis ce poste (exit 6). C'est une mesure **non prise**, pas une mesure négative.

### 8.2 Structurellement indisponible pour ce SHA

Identique à `fe4e9a2`, et pour les mêmes deux causes indépendantes : le `nexus-auth.js` de
`fe36a8e` est celui de 932 lignes, qui code `uzhjpqpctpvxytxpxoqz.supabase.co` — **Supabase
Production** — en dur et ignore `window.NEXUS_CONFIG` ; et `urlTestDuRail()` dérive l'adresse du
rail déclaré au registre, donc ne sait pas adresser un candidat de PR. Un déploiement de branche
de `reception-regularisation-20260919` servirait une page parlant à Production ; y jouer la
recette y écrirait.

Conformément au point 5 du plan, **l'absence de recette navigateur profonde pour `fe36a8e` est
inscrite ici comme absence**, et les mesures PostgreSQL ci-dessus ne sont pas offertes en
équivalent.
