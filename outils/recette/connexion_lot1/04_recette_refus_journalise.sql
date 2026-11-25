-- Preuve étape 2c (Test) : un refus d'auteur laisse une ligne 'auteur_refuse' VALIDÉE (non annulée).
-- Exécuter chaque bloc dans un appel séparé (chacun valide sa transaction). Comptes fictifs uniquement.
-- 1) refus : pompiste Test B sur Employé Test A (deux fonctions), puis auto-action de A sur A.
select nexus_connexion.lever_verrou('868d0b92-bf65-4c99-be43-656911919afd','755a2dc5-3390-4a29-a865-847cbebc1133');
select nexus_connexion.reinitialiser_code('868d0b92-bf65-4c99-be43-656911919afd', extensions.crypt('x', extensions.gen_salt('bf',4)), 1, '755a2dc5-3390-4a29-a865-847cbebc1133');
select nexus_connexion.lever_verrou('868d0b92-bf65-4c99-be43-656911919afd','868d0b92-bf65-4c99-be43-656911919afd');
-- attendu : {"ok":false,"motif":"auteur_refuse"} ×3
-- 2) constat dans un autre appel : 3 lignes auteur_refuse (ids 44, 45, 46 le 24/11)
select id, evenement, detail from nexus_connexion.journal where evenement = 'auteur_refuse' order by id;
-- 3) nettoyage, puis constat 0 ligne restante
delete from nexus_connexion.journal where evenement = 'auteur_refuse' and detail->>'par' in ('755a2dc5-3390-4a29-a865-847cbebc1133','868d0b92-bf65-4c99-be43-656911919afd');
