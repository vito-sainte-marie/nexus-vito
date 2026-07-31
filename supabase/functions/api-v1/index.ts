// NEXUS API v1 — routeur REST unifié
// Authentification par clé Bearer (api_keys), scopes, rate limiting,
// journalisation (api_logs), format d'erreur standardisé.
// Déployé en verify_jwt=false : l'authentification est gérée ici,
// pas par le JWT Supabase (les appelants sont des connecteurs externes,
// pas des sessions employé).
//
// Réf. NEXUS-API-Specification-v4.md et NEXUS-Guide-Integration-Editeurs-Caisse-v1.md

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const RATE_LIMIT_PER_MINUTE = 100;

type ApiKeyRow = {
  id: string;
  site: string;
  source: string;
  scopes: string[];
  actif: boolean;
  expire_le: string | null;
  revoque_le: string | null;
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  requestId: string,
  field: string | null = null,
  extraHeaders: Record<string, string> = {},
) {
  return jsonResponse(
    { error: { code, message, field, request_id: requestId, timestamp: new Date().toISOString() } },
    status,
    extraHeaders,
  );
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function logCall(
  apiKeyId: string | null,
  site: string,
  endpoint: string,
  method: string,
  statusCode: number,
  requestId: string,
  durationMs: number,
) {
  await sb.from("api_logs").insert({
    api_key_id: apiKeyId,
    site,
    endpoint,
    method,
    status_code: statusCode,
    request_id: requestId,
    duree_ms: durationMs,
  });
}

async function authenticate(req: Request, requestId: string): Promise<
  { ok: true; key: ApiKeyRow } | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      response: errorResponse("UNAUTHORIZED", "En-tête Authorization: Bearer <clé> manquant.", 401, requestId),
    };
  }
  const rawKey = match[1].trim();
  const hash = await sha256Hex(rawKey);
  const { data, error } = await sb
    .from("api_keys")
    .select("id, site, source, scopes, actif, expire_le, revoque_le")
    .eq("cle_hash", hash)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, response: errorResponse("UNAUTHORIZED", "Clé API invalide.", 401, requestId) };
  }
  const key = data as ApiKeyRow;
  if (!key.actif || key.revoque_le) {
    return { ok: false, response: errorResponse("UNAUTHORIZED", "Clé API révoquée ou inactive.", 401, requestId) };
  }
  if (key.expire_le && new Date(key.expire_le).getTime() < Date.now()) {
    return { ok: false, response: errorResponse("UNAUTHORIZED", "Clé API expirée.", 401, requestId) };
  }

  // Rate limiting — fenêtre glissante de 60s
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await sb
    .from("api_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", key.id)
    .gte("cree_le", since);
  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return {
      ok: false,
      response: errorResponse(
        "RATE_LIMITED",
        `Limite de ${RATE_LIMIT_PER_MINUTE} requêtes/minute dépassée.`,
        429,
        requestId,
        null,
        { "Retry-After": "60" },
      ),
    };
  }

  sb.from("api_keys").update({ dernier_appel_le: new Date().toISOString() }).eq("id", key.id).then(() => {});
  return { ok: true, key };
}

function requireScope(key: ApiKeyRow, scope: string, requestId: string): Response | null {
  if (!key.scopes?.includes(scope) && !key.scopes?.includes("admin:*")) {
    return errorResponse("FORBIDDEN_SCOPE", `Le scope '${scope}' est requis pour cet endpoint.`, 403, requestId);
  }
  return null;
}

function parsePagination(url: URL) {
  const limitParam = Number(url.searchParams.get("limit") ?? "100");
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 100, 1), 500);
  const cursor = url.searchParams.get("cursor");
  const updatedSince = url.searchParams.get("updated_since");
  return { limit, cursor, updatedSince };
}

Deno.serve(async (req: Request) => {
  const requestId = "req_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const startedAt = Date.now();
  const url = new URL(req.url);
  // chemin après /api-v1
  const path = url.pathname.replace(/^\/api-v1/, "").replace(/\/+$/, "") || "/";
  const method = req.method;
  let site = "inconnu";
  let apiKeyId: string | null = null;
  let responded: Response | undefined;

  try {
    // /health est public — sert de sonde de disponibilité, sans authentification
    if (path === "/health" && method === "GET") {
      responded = jsonResponse({ status: "ok", version: "v1", time: new Date().toISOString() });
      return responded;
    }

    const auth = await authenticate(req, requestId);
    if (!auth.ok) {
      responded = auth.response;
      return responded;
    }
    const key = auth.key;
    site = key.site;
    apiKeyId = key.id;

    // ---- Lecture ----
    if (path === "/status" && method === "GET") {
      const { data, error } = await sb.from("integration_status").select("source_code, statut, derniere_sync_le, derniere_sync_statut, message").eq("site", site);
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      responded = jsonResponse({ site, data });
      return responded;
    }

    if (path === "/integrations" && method === "GET") {
      const scopeErr = requireScope(key, "integrations:read", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const { data, error } = await sb
        .from("integration_status")
        .select("source_code, statut, derniere_sync_le, message, integration_sources(nom, type, description)")
        .eq("site", site);
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      responded = jsonResponse({ site, data });
      return responded;
    }

    if (path === "/products" && method === "GET") {
      const scopeErr = requireScope(key, "products:read", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const { limit } = parsePagination(url);
      const { data, error } = await sb
        .from("products")
        .select("id, article, code_barres, categorie, prix_vente, prix_achat, tva")
        .eq("site", site)
        .limit(limit);
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      responded = jsonResponse({ data, has_more: data.length === limit });
      return responded;
    }

    if (path === "/sales" && method === "GET") {
      const scopeErr = requireScope(key, "sales:read", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const { limit, updatedSince } = parsePagination(url);
      let query = sb
        .from("current_normalized_sales")
        .select("id, ticket_id, sold_at, product_id, category, quantity, unit_sale_price_ht, unit_sale_price_ttc, margin_amount_ht, margin_rate, total_ttc, status, normalise_le")
        .eq("site", site)
        .order("normalise_le", { ascending: true })
        .limit(limit);
      if (updatedSince) query = query.gt("normalise_le", updatedSince);
      const { data, error } = await query;
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      const nextCursor = data.length === limit ? data[data.length - 1].normalise_le : null;
      responded = jsonResponse({ data, has_more: data.length === limit, next_cursor: nextCursor });
      return responded;
    }

    if (path === "/employees" && method === "GET") {
      const scopeErr = requireScope(key, "employees:read", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const { data, error } = await sb.from("employees").select("id, nom, role, actif").eq("site_id", site).eq("actif", true);
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      responded = jsonResponse({ data });
      return responded;
    }

    if (path === "/stock" && method === "GET") {
      const scopeErr = requireScope(key, "stock:read", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const { limit } = parsePagination(url);
      const { data, error } = await sb.from("normalized_stock").select("*").eq("site", site).eq("is_current", true).limit(limit);
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      responded = jsonResponse({ data, has_more: data.length === limit });
      return responded;
    }

    if (path === "/cash" && method === "GET") {
      const scopeErr = requireScope(key, "cash:read", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const { limit } = parsePagination(url);
      const { data, error } = await sb.from("normalized_cash_sessions").select("*").eq("site", site).limit(limit);
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      responded = jsonResponse({ data, has_more: data.length === limit });
      return responded;
    }

    // ---- Écriture (déclarations terrain) ----
    if (path === "/controls" && method === "POST") {
      const scopeErr = requireScope(key, "controls:write", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const body = await req.json().catch(() => null);
      if (!body || typeof body.article !== "string" || typeof body.quantite_theorique !== "number" || typeof body.quantite_comptee !== "number") {
        responded = errorResponse("MISSING_FIELD", "article, quantite_theorique et quantite_comptee sont obligatoires.", 400, requestId);
        return responded;
      }
      if (body.quantite_theorique < 0 || body.quantite_comptee < 0) {
        responded = errorResponse("INVALID_FIELD", "Les quantités doivent être positives ou nulles.", 400, requestId, "quantite_comptee");
        return responded;
      }
      const ecart = body.quantite_comptee - body.quantite_theorique;
      const { data, error } = await sb
        .from("controles_stock")
        .insert({
          site,
          article: body.article,
          quantite_theorique: body.quantite_theorique,
          quantite_comptee: body.quantite_comptee,
          ecart,
          controle_le: body.controle_le ?? new Date().toISOString(),
        })
        .select()
        .single();
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      responded = jsonResponse(data, 201);
      return responded;
    }

    if (path === "/campaigns" && method === "POST") {
      const scopeErr = requireScope(key, "campaigns:write", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const body = await req.json().catch(() => null);
      if (!body?.nom || !body?.date_debut || !body?.date_fin || !Array.isArray(body?.produits_concernes) || body.produits_concernes.length === 0) {
        responded = errorResponse("MISSING_FIELD", "nom, date_debut, date_fin et produits_concernes (non vide) sont obligatoires.", 400, requestId);
        return responded;
      }
      const { data, error } = await sb
        .from("campagnes_nexus")
        .insert({
          site,
          nom: body.nom,
          date_debut: body.date_debut,
          date_fin: body.date_fin,
          type: body.type ?? null,
          produits_concernes: body.produits_concernes,
          nature: body.nature ?? null,
          objectif: body.objectif ?? null,
          objectif_libre: body.objectif_libre ?? null,
        })
        .select()
        .single();
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      responded = jsonResponse(data, 201);
      return responded;
    }

    const campaignImportMatch = path.match(/^\/campaigns\/([^/]+)\/imports$/);
    if (campaignImportMatch && method === "POST") {
      const scopeErr = requireScope(key, "campaigns:write", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const campagneId = campaignImportMatch[1];
      const body = await req.json().catch(() => null);
      if (!body?.phase || !["avant", "pendant"].includes(body.phase) || !body?.periode_debut || !body?.periode_fin) {
        responded = errorResponse("INVALID_FIELD", "phase ('avant'|'pendant'), periode_debut et periode_fin sont obligatoires.", 400, requestId);
        return responded;
      }
      const { data, error } = await sb
        .from("campagnes_nexus_imports")
        .insert({ campagne_id: campagneId, phase: body.phase, periode_debut: body.periode_debut, periode_fin: body.periode_fin })
        .select()
        .single();
      if (error) {
        responded = error.code === "23503"
          ? errorResponse("UNKNOWN_REFERENCE", "Campagne introuvable.", 404, requestId, "campagne_id")
          : errorResponse("INTERNAL_ERROR", error.message, 500, requestId);
        return responded;
      }
      responded = jsonResponse(data, 201);
      return responded;
    }

    if (path === "/marge-exceptions" && method === "POST") {
      const scopeErr = requireScope(key, "marge_exceptions:write", requestId);
      if (scopeErr) return (responded = scopeErr), responded;
      const body = await req.json().catch(() => null);
      if (!body?.article) {
        responded = errorResponse("MISSING_FIELD", "article est obligatoire.", 400, requestId, "article");
        return responded;
      }
      const { data, error } = await sb
        .from("marge_exceptions")
        .insert({ site, article: body.article, categorie: body.categorie ?? null, raison: body.raison ?? null })
        .select()
        .single();
      if (error) return (responded = errorResponse("INTERNAL_ERROR", error.message, 500, requestId)), responded;
      responded = jsonResponse(data, 201);
      return responded;
    }

    responded = errorResponse("NOT_FOUND", `Endpoint inconnu : ${method} ${path}`, 404, requestId);
    return responded;
  } catch (e) {
    responded = errorResponse("INTERNAL_ERROR", String(e), 500, requestId);
    return responded;
  } finally {
    const duration = Date.now() - startedAt;
    const statusCode = responded ? responded.status : 500;
    // best-effort, ne bloque jamais la réponse
    logCall(apiKeyId, site, path, method, statusCode, requestId, duration).catch(() => {});
  }
});
