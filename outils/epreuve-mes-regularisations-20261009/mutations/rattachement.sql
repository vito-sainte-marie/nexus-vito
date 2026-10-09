-- Rend tout versement Verify, rattaché ou non. Rougit : ANONYME, RATTACHEMENT.
select pg_temp.muter('public.mes_regularisations', 'and (v.audit_id, v.caisse_origine) in (select audit_id, poste from postes))', 'and true)');
