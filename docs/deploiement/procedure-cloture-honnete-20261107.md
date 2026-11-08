# Procédure — clôture honnête (PR #219)

Migration `supabase/migrations/20261107100000_cloture_honnete_comptage_et_regime_etendu.sql`.
Ce document ne constitue aucune autorisation.
**Appliquée sur Test (07/11/2026) puis en Production (08/11/2026), chacune sur GO de Frédéric.**
Fiche de qualification : `qualification-ordre-migration-code.json`, entrée `20261107100000`.

## Estampilles réelles

| Où | Estampille au registre | Remarque |
|---|---|---|
| Fichier du dépôt | `20261107100000` | repère de la garde, jamais celui du registre |
| Test (`udljdqxerrbbbajxubfn`) | `20261107225853` | appliquée le 07/11/2026 |
| Production (`uzhjpqpctpvxytxpxoqz`) | `20261108010440` | appliquée le 08/11/2026 |

L'outil d'application date la migration à l'instant de l'application : le registre
ne porte jamais l'estampille du fichier. La garde qualifie donc par le **blob** du
fichier (`5b33b970dde0d9ef15bd6b60ffc6a9407c33e7d3`) et par le corps de la
fonction, pas par le registre.

## Écart de commentaires entre Test et Production

Constat de Guardian (#160 6715507315), catalogue seul, lecture seule :

| | Test | Production |
|---|---|---|
| Longueur du corps | 10 150 caractères | 10 338 caractères |
| md5 brut | `93b5…` | `43d1…` |
| md5 normalisé (commentaires `--` retirés, espaces normalisés) | `8b514f39679b3c93a46655098c2c22c0` | `8b514f39679b3c93a46655098c2c22c0` |

Test a été appliquée sans les commentaires `--` du fichier ; Production porte le
fichier tel quel. **Aucun écart de comportement.** Pour comparer deux bases, on
compare le md5 normalisé, jamais le md5 brut.

## Ordre

La migration et le code client sont indépendants : le client n'appelle pas la
fonction, et la fonction ne lit aucune colonne nouvelle. Aucun ordre strict.
Appliquer la migration seule corrige la clôture automatique (heure de fin du
jeudi au samedi, quarts clos avec leurs vrais non-comptés). Fusionner #219 seule
rend l'écran honnête sans changer ce que le serveur fait.

## Ce que fait la migration

`create or replace` de `public.run_scheduled_inventory_reviews()` (SECURITY
DEFINER, search_path public), base 20261106100000 :

1. repli : les produits piste obligatoires du plan **sans comptage
   `type_comptage = 'cloture'` valide** sur le quart sont comptés non faits ;
2. fin de quart : `fin_etendu` les jeudi, vendredi, samedi (ISO 4, 5, 6),
   repli sur `fin_normal` ;
3. `revoke execute ... from public, anon, authenticated` conservé.

Aucun DDL destructif, aucune table ni colonne créée, aucune donnée corrigée.

## Relecture avant d'écrire (catalogue, lecture seule)

Mesure historique, sur Test le 07/11/2026, avant application : fonction présente, `prosecdef` vrai, corps de
9852 caractères (md5 `d5e470ebe2ba7694c5ba3f923646d05e`) sans `fin_etendu`,
estampille 20261107100000 absente. La relecture Production a été faite par
Guardian après application (voir ci-dessus).

## Relecture après application (faite sur Test et en Production)

- corps contenant `fin_etendu` et `type_comptage = 'cloture'` ;
- `proacl` sans EXECUTE pour public, anon, authenticated ;
- job cron `nexus-inventaire-reviews` actif.

## Retour arrière

Réappliquer `20261106100000_cloture_incomplete_perimetre_piste.sql`. Aucune donnée
n'est écrite par la migration elle-même.

## Leçon de #226

Voir `lecon-pr226-tete-de-pr-avant-fusion-20261108.md` : ne pas pousser sur une PR en cours de fusion, comparer la tête affichée par GitHub à celle annoncée sur #160 avant de fusionner.
