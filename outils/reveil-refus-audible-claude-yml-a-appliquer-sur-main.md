# Le refus muet de `claude.yml` — à appliquer sur `main`

> **État : préparé, NON appliqué.** Ce document décrit une modification de
> `.github/workflows/claude.yml`, fichier qui vit sur `main` et **seulement**
> sur `main`. Le GO de transport du 26/09/2026 borne explicitement la
> destination à `handoff-continuite-20260920` et exige l'absence de « toute
> modification de `main` ou `production` ». Appliquer ce qui suit demande donc
> un geste humain nommé, distinct.
>
> **Ce document n'élargit aucune permission.** C'est le point à retenir : le
> job déclare déjà `issues: write` (ligne 74). Il ne s'en sert simplement pas
> quand il refuse. Rien à accorder ; tout à câbler.

## 1. Le défaut, mesuré

Run **36139253850**, 25/09/2026 13 h 10 min 07 s UTC, issue #28.

Le commentaire déclencheur (25/09 13 h 10 min 04 s, `vito-sainte-marie`,
1370 octets) porte `@claude` et **ne porte pas** `NEXUS_BASE_BRANCH=`. L'étape 2
« Résoudre le rail NEXUS désigné » a écrit :

    ::error::Aucun rail NEXUS désigné dans le déclencheur. Ajoutez
    NEXUS_BASE_BRANCH=<branche> au commentaire. Aucun repli n'est appliqué :
    un rail se désigne, il ne se devine pas.

…puis `exit 1`. Les étapes 3 à 6 ont été **sautées**. L'étape 6 est
`anthropics/claude-code-action@v1` : c'est elle, et elle seule, qui publie le
commentaire « Claude finished @vito-sainte-marie's task ». Le seul chemin de
réponse du workflow se trouve **en aval** du refus.

Conséquence exacte : **le refus est correct et inaudible.** L'Orchestrateur a
attendu vingt-cinq heures devant un silence qu'aucune observation ne distingue
d'un rail mort, d'un jeton révoqué ou d'un runner en panne.

Le résolveur n'est pas le défaut. Refuser un rail non désigné est son rôle —
un rail se désigne, il ne se devine pas. Le défaut est qu'un refus ne revient
nulle part.

### Vérifié par lecture du fichier

`claude.yml` (222 lignes, `origin/main`) ne contient **aucune** occurrence de
`if: failure()`, `if: always()`, `continue-on-error`, `$GITHUB_STEP_SUMMARY`,
ni `gh issue comment`. Il n'y a pas un chemin d'échec mal réglé : il n'y en a
aucun.

## 2. Ce que la réparation doit tenir

1. **Ne pas deviner de rail.** Le refus reste un refus. On rend le refus
   audible, on ne l'assouplit pas.
2. **Ne demander aucune permission nouvelle.** `issues: write` est déjà
   déclaré ligne 74.
3. **Répondre là où l'on a été appelé** — l'issue ou la PR du déclencheur,
   jamais une adresse recalculée.
4. **Ne pas masquer un vrai plantage.** Un échec d'une autre étape ne doit pas
   être annoncé comme « rail non désigné ».

## 3. Le diff, en trois morceaux

### (a) L'étape du résolveur reçoit un `id` et consigne son motif

Ligne 80, `- name: Résoudre le rail NEXUS désigné`, devient :

```yaml
      - name: Résoudre le rail NEXUS désigné
        id: rail
```

Dans le `run:` de cette étape, juste après `set -euo pipefail`, on ajoute la
fonction qui écrit le motif **avant** de sortir. `$RUNNER_TEMP` survit d'une
étape à l'autre et n'est pas effacé par le `checkout` qui suit :

```bash
          # Un refus doit pouvoir être entendu. On consigne le motif AVANT de
          # sortir : l'étape 6 (`claude-code-action`), seul chemin de réponse
          # du workflow, est en aval de ce refus et ne tournera pas.
          REFUS="$RUNNER_TEMP/nexus-refus.md"
          refuser() { printf '%s\n' "$1" >> "$REFUS"; echo "::error::$1"; exit 1; }
```

Puis chaque refus passe de deux lignes à une. Les six, dans l'ordre du
fichier :

| avant | après |
|---|---|
| `echo "::error::Aucun rail NEXUS désigné…"` + `exit 1` | `refuser "Aucun rail NEXUS désigné dans le déclencheur. Ajoutez NEXUS_BASE_BRANCH=<branche> au commentaire. Aucun repli n'est appliqué : un rail se désigne, il ne se devine pas."` |
| `echo "::error::Désignation de rail ambiguë…"` + `printf` + `exit 1` | `refuser "$(printf 'Désignation de rail ambiguë — le déclencheur nomme plusieurs branches :\n%s' "$designations")"` |
| `echo "::error::Une ref protégée…"` + `exit 1` | `refuser "Une ref protégée ne peut pas être un rail Claude: $base"` |
| `echo "::error::Nom de rail malformé…"` + `exit 1` | `refuser "Nom de rail malformé: $base"` |
| `echo "::error::Rail NEXUS refusé…"` + `exit 1` | `refuser "Rail NEXUS refusé: $base"` |
| `echo "::error::Rail NEXUS introuvable sur origin…"` + `exit 1` | `refuser "Rail NEXUS introuvable sur origin: $base"` |

L'annotation `::error::` reste émise : le journal du run ne perd rien.

### (b) L'étape qui rend le refus audible

À ajouter **en dernière position** du job, après
`anthropics/claude-code-action@…` :

```yaml
      # Le retour du refus. Sans cette étape, un refus de l'étape 2 ne revient
      # nulle part : `claude-code-action` est en aval et ne tourne pas, donc
      # aucun commentaire n'est publié, et l'appelant ne distingue pas ce
      # silence d'un rail mort. Mesuré sur le run 36139253850 (25/09/2026) :
      # vingt-cinq heures de silence pour une ligne absente.
      #
      # `issues: write` est déjà déclaré par ce job (aucune permission nouvelle
      # n'est demandée ici). L'API `issues/{n}/comments` sert aussi bien une
      # issue qu'une pull request, ce qui évite de brancher selon l'événement.
      - name: Rendre le refus de rail audible
        if: failure() && steps.rail.outcome == 'failure'
        env:
          GH_TOKEN: ${{ github.token }}
          ADRESSE: ${{ github.event.issue.number || github.event.pull_request.number }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        shell: bash
        run: |
          set -euo pipefail
          REFUS="$RUNNER_TEMP/nexus-refus.md"
          # Une adresse ne se recalcule pas : si le déclencheur n'en portait
          # pas, on ne la devine pas — on échoue en le disant.
          if [[ -z "${ADRESSE:-}" ]]; then
            echo "::error::Refus de rail non publiable : le déclencheur ne porte aucun numéro d'issue ni de PR."
            exit 1
          fi
          # Un motif absent ne s'invente pas non plus.
          motif="$( [[ -s "$REFUS" ]] && cat "$REFUS" \
            || printf 'Motif non consigné — voir le journal du run.' )"
          {
            printf '**Rail NEXUS refusé — le déclencheur n'"'"'a pas été traité.**\n\n'
            printf '```text\n%s\n```\n\n' "$motif"
            printf 'Aucun repli n'"'"'a été appliqué : un rail se désigne, il ne se\n'
            printf 'devine pas. Pour relancer, réponds en portant la désignation :\n\n'
            printf '```text\n@claude NEXUS_BASE_BRANCH=`<branche>`\n<ta consigne>\n```\n\n'
            printf 'Journal du run : %s\n' "$RUN_URL"
          } > "$RUNNER_TEMP/nexus-refus-corps.md"
          gh api "repos/${GITHUB_REPOSITORY}/issues/${ADRESSE}/comments" \
            -f body="$(cat "$RUNNER_TEMP/nexus-refus-corps.md")" --silent
          echo "Refus publié sur #${ADRESSE}."
```

### (c) Rien d'autre

Pas de changement au `if:` du job, ni aux `permissions:`, ni au déclencheur,
ni aux versions épinglées des actions, ni à l'étape PostgreSQL Test.

## 4. Ce que cette réparation ne fait pas

- Elle ne répare **pas** l'autre sens du réveil. Publier le réveil depuis
  `tests.yml` exige `issues: write` sur le rail, qui n'est pas accordé :
  voir `outils/reveil-issues-write-a-appliquer-par-frederic.md`.
- Elle ne rend audible **que** le refus du résolveur de rail. Un plantage de
  `claude-code-action` elle-même reste muet de la même façon ; c'est un défaut
  distinct, non mesuré à ce jour, et l'élargir ici reviendrait à annoncer
  « rail non désigné » pour n'importe quelle panne.
- Elle ne se prouve pas par le banc du dépôt. `claude.yml` n'est pas sur le
  rail et aucune épreuve ne le charge. La logique shell, elle, a été exercée
  hors CI (§5) ; ce qui reste non prouvé est le **câblage GitHub Actions** :
  que `if: failure() && steps.rail.outcome == 'failure'` déclenche bien,
  que `$RUNNER_TEMP` traverse les étapes, et que `github.token` suffise à
  commenter. La preuve est un **run réel** : poster sur #28, depuis
  `vito-sainte-marie`, un `@claude` **sans** `NEXUS_BASE_BRANCH`, et constater
  qu'un commentaire de refus revient. Tant que ce run n'a pas eu lieu, le
  câblage est écrit, pas prouvé.

## 5. Ce qui a été vérifié sans run réel

Un document préparé qui ne charge pas n'est pas préparé. Le candidat complet
(262 lignes) a donc été monté et mesuré avant d'être décrit ici.

**Le YAML charge.** Chargement par un analyseur YAML réel — pas par lecture à
l'œil : **6 étapes**, l'étape 1 porte bien `[id=rail]`, l'étape 6 s'appelle
« Rendre le refus de rail audible » et porte
`if: failure() && steps.rail.outcome == 'failure'`.

**Les permissions sont inchangées, octet pour octet.** L'analyseur rend
`{contents: write, issues: write, pull-requests: write, actions: read,
id-token: write}` — identique à l'original. C'est la vérification qui compte
le plus ici : le GO du 26/09 exige « aucune permission GitHub supplémentaire »,
et la tentation était réelle puisque j'ai le scope `workflow`.

**Les quatre blocs `run:` passent `bash -n`.** Extraits du candidat, les
`${{ … }}` neutralisés, chacun rend « syntaxe shell OK ».

**Le chemin de refus a été exercé, avec un `gh` bouchonné.** Les blocs shell des
étapes 1 et 6 ont tourné hors CI sur six déclencheurs fabriqués. Les cinq refus
consignent un motif dans `$RUNNER_TEMP/nexus-refus.md` **et** construisent un
corps de commentaire :

| déclencheur | motif consigné |
| --- | --- |
| `@claude` sans désignation (le cas du 25/09) | « Aucun rail NEXUS désigné dans le déclencheur… » |
| deux `NEXUS_BASE_BRANCH` | « Désignation de rail ambiguë… » + les deux noms |
| `NEXUS_BASE_BRANCH=main` | « Une ref protégée ne peut pas être un rail Claude » |
| `NEXUS_BASE_BRANCH=chantier-x` | « Rail NEXUS refusé » (hors allowlist) |
| `NEXUS_BASE_BRANCH=handoff-inexistant` | « Rail NEXUS introuvable sur origin » |

Et le **contre-témoin** : `NEXUS_BASE_BRANCH=handoff-continuite-20260920` est
accepté, écrit `NEXUS_CLAUDE_BASE_BRANCH` dans `$GITHUB_ENV`, et ne construit
aucun commentaire. Sans ce contre-témoin, un bloc qui commenterait *toujours*
aurait rendu le même tableau vert.

Le bouchon `gh` n'a rien publié : il a écrit dans un fichier. Aucun commentaire
n'a été posté sur #28 au cours de cette vérification.

## 6. L'artefact mesuré

Les trois morceaux du §3 décrivent le diff ; le fichier qui a **réellement** été
mesuré au §5 est déposé à côté de ce document :

    outils/reveil-refus-audible-claude-yml-candidat.yml

C'est un `.yml` hors `.github/workflows/` : il ne se déclenche pas, il attend.
262 lignes, `sha256 = b0950b73e4d2abd7cc8a36032135db2c02f14f330d83d1b0cc91aeb88400d6aa`.

Le geste du §7 est une **copie**, pas une réapplication du diff à la main : un
diff réappliqué produit un fichier voisin, et la mesure du §5 ne porte alors
plus sur ce qui est poussé. Si le sha256 ci-dessus ne correspond plus au
fichier déposé, la mesure est périmée et doit être reprise avant tout geste.

## 7. Le geste

Copier `outils/reveil-refus-audible-claude-yml-candidat.yml` par-dessus
`.github/workflows/claude.yml` sur `main`, vérifier que le diff obtenu est bien
(a) + (b) + (c) et rien d'autre, puis pousser. Le ruleset de `main` (22486287) ne contient que `deletion` et
`non_fast_forward` : ni PR requise, ni check requis. La poussée est donc
techniquement à ma portée — et `main` est nommément exclu du GO du 26/09.
**Avoir la capacité technique n'est pas avoir l'autorisation** (CLAUDE.md:85).
J'attends un GO qui nomme `main`.
