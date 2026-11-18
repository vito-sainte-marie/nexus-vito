-- Retour arrière de 20261117161325_tarif_decision_journal.sql : ne retire que ses propres objets. Ordre de retrait : 6, 5, 4, 3, 2, 1 (jamais l'inverse).
-- Perd le lien prix_decide_id des décisions déjà enregistrées par la fonction : exporter avant (select id, site, prix_decide_id from tarif_decisions where prix_decide_id is not null).
-- Prérequis : la migration 20261118120000 doit être retirée avant (elle appelle tarif_enregistrer_decisions).
select id, site, prix_decide_id from tarif_decisions where prix_decide_id is not null;
begin;
drop function if exists tarif_enregistrer_decisions(jsonb);
drop trigger if exists tarif_decisions_lien on tarif_decisions;
drop function if exists tarif_controle_decision_lien();
drop index if exists tarif_decisions_prix_decide_uq;
alter table tarif_decisions drop constraint if exists tarif_decisions_prix_meme_site_fk;
alter table tarif_decisions drop column if exists prix_decide_id;
commit;
