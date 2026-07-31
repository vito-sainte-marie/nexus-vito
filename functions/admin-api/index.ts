// NEXUS Admin API — actions privilégiées pour l'écran d'administration
// (NEXUS-Admin-API-v1.html) : gestion des clés API, permissions,
// historique des intégrations. Déployé en verify_jwt=true : Supabase
// vérifie la signature du JWT avant même d'invoquer cette fonction ;
// on lit ensuite le rôle de l'employé (manager/gérant/créateur requis)
// via le service_role, qui contourne le RLS deny-all des tables API.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function errorResponse(code: string, message: string, status: number, requestId: string) {
  return jsonResponse({ error: { code, message, request_id: requestId, timestamp: new Date().toISOString() } }, status);
}

function decodeJwtSub(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const parts = match[1].split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateRawKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `nx_live_${rand}`;
}

Deno.serve(async (req: Request) => {
  const requestId = "req_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/admin-api/, "").replace(/\/+$/, "") || "/";
  const method = req.method;

  try {
    const uid = decodeJwtSub(req.headers.get("Authorization") || "");
    if (!uid) return errorResponse("UNAUTHORIZED", "Session invalide.", 401, requestId);

    const { data: employee, error: empError } = await sb
      .from("employees")
      .select("id, role, site_id, est_createur, actif")
      .eq("id", uid)
      .maybeSingle();

    if (empError || !employee || !employee.actif) {
      return errorResponse("UNAUTHORIZED", "Employé introuvable ou inactif.", 401, requestId);
    }
    const isAdmin = employee.est_createur || ["manager", "gerant"].includes(employee.role);
    if (!isAdmin) {
      return errorResponse("FORBIDDEN_SCOPE", "Réservé aux managers, gérants ou créateur.", 403, requestId);
    }
    const site = employee.site_id;

    // ---- Clés API ----
    if (path === "/keys" && method === "GET") {
      const { data, error } = await sb
        .from("api_keys")
        .select("id, site, source, label, cle_prefix, scopes, actif, cree_le, expire_le, dernier_appel_le, revoque_le")
        .eq("site", site)
        .order("cree_le", { ascending: false });
      if (error) return errorResponse("INTERNAL_ERROR", error.message, 500, requestId);
      return jsonResponse({ data });
    }

    if (path === "/keys" && method === "POST") {
      const body = await req.json().catch(() => null);
      if (!body?.source || !Array.isArray(body?.scopes) || body.scopes.length === 0) {
        return errorResponse("MISSING_FIELD", "source et scopes (non vide) sont obligatoires.", 400, requestId);
      }
      const rawKey = generateRawKey();
      const hash = await sha256Hex(rawKey);
      const prefix = rawKey.slice(0, 16);
      const expireLe = body.expire_le ?? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
      const { data, error } = await sb
        .from("api_keys")
        .insert({
          site,
          source: body.source,
          label: body.label ?? null,
          cle_hash: hash,
          cle_prefix: prefix,
          scopes: body.scopes,
          expire_le: expireLe,
          cree_par: employee.id,
        })
        .select("id, cle_prefix, cree_le, expire_le")
        .single();
      if (error) return errorResponse("INTERNAL_ERROR", error.message, 500, requestId);
      // La clé en clair n'est renvoyée qu'une seule fois, jamais stockée.
      return jsonResponse({ ...data, cle: rawKey }, 201);
    }

    const revokeMatch = path.match(/^\/keys\/([^/]+)\/revoke$/);
    if (revokeMatch && method === "POST") {
      const keyId = revokeMatch[1];
      const { data, error } = await sb
        .from("api_keys")
        .update({ actif: false, revoque_le: new Date().toISOString(), revoque_par: employee.id })
        .eq("id", keyId)
        .eq("site", site)
        .select("id")
        .maybeSingle();
      if (error) return errorResponse("INTERNAL_ERROR", error.message, 500, requestId);
      if (!data) return errorResponse("NOT_FOUND", "Clé introuvable pour ce site.", 404, requestId);
      return jsonResponse({ revoked: true });
    }

    // ---- Intégrations ----
    if (path === "/integrations" && method === "GET") {
      const { data, error } = await sb
        .from("integration_status")
        .select("source_code, statut, derniere_sync_le, derniere_sync_statut, message, maj_le, integration_sources(nom, type, description)")
        .eq("site", site);
      if (error) return errorResponse("INTERNAL_ERROR", error.message, 500, requestId);
      return jsonResponse({ data });
    }

    // ---- Journal d'appels API ----
    if (path === "/logs" && method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
      const { data, error } = await sb
        .from("api_logs")
        .select("id, endpoint, method, status_code, request_id, duree_ms, cree_le")
        .eq("site", site)
        .order("cree_le", { ascending: false })
        .limit(limit);
      if (error) return errorResponse("INTERNAL_ERROR", error.message, 500, requestId);
      return jsonResponse({ data });
    }

    // ---- Historique de synchronisation ----
    if (path === "/sync-history" && method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
      const { data, error } = await sb
        .from("synchronization_history")
        .select("id, source, domaine, statut, demarre_le, termine_le, nb_recus, nb_erreurs, message")
        .eq("site", site)
        .order("demarre_le", { ascending: false })
        .limit(limit);
      if (error) return errorResponse("INTERNAL_ERROR", error.message, 500, requestId);
      return jsonResponse({ data });
    }

    return errorResponse("NOT_FOUND", `Endpoint inconnu : ${method} ${path}`, 404, requestId);
  } catch (e) {
    return errorResponse("INTERNAL_ERROR", String(e), 500, requestId);
  }
});
