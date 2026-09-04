-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260812123535 · nexus_risk_signals
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ============================================================
-- nexus_risk_signals — mémoire du risque dans le temps (11/08/2026)
--
-- Fondation du futur moteur de qualification du risque NEXUS
-- (nexus-risques-moteur.js), demandé par Frédéric : NEXUS ne doit jamais
-- appeler "risque" quelque chose qui n'est qu'un écart ponctuel. Chaque
-- signal détecté (marge, caisse, stock, carburant, FDJ, équipe...) est
-- qualifié selon 4 niveaux croissants (anomalie -> signal_faible ->
-- exposition -> risque_avere), comparé à SA PROPRE référence (jamais une
-- moyenne générale), et garde une mémoire de son évolution dans le temps.
--
-- Décision d'architecture (voir NEXUS-Cartographie-Moteur-Risques-2026.md) :
-- cette table est NOUVELLE plutôt qu'une extension de advisor_messages/
-- advisor_rules. Ces deux tables existantes restent le moteur PL/pgSQL qui
-- alimente le Centre d'Intelligence NEXUS (domaines caisse/qualité
-- uniquement) — elles ne sont pas touchées ici pour ne rien casser côté
-- CIN. nexus_risk_signals est consommée par le nouveau moteur JS
-- (nexus-risques-moteur.js + nexus-risques-donnees.js), sur le même
-- schéma architecture que les autres moteurs NEXUS (Article 11 : "un
-- moteur calcule, un service récupère les données, une page affiche").
-- Pour le domaine Caisse, nexus-risques-donnees.js pourra lire
-- caisse_sante_historique/advisor_messages comme SOURCE d'observation,
-- sans dupliquer leur logique de récurrence en JS.
--
-- Une ligne = un signal identifié par (site_id, cle_signal), mis à jour à
-- chaque nouvelle observation plutôt que dupliqué — c'est ce qui permet à
-- NEXUS de dire "ce signal est surveillé depuis 18 jours" ou "il s'est
-- aggravé sur 3 périodes".
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."nexus_risk_signals" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "site_id" text NOT NULL,

    -- Classification (voir en-tête nexus-risques-moteur.js pour le détail
    -- de chaque champ, qui reprend le contrat proposé par Frédéric :
    -- type_signal / niveau_confiance / preuve / impact_mesure /
    -- impact_potentiel / recurrence / anciennete / secteur /
    -- action_recommandee).
    "domaine" text NOT NULL,
    "cle_signal" text NOT NULL,
    "type_signal" text NOT NULL,
    "niveau" text NOT NULL DEFAULT 'anomalie',
    "niveau_confiance" text,
    "secteur" text,

    -- Preuve et impact — jamais un score opaque, toujours les faits qui
    -- justifient le niveau (demande explicite de Frédéric).
    "preuve" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "impact_mesure_eur" numeric,
    "impact_potentiel_eur" numeric,
    "action_recommandee" text,

    -- Récurrence et mémoire dans le temps.
    "recurrence_count" integer DEFAULT 1 NOT NULL,
    "premiere_detection_le" timestamp with time zone DEFAULT now() NOT NULL,
    "derniere_detection_le" timestamp with time zone DEFAULT now() NOT NULL,
    "historique_transitions" jsonb DEFAULT '[]'::jsonb NOT NULL,

    -- Cycle de vie : un signal ne disparaît jamais silencieusement, il
    -- passe explicitement à resolu (action prise / situation rentrée dans
    -- l'ordre) ou expire (plus observé depuis longtemps, sans action).
    "statut" text DEFAULT 'surveille' NOT NULL,
    "resolu_le" timestamp with time zone,
    "resolu_note" text,

    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT "nexus_risk_signals_domaine_check" CHECK (("domaine" = ANY (ARRAY['marge'::text, 'caisse'::text, 'stock'::text, 'carburant'::text, 'fdj'::text, 'equipe'::text, 'conformite'::text]))),
    CONSTRAINT "nexus_risk_signals_niveau_check" CHECK (("niveau" = ANY (ARRAY['anomalie'::text, 'signal_faible'::text, 'exposition'::text, 'risque_avere'::text]))),
    CONSTRAINT "nexus_risk_signals_niveau_confiance_check" CHECK (("niveau_confiance" IS NULL OR "niveau_confiance" = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text]))),
    CONSTRAINT "nexus_risk_signals_statut_check" CHECK (("statut" = ANY (ARRAY['surveille'::text, 'resolu'::text, 'expire'::text]))),
    CONSTRAINT "nexus_risk_signals_site_cle_unique" UNIQUE ("site_id", "cle_signal")
);

ALTER TABLE "public"."nexus_risk_signals" OWNER TO "postgres";

COMMENT ON TABLE "public"."nexus_risk_signals" IS 'Mémoire du risque dans le temps — une ligne par signal (site_id, cle_signal), mise à jour à chaque nouvelle observation plutôt que dupliquée. Consommée par nexus-risques-moteur.js/nexus-risques-donnees.js. Ne remplace pas advisor_messages (Centre d''Intelligence, domaines caisse/qualité) : table nouvelle, domaine plus large (marge/stock/carburant/fdj/équipe/conformité), vocabulaire à 4 niveaux explicite.';

COMMENT ON COLUMN "public"."nexus_risk_signals"."cle_signal" IS 'Identifiant stable du signal, ex: "marge:categorie:Boissons energisantes" ou "caisse:quart:matin". Stable dans le temps pour permettre le suivi (contrairement à un fingerprint de contenu qui changerait à chaque nouvelle valeur).';

COMMENT ON COLUMN "public"."nexus_risk_signals"."niveau" IS 'Anomalie à expliquer / signal_faible / exposition / risque_avere — jamais risque_avere sans preuve suffisante (Article 5 NEXUS : vérité avant certitude).';

COMMENT ON COLUMN "public"."nexus_risk_signals"."historique_transitions" IS 'Array JSON [{date, ancien_niveau, nouveau_niveau, motif}] — trace chaque changement de niveau, y compris une désescalade (signal_faible -> résolu / non confirmé).';

CREATE INDEX IF NOT EXISTS "idx_nexus_risk_signals_site_statut" ON "public"."nexus_risk_signals" USING btree ("site_id", "statut");
CREATE INDEX IF NOT EXISTS "idx_nexus_risk_signals_site_niveau" ON "public"."nexus_risk_signals" USING btree ("site_id", "niveau");
CREATE INDEX IF NOT EXISTS "idx_nexus_risk_signals_domaine" ON "public"."nexus_risk_signals" USING btree ("domaine");

ALTER TABLE "public"."nexus_risk_signals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_nexus_risk_signals" ON "public"."nexus_risk_signals" FOR SELECT TO "authenticated" USING (("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid")))));

CREATE POLICY "inserer_nexus_risk_signals" ON "public"."nexus_risk_signals" FOR INSERT TO "authenticated" WITH CHECK (("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid")))));

CREATE POLICY "modifier_nexus_risk_signals" ON "public"."nexus_risk_signals" FOR UPDATE TO "authenticated" USING (("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid")))));
