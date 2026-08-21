-- Migration Supabase appliquee (projet uzhjpqpctpvxytxpxoqz) le 21/08/2026 :
-- fdj_cash_controls_verdict_a_regulariser
-- Ajoute 'a_regulariser' aux CHECK constraints existantes (aucune valeur
-- historique retiree) pour permettre le nouveau verdict "Ecart a regulariser".

alter table public.fdj_cash_controls drop constraint fdj_cash_controls_resultat_controle_check;
alter table public.fdj_cash_controls add constraint fdj_cash_controls_resultat_controle_check
  check (resultat_controle is null or resultat_controle = any (array['conforme','avec_ecart','a_revoir','non_comparable','a_regulariser']));

alter table public.fdj_cash_controls drop constraint fdj_cash_controls_statut_check;
alter table public.fdj_cash_controls add constraint fdj_cash_controls_statut_check
  check (statut = any (array['provisoire','a_controler','en_attente','expliquee','regularise','valide_avec_ecart','conforme','a_regulariser']));
