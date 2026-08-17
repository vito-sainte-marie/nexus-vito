-- Sprint C4 "Réception" (audit Carburants — chaîne de preuve, 17/08/2026) :
-- "Réception clôturable et idempotente" (critère de sortie §16), gap P0
-- identifié §4 "Idempotence livraison" : "Risque d'intégrer deux fois une
-- livraison." et scénario de test C04 du plan d'audit ("Double clic
-- validation livraison → Une seule réception comptabilisée").
--
-- carburant_reception_visites n'avait jusqu'ici aucune clé permettant de
-- distinguer un VRAI second appel (deuxième visite camion) d'un RETRY d'un
-- même geste employé (double-tap, coupure réseau puis nouvel essai) : deux
-- soumissions du même formulaire créaient deux lignes distinctes.
--
-- idempotency_key est généré côté écran UNE SEULE FOIS par visite (au
-- moment de "Démarrons ensemble", jamais régénéré tant que l'employé n'a
-- pas recommencé une nouvelle visite) et envoyé avec chaque tentative de
-- soumission. Un conflit sur cette colonne est traité comme un succès
-- idempotent par nexus-reception-donnees.js::soumettreVisiteComplete,
-- jamais comme une erreur bloquante — même discipline que le traitement du
-- 23505 sur carburant_releve_versions (Sprint C1) et fdj_releves_cloture.
--
-- Index unique PARTIEL (where idempotency_key is not null) plutôt qu'une
-- contrainte unique simple : équivalent en pratique (Postgres traite déjà
-- chaque NULL comme distinct dans une contrainte unique standard), mais la
-- clause explicite documente l'intention pour tout lecteur futur du schéma.
alter table carburant_reception_visites
  add column idempotency_key uuid;

create unique index carburant_reception_visites_idempotency_key_key
  on carburant_reception_visites (idempotency_key)
  where idempotency_key is not null;

comment on column carburant_reception_visites.idempotency_key is
  'Clé générée une fois par visite côté écran (crypto.randomUUID()) — un conflit sur cette colonne est un retry du même geste employé, jamais une nouvelle réception. Sprint C4, audit Carburants (17/08/2026).';
