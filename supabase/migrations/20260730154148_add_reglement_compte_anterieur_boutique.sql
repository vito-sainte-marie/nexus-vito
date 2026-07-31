alter table audits_caisse
  add column if not exists reglement_compte_anterieur_boutique numeric not null default 0;

comment on column audits_caisse.reglement_compte_anterieur_boutique is
  'Argent recu ce quart pour solder une facture client boutique d''un mois anterieur (ex: facture de juillet reglee en aout). A distinguer de clients_compte_boutique, qui concerne une vente a credit du jour meme (deja incluse dans vente_boutique par Decenium). Ce nouveau montant, lui, n''apparait PAS dans vente_boutique puisque la vente correspondante a deja ete comptabilisee un mois precedent - il doit donc etre ajoute au theorique attendu en caisse boutique pour ne pas creer un faux ecart positif.';
