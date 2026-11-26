-- Retour arrière de l'étape 5 (décisions du gérant). Test seulement. Ne touche à aucun compte ni au journal.
do $r$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'nexus-connexion-purge';
  end if;
end $r$;
drop function if exists nexus_connexion.alerte_indisponible_pour(uuid);
drop function if exists nexus_connexion.code_temporaire_expire(uuid);
alter table nexus_connexion.parametres alter column retention_journal_j set default 90;
update nexus_connexion.parametres set retention_journal_j = 90 where id = 1 and retention_journal_j = 180;
-- poser_code : rétablir la définition de 20261126120000 (sans échéance de 24 h).
