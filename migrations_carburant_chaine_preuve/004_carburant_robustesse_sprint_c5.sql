-- Sprint C5 "Robustesse serveur" (audit Carburants — chaîne de preuve,
-- 17/08/2026) : "Écriture résiliente : pending/error, retry, RLS strict"
-- (critère de sortie §16), couvrant §12 "Atomicité / idempotence / RLS".
--
-- Applique la même discipline pending/error/retry déjà en place côté FDJ
-- (fdj_shifts.releve_cloture_statut) à deux points d'écriture Carburants
-- où l'audit a identifié un vrai gap :
--
-- 1) carburant_reception_visites n'admettait que les statuts finaux
--    ('terminee', 'terminee_avec_derogation'). soumettreVisiteComplete()
--    (nexus-reception-donnees.js) posait donc directement un statut final
--    à l'insertion de l'en-tête, puis tentait un DELETE de nettoyage en cas
--    d'échec d'un insert intermédiaire (lignes/compartiments/mesures) —
--    or carburant_reception_visites n'a AUCUNE politique RLS DELETE : ce
--    nettoyage échouait toujours silencieusement, laissant potentiellement
--    une en-tête à statut FINAL mais orpheline (sans ses lignes), invisible
--    comme telle.
--    Fix applicatif (Sprint C5) : écriture en deux phases — l'en-tête est
--    toujours insérée en 'en_cours' d'abord, le statut final n'est posé
--    qu'après le succès complet des sous-tables. chargerDerniereVisite() et
--    chargerHistoriqueVisites() excluent désormais 'en_cours'.
--
-- 2) carburant_releves n'avait aucune colonne pour savoir si la dernière
--    tentative d'écriture de carburant_controles (contrôle du jour, direct
--    ou via recalcul en cascade) avait réussi — un échec silencieux
--    (ex. coupure réseau côté enregistrerControleDate) rendait le contrôle
--    manquant sans que rien ne soit interrogeable pour le détecter/relancer.
--    Fix applicatif (Sprint C5) : carburant_releves.controle_statut
--    ('en_attente' / 'ok' / 'erreur'), posé par majControleStatutReleve()
--    après chaque tentative (enregistrerControlesCarburant et
--    reconstruireControlesSuivants). Le panneau manager de retry consommant
--    ce statut ('erreur') est le sujet du Sprint C6 "Pilotage" (même
--    séparation que le Sprint C2, dont le Data Dictionary notait déjà
--    qu'aucun écran ne relisait ses contrôles).
--
-- Article 11 ("une seule vérité") : ce sprint reste volontairement dans le
-- modèle pending/error/retry déjà validé côté FDJ plutôt que de construire
-- une RPC plpgsql transactionnelle, qui aurait exigé de porter la logique
-- de calcul/qualité de chaîne (nexus-carburant-moteur.js) en SQL — l'audit
-- §12 offre explicitement les deux mécanismes comme équivalents pour
-- l'atomicité.
--
-- controleInchange() (nexus-carburant-moteur.js, Sprint C5) complète ce
-- sprint côté moteur pur : un recalcul en cascade relancé deux fois sur un
-- contenu identique ne pose plus de version carburant_controles redondante
-- (scénario de test C16 de l'audit).

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
