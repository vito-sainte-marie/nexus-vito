-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817172242 · carburant_robustesse_sprint_c5
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Sprint C5 "Robustesse serveur" (audit Carburants — chaîne de preuve,
-- 17/08/2026), §12 : "Les invariants critiques ne doivent pas dépendre
-- uniquement du JavaScript de l'interface." Critère de sortie §16:
-- "Pas d'état partiel."
--
-- Vérification préalable de l'existant (avant d'ajouter quoi que ce soit) :
-- RLS site_id déjà en place sur toutes les tables carburant_* (select +
-- write scopées site, append-only par absence de policy UPDATE/DELETE sur
-- carburant_releve_versions et carburant_controles), unicité de version déjà
-- garantie par contrainte (site,date,version_num) / (site,date,carburant,
-- version_num), droits déjà corrects (réception : insert ouvert à l'employé
-- du site, update réservé manager/gérant — exactement "l'employé crée/valide
-- ses faits, le manager corrige/qualifie"). Ces garanties ne sont PAS
-- reprises ici, seuls les deux vrais manques trouvés en auditant le code
-- réel sont fermés :
--
-- 1) carburant_reception_visites.statut n'autorisait QUE 'terminee' /
--    'terminee_avec_derogation' — l'écran écrivait donc l'en-tête avec un
--    statut "terminée" AVANT que les lignes/compartiments/mesures ne soient
--    réellement posés. Une interruption entre les deux (coupure réseau,
--    onglet fermé) laissait une visite MENSONGÈREMENT étiquetée "terminée"
--    avec zéro ligne. Le nettoyage best-effort ajouté au Sprint C4
--    (`nettoyer()` = DELETE sur carburant_reception_visites) ne pouvait de
--    toute façon jamais fonctionner : aucune policy RLS DELETE n'existe sur
--    cette table (vérifié — l'append-only était déjà de fait, pas par
--    accident, mais le code ne le savait pas). Nouvel état 'en_cours',
--    valeur par défaut, écrit à la création de l'en-tête ; le statut final
--    n'est posé qu'après le succès complet de la séquence
--    (nexus-reception-donnees.js).
-- 2) carburant_releves n'avait aucune trace de l'état d'écriture de son
--    contrôle du jour (carburant_controles) — une erreur sur
--    enregistrerControleDate() n'était que console.error'ée, invisible et
--    non rejouable. Nouvelle colonne controle_statut (même discipline que
--    fdj_shifts.releve_cloture_statut) : 'en_attente' par défaut, posée à
--    'ok'/'erreur' par l'écran après chaque tentative d'écriture du
--    contrôle — que ce soit l'écriture directe du jour ou une passe du
--    recalcul en cascade (Sprint C3), chaque relevé impacté porte l'état de
--    SON PROPRE contrôle. Une future carte manager (Sprint C6 Pilotage,
--    "relevé de contrôle, historique") pourra lister et rejouer les
--    'erreur' exactement comme le panneau FDJ "Relevés à régulariser".

alter table carburant_reception_visites
  drop constraint carburant_reception_visites_statut_check;
alter table carburant_reception_visites
  add constraint carburant_reception_visites_statut_check
  check (statut = any (array['en_cours', 'terminee', 'terminee_avec_derogation']));
alter table carburant_reception_visites
  alter column statut set default 'en_cours';

comment on column carburant_reception_visites.statut is
  'en_cours = en-tête créée, séquence lignes/compartiments/mesures pas encore confirmée terminée (jamais affiché comme une réception réelle, exclu des lectures Pilotage/historique) ; terminee/terminee_avec_derogation = posé uniquement après succès complet. Sprint C5, audit Carburants (17/08/2026).';

alter table carburant_releves
  add column controle_statut text not null default 'en_attente'
  constraint carburant_releves_controle_statut_check check (controle_statut in ('en_attente', 'ok', 'erreur'));

comment on column carburant_releves.controle_statut is
  'État de la dernière tentative d''écriture du contrôle carburant_controles de CE jour (écriture directe ou passe de recalcul en cascade) — en_attente tant que jamais tenté, ok/erreur après. Même discipline que fdj_shifts.releve_cloture_statut. Sprint C5, audit Carburants (17/08/2026).';
