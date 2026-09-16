-- =====================================================================
-- P-2 (16/09/2026) — effacer les heures de fin que B1/S-3 ont fabriquées.
--
-- P-1 empêche d'en écrire de nouvelles. Celles déjà en base restent, et
-- elles se lisent comme des mesures de présence :
--
--   Production, 2 lignes — loane 2 j 00 h 24, angelique 13 h 31,
--   zéro pointage l'une comme l'autre.
--   Test,      43 lignes — même signature, jusqu'à 1 j 17 h 07.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--
-- Elle ne calcule aucune heure de remplacement, ne devine rien, ne
-- supprime aucune ligne. Elle remplace une valeur fausse par l'absence
-- de valeur, qui est la vérité : cette fin n'a jamais été enregistrée.
--
-- AUCUNE DONNÉE N'EST PERDUE
--
-- La valeur effacée est exactement `cloture_le` — c'est la signature du
-- défaut : B1 écrivait `heure_fin = NEW.heure_debut` et `cloture_le =
-- now()` dans la même instruction, deux noms pour le même instant.
-- Vérifié avant écriture : 43 lignes sur 43 en Test, 2 sur 2 en
-- Production. `cloture_le` reste intact, donc l'instant où le service a
-- été fermé reste consultable ; seule disparaît la prétention que cet
-- instant soit une heure de fin de travail.
--
-- C'est aussi la garde de ciblage : une ligne dont `heure_fin` DIFFÈRE de
-- `cloture_le` ne vient pas de ce défaut — nous ne savons pas d'où elle
-- vient, donc nous n'y touchons pas, et la migration s'interrompt plutôt
-- que d'écrire en aveugle.
--
-- PÉRIMÈTRE
--
--   statut = 'termine'
--   cloture_source = 'prise_de_poste_suivante'   (le seul chemin fautif)
--   aucun pointage de départ rattaché au service (même critère strict que
--     P-1 : égalité sur service_id, jamais d'approximation)
--   heure_fin = cloture_le                        (la signature)
--
-- Les clôtures par `pointage_depart` (S-2) reposent sur un départ
-- réellement pointé : hors périmètre. Les `systeme_legacy` (S-1) et les
-- `manager` (régularisation du 16/09) portent déjà `heure_fin` NULL.
--
-- Ni `cloture_source` ni `cloture_le` ni `cloture_par` ne sont modifiés :
-- la clôture a bien eu lieu, à cet instant, par ce mécanisme. Seul le
-- statut et l'heure changent, et un motif est ajouté.
-- =====================================================================

begin;

do $p2$
declare
  v_hors_signature int;
  v_cibles         int;
  v_modifiees      int;
  v_restantes      int;
  v_motif          text :=
    'Fin non enregistrée — régularisation du 16/09/2026 : l''heure de fin avait été déduite de la prise de poste suivante, jamais pointée (phase pilote)';
begin
  -- ── Garde d'entrée : tout ce qui ressemble au défaut doit en porter la
  -- signature. Une seule exception non expliquée, et l'on n'écrit rien.
  select count(*) into v_hors_signature
    from public.shifts sh
   where sh.statut         = 'termine'
     and sh.cloture_source = 'prise_de_poste_suivante'
     and not exists (select 1 from public.pointages p
                      where p.service_id = sh.id and p.type = 'depart')
     and sh.heure_fin is distinct from sh.cloture_le;

  if v_hors_signature > 0 then
    raise exception
      'P-2 interrompu : % service(s) clos par prise_de_poste_suivante, sans départ pointé, dont heure_fin ne vaut pas cloture_le. Cette forme n''est pas celle du défaut de B1 : elle doit être examinée avant toute écriture.',
      v_hors_signature;
  end if;

  select count(*) into v_cibles
    from public.shifts sh
   where sh.statut         = 'termine'
     and sh.cloture_source = 'prise_de_poste_suivante'
     and sh.heure_fin      = sh.cloture_le
     and not exists (select 1 from public.pointages p
                      where p.service_id = sh.id and p.type = 'depart');

  update public.shifts sh
     set statut        = 'clos_sans_pointage',
         heure_fin     = null,
         cloture_motif = v_motif
   where sh.statut         = 'termine'
     and sh.cloture_source = 'prise_de_poste_suivante'
     and sh.heure_fin      = sh.cloture_le
     and not exists (select 1 from public.pointages p
                      where p.service_id = sh.id and p.type = 'depart');

  get diagnostics v_modifiees = row_count;

  -- Une RLS ou un trigger qui filtrerait silencieusement se verrait ici.
  if v_modifiees <> v_cibles then
    raise exception
      'P-2 interrompu : % ligne(s) modifiée(s) pour % ciblée(s).', v_modifiees, v_cibles;
  end if;

  -- ── Garde de sortie : le défaut ne doit plus exister nulle part.
  select count(*) into v_restantes
    from public.shifts sh
   where sh.statut         = 'termine'
     and sh.cloture_source = 'prise_de_poste_suivante'
     and not exists (select 1 from public.pointages p
                      where p.service_id = sh.id and p.type = 'depart');

  if v_restantes > 0 then
    raise exception
      'P-2 interrompu : % service(s) « termine » par prise_de_poste_suivante sans départ pointé subsistent.', v_restantes;
  end if;

  raise notice 'P-2 : % service(s) régularisé(s), heure_fin effacée, cloture_le conservé.', v_modifiees;
end;
$p2$;

commit;
