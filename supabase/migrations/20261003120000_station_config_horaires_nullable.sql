-- Mandat 55 — `station_config.horaires` : la contrainte qui faisait écrire
-- quinze écrans. Suite directe de 20261002000000 (fuseau_horaire), MÊME
-- MÉCANISME, cause différente.
--
-- MÉCANISME (mesuré sur nexus-test le 02/10/2026, puis en conteneur jetable le
-- 03/10/2026 — jamais déduit) : `INSERT ... ON CONFLICT (site) DO UPDATE`
-- construit et VALIDE la ligne proposée — colonnes absentes remplies par leur
-- défaut, ou NULL faute de défaut — AVANT de chercher le conflit. Une colonne
-- `NOT NULL` sans défaut rend donc la table NON UPSERTABLE, **même quand la
-- ligne existe déjà pour ce site**. Ce n'est pas « seulement les sites neufs ».
--
-- ÉTAT AVANT : `horaires jsonb NOT NULL`, sans défaut, depuis le DDL d'origine
-- (20260101000000 baseline, ligne 1003). Aucune migration ne l'a jamais altérée
-- — la contrainte est celle du premier jour, pas une dérive.
--
-- CE QUE LA CONTRAINTE A PRODUIT CÔTÉ ÉCRANS : QUINZE upserts `station_config`
-- existent dans le dépôt, et LES QUINZE transportent un payload `horaires`
-- (comptés par l'instrument du dépôt lui-même — `fichiersAvecUpsertStationConfig`
-- + `appelsUpsertStationConfig` de outils/schema-station-config.js — et non à la
-- main : un premier comptage manuel avait annoncé dix-sept en dédoublant deux
-- paires de lignes adjacentes). UN SEUL le possède légitimement :
-- NEXUS-Parametres-Station-v1.html:1391, `horaires: config`, l'enregistrement
-- des horaires lui-même. Les QUATORZE autres — raccourcis, pointage_actif,
-- manager_pointage_requis,
-- jaugeage, prix carburants, réception, consignes, contact manager, google
-- sheet — joignent une donnée qui ne leur appartient pas, uniquement pour
-- satisfaire la contrainte (onze via la variable `horairesUpsert`, deux via une
-- relecture `existant`, un via `chargerHorairesPourUpsert()` dans App).
-- S'y ajoutent deux `alert()` de quatre lignes, deux
-- gardes à retour anticipé (`horairesObligatoires()`,
-- `chargerHorairesPourUpsert()`) et une relecture de la base avant chaque
-- écriture. Tout cet appareillage n'existe que pour cette contrainte.
--
-- POURQUOI NULL EST LE BON ÉTAT, et non un défaut : le moteur unique des
-- horaires tolère déjà l'absence PAR CONCEPTION. `calculer_horaires_quart`
-- (20260919160000, lignes 120-122) fait `select sc.horaires into v_horaires
-- ... ; if v_horaires is null then return; -- site inconnu ou sans horaires :
-- rien à dire.` C'est l'arbitrage b1 de Frédéric Bragance du 19/09/2026 :
-- INVENTER une valeur était le défaut, s'abstenir est le contrat. Un `DEFAULT`
-- ici réintroduirait exactement ce que cet arbitrage a supprimé — et les
-- horaires d'une station ne se devinent pas depuis une autre.
--
-- `DROP NOT NULL` N'EFFACE RIEN : `DO UPDATE` n'affecte que les colonnes
-- citées, donc les horaires déjà enregistrés d'un site survivent à un upsert
-- de prix qui ne les mentionne pas. Mesuré (section I de l'épreuve conteneur).

alter table public.station_config alter column horaires drop not null;

comment on column public.station_config.horaires is
  'Source CANONIQUE des horaires du site (contrat 20260919160000 : Paramètres '
  'Station = horaires de référence ; Planning = affectation réelle ; Pointage = '
  'heure constatée ; retard = rapprochement des trois). NULLABLE depuis le '
  '03/10/2026 : la contrainte NOT NULL sans défaut rendait la table non '
  'upsertable (ON CONFLICT valide la ligne proposée avant de détecter le '
  'conflit), ce qui obligeait quinze écrans sans rapport à transporter un '
  'payload d''horaires. NULL se lit « ce commerce n''a pas encore déclaré ses '
  'horaires » et le moteur unique le gère déjà (calculer_horaires_quart '
  'retourne zéro ligne). NE JAMAIS ajouter de DEFAULT : inventer des horaires '
  'est précisément le défaut que l''arbitrage b1 du 19/09/2026 a supprimé.';

-- `site` N'EST PAS TOUCHÉE, ET C'EST DÉLIBÉRÉ.
--
-- `site` apparaît elle aussi comme « NOT NULL sans défaut » — et c'est ainsi
-- qu'un verdict du 03/10/2026 l'a d'abord classée « même famille de défaut ».
-- C'était FAUX. `site` est `station_config_pkey PRIMARY KEY ("site")`
-- (baseline, lignes 1281-1282) : son NOT NULL est celui de la clé primaire,
-- l'absence de défaut est correcte (une identité se fournit, elle ne se
-- devine pas), et PostgreSQL REFUSE physiquement le `DROP NOT NULL`
-- (« column "site" is in a primary key » — mesuré en conteneur jetable le
-- 03/10/2026). L'y forcer, si c'était possible, détruirait la détection de
-- conflit dont tous les upserts de cette table dépendent.
--
-- LE DÉFAUT DE MESURE À RETENIR : un prédicat `attnotnull and not atthasdef`
-- ne distingue PAS une clé primaire d'une contrainte résiduelle. Il faut
-- joindre `pg_constraint` (contype = 'p'). La bonne correction pour `site`
-- n'est pas une migration mais une garde d'appelant — « tout upsert
-- station_config fournit site » — aujourd'hui vraie 15 fois sur 15, et
-- désormais mesurée par
-- test_station_config_horaires_nullable_et_site_pk_20261003.js.
