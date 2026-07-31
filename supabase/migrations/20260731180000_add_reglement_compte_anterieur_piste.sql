alter table audits_caisse
  add column if not exists reglement_compte_anterieur_piste numeric not null default 0;

comment on column audits_caisse.reglement_compte_anterieur_piste is
  'Argent recu ce quart pour solder une facture client PISTE d''un mois anterieur (ex: facture de juillet reglee en aout), symetrique a reglement_compte_anterieur_boutique. N''apparait pas dans vente_piste (deja comptabilise un mois precedent) : doit etre ajoute au theorique attendu en caisse piste pour ne pas creer un faux ecart negatif.';
