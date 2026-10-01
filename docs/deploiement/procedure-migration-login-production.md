# Procédure — remise en service de la connexion NEXUS en Production

**Objet.** L'écran de connexion de Production (`https://app.nexusconseil.net`) est en panne
depuis la fusion de la PR #65, le 01/10/2026 à 13 h 49 UTC. Ce document est le plan minimal
de remise en service : ce qu'il faut jouer, ce qu'il faut lire avant, ce qu'il faut lire
après, et comment vérifier sur l'écran lui-même que le parcours est revenu.

**Geste humain.** L'application à Production est un geste de Frédéric. Claude n'a aucun
chemin d'écriture vers Production et n'en cherche pas. Ce document prépare ; il n'applique
rien.

**L'artefact à jouer :** `outils/migration-login-production-a-executer-par-frederic.sql`.

---

## 1. Ce qui s'est passé, mesuré et non supposé

Trois dates, lues dans le dépôt, pas reconstituées.

| Quand | Quoi |
| --- | --- |
| 04/09/2026 10 h 51 | `20260904105148_urgence_revoquer_acces_anonyme_vues_security_definer` retire à `anon` les écritures sur `public.employees_public` et **conserve délibérément le `select`**. Le fichier le dit lui-même : « On ne conserve QUE le SELECT, dont l'écran de connexion a besoin — provisoirement, cette vue devant être remplacée par une authentification non énumérable. » |
| 04/09/2026 17 h 57 | `20260904175747_login_non_enumerable` écrit la suite : la fonction `public.nexus_identifiant_de_connexion(text)`, et la fermeture de la porte anonyme. Le fichier pose l'ordre en toutes lettres : « Les deux vont ensemble, dans cet ordre : code promu, puis migration appliquée. » |
| 01/10/2026 13 h 49 | La PR #65 est fusionnée. `origin/production` passe à `adee9bb`. **Le code est promu. La migration ne l'est pas.** |

État constaté après la fusion :

- `origin/production` = `adee9bbcb6fd7e0af7632730ede185e655d04580`, **277 migrations**, 56 définitions de fonction.
- `adee9bb^1` = `2bc7b39dd73a` (21/09), **276 migrations**. La fusion de #65 **n'a transporté aucune migration**.
- `origin/production:NEXUS-Login-v1.html` ligne 146 appelle `.rpc("nexus_identifiant_de_connexion", { p_prenom: prenom })`.
- Aucun fichier de front de `adee9bb` ne nomme encore `employees_public`. L'ancien chemin a bien disparu du code.
- Lecture du catalogue Production : **la fonction est absente.**

Le front appelle donc une fonction que la base n'a pas. PostgREST répond une erreur, elle
tombe dans le `catch`/`lookupError` de la ligne 152, et l'écran affiche
« Connexion au serveur impossible. Vérifiez votre connexion et réessayez. » — le symptôme
rapporté par le terrain. Ce n'est pas un problème de réseau.

## 2. Pourquoi cette dépendance n'a pas été qualifiée avant le déploiement

Trois causes, qui se cumulent. Aucune n'est une négligence isolée.

1. **L'ordre était écrit, pas outillé.** « code promu, puis migration appliquée » vivait dans
   un commentaire de migration. Rien ne le mesurait au moment de fusionner.
2. **La migration n'était pas dans le lot.** Le déploiement Production sert l'arbre du front ;
   les migrations sont un geste séparé. Fusionner #65 ne pouvait donc pas emporter
   `20260904175747` — et rien ne signalait qu'elle manquait à la cible.
3. **`20260904105148` avait laissé la porte ouverte « provisoirement ».** Le front a continué
   de fonctionner pendant 27 jours par cette porte. La dette n'était visible nulle part : tant
   que le vieux code tournait, l'absence de la fonction ne coûtait rien.

La prévention est désormais outillée, et elle est transportée sur le rail :

- `outils/garde-rpc-front-definie-sur-la-cible.js` — refuse un candidat dont le front appelle
  une RPC absente de la cible. Mesure sur les refs réelles : `--candidat adee9bb --cible 2bc7b39`
  rend **un BLOCK, `RPC_FRONT_REFUS`, code de sortie 1** — c'est exactement le cas qui aurait dû
  arrêter ce déploiement. Contre-témoin sur le rail : `RPC_FRONT_CONFORME`, code 0.
- `docs/deploiement/cablage-garde-rpc-production.patch` + `cablage-garde-rpc-production.md` —
  le câblage dans `.github/workflows/deploiement-production.yml`, qui n'existe que sur
  `origin/production` et ne peut donc pas être modifié depuis le rail. Le patch voyage, et
  `test_cablage_garde_rpc_production_20261001.js` mesure le patch.

## 3. Avant de jouer : ce que la base doit porter

L'artefact ne vous demande pas de vérifier cela à la main — sa **section 0** le fait et
refuse d'elle-même. Les quatre préconditions, et le message exact si l'une manque :

| Précondition | Message si elle manque |
| --- | --- |
| La fonction `public.nexus_identifiant_de_connexion(text)` est **absente** | `ARRET — … EXISTE DEJA sur cette base. Le trou diagnostique est donc refermé, et la panne de connexion a une AUTRE cause…` |
| La vue `public.employees_public` est **présente** | `ARRET — public.employees_public est introuvable…` |
| `public.employees` porte `username`, `nom`, `actif`, `compte_test` | `ARRET — public.employees ne porte pas la ou les colonnes suivantes, que le corps de la fonction interroge : <les noms manquants>` |
| `anon` a **encore** le `SELECT` sur la vue | `ARRET — anon n'a DEJA plus le SELECT sur public.employees_public, alors que la fonction est absente. Cet état mi-chemin n'est pas celui…` |

Si la section 0 passe, elle le dit :

```
Section 0 — précondition conforme : fonction absente, vue présente, 4 colonnes présentes, SELECT anonyme encore ouvert.
```

**Lecture AVANT (section 1).** Une seule ligne, sept colonnes, aucune donnée nominative — des
comptes se comptent, ils ne se listent pas :

```
moment | base | identite | fonction_login_presente | anon_lit_la_vue | vue_sous_rls_appelant | comptes_joignables
AVANT  | …    | …        | 0                       | true            | non                   | <n>
```

`fonction_login_presente = 0` et `anon_lit_la_vue = true` : c'est l'état de la panne, et
c'est aussi l'état de la fuite d'annuaire — la vue est encore une porte anonyme.

## 4. Jouer l'artefact

```bash
psql "$URL_PRODUCTION" -v ON_ERROR_STOP=1 -f outils/migration-login-production-a-executer-par-frederic.sql
```

**`-v ON_ERROR_STOP=1` est conseillé, pas requis.** La sûreté de la base est assurée par la
transaction (`begin;` … `commit;`), qui ne dépend pas du client. L'option sert à autre chose :
sans elle, **`psql` sort avec le code 0 même quand le fichier a refusé**. C'est mesuré, pas
supposé : voir §6. Si vous ne pouvez pas la passer, lisez **la dernière ligne** de la sortie —
la section 6 l'écrit pour ça.

L'artefact fait trois choses, dans cet ordre, et uniquement elles :

1. crée `public.nexus_identifiant_de_connexion(text)` — `security definer`, `search_path`
   figé à `public`, avec son `comment on` ;
2. `revoke select on public.employees_public from anon` ;
3. `alter view public.employees_public set (security_invoker = true)`.

**Le corps de la fonction n'a pas été réécrit.** Il est repris tel quel des lignes 78 à 101 de
`supabase/migrations/20260904175747_login_non_enumerable.sql`, et l'identité a été prouvée
**octet pour octet** par `cmp`, avec un contre-témoin muté (`stable` → `immutable`) pour
démontrer que `cmp` mord. Rien n'a été recréé de mémoire.

## 5. Contrôles APRÈS

L'artefact les joue lui-même. Vous avez trois niveaux de lecture.

**a) Ce que la base montre (section 3), avant le commit :**

```
APRES | security_definer | reglages | <arguments> | acl_fonction
APRES | anon_lit_encore_la_vue | authenticated_lit_la_vue | vue_sous_rls_appelant
```

Attendu : `security_definer = t`, `reglages` contenant `search_path=public`,
`anon_lit_encore_la_vue = f`, `vue_sous_rls_appelant = oui`.

**b) Ce que l'artefact exige pour committer (sections 4 et 5).** Six contrôles. Chacun annule
la transaction s'il échoue — c'est-à-dire que la base ressort **intacte**, la fonction toujours
absente.

| | Contrôle |
| --- | --- |
| 4a | La base choisit elle-même un prénom porté par exactement un compte joignable ; la fonction doit rendre exactement cet identifiant. Les deux valeurs sont comparées **sans être affichées** : ce sont des données nominatives. Si aucun prénom unique n'existe, le contrôle annonce « Contrôle 4a NON MESURÉ » plutôt que de prétendre un succès. |
| 4b | Un prénom qui n'existe pas doit rendre `NULL`. |
| 4c | Sous `set local role anon`, lire `public.employees_public` doit lever `insufficient_privilege` (42501). **Un `0` n'est pas un refus** : une lecture qui réussit en rendant 0 ligne est traitée comme un ÉCHEC, et le message le dit — « `anon` a pu INTERROGER public.employees_public sans erreur (% ligne(s) visible(s)). Le SELECT n'a pas été retiré. Un 0 n'est pas un refus. » |
| 4d | Sous `anon`, la fonction doit rester appelable — sinon l'écran reste en panne. |
| 5 | Verdict : fonction présente, `prosecdef`, `search_path=public`, **`EXECUTE` effectif** pour `anon` et `authenticated`, `SELECT` anonyme refermé, vue sous `security_invoker`. |
| 6 | Relecture terminale **hors transaction**, après le `commit;`. S'exécute dans tous les cas, refus compris. |

Si tout passe, la section 5 écrit :

```
NOTICE:  MIGRATION_LOGIN_APPLIQUEE — fonction présente, security definer, search_path figé, EXECUTE effectif pour anon et authenticated, SELECT anonyme refermé, vue sous RLS de l'appelant.
```

**c) La dernière ligne à l'écran (section 6).** C'est la seule que vous devez lire si vous
n'avez rien lu d'autre :

| Dernière ligne | Ce que ça veut dire |
| --- | --- |
| `ETAT_FINAL MIGRATION_LOGIN_APPLIQUEE — …` | C'est fait. Passez à la recette, §7. |
| `ETAT_FINAL MIGRATION_LOGIN_NON_APPLIQUEE — …` | Rien n'a changé, la base est intacte. Remontez l'écran : un `ARRET` dit pourquoi. |
| `ETAT_FINAL MIGRATION_LOGIN_INCOMPLETE — …` | État mi-chemin. Ne rejouez pas en aveugle ; lisez la cause nommée. |
| `ETAT_FINAL MIGRATION_LOGIN_INCOHERENTE — …` | La fonction est là mais la vue a disparu. Arrêtez et appelez. |

**Si ça refuse, il n'y a rien à annuler.** La transaction a déjà tout rendu. C'est vérifié :
après chacun des six refus répétés sur banc, la fonction était toujours absente.

## 6. Ce que le banc a prouvé, et ce qu'il a démenti

L'artefact n'a pas été seulement écrit : il a été **joué**, le 01/10/2026, sur un conteneur
jetable `supabase/postgres:17.6.1.175` — l'image qui porte les vrais rôles `anon`,
`authenticated`, `service_role` et les *default privileges* de Supabase. L'état de départ
reproduit celui de Production côté base à `adee9bb` : vue `security_definer`, RLS active sur
`employees` sans politique pour `anon`, cinq comptes dont un doublon, un inactif, un de test.

**Sept passages, chacun sur un bac remis à neuf** — deux mutations concurrentes dans le même
bac ne mesurent rien.

| | Mutation | Attendu | Mesuré |
| --- | --- | --- | --- |
| T1 | aucune (nominal) | commit, toutes les sections parlent | ✅ |
| M0 | rejouer sur un état déjà migré | refus 0a | ✅ |
| M1 | état mi-chemin (`SELECT` déjà retiré) | refus 0d | ✅ |
| M2 | colonne `compte_test` absente | refus 0c, **nommant la colonne** | ✅ |
| M3 | `revoke select … from anon` retiré | refus **4c** | ✅ |
| M4 | `alter view … security_invoker` retiré | refus **section 5** | ✅ |
| M5 | les deux `grant execute` retirés | — | **PASSE** |

**La fuite a été reproduite, pas décrite.** Dans l'état de départ, `anon` voyait les **5**
lignes de l'annuaire à travers la vue `security_definer`. Après l'artefact :
`anon_lit_encore_la_vue = f`, `vue_sous_rls_appelant = oui`.

Deux résultats comptent plus que les sept verts, parce qu'ils **corrigent la façon d'écrire
une garde**.

**a) Une garde qui lit le texte de l'ACL est verte pour la mauvaise raison.** Mesure `\ddp`
sur l'image : dans le schéma `public`, les *default privileges* du propriétaire `postgres`
donnent `function → postgres=X, anon=X, authenticated=X, service_role=X`. Une fonction créée
dans `public` porte donc **déjà** `anon=X` et `authenticated=X` dans son `proacl` **avant tout
`grant`**. Deux contrôles de la section 5 cherchaient `anon=X` dans le texte de l'ACL : ils
seraient passés même si les deux `grant execute` avaient disparu. C'est M5 qui l'a démontré —
et M5 **passe**, honnêtement. Les deux `grant` sont redondants sur cette cible ; ils ne sont
pas inutiles (ils rendent le droit explicite et survivraient à un changement de default
privileges) mais leur absence serait **indétectable par lecture de `proacl`**. Les deux
contrôles ont été remplacés par `has_function_privilege(rôle, signature, 'EXECUTE')`, qui
répond à la seule question qui compte : l'écran peut-il appeler. Même famille que le
`revoke … from public` qui ne ferme pas `anon` — à chaque fois, c'est **le rôle nommé** qu'il
faut interroger.

**b) Un `raise exception` n'arrête pas le fichier, et `psql` sort 0.** Sur chaque refus, la
base ressortait intacte — la transaction fait son travail — mais le code de sortie de `psql`
valait **0** sans `ON_ERROR_STOP`. Le refus défile hors de l'écran et le shell annonce un
succès. D'où la **section 6**, placée *après* le `commit;` (qui, sur une transaction annulée,
est un rollback et rend la session utilisable), et qui écrit l'`ETAT_FINAL` en dernier, dans
tous les cas. Le code de sortie est une observation, pas une garantie du fichier.

## 7. Recette réelle du login — sur l'écran, pas dans la base

Un commit vert prouve l'état de la base, pas le parcours de l'écran. La recette se fait sur
`https://app.nexusconseil.net`, à la main.

**Le discriminateur ne coûte aucun compte et n'expose aucun PIN.** Dans
`NEXUS-Login-v1.html`, trois sorties seulement sont possibles :

| Message affiché | Ce qu'il prouve |
| --- | --- |
| « Connexion au serveur impossible. Vérifiez votre connexion et réessayez. » | **l'appel RPC lui-même a échoué** — c'est l'état de la panne |
| « Prénom ou code PIN incorrect. » | **l'appel RPC a répondu**, et il a rendu `NULL` (prénom inconnu ou ambigu) ou l'authentification a refusé |
| L'écran avance vers la session | la fonction a résolu le prénom **et** le PIN est bon |

D'où la recette, en trois temps :

**AVANT la migration (optionnel, pour constater la panne).** Saisir un prénom volontairement
inexistant — par exemple `ZZZPrenomInexistant` — et n'importe quoi dans le champ PIN.
Attendu : **« Connexion au serveur impossible. »**

**APRÈS la migration, contrôle sans aucun compte.** Même saisie, même prénom inexistant.
Attendu : **« Prénom ou code PIN incorrect. »** Ce changement de message, et lui seul, prouve
que la RPC existe et répond. Aucun compte réel n'est touché, aucun PIN réel n'est saisi.

**APRÈS la migration, parcours complet.** Se connecter normalement avec un compte réel, par
le prénom et le PIN. Attendu : la session s'ouvre et l'écran d'accueil s'affiche.
*Le PIN est saisi par Frédéric ; il n'est ni affiché, ni journalisé, ni recopié ici.*

**Quatrième contrôle, celui de la fuite.** Il ne se voit pas sur l'écran : c'est
`anon_lit_encore_la_vue = f` de la section 3, et le refus `42501` du contrôle 4c. L'annuaire
n'est plus listable par un visiteur muni de la seule clé publiable.

## 8. Ce qui reste ouvert après, et ce n'est pas un oubli

**`authenticated` garde le `SELECT` sur `public.employees_public`.** Ce n'est pas un
relâchement : avec `security_invoker = true`, la vue repasse sous la RLS de l'appelant, donc
un utilisateur connecté ne voit à travers elle que ce que les politiques de `employees` lui
accordent déjà. La porte est rétrécie, pas condamnée. La refermer demanderait un GO séparé et
n'est pas dans ce lot.

**L'énumération n'est pas complètement fermée.** La fonction supprime la possibilité de
*lister* les employés ; elle laisse celle de *confirmer* un prénom deviné, puisqu'elle rend un
identifiant pour un prénom juste et `NULL` sinon. C'est le correctif provisoire que
`20260904105148` annonçait. Le remplacement durable — Edge Function, limitation de tentatives
atomique, verrouillage de compte avec déverrouillage manager, réponse et délai homogènes,
journalisation sans secret — reste **un lot séparé**.

**Aucune estampille n'est posée au registre des migrations.** L'artefact applique l'effet de
`20260904175747` sans écrire sa ligne dans `supabase_migrations.schema_migrations`. Production
portera donc l'effet sans l'estampille : une divergence **nommée**, exactement du même genre
que celle de `20261001160000`. Elle est délibérée, parce que l'artefact n'est pas la migration
— c'est le geste de remise en service. La réconciliation du registre est un travail distinct,
qui mesure les 11 estampilles hors-bande du rail et ne les déclare pas sans mesure.

## 9. La fiche de qualification — préparée, pas insérée

`outils/garde-ordre-migration-code.js` refuse aujourd'hui `20260904175747` avec
`MIGRATION_NON_QUALIFIEE`, comme les dix autres migrations du rail. La fiche ci-dessous la
qualifie. **Elle n'est pas encore dans `docs/deploiement/qualification-ordre-migration-code.json`,
et elle ne doit pas y être avant qu'une lecture datée du catalogue Production existe.** Le
`_lecture` de ce fichier le dit : « les declarer sans mesure serait la faute meme que cette
garde existe pour empecher. » Un rapport d'absence transmis par un tiers est une donnée, pas
une `mesure`.

Pour la rendre insérable, il manque **un seul geste** : une lecture en lecture seule du
catalogue Production constatant l'absence (ou, après application, la présence) de
`public.nexus_identifiant_de_connexion(text)`, avec l'identité **constatée** et non choisie.
Puis coller la fiche sous la clé `20260904175747` dans `migrations`, en remplaçant
`<À REMPLIR …>` par les valeurs lues. **Jamais en éditant `20260919103000`.**

```json
"20260904175747": {
  "etat": "exige_code_d_abord",
  "justification": "La migration cree public.nexus_identifiant_de_connexion(text), que le front de production APPELLE DEJA : origin/production:NEXUS-Login-v1.html ligne 146, .rpc(\"nexus_identifiant_de_connexion\", { p_prenom: prenom }). L'ordre est donc STRICT et il a ete VIOLE : le code a ete promu le 01/10/2026 a 13 h 49 UTC par la fusion de la PR #65 (adee9bb), la migration ne l'a jamais ete. adee9bb porte 277 migrations, adee9bb^1 en portait 276 : la fusion n'a transporte AUCUNE migration. L'etat exige_code_d_abord est retenu parce que la condition qu'il nomme est aujourd'hui remplie - le code est deja la - et que la migration est donc en RETARD, pas en avance. CE QUE LA GARDE NE VOIT PAS : extraireObjets() ne nomme que la fonction. Les deux autres instructions du fichier - revoke select on public.employees_public from anon, et alter view public.employees_public set (security_invoker = true) - ne produisent aucun objet et n'apparaissent donc nulle part dans son analyse. Or ce sont elles qui rendent l'ordre strict dans l'autre sens : appliquees AVANT la promotion du code, elles auraient coupe l'ancien chemin front, qui lisait employees_public directement. La garde aurait laisse passer cet ordre-la. Ce point aveugle est mesure et reste ouvert.",
  "prochaine_action": "Jouer outils/migration-login-production-a-executer-par-frederic.sql sur Production, selon docs/deploiement/procedure-migration-login-production.md. L'artefact se juge lui-meme : section 0 refuse si la fonction existe deja, si la vue manque, s'il manque une colonne, ou si le SELECT anonyme a deja ete retire ; sections 4 et 5 annulent la transaction si la fonction ne resout pas un prenom unique, si un prenom inconnu ne rend pas NULL, si anon peut encore INTERROGER la vue (un 0 n'est pas un refus : le code 42501 est exige), si anon ne peut plus appeler la fonction, ou si EXECUTE effectif, prosecdef, search_path et security_invoker ne sont pas tous conformes ; section 6 ecrit l'ETAT_FINAL en derniere ligne, hors transaction, refus compris. Puis la recette reelle sur https://app.nexusconseil.net : un prenom volontairement inexistant doit faire passer le message de « Connexion au serveur impossible » a « Prenom ou code PIN incorrect », ce qui prouve que la RPC repond sans toucher aucun compte. Geste de Frederic.",
  "procedure": "docs/deploiement/procedure-migration-login-production.md",
  "mesure": {
    "source": "catalogue",
    "le": "<À REMPLIR — horodatage ISO 8601 UTC de la lecture>",
    "cible": "uzhjpqpctpvxytxpxoqz",
    "par": "frederic",
    "outil": "<À REMPLIR — le script nomme qui a pris la lecture>",
    "identite_constatee": "<À REMPLIR — current_user tel que la base l'a rendu>",
    "lecture_seule": "<À REMPLIR — default_transaction_read_only>",
    "moteur": "<À REMPLIR>",
    "verdict": "<À REMPLIR — par exemple : FONCTION ABSENTE — to_regprocedure('public.nexus_identifiant_de_connexion(text)') is null, et employees_public presente avec SELECT encore ouvert a anon>",
    "expire_le": "<À REMPLIR — la lecture + 72 h>"
  },
  "repetition": "La mesure ci-dessus dit ce que Production PORTE ; elle ne dit pas ce que la migration FERAIT. Cette seconde question a ete repetee le 01/10/2026 sur un banc jetable supabase/postgres:17.6.1.175, meme famille de moteur que Production, sur un etat reproduisant celui d'adee9bb cote base : vue security_definer, RLS active sur employees sans politique pour anon, cinq comptes dont un doublon, un inactif, un de test. Sept passages, chacun sur un bac remis a neuf : le nominal commite avec toutes ses sections ; rejouer sur un etat deja migre est refuse par 0a ; un etat mi-chemin par 0d ; une colonne absente par 0c, qui NOMME la colonne ; retirer le revoke select est refuse par 4c, qui exige le code 42501 et non une lecture a 0 ligne ; retirer l'alter view est refuse par la section 5. Apres chacun de ces six refus la fonction etait TOUJOURS ABSENTE : la transaction est la seule garde independante du client. Resultat negatif enregistre honnetement : retirer les deux grant execute PASSE, parce que les default privileges de Supabase portent deja anon=X et authenticated=X sur une fonction creee dans public, avant tout grant. La fuite a ete reproduite et non decrite : anon voyait les 5 lignes de l'annuaire a travers la vue, et ne les voit plus apres.",
  "reserve": "DEUX CHOSES QUE CETTE FICHE N'AUTORISE PAS. (1) Elle ne leve que l'axe de l'ordre migration/code pour 20260904175747. L'approbation du deploiement github-pages en attente reste un geste distinct, soumis a son propre GO. (2) Elle ne pose aucune estampille au registre : l'artefact applique l'effet de la migration sans ecrire sa ligne dans supabase_migrations.schema_migrations, exactement comme 20261001160000. Production portera donc l'effet sans l'estampille - une divergence NOMMEE et delibere, a reconcilier dans un travail distinct qui mesure les 11 estampilles hors-bande du rail au lieu de les declarer. RESIDUEL ASSUME : authenticated garde le SELECT sur employees_public, largement neutralise par security_invoker = true qui replace la vue sous la RLS de l'appelant ; et la fonction ferme la LISTE des employes, pas la CONFIRMATION d'un prenom devine. Le remplacement durable - Edge Function, limitation de tentatives atomique, verrouillage avec deverrouillage manager, reponse et delai homogenes - est un lot separe."
}
```

## 10. Le point aveugle, dit explicitement

`extraireObjets()` reconnaît les objets créés, modifiés, supprimés. Les deux instructions qui
ferment la porte anonyme n'en créent aucun :

```sql
revoke select on public.employees_public from anon;
alter view public.employees_public set (security_invoker = true);
```

La garde ne les voit pas. Conséquence concrète : elle a raison de dire que l'ordre est strict
dans le sens *migration après code* — parce que la fonction, elle, est nommée par le front.
Mais elle serait **incapable de refuser l'ordre inverse**, où appliquer la migration avant de
promouvoir le code aurait coupé l'ancien chemin `employees_public` et cassé le login dans
l'autre sens. C'est mesuré, c'est écrit dans la fiche, et ce n'est pas corrigé ici : élargir
`extraireObjets()` aux `revoke` et aux `alter … set (…)` est un travail distinct, qui touche
une garde déjà en service.

## 11. Si quelque chose doit être arrêté

- **Avant le `commit;`** : rien à faire. Toute erreur annule la transaction, la base ressort
  telle quelle, et la section 6 écrit `MIGRATION_LOGIN_NON_APPLIQUEE`.
- **Après le `commit;`, si la recette échoue** : ne rejouez pas l'artefact — sa section 0
  refuserait, et c'est voulu. Lisez d'abord la section 3 pour savoir ce que la base porte
  réellement, et traitez le cas nommé.
- **Rollback** : revenir en arrière signifierait rendre `anon` lecteur de la vue et supprimer
  la fonction, c'est-à-dire réouvrir la fuite d'annuaire pour sortir d'une panne d'écran. Ce
  n'est pas un geste de procédure : c'est un arbitrage, et il demande un GO explicite.
