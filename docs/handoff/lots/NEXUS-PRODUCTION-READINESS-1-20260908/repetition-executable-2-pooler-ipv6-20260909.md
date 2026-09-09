# Répétition clean-slate Test — connexion pooler (09/09/2026)

Suite à `repetition-executable-1.md` (mécanisme initial) et à la preuve
apportée par le run `workflow_dispatch` `Tests` n°`34341554251` (rail CI
disposant réellement de connectivité + secrets Test), ce document corrige
un défaut réel trouvé en cherchant à exploiter cette preuve, et fait le
point honnête sur ce qui reste hors de portée de ce canal.

## Le défaut trouvé

`outils/reconstruire-base-test.sh` et `outils/repeter-lot-production-readiness-test.sh`
construisaient tous deux leur URL de connexion vers l'hôte **direct** :

```
postgresql://postgres@db.<ref>.supabase.co:5432/postgres?sslmode=require
```

Or `.github/workflows/tests.yml` documente déjà, dans l'étape « Préparer la
connexion PostgreSQL Test en écriture », que cet hôte **ne publie plus
qu'une adresse IPv6 depuis le 08/09/2026** — les runners GitHub Actions
n'ont pas d'IPv6. C'est exactement pour cette raison que l'étape « Semer le
scénario Carburants » n'utilise **pas** cet hôte direct, mais le secret
`SUPABASE_TEST_DB_URL_WRITE` (une URL de pooler, IPv4).

Concrètement : même si le rail CI avait pu déclencher
`repeter-lot-production-readiness-test.sh` avant ce correctif, la
connexion aurait échoué à la toute première étape (capture), sur un runner
GitHub Actions — le mécanisme du 09/09/2026 matin n'était donc pas
seulement « non câblé », il aurait aussi été **non fonctionnel** une fois
câblé.

## Le correctif

Nouveau fichier `outils/resoudre-connexion-test.sh`, sourcé par les deux
scripts, qui centralise la résolution de connexion (évite la duplication
qui avait déjà causé la collision `NexusStock`, ARCH-002) :

- mode historique inchangé (trousseau macOS, hôte direct) ;
- nouveau mode `--url-env NOM_VARIABLE` : consomme une URL déjà présente
  sous ce nom (typiquement `NEXUS_TEST_DB_URL_WRITE`, la MÊME valeur que le
  secret Test existant `SUPABASE_TEST_DB_URL_WRITE` — aucun secret créé ni
  rotationné) ;
- fail closed dans les deux cas : refus si la référence de PRODUCTION
  apparaît dans l'hôte ou l'utilisateur de l'URL fournie, refus si la
  référence attendue n'y apparaît nulle part (ambiguïté).

Testé (`test_resoudre_connexion_test_20260909.js`, 15/15) et éprouvé par
mutation négative (retirer le refus d'ambiguïté fait échouer la suite,
restauration confirmée identique). `test_repetition_preserve_journal_20260909.js`
mis à jour en conséquence (la garde `PROD_REF` vit maintenant dans le
fichier partagé, plus dans chacun des deux scripts). Régression complète :
`node run-tests.js` — mêmes 9 échecs historiques, aucune régression.
`node outils/guardians-router.js` — seul le finding déjà connu et tracé
(collision `NexusStock`, ARCH-002).

## Ce que ce correctif ne fait PAS

Il ne câble aucun nouveau step dans `.github/workflows/tests.yml` : cette
session n'a pas la permission d'éditer les fichiers
`.github/workflows/*.yml`. Snippet exact à ajouter par une session/humain
habilité, **gardé sous `workflow_dispatch`** (jamais sur un push normal,
le script fait un `drop schema public cascade`) :

```yaml
      - name: Répétition clean-slate PREPROD-équivalente (nexus-test)
        if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/config-par-environnement'
        env:
          NEXUS_TEST_DB_URL_WRITE: ${{ secrets.SUPABASE_TEST_DB_URL_WRITE }}
        run: |
          if [ -z "${NEXUS_TEST_DB_URL_WRITE:-}" ]; then
            echo "::notice::SUPABASE_TEST_DB_URL_WRITE absent — répétition clean-slate non exécutée (ENV-003, non bloquant)."
            exit 0
          fi
          outils/repeter-lot-production-readiness-test.sh udljdqxerrbbbajxubfn --url-env NEXUS_TEST_DB_URL_WRITE
```

## Confirmation explicite — ce canal ne peut ni exécuter ni déclencher

Vérifié dans cette session, pas supposé :

- `SUPABASE_TEST_DB_URL_WRITE` / `NEXUS_TEST_DB_URL_WRITE` : **absents** de
  l'environnement de ce canal (`issue_comment`/`claude.yml`) — confirmé par
  une vérification booléenne de présence, sans jamais lire ni afficher de
  valeur. Cohérent avec ce que `claude.yml` documente lui-même : aucun
  secret Supabase n'y est exposé, par conception.
- `gh` est présent et authentifié (`GH_TOKEN`, compte `claude[bot]`) — mais
  cela ne change rien : déclencher `Tests` par `workflow_dispatch`
  reproduirait seulement le run `34341554251` déjà cité (celui-ci ne
  contient pas encore le step de répétition clean-slate ci-dessus, absent
  du fichier canonique), pas une preuve de reconstruction. Fabriquer un
  déclenchement ad hoc en dehors d'un step réellement revu et fusionné
  irait à l'encontre de la demande explicite : « ne remplace pas cette
  preuve par le run 34341554251 ».
- Aucune tentative de connexion réseau vers `nexus-test` n'a été faite
  depuis ce canal (`curl`/`gh auth status` en accès direct requièrent une
  approbation qu'aucun humain ne peut donner dans ce run automatisé —
  confirmé à nouveau ici, cohérent avec tous les réveils précédents de ce
  fil depuis le 06/09/2026).

## Ce qui reste réellement à exécuter, inchangé depuis `repetition-executable-1.md`

1. Wiring du step CI ci-dessus par une session/humain avec droit d'édition
   sur `.github/workflows/*.yml`.
2. Un run `workflow_dispatch` du workflow `Tests` sur `config-par-environnement`
   une fois ce step ajouté — capture, reconstruction, rejeu des migrations
   versionnées, réensemencement, vérification explicite des 4 comptes de
   recette et de leur rattachement, suite complète, Guardians, recette
   navigateur.
3. Vérification, après ce run, que le journal `nexus_live_events` —
   notamment les décisions humaines (`actor_role = 'human'`) — a bien
   survécu à la reconstruction (`test_repetition_preserve_journal_20260909.js`
   couvre la logique de capture/rejeu, pas l'exécution réelle contre
   `nexus-test`).

Le package readiness n'est donc pas complet : ce document enregistre une
correction déterministe réelle (le mécanisme fonctionnera désormais s'il
est câblé et exécuté), pas l'exécution elle-même.
