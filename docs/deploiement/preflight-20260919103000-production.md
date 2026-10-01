# Préflight Production — `20260919103000_carburant_reception_regularisation_releve_manuscrit`

| | |
|---|---|
| SHA officiel audité | `5dcdaaa55f5804f88594c91c272439cf77a123b0` |
| Fichier | `supabase/migrations/20260919103000_carburant_reception_regularisation_releve_manuscrit.sql` |
| Empreinte du blob | `1a02adca37af32b6ea3ffa3ec41b43968502d75bd515877b47e1d4073a8d6caf` |
| Cible | Production `uzhjpqpctpvxytxpxoqz` |
| Date de l'audit | 30/09/2026 |
| Verdict | **`NO_GO_MIGRATION_PRODUCTION`** — état AVANT non mesuré |

Le fichier n'est pas modifié par ce préflight, et ne doit pas l'être pour
faire passer une garde.

## 1. Les 13 objets créés

`carburant_reception_visites` — 7 colonnes : `mode_saisie`
(`text not null default 'temps_reel'`), `regularisation_motif`,
`regularisation_par` (`uuid`), `regularisation_par_nom`, `regularisation_le`
(`timestamptz`), `controle_terrain_par`, `justificatif_url` — les six
dernières nullables sans défaut.

2 contraintes : `…_mode_saisie_check` (liste `temps_reel`/`regularisation`) et
`…_regularisation_coherente_check` (symétrique, `case mode_saisie`).

`carburant_reception_mesures` — 1 colonne : `source`
(`text not null default 'saisie_nexus'`) ; 1 contrainte `…_source_check`.

1 fonction `public.nexus_garde_regularisation_reception()`
(`security definer`, `set search_path = public`) ; 1 trigger
`trg_garde_regularisation_reception` `before insert or update … for each row`.

Aucune table nouvelle, aucune vue, aucune policy, aucun bucket, aucun rôle.
Aucun `grant`. Le seul geste de droits est un `revoke all … from public`.

## 2. Caractère additif — et la seule objection sérieuse

Tout est en création. Aucun `drop column`, `drop table`, `alter column type`,
`set not null` sur colonne existante, `rename`, `truncate`, `delete from`.
Le seul `drop` est `drop trigger if exists` sur le trigger que la migration
recrée immédiatement : un remplacement, pas une destruction.

Les lignes Production existantes sont-elles acceptées par les nouvelles
contraintes ? **Oui, et c'est démontrable sans mesurer la base.** Une ligne
existante reçoit `mode_saisie = 'temps_reel'` par le défaut, et les quatre
colonnes citées par la branche `else` du check symétrique viennent d'être
ajoutées sans défaut : elles valent donc `NULL` sur toutes les lignes. La
branche `else` n'exige rien d'autre que ces quatre `NULL`. La validation du
check ne peut donc pas échouer sur des données préexistantes — quel que soit
le volume. `mode_saisie` étant `not null`, le `case` ne peut pas tomber dans
la branche `NULL`.

## 3. Aucun parcours Production existant ne casse

**La première ligne du trigger décide tout :**

```sql
if new.mode_saisie is distinct from 'regularisation' then
  return new;
end if;
```

Le code actuellement servi en Production **ne nomme aucune des nouvelles
colonnes** (mesuré : zéro occurrence dans l'arbre `origin/production`). Il
n'envoie donc jamais `mode_saisie`, la colonne prend `temps_reel`, et le
trigger ressort à sa première instruction sans jamais appeler
`current_employee_role()`.

- **Réception carburant normale, pompiste** — inchangée. Le trigger ressort
  immédiatement ; aucune policy, aucun `grant`, aucune colonne existante n'est
  touchée.
- **Manager** — inchangé pour les mêmes raisons.
- **Lecture Pilotage / Performance** — les lecteurs citent des colonnes
  explicites ; le seul `select('*')` concerné est sur
  `carburant_reception_mesures`, qui gagne un champ `source` ignoré par le
  moteur. Aucune vue ne dépend des tables modifiées.
- **Triggers existants** — mesuré sur l'arbre `origin/production` par
  extraction des 30 `create trigger` du dépôt : **zéro trigger existant sur
  `carburant_reception_visites` et `carburant_reception_mesures`**
  (`trg_preserver_releve_ouverture_lors_reception` est sur `carburant_releves`).
  `trg_garde_regularisation_reception` serait le premier : aucune question
  d'ordre de déclenchement. Mesuré sur l'**arbre** — à reconfirmer au
  catalogue, puisque la base peut porter des objets hors-bande.
- **RLS existantes** — aucune policy créée, modifiée ni supprimée. En
  particulier `update_carburant_reception_visites` (20260820152614, ouverte au
  pompiste du site) reste intacte.

**Changement de comportement réel, après déploiement du code seulement :** un
`UPDATE` par un pompiste sur une ligne dont `mode_saisie = 'regularisation'`
sera refusé `42501` par le trigger, là où la policy l'autoriserait. C'est
l'effet voulu — la garde mord en base et pas seulement dans l'écran — et il
est inatteignable avant que du code n'écrive une ligne `regularisation`.

## 4. Ordre `migration → code` : additive, applicable avant le code

Le code du candidat `5dcdaaa` nomme **9** des nouveaux identifiants, dont
`NEXUS-Carburant-Reception-v1.html` qui envoie `mode_saisie` (ligne 1483) et
`source` (ligne 1527) **inconditionnellement**. Déployer le code sans la
migration casserait donc **toute** sauvegarde de réception, y compris
normale. L'ordre est contraint : **migration d'abord, code ensuite.**

`outils/garde-ordre-migration-code.js` reproduit ce constat seul, par analyse
statique des deux refs.

## 5. Verrous

PostgreSQL 17.6 (mesuré sur Test ; la version Production fait partie de la
lecture AVANT). Sur PG 11+, `add column … not null default` écrit le défaut
au catalogue (`attmissingval`) et **ne réécrit pas la table**.

| ordre | instruction | verrou | durée |
|---|---|---|---|
| 1 | `alter table … add column ×7` | `ACCESS EXCLUSIVE` sur visites | catalogue seul, millisecondes |
| 2 | `add constraint …_mode_saisie_check` | `ACCESS EXCLUSIVE` | + balayage complet de validation |
| 3 | `add constraint …_regularisation_coherente_check` | `ACCESS EXCLUSIVE` | + balayage complet |
| 4 | `alter table … add column source` | `ACCESS EXCLUSIVE` sur mesures | millisecondes |
| 5 | `add constraint …_source_check` | `ACCESS EXCLUSIVE` | + balayage complet |
| 6 | `create or replace function` | aucun verrou de table | — |
| 7 | `revoke all on function … from public` | verrou sur la fonction | — |
| 8 | `drop trigger` + `create trigger` | `ACCESS EXCLUSIVE` sur visites | brève |

Le risque n'est pas la durée des instructions, c'est **l'attente** : un
`ACCESS EXCLUSIVE` en file d'attente derrière une transaction longue bloque à
son tour **tous les lecteurs suivants**. D'où le `lock_timeout`.

Les volumes Production ne sont pas connus (Test porte 1 visite et 2 mesures,
non représentatif). Les balayages de validation sont à mesurer à la lecture
AVANT ; sur une table de réceptions, l'ordre de grandeur attendu est de
quelques centaines à quelques milliers de lignes.

## 6. Idempotence — et pourquoi elle ne rassure pas

`add column if not exists`, `exception when duplicate_object then null`,
`create or replace function`, `drop trigger if exists` : la migration est
rejouable sans erreur.

**C'est précisément le danger.** `if not exists` passe en silence sur une
colonne déjà présente **avec une autre définition**, et
`exception when duplicate_object then null` laisse en place une contrainte
homonyme **de définition différente** sans le dire. L'idempotence ne rend pas
l'état inconnu sûr : elle le rend **muet**. C'est la raison de fond du NO-GO,
et la raison pour laquelle la lecture AVANT doit lire les **définitions** et
pas seulement les noms.

Un `check_violation` ou toute erreur autre que `duplicate_object` n'est **pas**
attrapée et fait bien échouer la transaction : le bloc `do $$ … exception $$`
ne masque que l'homonymie.

## 7. Dépendances

`public.current_employee_role()` — présente dans l'arbre `origin/production`
(`20260728135643`). `auth.role()` — fournie par Supabase, déjà utilisée par
`20260807152513`. Les deux tables cibles existent depuis `20260815114849`.
`heure_fin`, cité par le check, est une colonne existante de la table.

## 8. Droits — une dette mesurée, pas un défaut à corriger ici

```
nexus_garde_regularisation_reception
  acl = {postgres=X/postgres, anon=X/postgres,
         authenticated=X/postgres, service_role=X/postgres}
```

Mesuré sur Test le 30/09/2026. `revoke all … from public` **ne retire pas**
`anon` ni `authenticated` : Supabase accorde `EXECUTE` par *grants nommés* via
`pg_default_acl`, et `from public` ne les nomme pas. Troisième occurrence du
même défaut dans ce dépôt.

**Ce n'est pas exploitable ici** : la fonction retourne `trigger` et ne peut
pas être appelée directement en SQL par un client PostgREST ; appelée par le
trigger, elle *restreint* au lieu d'ouvrir. Plus de vingt fonctions
préexistantes portent le même ACL.

**Correctif préparé, à appliquer séparément et non dans ce fichier** :

```sql
revoke all on function public.nexus_garde_regularisation_reception()
  from anon, authenticated;
```

Ce n'est **pas** un défaut qui justifie de modifier `20260919103000` : la
migration est gelée au SHA audité, et la modifier pour satisfaire une garde
est explicitement interdit.

## 9. Registre, arbre, schéma — trois termes, pas deux

Ne rien déduire du nombre de fichiers Git. Les trois diffèrent :

| terme | ce qu'il dit | ce qu'il ne dit pas |
|---|---|---|
| arbre du dépôt | quels fichiers existent à une ref | si quoi que ce soit a été appliqué |
| registre `supabase_migrations.schema_migrations` | qu'un outil a inscrit une estampille | que l'objet existe, ni avec quelle définition |
| catalogue (`pg_catalog`, `information_schema`) | ce qui existe réellement | — c'est la seule source recevable |

Preuves que la distinction n'est pas théorique, mesurées le 30/09/2026 :

- Sur **Test**, le schéma portait **la totalité des 13 objets** de
  `20260919103000` alors que son estampille était **absente du registre**.
- **286 des 287 lignes** du registre de Test ont `statements` à `NULL` : le
  registre n'a pas conservé ce qu'il prétend avoir appliqué.
- Le registre de Test est un sur-ensemble strict de l'arbre Production :
  11 estampilles sans fichier correspondant.

### Estampille hors ordre — conséquence opératoire

La dernière migration constatée en Production est `20260920140000`, soit
**postérieure** à `20260919103000`. Neuf estampilles Production la précèdent
dans le registre tout en lui étant postérieures en date. `supabase db push`
refuse par défaut d'appliquer une migration plus ancienne que la dernière
inscrite et exige `--include-all`. Deux voies, à arbitrer par Frédéric :

1. `supabase db push --include-all` — l'outil applique et inscrit lui-même.
2. Application manuelle du SQL en transaction explicite, **suivie de
   l'inscription de l'estampille** `20260919103000` dans
   `supabase_migrations.schema_migrations`. Sans cette inscription, le
   registre mentira une fois de plus — et un `db push` ultérieur rejouerait le
   fichier (sans dommage, mais en silence).

La voie 2 est la seule qui permette de poser `lock_timeout` et des contrôles
transactionnels. C'est celle décrite ci-dessous.

## 10. État AVANT attendu

**Les 13 objets absents, et aucun homonyme de définition divergente.**

Requête de lecture AVANT — lecture seule, à exécuter sur Production :

```sql
select 1 as ordre, 'moteur' as rubrique, version() as detail
union all
select 2, 'volume', format('%s = %s lignes', 'carburant_reception_visites',
                           (select count(*) from public.carburant_reception_visites))
union all
select 2, 'volume', format('%s = %s lignes', 'carburant_reception_mesures',
                           (select count(*) from public.carburant_reception_mesures))
union all
select 3, 'colonne', format('%s.%s : type=%s null=%s defaut=%s',
                            table_name, column_name, data_type, is_nullable,
                            coalesce(column_default,'-'))
  from information_schema.columns
 where table_schema = 'public'
   and ( (table_name = 'carburant_reception_visites'
          and column_name in ('mode_saisie','regularisation_motif','regularisation_par',
                              'regularisation_par_nom','regularisation_le',
                              'controle_terrain_par','justificatif_url'))
      or (table_name = 'carburant_reception_mesures' and column_name = 'source') )
union all
select 4, 'contrainte', format('%s : %s', conname, pg_get_constraintdef(oid))
  from pg_constraint
 where conname in ('carburant_reception_visites_mode_saisie_check',
                   'carburant_reception_visites_regularisation_coherente_check',
                   'carburant_reception_mesures_source_check')
union all
select 5, 'fonction', format('%s : secdef=%s search_path=%s acl=%s',
                             p.proname, p.prosecdef,
                             coalesce(array_to_string(p.proconfig,','),'-'),
                             coalesce(p.proacl::text,'DEFAUT(null)'))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'nexus_garde_regularisation_reception'
union all
select 6, 'trigger', format('%s sur %s : %s', t.tgname, c.relname, pg_get_triggerdef(t.oid))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
order by ordre, detail;
```

**Lecture attendue :** rubriques 3, 4, 5 vides ; rubrique 6 vide ; rubriques 1
et 2 renseignées.

### Conditions d'arrêt

| constat | décision |
|---|---|
| toute rubrique 3/4/5/6 **non vide** | **STOP.** État divergent. L'idempotence masquerait l'écart au lieu de le corriger. |
| version PostgreSQL < 11 | **STOP.** Réécriture complète de table sous `ACCESS EXCLUSIVE`. |
| `current_employee_role()` absente | **STOP.** Dépendance manquante. |
| un trigger déjà présent sur `carburant_reception_visites` | **STOP.** L'ordre de déclenchement devient une question ouverte. |
| volume > ~1 M lignes sur une des deux tables | **STOP** et rebâtir en `not valid` + `validate constraint` — ce qui exige une nouvelle migration, donc un nouvel arbitrage. |
| lecture impossible / incomplète | **STOP.** État inconnu = refus fermé. |

## 11. SQL exact à exécuter

Le corps est **le fichier audité, inchangé**, encadré. Un seul ajout
d'encadrement, aucune modification du contenu.

```sql
begin;

-- Aucune instruction ne doit attendre un verrou : mieux vaut échouer vite et
-- rejouer que bloquer la file de lecture derrière un ACCESS EXCLUSIVE.
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- >>> contenu intégral de
--     supabase/migrations/20260919103000_carburant_reception_regularisation_releve_manuscrit.sql
--     au SHA 5dcdaaa55f5804f88594c91c272439cf77a123b0, sans la moindre retouche
--     (blob sha256 1a02adca37af32b6ea3ffa3ec41b43968502d75bd515877b47e1d4073a8d6caf)

-- Inscription de l'estampille : sans elle le registre mentirait une fois de plus.
insert into supabase_migrations.schema_migrations (version, name)
values ('20260919103000', 'carburant_reception_regularisation_releve_manuscrit')
on conflict (version) do nothing;

-- Contrôles AVANT COMMIT : la transaction se juge avant d'être validée.
-- 13 objets attendus. Tout autre total = rollback.
select count(*) as colonnes_attendues_8 from information_schema.columns
 where table_schema='public'
   and ( (table_name='carburant_reception_visites'
          and column_name in ('mode_saisie','regularisation_motif','regularisation_par',
                              'regularisation_par_nom','regularisation_le',
                              'controle_terrain_par','justificatif_url'))
      or (table_name='carburant_reception_mesures' and column_name='source') );

select count(*) as contraintes_attendues_3 from pg_constraint
 where conname in ('carburant_reception_visites_mode_saisie_check',
                   'carburant_reception_visites_regularisation_coherente_check',
                   'carburant_reception_mesures_source_check');

select count(*) as trigger_attendu_1 from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
 where not t.tgisinternal and t.tgname='trg_garde_regularisation_reception'
   and c.relname='carburant_reception_visites';

-- Témoin de non-régression : une réception normale doit toujours passer la
-- garde. Vérifié sans écrire, en appelant le prédicat du trigger sur la
-- valeur par défaut.
select 'temps_reel' is distinct from 'regularisation' as le_trigger_ressort_tout_de_suite;

-- commit;   <- à frapper seulement si 8 / 3 / 1 / true
-- rollback; <- dans tous les autres cas
```

**`lock_timeout` : la procédure NEXUS n'en fixe aucun.** Mesuré : le dépôt ne
contient aucun `lock_timeout` applicatif (seuls la baseline à `0` et des
`statement_timeout` de 8 s / 25 s dans trois migrations, et 120 s pour le rôle
de lecture Production). `3s` est donc une **proposition à ratifier**, cohérente
avec ces ordres de grandeur, et non la citation d'une règle existante. Le dire
plutôt que d'inventer une conformité.

## 12. État APRÈS attendu — mesuré, pas prédit

Relevé sur Test le 30/09/2026, où la migration est intégralement appliquée.
Même requête qu'au §10 ; voici la lecture à retrouver, à l'ACL près.

```
colonne    carburant_reception_mesures.source : type=text null=NO defaut='saisie_nexus'::text
colonne    …visites.mode_saisie             : type=text null=NO defaut='temps_reel'::text
colonne    …visites.regularisation_motif    : type=text null=YES defaut=-
colonne    …visites.regularisation_par      : type=uuid null=YES defaut=-
colonne    …visites.regularisation_par_nom  : type=text null=YES defaut=-
colonne    …visites.regularisation_le       : type=timestamp with time zone null=YES defaut=-
colonne    …visites.controle_terrain_par    : type=text null=YES defaut=-
colonne    …visites.justificatif_url        : type=text null=YES defaut=-

contrainte carburant_reception_mesures_source_check :
  CHECK ((source = ANY (ARRAY['saisie_nexus'::text, 'releve_manuscrit'::text])))
contrainte carburant_reception_visites_mode_saisie_check :
  CHECK ((mode_saisie = ANY (ARRAY['temps_reel'::text, 'regularisation'::text])))
contrainte carburant_reception_visites_regularisation_coherente_check :
  CHECK (CASE mode_saisie
    WHEN 'regularisation'::text THEN ((regularisation_motif IS NOT NULL)
      AND (btrim(regularisation_motif) <> ''::text) AND (regularisation_par IS NOT NULL)
      AND (regularisation_le IS NOT NULL)
      AND ((heure_fin IS NULL) OR (regularisation_le >= heure_fin)))
    ELSE ((regularisation_motif IS NULL) AND (regularisation_par IS NULL)
      AND (regularisation_par_nom IS NULL) AND (regularisation_le IS NULL))
  END)

fonction   nexus_garde_regularisation_reception : secdef=t search_path=search_path=public
           acl={postgres=X/postgres, anon=X/postgres,
                authenticated=X/postgres, service_role=X/postgres}

trigger    trg_garde_regularisation_reception sur carburant_reception_visites :
  BEFORE INSERT OR UPDATE … FOR EACH ROW EXECUTE FUNCTION
  nexus_garde_regularisation_reception()
```

L'ACL ci-dessus est la dette du §8, pas la cible souhaitée : la retrouver
telle quelle confirme que la migration a produit son effet habituel.

## 13. Restauration

**Avant `COMMIT`** : `rollback`, et rien n'a eu lieu. C'est pourquoi la voie
transactionnelle est préférable à `db push`.

**Après `COMMIT`, et tant qu'aucune ligne `regularisation` n'existe** — donc
pendant toute la fenêtre entre cette migration et le déploiement du code #65 —
un retour arrière est réel et sans perte, puisque les colonnes ne contiennent
que leurs défauts :

```sql
begin;
set local lock_timeout = '3s';

-- Contrôle d'innocuité : refuser le retour arrière s'il détruirait des données.
-- Doit rendre 0. Sinon : ROLLBACK, le retour arrière n'est plus sans perte.
select count(*) as regularisations_existantes
  from public.carburant_reception_visites where mode_saisie = 'regularisation';
select count(*) as mesures_manuscrites
  from public.carburant_reception_mesures where source = 'releve_manuscrit';

drop trigger if exists trg_garde_regularisation_reception
  on public.carburant_reception_visites;
drop function if exists public.nexus_garde_regularisation_reception();

alter table public.carburant_reception_mesures
  drop constraint if exists carburant_reception_mesures_source_check,
  drop column if exists source;

alter table public.carburant_reception_visites
  drop constraint if exists carburant_reception_visites_regularisation_coherente_check,
  drop constraint if exists carburant_reception_visites_mode_saisie_check,
  drop column if exists mode_saisie,
  drop column if exists regularisation_motif,
  drop column if exists regularisation_par,
  drop column if exists regularisation_par_nom,
  drop column if exists regularisation_le,
  drop column if exists controle_terrain_par,
  drop column if exists justificatif_url;

delete from supabase_migrations.schema_migrations where version = '20260919103000';

-- commit; seulement si les deux comptes valaient 0
```

**Après que le code #65 a écrit une régularisation** : le retour arrière
devient destructeur — `drop column` détruirait des motifs, des auteurs et des
justificatifs qui n'existent nulle part ailleurs. À partir de ce point, la
seule voie est la correction en avant, et ce script ne doit plus être employé.
Le dire franchement vaut mieux que de promettre un rollback qui mentirait.

Sauvegarde : Supabase conserve le PITR du projet. Une restauration de projet
reste le dernier recours — elle ramène **toute** la base à un instant
antérieur, pas seulement ces deux tables, et perd donc tout ce qui a été
saisi entre-temps. Ce n'est pas un rollback de migration et ne doit jamais
être présenté comme tel.

## 14. Verdict

**`NO_GO_MIGRATION_PRODUCTION`**

Le fichier audité est sain : purement additif, idempotent, sans DDL
destructif, sans dépendance manquante, inoffensif pour les lignes existantes,
et applicable **avant** le code — ce qui est d'ailleurs le seul ordre
possible, puisque le code du candidat envoie `mode_saisie` et `source`
inconditionnellement.

Ce qui manque n'est pas dans le fichier, c'est **l'état AVANT de la base
cible**, jamais mesuré. Et l'idempotence, loin de couvrir cette inconnue,
l'aggrave : un objet déjà présent avec une définition divergente serait
contourné **en silence**.

### Prochaine action — une seule

Exécuter la **lecture AVANT du §10** sur Production `uzhjpqpctpvxytxpxoqz`,
en lecture seule, et la rapporter. Elle est en lecture pure : aucun verrou,
aucune écriture, aucune donnée métier.

C'est un geste de Frédéric : les lectures de la base Production ne me sont pas
ouvertes. Dès que ses six rubriques sont connues, ce préflight se conclut sans
nouvel arbitrage — rubriques 3 à 6 vides donnent
`PRET_POUR_MIGRATION_PRODUCTION`, toute rubrique non vide maintient le NO-GO
et ouvre une comparaison de définitions.

Aucune écriture Supabase Production n'a été lancée. #65 n'est pas fusionnée.
Production n'est pas déployée. Rien n'a été force-pushé. Aucune garde n'a été
affaiblie.

---

## 15. Confrontation du 01/10/2026 — ce que les mesures déjà prises répondent

Section ajoutée, aucune section ci-dessus n'est réécrite. Le dossier a été
transporté sur le rail `handoff-continuite-20260920` ; **son sujet ne l'a pas
été** : `supabase/migrations/20260919103000_….sql` est absent du rail et
n'existe que sur le candidat #65. Vérifié ce jour.

### 15.1 Ce qui a été re-mesuré aujourd'hui, pas cité

| constat | valeur |
|---|---|
| `origin/production` | **276** fichiers de migration ; `20260919103000` **absent** ; dernier par nom `20260920140000_bascule_source_precedente_et_change_le.sql` |
| blob audité | `git cat-file blob 5dcdaaa…` → sha256 `1a02adca37af32b6ea3ffa3ec41b43968502d75bd515877b47e1d4073a8d6caf` — **identique à l'en-tête** |
| PR #65 | OPEN, base `production`, `headRefOid` **`5dcdaaa55f5804f88594c91c272439cf77a123b0`** — le SHA audité est toujours la tête |
| garde rejouée | candidat 277 / cible 276 → 1 nouvelle, 0 retirée, 13 objets, **9** identifiants du code en dépendent, `REFUS [ETAT_INCONNU]`, sortie 1 |

L'autorisation du préflight n'a donc pas péri sur un SHA déplacé, et le refus
se reproduit à l'identique.

### 15.2 Chaque contrôle, contre la mesure réellement en main

« Nature » dit **d'où** vient la preuve. Un arbre Git dit quels fichiers
existent, jamais ce qui a été appliqué ; une réplique jetable dit ce que
produisent les 276 fichiers, jamais ce que contient Production.

| § | contrôle | nature de la preuve | date | tranché ? |
|---|---|---|---|---|
| 2 | purement additive ; les lignes existantes prennent le défaut, les 4 colonnes du `else` sont NULL partout | raisonnement + **réplique jetable** PG 17.6 (différentiel inverse vide) | 22/09 | **oui** — ne dépend pas du volume |
| 3 | aucun chemin Production cassé ; zéro trigger existant sur les deux tables | **arbre** `origin/production` (0 occurrence des nouvelles colonnes ; 30 `create trigger` extraits) | 01/10 | **partiellement** — aveugle au hors-bande |
| 4 | ordre contraint migration → code | **arbre**, garde statique rejouée | 01/10 | **oui** |
| 5 | verrous et volumes | **aucune** mesure Production ; `volumes-production-mesures.json` (09/09) ne cite pas `carburant` ; Test porte 1 visite et 2 mesures | — | **non** |
| 6 | idempotence | lecture du fichier | 30/09 | **oui** — et c'est précisément ce qui rend l'état AVANT nécessaire |
| 7 | dépendances (`current_employee_role`, les deux tables, `heure_fin`) | **arbre** `origin/production` | 30/09 | **partiellement** — aveugle au hors-bande |
| 8 | ACL de la fonction | **Test** (30/09) et **réplique** (22/09) — jamais Production | 30/09 | **non** pour Production ; portée faible, correction préparée à part |
| 9 | estampille hors ordre | **arbre** Production re-mesuré | 01/10 | **oui** |

Les seules mesures **catalogue Production** existantes datent du **09/09/2026**
(`mesures-production-lecture-seule-1.md`, `volumes-production-mesures.json`) et
portent sur `shifts`, `mission_catalog`, `sites` et les services — **d'autres
tables**. Elles ont trois semaines, contre une péremption de 72 h posée par ce
même axe. Elles ne répondent à aucune des six rubriques du §10.

### 15.3 Une contradiction entre deux de mes documents

`preuve-65-schema-jetable.md` §1 écrit « PostgreSQL 17.6 — identique à
Production (`server_version_num` 170006) » **sans source pour la moitié
Production**. Le §5 ci-dessus écrit « mesuré sur Test ; la version Production
fait partie de la lecture AVANT ». C'est le §5 qui est prudent. La rubrique 1
reste **non tranchée** ; la condition d'arrêt « PG < 11 » n'est pas levée par
une mesure, seulement par une attente.

### 15.4 Le défaut trouvé dans la lecture du §10 — et il penche du mauvais côté

Le rôle préparé pour cette lecture, `nexus_prod_readonly_login`
(`role-lecture-seule-production-1.md`, 11/09), **n'a de `SELECT` ni sur
`carburant_reception_visites` ni sur `carburant_reception_mesures`** : ses
droits couvrent 7 tables, aucune des deux. Il est de surcroît resté sans ligne
visible, la RLS n'accordant rien à une connexion sans `auth.uid()`.

La question n'est donc pas seulement « peut-il lire ? », mais **que rend la
requête du §10 quand elle est jouée par un rôle sans privilège ?**

Mesuré aujourd'hui, conteneur jetable `supabase/postgres:17.6.1.175`, objets
créés à l'image des réels, rôle sonde sans aucun privilège dessus :

| rubrique | source | `postgres` (témoin) | rôle sans privilège |
|---|---|---|---|
| 3 — colonnes | `information_schema.columns` | **6** | **0** |
| 3 bis — colonnes | `pg_attribute` (catalogue) | 6 | **6** |
| 4 — contraintes | `pg_constraint` | 1 | 1 |
| 5 — fonction | `pg_proc` | 1 | 1 |
| 6 — trigger | `pg_trigger` | 1 | 1 |
| 2 — volume | `count(*)` | 0 | **permission denied** |

`information_schema` ne montre que les objets sur lesquels le rôle courant
détient un privilège. Les six colonnes **existent** et la rubrique 3 rend
**vide**. Or le §10 lit « rubriques 3 à 6 vides » comme
`PRET_POUR_MIGRATION_PRODUCTION` : **un rôle sans droit produit exactement la
lecture qui autorise la migration.** C'est une garde qui ne mord pas, et elle
penche vers le GO.

Deux choses la retiennent aujourd'hui, aucune par conception : la requête est
un seul `union all`, donc le `permission denied` de la rubrique 2 avorte le
tout ; et le geste est celui de Frédéric, qui lit probablement sous une
identité privilégiée. Mais le réflexe naturel devant ce refus — retirer la
rubrique 2 pour « au moins voir le schéma » — débloque le faux vert.

`pg_constraint`, `pg_proc` et `pg_trigger` ne sont pas filtrés par privilège :
les rubriques 4, 5 et 6 sont honnêtes telles quelles.

### 15.5 Correctif de la rubrique 3 — à substituer avant toute lecture

```sql
select 3 as ordre, 'colonne' as rubrique,
       c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
         || case when a.attnotnull then ' NOT NULL' else ' NULL' end
         || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '') as detail
  from pg_attribute a
  join pg_class     c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
   and a.attnum > 0 and not a.attisdropped
   and a.attname in ('mode_saisie','regularisation_motif','regularisation_par',
                     'regularisation_par_nom','regularisation_le',
                     'controle_terrain_par','justificatif_url','source')
```

Pour la rubrique 2, `count(*)` exige `SELECT`. L'estimation catalogue
`pg_class.reltuples` ne l'exige pas — mais elle vaut **-1** sur une table
jamais analysée, et **-1 n'est pas « petit »**. Si elle est employée, la
condition d'arrêt devient : `reltuples < 0` → **STOP, volume inconnu**.

### 15.6 Ce que cela ajoute aux conditions d'arrêt du §10

Sans réécrire le tableau du §10, trois conditions s'y ajoutent :

| constat | décision |
|---|---|
| la lecture n'est pas jouée sous une identité détenant `SELECT` sur les deux tables | **STOP.** Une rubrique vide ne distingue plus « absent » de « invisible ». |
| rubrique 2 en `permission denied`, ou rubrique 3 lue par `information_schema` | **STOP.** Lecture incomplète — la version du §15.5 est obligatoire. |
| `reltuples` négatif employé en remplacement du `count(*)` | **STOP.** Volume inconnu. |

### 15.7 Verdict pour la migration seule — `NO_GO_MIGRATION_PRODUCTION` maintenu

Portée : **la migration `20260919103000` seule**. Ni la fusion de #65, ni le
déploiement Pages, ni le rail.

Le verdict ne change pas, et pour la raison inchangée : **l'état AVANT de
Production n'est pas mesuré**, et aucune des mesures déjà prises ne le couvre.
L'idempotence du fichier ne sauve pas cet inconnu — elle le rend muet.

Ce qui change, c'est que le dossier **ne pouvait pas se conclure même si le
geste avait été fait** : le rôle prévu n'ouvre pas les deux tables, et la
requête prévue aurait rendu « vide » pour « invisible ». La « prochaine action
— une seule » du §14 était mal spécifiée. Elle est corrigée ici.

### 15.8 Prochaine action — corrigée

Exécuter la lecture AVANT du §10 **avec la rubrique 3 remplacée par le
§15.5**, sous une identité détenant `SELECT` sur les deux tables — c'est-à-dire
**pas** `nexus_prod_readonly_login` en l'état. Geste de Frédéric.

Deux voies, au choix, et aucune n'est à prendre de ma part :
1. lecture depuis le Dashboard Supabase, sous une identité privilégiée ;
2. `grant select on public.carburant_reception_visites,
   public.carburant_reception_mesures to nexus_prod_readonly;` — **élargit la
   surface de sécurité Production**, donc geste humain explicite, et à révoquer
   après la lecture.

Rubriques 3 à 6 vides **sous une identité qui aurait vu les objets s'ils
existaient** → `PRET_POUR_MIGRATION_PRODUCTION`. Toute rubrique non vide
maintient le NO-GO et ouvre la comparaison de définitions.

Aucune écriture Supabase Production n'a été lancée. Aucune lecture Production
n'a été lancée. #65 n'est pas fusionnée. Production n'est pas déployée. Aucune
garde n'a été affaiblie.

---

## 16. Le `grant select` : mesuré, puis écarté — 01/10/2026

Frédéric a donné le GO pour la voie 2 du §15.8 (`grant select` sur les deux
tables à `nexus_prod_readonly`). Avant de préparer le geste, j'ai mesuré ce
qu'il achète. **Il n'achète rien, et il coûte une condition d'arrêt.** Le GO
est fondé dans son intention — rendre la lecture possible — mais il porte sur
un geste qui ne la rend pas possible.

### 16.1 Pourquoi le `SELECT` ne suffit pas : la policy repose sur `auth.uid()`

Le corps de la fonction est enfin localisé. Il n'était pas dans les migrations
du lot, mais dans le socle :
`supabase/migrations/20260101000000_baseline_pre_existing_schema.sql:201`.

```sql
CREATE OR REPLACE FUNCTION "public"."current_employee_site_id"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select site_id from employees where id = auth.uid();
$$;
```

Les deux tables cibles ont RLS activée (`20260815114849_carburant_receptions_visite_v2.sql:142`
et `:145`) et leur policy de lecture est
`using (site = (select current_employee_site_id()))`.

Une connexion `psql` n'a pas de jeton : `auth.uid()` rend NULL, donc
`current_employee_site_id()` rend NULL, donc `site = NULL` n'est jamais vrai.
**Le rôle verrait zéro ligne même avec le `SELECT` accordé.** C'est exactement
ce qui avait été constaté le 11/09 sur cinq autres tables
(`docs/handoff/lots/NEXUS-POINTAGE-CORRECTIF-1-20260911/role-lecture-seule-production-1.md`,
« Le rôle ne voit aucune ligne »), sans que la cause en soit alors établie.
Elle l'est maintenant.

### 16.2 Mesure, pas déduction — conteneur jetable `nexus-preuve-grant`

Image `supabase/postgres:17.6.1.175`, port 55434, détruit après la mesure.
Fixture reproduisant la forme Production : l'`auth.uid()` **native de l'image**
(non simulée), la fonction du socle, la policy du `do $$ … foreach t in array … $$`
de `20260815114849`, RLS activée, et un rôle `sonde_lecture` `login nobypassrls`
avec `default_transaction_read_only = on`, à l'image de `nexus_prod_readonly_login`.

Données réellement présentes dans les tables : **2 400** visites, **6 800** mesures.

| mesure | identité | sans `grant` | avec `grant select` |
|---|---|---|---|
| rubrique 2 — `count(*)` visites | `sonde_lecture` | **`permission denied`** | **`0`** |
| rubrique 2 — `count(*)` mesures | `sonde_lecture` | *(non atteint)* | **`0`** |

**Le `grant` transforme un refus bruyant en un zéro silencieux, sur 2 400 et
6 800 lignes bien présentes.** Sans lui, la condition d'arrêt « lecture
impossible / incomplète → STOP » du §10 se déclenche correctement. Avec lui, la
lecture rend `0`, `0` satisfait « bien en dessous de 1 M lignes », et la
condition d'arrêt passe — **pour la mauvaise raison**.

C'est le défaut du §15 réintroduit une couche plus bas : là où
`information_schema` rendait vide pour invisible, le `grant` ferait rendre zéro
pour masqué. Et comme au §15, le faux négatif penche vers le GO.

### 16.3 Ce que la même identité lit déjà, sans aucun `grant`

Même conteneur, même rôle, **après révocation** du `grant` :

| rubrique | source | témoin `postgres` | `sonde_lecture` sans aucun privilège |
|---|---|---|---|
| 3 — colonnes (§15.5) | `pg_attribute` + `pg_attrdef` | 6 | **6** |
| 3 — variante abandonnée | `information_schema.columns` | 6 | **0** |
| 4 — contraintes | `pg_constraint` | 2 | **2** |
| 5 — fonctions | `pg_proc` | 1 | **1** |
| 6 — triggers | `pg_trigger` | 0 | **0** |
| 2 — volume | `pg_stat_user_tables.n_live_tup` | 2 400 / 6 800 | **2 400 / 6 800** |
| 2 — volume | `pg_total_relation_size()` | 311 296 / 802 816 o | **311 296 / 802 816 o** |
| 2 — volume | `pg_class.reltuples` | **-1** | **-1** |

**Les rubriques 3, 4, 5 et 6 — celles qui portent le verdict — sont déjà
lisibles par `nexus_prod_readonly_login` en l'état.** Le `grant` leur est
inutile.

La rubrique 2 l'est aussi, mais par `pg_stat_user_tables.n_live_tup`, pas par
`count(*)`. `n_live_tup` n'est pas filtré par privilège **et** n'est pas filtré
par RLS : il a rendu les 2 400 et 6 800 lignes réelles là où le `count(*)`
privilégié rendait `0`. `reltuples` reste inutilisable : **-1** sur une table
jamais analysée, et -1 n'est pas « petit ».

### 16.4 Décision

**Le `grant select` n'est pas appliqué.** Il est inutile aux rubriques 3 à 6,
insuffisant à la rubrique 2, et il supprime une condition d'arrêt qui
fonctionne. Il élargirait la surface de sécurité Production sans contrepartie
de mesure.

Le §15.8 avait tort sur un point et il est corrigé ici : il exigeait « une
identité détenant `SELECT` sur les deux tables — c'est-à-dire **pas**
`nexus_prod_readonly_login` en l'état ». C'est faux. L'identité en l'état
suffit, pourvu que la requête lise `pg_catalog` et non `information_schema`.

Si Frédéric veut malgré tout accorder le `SELECT`, le geste reste celui du
§15.8 voie 2, assorti de sa révocation — mais il ne doit alors **pas** servir à
renseigner la rubrique 2, dont le `0` serait trompeur.

**Je ne peux pas exécuter ce `grant` moi-même**, et ce n'est pas une préférence :
le rôle de lecture a été mesuré le 11/09 incapable de modifier quoi que ce soit
(`must be owner of table`), et l'accès à la base Production depuis cette session
est refusé au niveau du harnais, motif `[Production Reads]`. Ce refus porte sur
le résultat, pas sur la commande : il ne se contourne ni par un autre outil, ni
par un sous-agent, ni par un tour ultérieur.

### 16.5 La lecture AVANT, en un seul bloc, sans aucun `grant`

À exécuter par Frédéric sous `nexus_prod_readonly_login`, sur la base
Production `uzhjpqpctpvxytxpxoqz`. Remplace intégralement le §10 et le §15.8.

```sql
select 1 as ordre, 'contexte' as rubrique,
       'identite=' || current_user || ' base=' || current_database()
         || ' moteur=' || current_setting('server_version')
         || ' le=' || now()::timestamptz(0)::text as detail
union all
select 1, 'contexte',
       'table presente : ' || c.relname
         || ' (rls=' || c.relrowsecurity || ')'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
union all
select 2, 'volume',
       c.relname || ' : ~' || coalesce(s.n_live_tup, -1) || ' lignes vivantes, '
         || pg_size_pretty(pg_total_relation_size(c.oid))
         || ', reltuples=' || c.reltuples
         || ', analyse=' || coalesce(greatest(s.last_analyze, s.last_autoanalyze)::text, 'jamais')
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
union all
select 3, 'colonne',
       c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
         || case when a.attnotnull then ' NOT NULL' else ' NULL' end
         || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '')
  from pg_attribute a
  join pg_class     c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
   and a.attnum > 0 and not a.attisdropped
   and a.attname in ('mode_saisie','regularisation_motif','regularisation_par',
                     'regularisation_par_nom','regularisation_le',
                     'controle_terrain_par','justificatif_url','source')
union all
select 4, 'contrainte',
       c.relname || ' : ' || k.conname || ' — ' || pg_get_constraintdef(k.oid)
  from pg_constraint k
  join pg_class     c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
   and k.conname in ('carburant_reception_mesures_mode_saisie_check',
                     'carburant_reception_visites_source_check')
union all
select 5, 'fonction',
       p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
         || ' secdef=' || p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'nexus_garde_regularisation_reception'
union all
select 6, 'trigger', c.relname || ' : ' || t.tgname
  from pg_trigger t
  join pg_class     c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
   and not t.tgisinternal
   and t.tgname like '%regularisation%'
order by ordre, detail;
```

**Lecture attendue** si la migration `20260919103000` n'est pas appliquée :
rubrique 1 renseignée (identité + les **deux** tables présentes), rubrique 2
renseignée, **rubriques 3, 4, 5 et 6 vides**.

### 16.6 Conditions d'arrêt — remplacent celles du §10

| lecture | décision |
|---|---|
| rubrique 1 ne nomme pas l'identité | **STOP.** Lecture non attribuée, donc non recevable. |
| rubrique 1 ne liste pas les **deux** tables | **STOP.** Une rubrique 3 vide ne dirait alors rien sur les colonnes. |
| toute rubrique 3, 4, 5 ou 6 **non vide** | **STOP.** L'objet existe déjà : comparer les définitions avant toute idempotence. |
| rubrique 2 : `n_live_tup` négatif, ou `analyse = jamais` **et** taille > 100 Mo | **STOP.** Volume non établi. |
| rubrique 2 : plus de 1 M lignes vivantes sur l'une des tables | **STOP.** Arbitrage de fenêtre. |
| moteur Production ≠ celui mesuré sur Test (17.6) | **STOP.** La contradiction du §15.3 doit être tranchée, pas contournée. |
| la lecture échoue, ou une rubrique ne rend rien **sans** que la rubrique 1 soit renseignée | **STOP.** État inconnu = refus fermé. |

Un `0` à la rubrique 2 n'est **pas** une lecture valide de volume si l'identité
détient `SELECT` : ce serait la RLS, pas la table. C'est la raison pour
laquelle la rubrique 2 se lit par `n_live_tup` et jamais par `count(*)`.

### 16.7 Verdict — inchangé

`NO_GO_MIGRATION_PRODUCTION` est **maintenu**. Aucune mesure de ce §16 ne porte
sur l'état réel de Production : toutes ont été prises en conteneur jetable, sur
une fixture. Elles établissent ce que la lecture vaut, pas ce qu'elle rendra.

Le verdict basculera sur la seule lecture du §16.5, jouée sur Production, par
Frédéric. Rubriques 3 à 6 vides avec rubrique 1 renseignée →
`PRET_POUR_MIGRATION_PRODUCTION`.

Aucune écriture Supabase Production n'a été lancée. Aucune lecture Production
n'a été lancée. Aucun `grant` n'a été appliqué. #65 n'est pas fusionnée.
Production n'est pas déployée. Aucune garde n'a été affaiblie.

## 17. Dossier d'application — 01/10/2026

GO reçu de Frédéric : « go migration ». Section ajoutée, rien de réécrit.

### 17.1 Ce que le GO lève, et ce qu'il ne lève pas

Il lève l'interdit portant sur la migration Supabase Production, et lui seul.
Restent interdits sans GO distinct : la fusion de #65, le déploiement Pages,
toute modification de données Production, Pages/DNS/secrets/règles GitHub.

Le motif unique du `NO_GO` tenait debout : **la lecture AVANT n'a jamais été
jouée sur Production.** Ce n'est pas une formalité. La migration est
idempotente ; si un des 13 objets existe déjà avec une définition divergente,
elle passera dessus **sans rien dire**, et le `commit` sera frappé sur un
total conforme. L'idempotence ne rend pas l'état inconnu sûr, elle le rend
muet. La lecture AVANT est donc l'étape 1 de l'application, pas un préalable
qui la retarde : les trois étapes ci-dessous s'enchaînent en une seule séance.

### 17.2 Par quel chemin une migration atteint Production — mesuré

Aucune automatisation n'applique de SQL à Production.
`.github/workflows/deploiement-production.yml` publie un artefact GitHub Pages
et **exclut explicitement** `supabase/`, le SQL, `docs/` et `outils/` de cet
artefact. Un balayage de `db push|migration up|psql.*migrations|apply_migration`
sur `.github/`, `outils/` et `docs/deploiement/` ne rencontre **que le présent
document**. Conforme à ce qui était déjà su : seul le connecteur écrit en
Production.

L'application est donc un **geste manuel**, la voie 2 du §9 — transaction
explicite puis inscription de l'estampille — seule voie permettant de poser un
`lock_timeout` et des contrôles avant `commit`.

### 17.3 Quatre défauts dans les blocs d'application, relevés avant de les livrer

Les blocs des §11 et §16.5 n'avaient jamais été relus comme un geste à frapper.
Relus à ce titre, ils portent quatre défauts. Le premier est le mien, écrit
hier dans la correction même qui devait fermer ce genre de trou.

**D1 — §16.5, rubrique 4 : deux noms de contraintes croisés, un troisième
absent.** Le bloc interroge `carburant_reception_mesures_mode_saisie_check` et
`carburant_reception_visites_source_check`. Ces deux noms **n'existent pas** :
les préfixes de table ont été intervertis. Les noms réels, extraits de la
migration auditée, sont `carburant_reception_visites_mode_saisie_check`,
`carburant_reception_visites_regularisation_coherente_check` et
`carburant_reception_mesures_source_check` — le troisième n'était pas
interrogé du tout. Conséquence : **la rubrique 4 revient vide quoi qu'il
arrive**, y compris si les trois contraintes sont déjà en place. Or le §16.6
lit une rubrique 4 vide comme un feu vert. Le défaut penche vers le GO, comme
les deux précédents du §15 et du §16 — troisième occurrence du même biais.

**D2 — §11, le « témoin de non-régression » est une tautologie.** Le contrôle
`select 'temps_reel' is distinct from 'regularisation'` ne compare que deux
littéraux. Il ne référence ni `pg_trigger`, ni la fonction, ni la table. Il
rend `true` que le trigger existe, soit absent, soit cassé. Il figure pourtant
dans le critère de validation « 8 / 3 / 1 / **true** » : ce `true` est gratuit.
Une garde qui ne peut pas rougir ne garde rien.

**D3 — §11 ne mesure que 12 des 13 objets.** Les trois `count(*)` couvrent 8
colonnes, 3 contraintes et 1 trigger. **La fonction
`nexus_garde_regularisation_reception` — objet n° 13 — n'est contrôlée par
aucun des quatre contrôles avant `commit`.** Elle ne l'est qu'au §12, après.

**D4 — §11 lit `information_schema.columns`, et ne nomme pas qui lit.** Dans
ce contexte précis l'identité qui vient de frapper le `alter table` détient les
privilèges, donc la lecture rendra 8 : ce n'est pas un faux négatif ici. C'est
une fragilité — un contrôle dont le résultat dépend d'un privilège alors que le
fait mesuré n'en dépend pas — et une incohérence avec la règle posée au §16.
Corrigé par durcissement, et `current_user` ajouté pour que la lecture soit
attribuable.

### 17.4 Étape 1 — lecture AVANT, corrigée (D1), et qui fait office de porte

Le §16.5 s'applique **avec sa rubrique 4 remplacée** par celle-ci. Le reste du
bloc est inchangé.

```sql
union all
select 4, 'contrainte',
       c.relname || ' : ' || k.conname || ' — ' || pg_get_constraintdef(k.oid)
  from pg_constraint k
  join pg_class     c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
   and k.conname in ('carburant_reception_visites_mode_saisie_check',
                     'carburant_reception_visites_regularisation_coherente_check',
                     'carburant_reception_mesures_source_check')
```

Conditions d'arrêt : celles du §16.6, inchangées. Porte de passage :
**rubrique 1 renseignée avec les deux tables, rubriques 3, 4, 5 et 6 vides.**
Toute autre lecture → arrêt, et le GO n'est pas consommé.

### 17.5 Étape 2 — la transaction du §11, avec ses quatre contrôles refaits

Corps inchangé : le fichier audité au SHA `5dcdaaa55f5804f88594c91c272439cf77a123b0`
(blob sha256 `1a02adca37af32b6ea3ffa3ec41b43968502d75bd515877b47e1d4073a8d6caf`),
sans la moindre retouche, puis l'inscription de l'estampille. Seuls les
contrôles avant `commit` changent.

```sql
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- >>> contenu intégral du fichier audité, inchangé  (cf. §11)
-- >>> puis l'insert dans supabase_migrations.schema_migrations  (cf. §11)

-- Contrôle 0 — qui frappe. Une lecture non attribuée n'est pas recevable.
select current_user as identite, current_database() as base,
       current_setting('server_version') as moteur;

-- Contrôle 1 — 8 colonnes, par pg_attribute (D4). Indépendant des privilèges.
select count(*) as colonnes_attendues_8
  from pg_attribute a
  join pg_class     c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and a.attnum > 0 and not a.attisdropped
   and ( (c.relname = 'carburant_reception_visites'
          and a.attname in ('mode_saisie','regularisation_motif','regularisation_par',
                            'regularisation_par_nom','regularisation_le',
                            'controle_terrain_par','justificatif_url'))
      or (c.relname = 'carburant_reception_mesures' and a.attname = 'source') );

-- Contrôle 2 — 3 contraintes, qualifiées par leur table (même soin qu'en D1).
select count(*) as contraintes_attendues_3
  from pg_constraint k
  join pg_class     c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('carburant_reception_visites','carburant_reception_mesures')
   and k.conname in ('carburant_reception_visites_mode_saisie_check',
                     'carburant_reception_visites_regularisation_coherente_check',
                     'carburant_reception_mesures_source_check');

-- Contrôle 3 — le trigger ET la fonction qu'il appelle (D2 + D3).
-- Remplace la tautologie. Rend 0 ligne si le trigger manque ; rend false si
-- le trigger est désactivé, si la fonction n'est pas security definer, ou si
-- son search_path n'est pas figé. Ce contrôle peut rougir.
select t.tgenabled = 'O'                         as trigger_actif,
       p.prosecdef                               as fonction_security_definer,
       p.proconfig @> array['search_path=public'] as search_path_fige,
       p.proname                                 as fonction_appelee
  from pg_trigger   t
  join pg_class     c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc      p on p.oid = t.tgfoid
 where n.nspname = 'public'
   and c.relname = 'carburant_reception_visites'
   and t.tgname  = 'trg_garde_regularisation_reception'
   and not t.tgisinternal;

-- commit;   <- seulement si : 8 / 3 / une ligne portant t,t,t,
--                             nexus_garde_regularisation_reception
-- rollback; <- dans tous les autres cas, sans exception
```

**`lock_timeout = '3s'` reste une proposition à ratifier**, pas la citation
d'une règle NEXUS : le dépôt n'en fixe aucun (§11). Le ratifier ou le changer
est un arbitrage de Frédéric, pas un défaut à corriger.

**Ce que le contrôle 3 ne fait toujours pas.** Il prouve le câblage, pas le
comportement : il n'établit pas qu'une réception nominale passe la garde. Le
seul témoin comportemental véritable est l'insertion d'une ligne
`temps_reel` nominale sous `savepoint`, suivie d'un `rollback to savepoint`.
Il exige de connaître les colonnes `not null` de la table, et doit être
**répété sur Test avant d'être frappé sur Production** — jamais improvisé là.
Préparé, non livré ici : l'écrire à l'aveugle serait refaire D2 sous une
forme plus crédible.

### 17.6 Étape 3 — lecture APRÈS

Le §12, inchangé, rejoué sous la même identité. L'ACL qui en ressort est la
dette du §8 : la retrouver telle quelle confirme l'effet habituel de la
migration, elle n'est pas la cible souhaitée. Sa correction
(`revoke all on function … from anon, authenticated`) reste un geste distinct,
qui ne passe **jamais** par une modification de `20260919103000`.

Retour arrière : §13, réel et sans perte tant qu'aucune ligne
`regularisation` n'existe — donc pendant toute la fenêtre entre cette
migration et le déploiement du code #65.

### 17.7 Ce que je ne peux pas faire, et pourquoi je ne le contourne pas

Je ne peux exécuter aucune des trois étapes. Je ne détiens aucun identifiant
d'écriture sur la base Production ; le rôle de lecture a été mesuré
`must be owner of table` ; et l'accès en lecture à Production m'est refusé par
le harnais. Ce refus porte sur **le résultat**, pas sur la commande : il ne se
contourne ni par un autre outil, ni par le serveur MCP Supabase — dont
`apply_migration` et `execute_sql` restent non utilisés — ni par un
sous-agent, ni par un tour ultérieur. Les trois étapes sont des gestes de
Frédéric.

### 17.8 Verdict

`GO_CONDITIONNEL_A_LA_LECTURE_AVANT`.

Le GO de Frédéric est enregistré et le geste est prêt, blocs corrigés. Il se
consomme en une séance : étape 1, et si la porte du §17.4 s'ouvre — rubrique 1
renseignée, rubriques 3 à 6 vides — étapes 2 et 3 enchaînent sans nouvelle
autorisation. Si la porte ne s'ouvre pas, le GO n'est pas consommé et l'écart
constaté revient en arbitrage.

Aucune écriture Supabase Production n'a été lancée. Aucune lecture Production
n'a été lancée. Aucun `grant` n'a été appliqué. #65 n'est pas fusionnée.
Production n'est pas déployée. Aucune garde n'a été affaiblie.
