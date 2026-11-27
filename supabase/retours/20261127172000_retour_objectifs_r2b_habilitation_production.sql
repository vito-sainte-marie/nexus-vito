-- Retour arrière de 20261127172000 (R2b).
-- Retire exactement les lignes posées par la migration : droit « valider » de la
-- station vito-sainte-marie dont accorde_par est nul (marque « migration »).
-- Les habilitations accordées par la RPC (accorde_par renseigné) ne sont pas
-- touchées. Aucun identifiant n'est écrit ici.
delete from public.objectif_habilitation
where site = 'vito-sainte-marie'
  and droit = 'valider'
  and accorde_par is null;
