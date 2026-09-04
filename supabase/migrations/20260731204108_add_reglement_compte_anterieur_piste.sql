-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260731204108 · add_reglement_compte_anterieur_piste
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table audits_caisse
  add column if not exists reglement_compte_anterieur_piste numeric not null default 0;

comment on column audits_caisse.reglement_compte_anterieur_piste is
  'Argent recu ce quart pour solder une facture client PISTE d''un mois anterieur (ex: facture de juillet reglee en aout), symetrique a reglement_compte_anterieur_boutique. N''apparait pas dans vente_piste (deja comptabilise un mois precedent) : doit etre ajoute au theorique attendu en caisse piste pour ne pas creer un faux ecart negatif.';
