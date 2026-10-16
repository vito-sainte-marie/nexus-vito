# Dossier de promotion Production — changement de quart atomique

| | |
|---|---|
| Branche | `lot-changement-de-quart-20261016`, PR #131 (base `production`, **non fusionnable sans GO**) |
| Cible | Production `uzhjpqpctpvxytxpxoqz` + GitHub Pages (`production`) |
| Date | 16/10/2026 |
| Verdict demandé | **aucun** : ce dossier prépare, il n'autorise rien. Aucun GO Production n'est implicite. |
| État de Production | inchangé par ce lot — migration, code et données |

**Qualification soumise au verdict Handoff. Cette qualification documentaire ne constitue aucune autorisation de migration, de fusion ou de déploiement en Production.**

Fiche rédigée par Claude. Statut : aucun GO Production, aucune fusion, aucun déploiement.

## 1. Ce que le lot change

L'employé qui a un quart ouvert et prend son poste suivant voit un avertissement (« votre quart en cours sera clôturé définitivement »), peut déclarer un motif, et confirme. La clôture et l'ouverture partent dans **une seule transaction** (`nexus_changer_de_quart`). Le quart clos porte `cloture_source = 'employe'`, `cloture_par` = l'employé, `cloture_motif` = le motif déclaré (NULL s'il n'en déclare pas). `heure_fin` reste NULL : aucune durée, aucune heure supplémentaire n'est créée.

## 2. Migration — `20261016090000_changement_de_quart_atomique.sql`

Blob au moment de la qualification : `d7ac18acd2cb8b82d606f52e6c35ac71346df4e2`. Un blob différent fait tomber la qualification.

Mesure Production du 16/10/2026 (lecture seule, `begin read only … rollback`) :

| Mesure | Valeur |
|---|---|
| `public.nexus_changer_de_quart` | absente |
| `nexus_shifts_avant_insertion` | présente, définition P-1 (empreinte md5 `1888968bc2138557fab6d10601a1715f`), SECURITY INVOKER, sans `proconfig`, ne connaît pas `changement_quart_employe` |
| trigger | un seul, `nexus_shifts_avant_insertion` (BEFORE INSERT, activé `O`) sur `shifts` |
| migrations enregistrées | 313 |

### 2.1 Compatibilité avec le code actuellement en Production

Le code Production n'appelle pas la fonction neuve. Son seul chemin d'écriture est un `INSERT` direct dans `shifts` (`NEXUS-Prise-De-Poste-v1.html`, `nexusClient.from('shifts').insert`). Après migration, cet INSERT traverse le déclencheur remplacé **sans variable de transaction** : le chemin « non déclaré » est celui de P-1 (même source `prise_de_poste_suivante`, mêmes motifs « Fin non enregistrée », même garde `22007`, même `termine` si départ pointé valide). Épreuve SQL, cas 9 sur Test : INSERT direct = comportement P-1 (24/24 sous rollback). **L'ancien code reste donc compatible avec la nouvelle base.** À l'inverse, le nouveau code sur l'ancienne base échoue : la RPC est absente.

### 2.2 Déclencheur avant / après

| | Avant (Production) | Après migration |
|---|---|---|
| INSERT direct (ancien écran) | ferme le quart ouvert, `prise_de_poste_suivante`, `cloture_par` NULL | identique |
| Via `nexus_changer_de_quart` avec confirmation | n'existe pas | `cloture_source='employe'`, `cloture_par`=employé, motif déclaré ; variables remises à zéro |
| Variable posée pour un autre employé | n/a | ignorée : comparée à `NEW.employee_id`, comportement P-1 |
| Quart ouvert sans confirmation | n/a | rien n'est écrit, `confirmation_requise` |

### 2.3 Nature et faux positif de la garde

Fonction neuve, remplacement par `create or replace` d'une fonction de déclencheur existante. Aucune colonne, contrainte, table ni donnée touchée ; aucune ligne écrite. La garde additive (`additive_compatible_avant_code`) a refusé la fiche (`CIBLE_DEJA_DEPENDANTE`) parce que `nexus_shifts_avant_insertion`, que la migration remplace, est déjà nommée par le code de la cible : faux positif, la fonction préexiste et l'ancien code reste compatible (§2.1). Le risque réel n'est pas « additive pure » mais « ordre strict, et un remplacement de fonction de déclencheur qui exige une procédure » : l'état `atomique_ou_procedure_speciale` le décrit, avec ce dossier pour procédure. La garde n'est ni modifiée ni affaiblie.

## 3. Ordre exact

1. **Préflight (lecture seule).** Relire la base avant d'écrire : `nexus_changer_de_quart` absente ; md5 de `nexus_shifts_avant_insertion` = `1888968bc2138557fab6d10601a1715f` (sinon **arrêt**, la base a bougé hors dépôt) ; un seul trigger BEFORE INSERT et un seul UPDATE sur `shifts` ; blob de la migration = `d7ac18ac…` ; nombre de quarts `en_cours` et de lignes `shifts` relevés pour comparaison.
2. **Migration (GO distinct de Frédéric).** Appliquée telle quelle, une transaction (`begin … commit`), bloc `do $ctrl$` fail-closed en fin de fichier.
3. **Contrôles après migration.** Fonction présente, SECURITY INVOKER, EXECUTE fermé à `anon`, ouvert à `authenticated` ; la définition installée lit `nexus.changement_quart_employe` ; trigger unique ; **nombre de lignes de `shifts` et quarts `en_cours` inchangés** ; épreuve SQL `outils/epreuve-changement-de-quart-20261016/epreuve-test.sql` sous rollback.
4. **Code (GO distincts : fusion de la PR #131, puis déploiement Pages).** Jamais avant l'étape 3.
5. **Contrôles finaux.** Empreinte de l'artefact servi, recette navigateur humaine d'une prise de poste simple, d'un changement de quart avec confirmation, d'une annulation (rien écrit).

## 4. Conditions d'arrêt

- md5 du déclencheur différent au préflight, ou fonction déjà présente : arrêt, la base a dérivé.
- Un `do $ctrl$` qui lève : la transaction est annulée, rien n'est posé ; ne pas relancer sans comprendre.
- Après migration : une ligne de `shifts` créée ou modifiée, un deuxième quart `en_cours` pour un même employé, `anon` pouvant exécuter la fonction : arrêt et retour arrière.
- Le code n'est jamais posé tant que les contrôles de l'étape 3 ne sont pas verts.

## 5. Retour arrière et limites de réversibilité

- **Avant le code** : réappliquer le `create or replace function public.nexus_shifts_avant_insertion()` de `20260916193000_prise_de_poste_ninvente_plus_la_fin.sql` (définition P-1), puis `drop function public.nexus_changer_de_quart(text, text, text, boolean)`. Vérifier le md5 `1888968b…`. Opération sans perte : rien n'a été écrit dans les données par la migration.
- **Après le code** : revenir d'abord à l'ancien artefact Pages, ensuite seulement retirer la fonction (sinon l'écran appelle une RPC absente).
- **Limite** : les quarts déjà clos par un employé (`cloture_source = 'employe'`) après la promotion **ne sont pas ré-ouverts** par le retour arrière ; leur source et leur motif déclaré restent consignés (c'est la trace voulue). La clôture d'un quart reste, par construction, définitive depuis l'espace de l'employé ; seule une régularisation manager (`cloture_source = 'manager'`) la corrige.

## 6. Permissions et risques de régression

- `nexus_changer_de_quart` est **SECURITY INVOKER** : elle subit la RLS de l'employé connecté (`employee_own_shifts_insert`, `update_shifts`), comme l'INSERT direct de l'écran. Aucun élargissement de droit. `revoke … from public, anon` ; `grant execute … to authenticated`. Le bloc de contrôle le vérifie.
- Une variable de transaction ne permet pas à un client de s'attribuer une clôture « employé » : seule une fonction de la base la pose (`set_config` local), le déclencheur la compare à l'employé qui s'insère et la remet à zéro.
- Prises de poste existantes : sans quart ouvert, comportement inchangé (première prise = rien à clore). Quart ouvert + INSERT direct = P-1.
- Clôtures existantes : `pointage_depart` (S-2), `cycle_pilote`, `manager` ne passent pas par ce déclencheur ; inchangées. Aucune mission (`mission_completions` rattachée à l'employé et à la date), aucune ouverture FDJ n'est touchée.
- Risque résiduel connu : un employé qui confirme à tort une clôture ; paré par l'avertissement et la confirmation volontaire côté serveur, mesurable par `cloture_source = 'employe'`.

## 7. Preuves disponibles

Épreuve Node `test_changement_de_quart_20261016.js` (25 OK, mutation-testé) ; épreuve SQL 24/24 sous rollback sur Test ; migration appliquée sur Test seulement ; recette navigateur Test à faire par l'humain (aucun identifiant saisi par Claude).
