# Proposition de patch — `.github/workflows/claude.yml`

**État : PRÉPARÉ, NON APPLIQUÉ.** `claude.yml` vit sur `main`. Aucune de ces
modifications n'est en place, et aucune ne peut l'être sans geste humain.
Mesuré sur `origin/main` le 28/09/2026 : 262 lignes, `permissions` lignes 73–77,
filtre d'auteur ligne 64, **aucun bloc `concurrency`**.

Les items 2 et 3 sont déjà **construits et prouvés sur le rail**
(`outils/preflight-capacites.js`, `outils/transport-autorise.js`, 18 épreuves,
16 mutations rouges, témoins verts). Ce qui reste ici est leur **câblage** —
trois appels — plus l'item 4, qui est du YAML pur et n'a pas d'autre forme.

---

## Item 2 — préflight par opération réelle

Aujourd'hui rien ne mesure ce que le job peut faire : il l'apprend en échouant,
tard, ou il le croit d'après `permissions:`, qui décrit une intention et non un
droit effectif. Le 27/09 le trousseau git était périmé alors que les droits
étaient entiers ; le jeton neuf avait perdu `workflow` sans que rien ne le dise.

À insérer **avant** l'étape Claude, après la résolution du rail :

```yaml
      - name: Préflight — ce que ce job peut vraiment faire
        id: preflight
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          node outils/preflight-capacites.js --id "${{ github.run_id }}" | tee preflight.txt
          echo "capable=${PIPESTATUS[0]}" >> "$GITHUB_OUTPUT"
        continue-on-error: true
```

`continue-on-error` est délibéré : un préflight qui **échoue le job** transforme
une mesure en panne. Il doit renseigner, pas bloquer. Sa sortie porte la commande
exacte et l'horodatage ; `lirePreuve()` refuse toute impossibilité qui ne les
porte pas, pour qu'une impossibilité datée du 12/09 cesse de faire attendre en
octobre un droit accordé depuis.

## Item 3 — état C actif, sans PR vers une destination non autorisée

`pull-requests: write` est accordé depuis le 06/09 et **rien dans les 262 lignes
ne crée de PR**. Le pouvoir est là, l'usage n'y est pas : c'est exactement la
situation où l'on risque de confondre les deux.

La règle est dans `outils/transport-autorise.js`, avec son épreuve dédiée : la
capacité ne change pas la réponse. Passer `contents: write` à `decider()` rend
un résultat *strictement identique*. Câblage :

```yaml
      - name: Transport — la destination est-elle autorisée par la mission
        run: node outils/transport-autorise.js
             --destination "${{ steps.rail.outputs.branche }}"
             --autorites  "${{ steps.rail.outputs.autorites }}"
```

`--autorites` provient du corps de la mission, comme `NEXUS_BASE_BRANCH` :
**désigné par le déclencheur autorisé, jamais déduit**. Une mission qui ne nomme
aucune destination n'en autorise aucune — pas toutes. `main` et `production`
sont refusées même nommées : elles portent des gates humaines, et une gate qu'un
outil peut ouvrir n'est plus une gate.

## Item 4 — `concurrency` sérialisé par issue + rail

```yaml
concurrency:
  group: nexus-${{ github.event.issue.number || github.event.pull_request.number }}-${{ github.ref }}
  cancel-in-progress: false
```

`cancel-in-progress: false` est le cœur de la demande : deux missions distinctes
ne doivent jamais s'annuler l'une l'autre.

**Un piège à connaître avant d'appliquer.** GitHub ne garde qu'**un seul run en
attente par groupe**. Avec `cancel-in-progress: false`, si un run est en cours et
deux autres arrivent, le deuxième est mis en file — et le troisième **annule le
deuxième pendant qu'il attend**. La sérialisation ne met donc pas en file
indéfiniment : au-delà de deux, elle perd du travail, silencieusement, et le run
perdu n'a jamais tourné donc ne laisse aucune trace d'échec.

Trois `@claude` rapprochés sur la même issue suffisent. C'est plausible ici : le
mode de travail est précisément d'enchaîner les relances.

Conséquence : le groupe doit être **aussi fin que possible** pour que deux
demandes tombent rarement dedans. `github.event.comment.id` rendrait chaque
commentaire indépendant — mais supprimerait la sérialisation demandée. Il n'y a
pas de réglage qui donne les deux. **C'est un arbitrage, pas un détail
d'implémentation, et il n'est pas à moi.**

Ma recommandation : appliquer le groupe ci-dessus en acceptant la perte au-delà
de deux relances simultanées — une relance perdue se reposte, un run annulé en
vol coûte plus cher — **et le dire dans le commentaire du workflow**, pour que
personne ne redécouvre ce comportement en cherchant une panne inexistante.

---

## Ce que cette proposition ne fait pas

- Elle ne touche pas `main` et ne demande pas de permission GitHub nouvelle :
  les trois câblages n'utilisent que `contents`/`pull-requests`/`actions` déjà
  accordés le 06/09.
- Elle n'ouvre aucune PR automatique. L'item 3 **décide**, il n'agit pas — une
  épreuve vérifie que le fichier ne contient ni `gh pr create`, ni `git push`,
  ni `execSync`.
- Elle ne retire pas le filtre d'auteur ligne 64.
