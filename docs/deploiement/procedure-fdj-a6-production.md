# Procédure — 20261011090000, A6 : écriture directe fermée sur `fdj_releves_cloture`, `fdj_reports` et `fdj_audit_log` (Production)

**Statut : non exécutée.** Projet `uzhjpqpctpvxytxpxoqz`.
Fichier : `supabase/migrations/20261011090000_fdj_a6_ecriture_directe_releves_reports_audit_fermee.sql`, blob git `b6b021c866f8d90ee72ba423fb1768a57cc2222d`, md5 du texte `691faf6ad9f399526b1a08104cd79b67`, 20672 octets.

Ne jamais citer ces empreintes de mémoire : les recalculer depuis le commit fusionné (`git rev-parse <sha>:<chemin>`, `git show <sha>:<chemin> | md5`). Une retouche de la migration change le blob et fait tomber la qualification.

## Le défaut

`anon` et `authenticated` détiennent `arwdDxtm` sur les trois tables (mesuré en Production le 11/10/2026 à 02:58:48Z). Les policies RLS ne filtrent que le site :
- tout compte authentifié du site peut insérer, modifier ou supprimer une ligne du journal d'audit, ou un relevé de clôture ;
- `TRUNCATE`, qui ignore la RLS, vide les trois tables, pour `anon` comme pour `authenticated`.

Le journal d'audit est donc falsifiable.

## Pourquoi une procédure

Aucun ordre n'est sans rupture.

- **Migration d'abord** : l'écran Manager servi écrit directement dans les trois tables. Les lieux concernés :
  - le journal d'audit : création, correction, dérogation, inventaire de référence, réconciliations automatiques, propagation ;
  - les relevés de clôture : régularisation, recalcul, reprise de relevé manquant ;
  - les rapports de l'étape 3.

  Après le revoke, chacune de ces écritures échoue en `42501`.
- **Code d'abord** : l'écran du candidat appelle quatre RPC absentes de Production. Chaque appel échoue en `PGRST202` :
  - `fdj_manager_journaliser` ;
  - `fdj_journaliser_ouverture_validee`, depuis l'écran employé, en appel non bloquant ;
  - `fdj_manager_poser_releve_cloture` ;
  - `fdj_manager_enregistrer_rapports`.

Dans les deux sens, l'échec est franc, sans écriture partielle. Ordre retenu : **code d'abord, migration aussitôt après**, hors des changements de quart.

Prérequis constatés en Production, tous livrés par 20261010150000 (registre 306) :
- `fdj_quart_du_manager(uuid)` ;
- `fdj_site_du_manager()` ;
- `fdj_quart_ouvert_de_l_employe(uuid)`.

## Préflight (lecture seule, rejoué juste avant d'écrire)

Connecteur `execute_sql`, sous la forme `begin read only; … ; rollback;`. Chaque valeur doit être égale à la mesure. Tout écart arrête la procédure.

1. Registre : `count(*) = 306` et `max(version) = '20261010150000'`, avec `20261011090000` absente.
2. Aucune des quatre fonctions A6 n'existe dans `pg_proc`.
3. Les trois tables ont pour `relacl` `{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`.
4. `fdj_synchroniser_releves_courants(text)` a pour ACL `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.
5. Les trois prérequis ci-dessus sont présents et `security definer`.
6. Les décomptes de lignes (`fdj_releves_cloture`, `fdj_reports`, `fdj_audit_log`) sont relevés pour comparaison. Le 11/10 à 02:58Z : 191 / 260 / 619.

## Gestes (chacun sur GO distinct de Frédéric)

1. **Fusion** de la PR vers `production`.
2. **Déploiement constaté** : relire les fichiers servis `NEXUS-FDJ-Manager-v1.html` et `NEXUS-FDJ-v1.html`, puis comparer leur sha256 à celui des fichiers du commit fusionné. Un 200 ne suffit pas.
3. **Préflight**, ci-dessus.
4. **Application** par `execute_sql`, jamais par `apply_migration`, qui réestampille la version. Une seule transaction :
   - un bloc `DO` gardé vérifie le registre exact (306), la version absente et le md5 du texte transmis (`691faf6a…`) ;
   - puis `execute` du texte ;
   - puis l'insertion de la ligne `20261011090000 fdj_a6_ecriture_directe_releves_reports_audit_fermee` au registre.
5. **Constat** en lecture seule :
   - les quatre fonctions sont `security definer`, avec `search_path=""` et l'ACL `{postgres=X, authenticated=X, service_role=X}` ;
   - les trois tables ont `{postgres=arwdDxtm, authenticated=r, service_role=arwdDxtm}`. `anon` n'y a plus rien, `MAINTAIN` compris ;
   - le registre vaut 307 ;
   - les décomptes de lignes sont inchangés.
6. **Recette navigateur**, sur désignation de Frédéric pour tout bouton qui écrit :
   - côté manager : création de quart, correction de caisse, saisie des rapports, alignement Q1/Q2 ;
   - côté employé : clôture.

   On constate ensuite la ligne d'audit écrite par le serveur : `acteur_id` porte le manager, sauf pour les trois actions automatiques, et `metadata.via` vaut `fdj_manager_journaliser`.

## Retour arrière (sur GO distinct)

Une transaction :
1. `grant select, insert, update, delete, truncate, references, trigger, maintain on public.fdj_releves_cloture, public.fdj_reports, public.fdj_audit_log to anon, authenticated;`. Ce sont les privilèges mesurés avant ; ils rouvrent le défaut.
2. `drop function` des quatre fonctions A6, signatures exactes :
   - `fdj_manager_journaliser(uuid,text,uuid,text,text,jsonb,jsonb)` ;
   - `fdj_journaliser_ouverture_validee(uuid,jsonb)` ;
   - `fdj_manager_poser_releve_cloture(uuid,jsonb)` ;
   - `fdj_manager_enregistrer_rapports(uuid,numeric,numeric)`.
3. `fdj_synchroniser_releves_courants(text)` n'a rien à restaurer en Production : son ACL n'y comportait déjà ni `anon` ni `PUBLIC`.
4. Suppression de la ligne `20261011090000` du registre.

Les écrans du candidat ne fonctionnent plus après ce retour arrière. Il s'accompagne donc du retour des écrans : revert de la PR et déploiement constaté.

## Ce que le lot ne couvre pas

- **A5.** Les autres tables `fdj_*` restent écrivables en direct, notamment `fdj_alertes` et `fdj_corrections`. Cela relève du lot suivant. L'épreuve sur Test n'a trouvé aucun contournement d'A6 par ces tables.
- **Le snapshot.** Il reste calculé par l'écran : le serveur fixe l'identité (site, date, quart, employé, auteur, horodatage) et la séquence des versions, pas les montants.
- **Les policies.** Celles d'écriture sur les trois tables deviennent inertes, faute de privilège. Elles ne sont pas supprimées dans ce lot.
