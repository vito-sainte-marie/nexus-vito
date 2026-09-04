-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260728222354 · creer_vue_caisse_ecart_a_traiter
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Vue Cockpit (28/07/2026, demande de Frédéric — "le Cockpit doit distribuer
-- du travail, pas seulement parler produits") : identifie, pour chaque audit
-- de caisse en anomalie/critique et non justifié (pas de commentaire, 14
-- derniers jours), le côté (piste/boutique) qui porte le plus gros écart en
-- valeur absolue, et l'employé unique qui tenait ce poste ce quart-là.
-- employee_nom reste NULL si plus d'une personne était affectée à ce côté
-- (jamais une attribution incertaine) — dans ce cas, le Conseiller ne doit
-- pas nommer quelqu'un, l'appelant doit ignorer la ligne ou reformuler sans
-- nom. Ne compare jamais les employés entre eux, ne fait que remonter un
-- incident précis et daté.
create or replace view public.v_caisse_ecart_a_traiter as
select
  ac.id as audit_id,
  ac.site,
  ac.date,
  ac.quart,
  ac.statut,
  ac.ecart_piste,
  ac.ecart_boutique,
  ac.ecart_total,
  case when abs(ac.ecart_piste) >= abs(ac.ecart_boutique) then 'piste' else 'boutique' end as cote_dominant,
  greatest(abs(ac.ecart_piste), abs(ac.ecart_boutique)) as montant_dominant,
  e.id as employee_id,
  e.nom as employee_nom
from public.audits_caisse ac
left join public.employees e on e.id = (
  case
    when abs(ac.ecart_piste) >= abs(ac.ecart_boutique) then
      case when jsonb_array_length(coalesce(ac.employes_piste, '[]'::jsonb)) = 1
        then (ac.employes_piste->>0)::uuid end
    else
      case when jsonb_array_length(coalesce(ac.employes_boutique, '[]'::jsonb)) = 1
        then (ac.employes_boutique->>0)::uuid end
  end
)
where ac.statut in ('anomalie','critique')
  and (ac.commentaire is null or btrim(ac.commentaire) = '')
  and ac.date >= current_date - interval '14 days';
comment on view public.v_caisse_ecart_a_traiter is 'Écarts de caisse anomalie/critique non justifiés (14 derniers jours), avec le côté dominant et l''employé unique attribuable (NULL si ambigu). Source du candidat "caisse par personne" du Conseiller NEXUS/Cockpit (nexus-conseiller.js).';
