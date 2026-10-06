-- =============================================================================
-- invoices.methode_identification — ajout de la valeur 'nom_decenium'.
-- =============================================================================
--
-- DÉFAUT
-- ------
-- Le worker du dossier surveillé (iMac) identifie désormais un client par sa
-- raison sociale Decenium exacte quand SIRET et e-mail ne désignent pas un
-- compte unique (VERT PRE Leslie / VERT PRE Leslie DIVERS, VETRO Maïté /
-- VETRO Maïté divers : comptes distincts qui partagent un e-mail). Il écrit
-- methode_identification = 'nom_decenium'. Le CHECK inline de 20260807032033
-- n'admet que 7 valeurs : le 06/10/2026, l'INSERT d'une facture VERT PRE
-- Leslie DIVERS est refusé (23514), le fichier est retenté indéfiniment et
-- chaque essai dépose un nouvel objet Storage.
--
-- PORTÉE
-- ------
-- Élargissement seul : les 7 valeurs historiques restent admises, NULL reste
-- admis (colonne nullable, sans défaut). Valeurs utilisées en Production au
-- 06/10/2026 : email, manuel, siret — toutes conservées.
-- Aucune donnée, aucun privilège, aucune fonction, vue, policy ni trigger
-- touché : aucun objet de la base ne lit invoices.methode_identification
-- (les trois fonctions fdj_* qui portent ce nom lisent fdj_stock_movements).
-- Le front (NEXUS-Boite-Reception-v1.html) affiche un libellé pour 'siret'
-- et 'email' seulement ; une autre valeur n'affiche rien, sans erreur.
--
-- GARDE
-- -----
-- La migration refuse de s'appliquer si la contrainte actuelle n'est pas
-- exactement celle de 20260807032033 (7 valeurs) : une base qui a dérivé
-- n'est pas réécrite à l'aveugle. Tout se joue dans une transaction.
--
-- RETOUR ARRIÈRE
-- --------------
-- Possible seulement s'il n'existe aucune ligne 'nom_decenium' :
--   alter table public.invoices drop constraint invoices_methode_identification_check;
--   alter table public.invoices add constraint invoices_methode_identification_check
--     check (methode_identification = any (array['code_client','raison_sociale',
--       'siret','contenu','email','historique','manuel']));
-- =============================================================================

begin;

do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'public.invoices'::regclass
    and conname = 'invoices_methode_identification_check';
  if v_def is distinct from
    'CHECK ((methode_identification = ANY (ARRAY[''code_client''::text, ''raison_sociale''::text, ''siret''::text, ''contenu''::text, ''email''::text, ''historique''::text, ''manuel''::text])))'
  then
    raise exception 'invoices_methode_identification_check inattendue : %', coalesce(v_def, '(absente)');
  end if;
end;
$$;

alter table public.invoices drop constraint invoices_methode_identification_check;
alter table public.invoices add constraint invoices_methode_identification_check
  check (methode_identification = any (array['code_client'::text, 'raison_sociale'::text, 'siret'::text,
    'contenu'::text, 'email'::text, 'historique'::text, 'manuel'::text, 'nom_decenium'::text]));

commit;
