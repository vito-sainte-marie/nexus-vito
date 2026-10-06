-- Base qui a dérivé : la contrainte n'est plus celle attendue. La migration
-- doit refuser et ne rien changer.
alter table public.invoices drop constraint invoices_methode_identification_check;
alter table public.invoices add constraint invoices_methode_identification_check
  check (methode_identification = any (array['siret'::text, 'email'::text, 'manuel'::text, 'code_client'::text, 'raison_sociale'::text, 'contenu'::text, 'historique'::text, 'nom_decenium'::text, 'autre'::text]));
