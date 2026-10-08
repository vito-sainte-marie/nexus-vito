-- ============================================================================
-- Factures différées en Boutique (mandat consolidé §4, B4)
-- ============================================================================
-- Une vente facturée dans le Back-office Décenium et non encaissée sur le
-- quart (cas de référence : Sainte-Marie Usine, 06/10 Q2, une facture de
-- 58,00 €) gonfle la « vente boutique » sans qu'aucun argent n'entre dans
-- le tiroir : l'écart boutique paraît négatif du montant de la facture.
-- Verify n'avait aucun champ pour le dire ; l'argent attendu se cachait
-- dans un autre champ ou dans l'écart.
--
-- Ce qui est ajouté :
--   factures_differees           jsonb, une ligne par facture : montant,
--                                client (texte libre, jamais une clé vers
--                                `clients`), numero_facture, justificatif
--                                (référence), incluse_dans_ventes (le
--                                manager a VÉRIFIÉ que la facture figure
--                                dans la vente boutique Décenium du quart),
--                                auteur_id et saisie_le posés par le
--                                serveur, modifie_par et modifie_le à la
--                                première modification d'une ligne.
--   factures_differees_boutique  somme des seules lignes confirmées,
--                                recalculée ici : aucune valeur envoyée
--                                par l'écran n'est crue.
--
-- Pas de soustraction automatique (§4) : une ligne non confirmée est
-- conservée « à vérifier » et n'entre dans aucun calcul. Seule une ligne
-- confirmée réduit l'attendu boutique, puisque sa vente est comptée dans
-- la vente Décenium sans argent en face. À la piste, le pupitre prime : la
-- colonne ne concerne que la boutique.
--
-- Refus (codes lus par l'écran) :
--   [FACTURES_FORMAT]               la valeur n'est pas un tableau d'objets
--   [FACTURE_MONTANT_INVALIDE]      montant absent, nul, négatif ou au-delà du centime
--   [FACTURE_CLIENT_REQUIS]         client vide
--   [FACTURE_NUMERO_REQUIS]         numéro de facture vide
--   [FACTURE_PRESENCE_NON_DITE]     incluse_dans_ventes absent ou non booléen
--   [FACTURE_EN_DOUBLE]             même numéro deux fois dans le même audit
--   [FACTURE_DEJA_SAISIE]           même numéro sur un autre audit du site
--   [FACTURES_SUPERIEURES_VENTES]   factures confirmées au-delà de la vente boutique
-- Le numéro est normalisé (espaces retirés aux bords, majuscules) avant
-- toute comparaison. Les clés inconnues sont écartées : l'écran ne peut
-- poser ni auteur ni horodatage.
--
-- Historique : chaque modification passe par le snapshot complet de
-- `audits_caisse_versions` déjà posé par Verify avant toute écriture.
--
-- Retour arrière : drop trigger trg_audits_caisse_factures_differees ;
-- drop function public.audits_caisse_factures_differees_controle() ;
-- drop index audits_caisse_factures_differees_idx ; alter table
-- public.audits_caisse drop column factures_differees_boutique, drop
-- column factures_differees.
-- Épreuve : outils/epreuve-factures-differees-20261008/executer.sh
-- ============================================================================

alter table public.audits_caisse
  add column factures_differees jsonb not null default '[]'::jsonb,
  add column factures_differees_boutique numeric not null default 0;

comment on column public.audits_caisse.factures_differees is
  'Factures différées boutique (B4, 20261008140000) : ventes facturées dans Décenium Back-office, non encaissées sur ce quart. Lignes validées et horodatées par trg_audits_caisse_factures_differees.';
comment on column public.audits_caisse.factures_differees_boutique is
  'Somme des factures différées dont la présence dans la vente boutique Décenium du quart est confirmée ; recalculée par le serveur.';

create index audits_caisse_factures_differees_idx
  on public.audits_caisse using gin (factures_differees jsonb_path_ops);

create or replace function public.audits_caisse_factures_differees_controle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_ancienne jsonb;
  v_sortie jsonb := '[]'::jsonb;
  v_numeros text[] := '{}';
  v_numero text;
  v_client text;
  v_just text;
  v_montant numeric;
  v_incluse boolean;
  v_total numeric := 0;
  v_acteur uuid := auth.uid();
begin
  if tg_op = 'UPDATE' and new.factures_differees is not distinct from old.factures_differees
     and new.vente_boutique is not distinct from old.vente_boutique
     and new.factures_differees_boutique is not distinct from old.factures_differees_boutique then
    return new;
  end if;

  if new.factures_differees is null then
    new.factures_differees := '[]'::jsonb;
  end if;
  if jsonb_typeof(new.factures_differees) <> 'array' then
    raise exception '[FACTURES_FORMAT] Les factures différées doivent être une liste.';
  end if;

  for v_ligne in select e from jsonb_array_elements(new.factures_differees) e loop
    if jsonb_typeof(v_ligne) <> 'object' then
      raise exception '[FACTURES_FORMAT] Chaque facture différée doit être une ligne complète.';
    end if;

    begin
      v_montant := (v_ligne->>'montant')::numeric;
    exception when others then
      v_montant := null;
    end;
    if v_montant is null or v_montant <= 0 or v_montant <> round(v_montant, 2) then
      raise exception '[FACTURE_MONTANT_INVALIDE] Montant de facture différée invalide (positif, au centime).';
    end if;

    v_client := btrim(coalesce(v_ligne->>'client', ''));
    if v_client = '' then
      raise exception '[FACTURE_CLIENT_REQUIS] Le client de la facture différée est requis.';
    end if;

    v_numero := upper(btrim(coalesce(v_ligne->>'numero_facture', '')));
    if v_numero = '' then
      raise exception '[FACTURE_NUMERO_REQUIS] Le numéro de facture est requis.';
    end if;

    if jsonb_typeof(v_ligne->'incluse_dans_ventes') is distinct from 'boolean' then
      raise exception '[FACTURE_PRESENCE_NON_DITE] Indiquez si la facture % figure dans la vente boutique Décenium du quart.', v_numero;
    end if;
    v_incluse := (v_ligne->>'incluse_dans_ventes')::boolean;

    if v_numero = any(v_numeros) then
      raise exception '[FACTURE_EN_DOUBLE] La facture % est saisie deux fois sur ce quart.', v_numero;
    end if;
    v_numeros := v_numeros || v_numero;

    -- Une facture n'est différée qu'une fois, tous quarts confondus.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('facture_differee:' || new.site || ':' || v_numero));
    if exists (
      select 1 from public.audits_caisse a
      where a.site = new.site and a.id <> new.id
        -- l'upsert de Verify (on conflict site, date, quart) passe d'abord par
        -- ce trigger en INSERT, avec un id neuf : la ligne du même quart est
        -- celle qu'il va mettre à jour, pas un autre quart.
        and (a.date, a.quart) is distinct from (new.date, new.quart)
        and a.factures_differees @> jsonb_build_array(jsonb_build_object('numero_facture', v_numero))
    ) then
      raise exception '[FACTURE_DEJA_SAISIE] La facture % est déjà saisie sur un autre quart de la station.', v_numero;
    end if;

    v_just := nullif(btrim(coalesce(v_ligne->>'justificatif', '')), '');

    v_ancienne := null;
    if tg_op = 'UPDATE' then
      select e into v_ancienne
      from jsonb_array_elements(old.factures_differees) e
      where e->>'numero_facture' = v_numero
      limit 1;
    end if;

    if v_ancienne is null then
      v_sortie := v_sortie || jsonb_build_array(jsonb_build_object(
        'numero_facture', v_numero, 'montant', v_montant, 'client', v_client,
        'justificatif', v_just, 'incluse_dans_ventes', v_incluse,
        'auteur_id', v_acteur, 'saisie_le', now()));
    else
      v_sortie := v_sortie || jsonb_build_array(jsonb_build_object(
        'numero_facture', v_numero, 'montant', v_montant, 'client', v_client,
        'justificatif', v_just, 'incluse_dans_ventes', v_incluse,
        'auteur_id', v_ancienne->'auteur_id', 'saisie_le', v_ancienne->'saisie_le')
        || case
             when (v_ancienne->>'montant')::numeric = v_montant
                  and v_ancienne->>'client' = v_client
                  and (v_ancienne->>'justificatif') is not distinct from v_just
                  and (v_ancienne->>'incluse_dans_ventes')::boolean = v_incluse
             then jsonb_strip_nulls(jsonb_build_object('modifie_par', v_ancienne->'modifie_par', 'modifie_le', v_ancienne->'modifie_le'))
             else jsonb_build_object('modifie_par', v_acteur, 'modifie_le', now())
           end);
    end if;

    if v_incluse then
      v_total := v_total + v_montant;
    end if;
  end loop;

  if v_total > coalesce(new.vente_boutique, 0) then
    raise exception '[FACTURES_SUPERIEURES_VENTES] Factures différées confirmées (% €) supérieures à la vente boutique (% €).',
      v_total, coalesce(new.vente_boutique, 0);
  end if;

  new.factures_differees := v_sortie;
  new.factures_differees_boutique := v_total;
  return new;
end;
$$;

revoke all on function public.audits_caisse_factures_differees_controle() from public;
revoke all on function public.audits_caisse_factures_differees_controle() from anon;
revoke all on function public.audits_caisse_factures_differees_controle() from authenticated;

create trigger trg_audits_caisse_factures_differees
before insert or update on public.audits_caisse
for each row execute function public.audits_caisse_factures_differees_controle();
