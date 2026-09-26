# Variante `issues: write` — PRÉPARÉE, NON APPLIQUÉE

**Ce fichier n'a aucun effet.** Il décrit exactement ce qu'il faudrait changer si
la réponse à `request-18.md` §5 est *oui*. Tant qu'elle n'est pas écrite, rien ici
ne doit être repris dans `.github/workflows/tests.yml`.

Pourquoi ce n'est pas mon geste : accorder `issues: write` **élargit la surface de
sécurité du jeton** (CLAUDE.md:85). Je peux le préparer, l'expliquer et l'éprouver ;
je ne peux pas me l'accorder.

## Ce que cela ouvrirait, exactement

Le jeton `GITHUB_TOKEN` du workflow porte aujourd'hui **`contents: read`** et
**`actions: read`** — deux lectures, aucune écriture. La variante y ajoute
**`issues: write`**, qui autorise, sur ce dépôt et pour la durée du run :

- créer un commentaire sur n'importe quelle issue ou pull request,
- **modifier ou supprimer** des commentaires existants,
- ouvrir, fermer, rouvrir, renommer, étiqueter, assigner n'importe quelle issue.

GitHub ne sait pas restreindre cette permission à **une** issue. Accorder
« commenter l'issue 28 » n'existe pas : on accorde l'écriture sur toutes.

C'est la seule raison de la réserve. Le risque n'est pas le code ci-dessous —
il est qu'une étape quelconque du workflow, présente ou future, hérite du droit
d'écrire dans le suivi.

## Le changement, en entier

Deux endroits, rien d'autre.

### 1. Le bloc `permissions`

```diff
 permissions:
   contents: read
   actions: read
+  issues: write   # request-18 §5 — accordé le <date> par Frédéric Bragance
```

### 2. Une étape ajoutée après « Réveil Orchestrateur — corps à coller »

Elle **ne remplace pas** le résumé de job : celui-ci reste, parce qu'il ne coûte
aucune permission et qu'il est la trace lisible même si la publication échoue.

```yaml
      # N'existe QUE si request-18 §5 a reçu un oui écrit. Le destinataire vient
      # du rail (`wake_to`), jamais d'ici : un workflow ne nomme pas d'adresse.
      - name: Réveil Orchestrateur — publication (issues:write)
        if: always()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          ADRESSE="$(node outils/reveil-orchestrateur.js --json | node -e '
            let t=""; process.stdin.on("data",d=>t+=d).on("end",()=>{
              const r=JSON.parse(t);
              // Pas de réveil, ou pas d adresse déclarée : on ne publie rien.
              // Deviner un destinataire serait pire que se taire.
              process.stdout.write(r.reveil && r.lots[0].adresse ? r.lots[0].adresse : "");
            });')"
          if [ -z "$ADRESSE" ]; then
            echo "Aucune adresse declaree au rail : rien n est publie." && exit 0
          fi
          node outils/reveil-orchestrateur.js --message > /tmp/reveil.md
          gh issue comment "$ADRESSE" --body-file /tmp/reveil.md
```

## Ce qui garderait cette variante

Les épreuves de `test_permissions_workflow_20260908.js` interdisent aujourd'hui
**toute** permission en écriture. Appliquer la variante les rendrait rouges — et
c'est voulu : la permission ne doit pas pouvoir entrer sans que quelqu'un
décide. Le jour où elle est accordée, l'épreuve change de contrat au lieu de
disparaître :

- `issues: write` est la **seule** écriture tolérée, nommément ;
- l'autorisation humaine reste inscrite en commentaire **à côté** de la ligne,
  comme pour `actions: read` ;
- toute autre permission en écriture reste refusée.

Sans ce remplacement, la variante ne serait pas « autorisée » : elle serait
seulement « plus gardée par personne ».

## Ce qui ne change pas

Le réveil ne décide rien, ne résume pas la demande et ne réécrit aucun invariant.
La publication automatique change **qui porte le message**, pas ce qu'il dit.
