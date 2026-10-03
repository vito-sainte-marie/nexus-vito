# Verdict — `PRET_POUR_RETABLISSEMENT_VERIFY_PRODUCTION`

Établi le 03/10/2026. **Ce verdict n'autorise rien.** Il constate qu'un correctif est
mesuré vert sur NEXUS Test, par la recette connectée, sur un SHA nommé. La fusion vers
`production` et le déploiement restent deux gestes humains distincts et postérieurs : le
refus de Frédéric du 01/10/2026 — « je n'autorise aucune fusion ni aucun déploiement
Production » — n'a pas été levé et n'est pas sollicité ici.

## 1. L'objet exact

| | |
|---|---|
| **SHA mesuré** | **`5bf7e77c50fd1fe59e6a832947d74246fafa4bd5`** |
| Rail | `handoff-continuite-20260920` (déclaré au registre, lu par `node outils/handoff.js rail`) |
| **Run** | **`37080474157`** — job `111079650574` (`non-regression`), conclusion `success` |
| Artefact jugé | `https://handoff-continuite-20260920.nexus-test-ddf.pages.dev/` |
| Base jugée | `nexus-test` = `udljdqxerrbbbajxubfn` — **Production n'a pas été touchée** |

Le correctif de fond est la migration
`supabase/migrations/20261002000000_station_config_fuseau_horaire_nullable.sql`, introduite
par `6f92ad1`. Elle a été appliquée sur `nexus-test` par un autre maillon autorisé, pas
depuis ce canal.

## 2. Le correctif `23502` n'a pas été modifié — mesuré, pas affirmé

`git show --stat 5bf7e77` : mon commit touche **exactement deux fichiers** —
`outils/recette-navigateur-test.js` (+50) et
`test_recette_prix_carburants_connectee_20261002.js` (+72), 120 insertions, 2 suppressions.

`git diff --stat 5bf7e77 -- supabase/migrations/20261002000000_…sql` **n'imprime rien** :
le fichier est octet pour octet celui de `6f92ad1`. C'est l'absence de sortie qui est la
preuve, pas une relecture à l'œil.

## 3. La recette connectée est bien sur le rail, et elle n'a pas été sautée

- `37c8ad5` est **ancêtre** du SHA mesuré (`git merge-base --is-ancestor`).
- L'étape est câblée derrière `if: env.NEXUS_REF_EST_LE_RAIL == '1'` (`tests.yml`, 927/976).
- **Le drapeau valait bien 1** : l'en-tête d'étape du journal porte `NEXUS_REF_EST_LE_RAIL: 1`.
- **113 étapes sur 113 en `success`** — aucune `skipped`. L'étape 55 « Recette navigateur
  NEXUS Test » en fait partie.

Ce dernier point est contrôlé explicitement parce que le 22/09 cinq étapes profondes
avaient été silencieusement sautées quand le nom du rail avait bougé : `skipped` n'est pas
`success`, et un run vert peut ne rien avoir jugé.

## 4. Les deux témoins de l'enregistrement des prix

**Témoin 1 — la recette** (journal du run, ligne 2703, étape ouverte à `00:06:00.75Z`) :

> · Enregistrement des prix SP/GO/GNR (Paramètres Station) : satisfaite — prix du mois
> ENREGISTRÉS, la base n'en portait aucun pour ce mois (valeurs de recette écrites),
> confirmation affichée, aucun refus de contrainte NOT NULL

Le journal porte aussi `Version servie confirmée : 5bf7e77c50fd…` : la recette a jugé
l'artefact attendu, pas un artefact plus vieux.

**Témoin 2 — la base**, relue en lecture seule sur `nexus-test` :

| site | mois | sp | go | gnr | `fuseau_horaire` | `updated_at` |
|---|---|---|---|---|---|---|
| nexus-station-test | 2026-10 | 1.79 | 1.65 | 1.21 | America/Martinique | 2026-10-03 00:06:09.252+00 |

L'écriture est **postérieure à l'ouverture de l'étape** (`00:06:00.75Z` → `00:06:09.252Z`)
et les trois valeurs sont exactement `PRIX_DE_RECETTE` (`1,790` / `1,650` / `1,210`). Un
seul témoin n'aurait rien prouvé : la recette peut se tromper sur ce qu'elle croit avoir
écrit, et la base ne dit pas qui a écrit.

## 5. Les trois contrôles explicitement demandés

### `PRIX-00x` — zéro occurrence, **et c'est concluant**

`grep -n -E 'PRIX|23502'` sur les 2808 lignes du journal ne rend **rien**. Cette absence ne
vaut que parce que la source a été lue d'abord : les codes `PRIX-001`…`PRIX-005` n'existent
que dans les `echecs.push(…)` de `verifierPrix` — ils ne sont émis **qu'en cas d'échec**.
Une rubrique vide ne distingue pas « rien à signaler » de « rien n'a été mesuré ».

Ce qui tranche, c'est que `resumePrix` est à **trois valeurs** :
`NON SATISFAITE — PRIX-00x` / `NON JUGÉE — …` / `satisfaite — …`. Le journal imprime
`satisfaite`. L'étape a donc été **jugée**, pas dégradée, et aucun code n'a tiré.

### `alert()` navigateur — zéro

Par construction du verdict `satisfaite` : les branches `PRIX-003` (une alerte inattendue)
et `PRIX-005` (une alerte *et* une confirmation) n'ont pas été prises, donc
`alertes.length === 0`. L'écouteur de dialogue était armé — sans lui une alerte native est
invisible au DOM et la recette serait verte pendant que la base refuse.

Et `PRIX-004` non pris signifie `vue.note` non vide : **la confirmation a été affichée**.

### SQLSTATE `23502` — zéro

`grep 23502` → 0 ; `violates` → 0 ; `not-null` → 0. Et la branche `PRIX-001`, dont le motif
`REFUS_NOT_NULL` est le seul chemin par lequel un `23502` devient un échec de recette, n'a
jamais été appariée.

## 6. Pas de régression sur Verify ni sur les autres écritures `station_config`

**NEXUS Verify ne fait que LIRE `station_config`.** `grep -n station_config
NEXUS-Verify-v1.html` ne rend que deux `select` (lignes 2042 et 2221). Verify n'a donc
jamais été cassé par le `23502` : **il dégradait**. Sans prix du mois,
`calculerMontantCuve()` rend 0 et l'écran affiche deux avis — « la remise en cuve restera à
0,00 € tant qu'ils ne sont pas saisis dans Paramètres Station » et « Cela n'empêche pas
d'enregistrer : seul le montant des ventes piste (ticket pupitre) est obligatoire. »

**Cette précision corrige une formulation du projet lui-même.** Le texte de `PRIX-001` dans
la recette, et une note de travail, disaient « la remise en cuve de Nexus Verify est
inutilisable ». C'est une surestimation : le geste cassé était celui **en amont** — un
manager enregistrant les prix du mois dans Paramètres Station. Le rétablissement attendu est
celui de ce geste, et par ricochet d'un montant de cuve non nul.

**Les autres écritures : couverture STATIQUE, et il faut le dire ainsi.**
`test_station_config_upsert_fuseau_horaire_23502_20261002.js` passe **9/9** et vérifie que
les 15 sites d'upsert `station_config` du dépôt fournissent bien les colonnes encore
contraintes. C'est une lecture de source, pas une observation de parcours : seul le chemin
« prix » a été réellement exercé par un navigateur.

**Le `DROP NOT NULL` n'a rien effacé.** Risque acquis seulement après mesure :
`fuseau_horaire` vaut toujours `America/Martinique` sur la ligne que l'upsert vient de
toucher, parce que `ON CONFLICT (site) DO UPDATE` n'assigne que les colonnes citées. La
ligne candidate à NULL est validée, puis jetée.

## 7. Ce qui reste ouvert, et qui n'est pas couvert par ce verdict

**`horaires` et `site` restent `NOT NULL` sans défaut sur `station_config`** — mesuré ce
jour sur `pg_attribute` : ce sont exactement les deux colonnes dans cet état. C'est la
**même famille de défaut** que `fuseau_horaire`, et elle n'est pas fermée. Elle ne mord pas
sur le chemin « prix » seulement parce que ce gestionnaire-là fournit les deux
(`NEXUS-Parametres-Station-v1.html:1695`). Tout appelant qui en omettrait une rouvrirait le
`23502`.

**Le registre Test diverge du nom de fichier.** Mesuré ce jour : 288 estampilles sur
`nexus-test`, la plus récente `20261002233051` — et une requête sur les deux noms ne rend
**que** celui-là. L'estampille `20261002000000`, qui est le nom du fichier sur le rail,
**n'existe pas** au registre. Douzième divergence de ce type. Le correctif est bien en
place ; c'est sa trace qui ne porte pas le nom attendu.

**Le run `37077466591` est antérieur au correctif et ne juge rien.** Créé à
`2026-10-02T23:25:00Z`, pour une estampille posée à `23:30:51Z`. Son rouge —
`locator.fill: Timeout 30000ms exceeded` / « element is not visible » — **n'était pas la
migration** : c'était l'accordéon « Carburants » replié, corrigé par les volets A/B/C de
`5bf7e77`. Deux faits à ne pas confondre : *présence* d'un champ au DOM et *visibilité*
pour Playwright sont deux choses, et `offsetParent !== null` est ce que Playwright attend
réellement.

**Défaut latent, délibérément non compté comme échec** : dans le gestionnaire des prix,
`if (!horairesUpsert) return;` est placé **après** `btn.disabled = true`, ce qui laisse le
bouton désactivé pour toujours sur ce chemin. `indisponibilitePrix` dans la recette le nomme
déjà.

## 8. Verdict

**`PRET_POUR_RETABLISSEMENT_VERIFY_PRODUCTION`** sur
`5bf7e77c50fd1fe59e6a832947d74246fafa4bd5`, au vu du run `37080474157` et des deux témoins
ci-dessus.

Portée, explicitement : *prêt* signifie que le correctif est mesuré vert sur Test par un
parcours navigateur connecté, avec relecture de la base. Cela ne vaut ni GO de fusion, ni GO
de déploiement, ni autorisation d'écrire sur Production — et ce verdict ne demande aucun de
ces trois gestes. Il constate.
