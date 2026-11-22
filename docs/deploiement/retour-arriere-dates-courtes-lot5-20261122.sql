-- Retour arrière du lot 5 Dates courtes (Prévention des pertes). Ne touche à aucune table du lot 1.
begin;
drop trigger if exists dates_courtes_capture_prix on dates_courtes_demarques;
drop function if exists dates_courtes_prevention_pertes(timestamptz);
drop function if exists dates_courtes_nature_fiscale(text, date);
drop function if exists dates_courtes_capturer_prix_demarque();
drop function if exists dates_courtes_prix_article(text, text, text, date);
drop table if exists dates_courtes_prix_demarques;
commit;
