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
