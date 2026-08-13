// NEXUS — Edge Function "nexus-envoyer-facture" (13/08/2026, demande de Frédéric)
// ================================================================
// Envoie une facture identifiée par e-mail à son client, en pièce jointe,
// via le compte Gmail configuré par site (client_comptes_parametres).
//
// Sécurité — pas de service_role ici, volontairement : ce client Supabase
// est construit avec le JWT de l'appelant (Authorization transmis tel quel),
// donc TOUTES les lectures/écritures ci-dessous respectent exactement les
// mêmes policies RLS que si le manager les faisait depuis son navigateur
// (nexus_clients_ecriture_ok / nexus_clients_lecture_ok — manager/gérant du
// site, ou créateur). Si un manager n'a pas le droit de lire une ligne,
// cette fonction ne l'a pas non plus.
//
// V1 volontairement simple (facture par facture, pas de lot) — voir
// NEXUS-Data-Dictionary-v2 pour la portée exacte et ce qui est hors scope
// (le schéma email_batches/email_messages avec les 7 "checks" de
// rapprochement existe déjà en base pour un futur "Phase 2 RECONCILE", mais
// cette V1 n'implémente que les vérifications qu'elle peut honnêtement
// garantir : client identifié, e-mail connu, pas déjà envoyée, identifiants
// Gmail configurés).
//
// Substitution de variables — MIROIR EXACT de
// NEXUS-Parametres-Comptes-Clients-v1.html (composerSignature/genererApercu)
// et de la logique CIVILITES de NEXUS-Comptes-Clients-v1.html : mêmes clés,
// même remplacement littéral split/join (jamais de regex \{\{(\w+)\}\} — les
// clés accentuées comme {{année}}, {{établissement}}, {{téléphone}} ne
// matchent pas \w+, testé et confirmé avant ce choix). Dupliqué ici plutôt
// que partagé car un Edge Function Deno ne peut pas importer un <script>
// inline HTML — même situation déjà acceptée pour dossier_watcher.py.

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.14";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Remplacement littéral (pas de regex) — identique à genererApercu() et
// composerSignature() dans NEXUS-Parametres-Comptes-Clients-v1.html.
function substituerModele(texte: string, variables: Record<string, string>): string {
  return Object.keys(variables).reduce(
    (acc, cle) => acc.split(cle).join(variables[cle]),
    texte || "",
  );
}

type Contact = { civilite?: string | null; prenom?: string | null; formule_personnalisee?: string | null };

// Miroir de CIVILITES (NEXUS-Comptes-Clients-v1.html) — la civilité choisie
// pour l'interlocuteur détermine la formule d'appel réelle envoyée, jamais
// une valeur par défaut inventée ici.
function composerFormuleAppel(contact: Contact): string {
  const civilite = contact.civilite || "neutre";
  if (civilite === "monsieur") return "Bonjour Monsieur,";
  if (civilite === "madame") return "Bonjour Madame,";
  if (civilite === "prenom") return contact.prenom ? `Bonjour ${contact.prenom},` : "Bonjour,";
  if (civilite === "personnalisee") return contact.formule_personnalisee || "Bonjour,";
  return "Bonjour,"; // neutre
}

type Parametres = {
  expediteur_nom?: string | null; expediteur_fonction?: string | null;
  nom_etablissement?: string | null; adresse?: string | null; telephone?: string | null;
  signature_texte?: string | null;
};

// Miroir exact de composerSignature() (NEXUS-Parametres-Comptes-Clients-v1.html).
function composerSignature(parametres: Parametres): string {
  const vars: Record<string, string> = {
    "{{signataire}}": parametres.expediteur_nom || "",
    "{{fonction}}": parametres.expediteur_fonction || "",
    "{{établissement}}": parametres.nom_etablissement || "",
    "{{adresse}}": parametres.adresse || "",
    "{{téléphone}}": parametres.telephone || "",
  };
  const gabarit = parametres.signature_texte
    || "{{signataire}}\n{{fonction}}\n{{établissement}}\n{{adresse}}\nTél : {{téléphone}}";
  return substituerModele(gabarit, vars);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée." }, 405);
  }

  let body: { invoiceId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }
  const invoiceId = body && body.invoiceId;
  if (!invoiceId) return jsonResponse({ error: "invoiceId manquant." }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Non authentifié." }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // 1) Facture — doit exister, appartenir à un client identifié, ne pas
  // avoir déjà été envoyée, et avoir un fichier associé.
  const { data: invoice, error: eInv } = await supabase
    .from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (eInv || !invoice) {
    return jsonResponse({ error: "Facture introuvable ou accès refusé." }, 404);
  }
  if (invoice.statut === "envoyee") {
    return jsonResponse({ error: "Cette facture a déjà été envoyée." }, 400);
  }
  if (!invoice.client_id) {
    return jsonResponse({ error: "Aucun client identifié pour cette facture — assignez d'abord un client depuis la Boîte de réception." }, 400);
  }
  if (!invoice.fichier_path) {
    return jsonResponse({ error: "Aucun fichier associé à cette facture." }, 400);
  }

  // 2) Client + interlocuteur.
  const { data: client, error: eClient } = await supabase
    .from("clients").select("*").eq("id", invoice.client_id).maybeSingle();
  if (eClient || !client) return jsonResponse({ error: "Client introuvable." }, 404);

  const { data: contact } = await supabase
    .from("client_contacts").select("*")
    .eq("client_id", client.id).eq("est_contact_principal", true).maybeSingle();
  if (!contact || !contact.email_principal) {
    return jsonResponse({ error: "Aucune adresse e-mail enregistrée pour l'interlocuteur de ce client — complétez sa fiche avant d'envoyer." }, 400);
  }

  // 3) Identifiants Gmail du site — configurés dans Paramètres > Comptes Clients.
  const { data: parametres, error: eParam } = await supabase
    .from("client_comptes_parametres").select("*").eq("site", client.site).maybeSingle();
  if (eParam || !parametres || !parametres.adresse_expedition_email || !parametres.mot_de_passe_app_email) {
    return jsonResponse({ error: "Adresse d'envoi non configurée pour ce site — renseignez-la dans Paramètres > Comptes Clients." }, 400);
  }

  // 4) Période de facturation (pour {{mois}}/{{année}}) — optionnelle, une
  // facture peut ne pas encore avoir de période résolue.
  let billingPeriod: { mois: number; annee: number } | null = null;
  if (invoice.billing_period_id) {
    const { data: bp } = await supabase
      .from("billing_periods").select("mois, annee").eq("id", invoice.billing_period_id).maybeSingle();
    billingPeriod = bp || null;
  }

  // 5) Modèle de message par défaut du site.
  const { data: template } = await supabase
    .from("email_templates").select("*").eq("site", client.site).eq("est_defaut", true).maybeSingle();

  // 6) Fichier de la facture (même bucket que la Boîte de réception).
  const { data: fichier, error: eFichier } = await supabase
    .storage.from("documents-a-traiter").download(invoice.fichier_path);
  if (eFichier || !fichier) {
    return jsonResponse({ error: "Impossible de récupérer le fichier de la facture." }, 500);
  }
  const fichierBuffer = new Uint8Array(await fichier.arrayBuffer());
  const nomFichier = invoice.fichier_path.split("/").pop() || "facture.pdf";

  // 7) Message — mêmes variables et même logique de composition que
  // l'aperçu affiché dans Paramètres > Comptes Clients (voir en-tête).
  const variables: Record<string, string> = {
    "{{interlocuteur}}": composerFormuleAppel(contact),
    "{{compte_client}}": client.raison_sociale,
    "{{mois}}": billingPeriod ? MOIS_FR[(billingPeriod.mois || 1) - 1] : "",
    "{{année}}": billingPeriod ? String(billingPeriod.annee) : "",
    "{{établissement}}": parametres.nom_etablissement || "",
    "{{signature}}": composerSignature(parametres),
  };
  const objetDefaut = "Votre facture — {{compte_client}}";
  const corpsDefaut = "{{interlocuteur}}\n\nVeuillez trouver ci-joint votre facture.\n\n{{signature}}";
  const objet = substituerModele((template && template.objet) || objetDefaut, variables);
  const corps = substituerModele((template && template.corps) || corpsDefaut, variables);

  // 8) Envoi SMTP via Gmail.
  try {
    const transporteur = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: parametres.adresse_expedition_email,
        pass: parametres.mot_de_passe_app_email,
      },
    });
    await transporteur.sendMail({
      from: `"${parametres.nom_expediteur_email || parametres.nom_etablissement || "NEXUS"}" <${parametres.adresse_expedition_email}>`,
      to: contact.email_principal,
      cc: contact.email_cc || undefined,
      subject: objet,
      text: corps,
      attachments: [{ filename: nomFichier, content: fichierBuffer }],
    });
  } catch (erreurEnvoi) {
    console.error("Échec envoi SMTP:", erreurEnvoi);
    await supabase.from("client_comptes_audit_logs").insert({
      site: client.site, client_id: client.id, entite_type: "invoice", entite_id: invoice.id,
      action: "envoi_echec",
      nouvelle_valeur: String((erreurEnvoi as Error)?.message || erreurEnvoi),
    });
    return jsonResponse({ error: "Échec de l'envoi — vérifiez l'adresse et le mot de passe d'application Gmail dans Paramètres > Comptes Clients." }, 502);
  }

  // 9) Succès — statut facture + traçabilité.
  await supabase.from("invoices").update({ statut: "envoyee" }).eq("id", invoice.id);
  await supabase.from("client_comptes_audit_logs").insert({
    site: client.site, client_id: client.id, entite_type: "invoice", entite_id: invoice.id,
    action: "envoi_reussi",
    nouvelle_valeur: `Envoyée à ${contact.email_principal}`,
  });

  return jsonResponse({ success: true, destinataire: contact.email_principal });
});
