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

// CORS — indispensable ici : NEXUS-Comptes-Clients-v1.html appelle cette
// fonction via fetch() direct (pas nexusClient.functions.invoke) avec un
// en-tête Authorization personnalisé, ce qui déclenche systématiquement une
// requête de pré-vérification OPTIONS côté navigateur. Sans ces en-têtes sur
// CHAQUE réponse (y compris OPTIONS), le navigateur bloque l'appel avant
// même qu'il n'atteigne cette fonction — bug réel rencontré le 13/08/2026
// (405 sur le préflight OPTIONS), corrigé en reprenant exactement la même
// convention que google-sheets-sync.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

function echapperHtml(texte: string): string {
  return (texte || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Mise en page HTML du message (13/08/2026, demande de Frédéric : "améliore la
// mise en page de l'envoi"). Avant ce correctif, nodemailer n'envoyait que
// `text:` (texte brut) — d'où le rendu sans aucune mise en forme dans la boîte
// de réception. Important : une vraie ligne "Objet" d'e-mail ne peut
// techniquement pas être mise en gras (limitation du protocole/MIME, pas de
// NEXUS) — en compensation, l'objet substitué (déjà en majuscules sur
// {{mois}}, voir plus bas) est repris en gras en tête du corps HTML, ce qui
// donne le même effet visuel une fois l'e-mail ouvert. Le reste du texte
// composé depuis le modèle (Paramètres > Comptes Clients) est conservé mot
// pour mot, seuls les sauts de ligne sont préservés (white-space:pre-line)
// plutôt que d'être remplacés un par un par des <br>.
function composerCorpsHtml(objet: string, corps: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.6; color:#1a1a1a; max-width:600px;">` +
    `<div style="font-size:16px; font-weight:700; margin:0 0 6px 0;">${echapperHtml(objet)}</div>` +
    `<div style="border-bottom:2px solid #e2e2e2; margin-bottom:16px;"></div>` +
    `<div style="white-space:pre-line;">${echapperHtml(corps)}</div>` +
    `</div>`;
}

Deno.serve(async (req: Request) => {
  // Requête de pré-vérification CORS — le navigateur l'envoie avant tout
  // POST avec en-tête Authorization personnalisé. Doit être répondue avant
  // toute autre logique, sans authentification.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée." }, 405);
  }

  let body: { invoiceId?: string; envoyerSansBons?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corps de requête invalide." }, 400);
  }
  const invoiceId = body && body.invoiceId;
  if (!invoiceId) return jsonResponse({ error: "invoiceId manquant." }, 400);
  // 06/10/2026 — confirmation explicite d'un envoi sans bons (voir 6bis).
  const envoyerSansBons = body.envoyerSansBons === true;

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

  // 6bis) Bons justificatifs — 13/08/2026, bug réel signalé par Frédéric (la
  // facture RMSJ est partie sans ses bons) : cette fonction ne lisait jamais
  // client_preferences.bons_joindre_email, alors que cette préférence pilote
  // déjà l'affichage "bons joints" dans NEXUS-Comptes-Clients. Si activée, on
  // joint tous les bons (supporting_documents, type_document 'bon') de la
  // MÊME période de facturation que la facture — jamais deviné, uniquement
  // ceux réellement rattachés à ce client pour cette période précise.
  //
  // 06/10/2026 — un client ne recevait plus ses bons depuis août : un bon
  // déposé dans la Boîte de réception naît sans client (client_id null), la
  // recherche ci-dessous ne le trouvait donc pas, et la facture partait seule
  // avec un "envoi_reussi". Désormais, quand le client attend ses bons par
  // e-mail et qu'aucun bon n'est trouvé (ou que la facture n'a pas de
  // période), l'envoi s'arrête et demande confirmation (409, code
  // BONS_MANQUANTS) ; confirmé (envoyerSansBons), la facture part seule et
  // l'envoi est tracé "envoi_sans_bons" — compté dans le KPI « Envoyées sans
  // bons » de Comptes Clients. Un bon illisible ou une lecture en échec
  // restent refusés sans confirmation possible : jamais un envoi à moitié.
  const attachments: { filename: string; content: Uint8Array }[] = [
    { filename: nomFichier, content: fichierBuffer },
  ];
  const { data: preferences, error: ePref } = await supabase
    .from("client_preferences").select("bons_joindre_email").eq("client_id", client.id).maybeSingle();
  if (ePref) {
    return jsonResponse({ error: "Impossible de lire les préférences d'envoi de ce client — facture non envoyée, réessayez." }, 500);
  }
  let motifSansBons: string | null = null;
  if (preferences && preferences.bons_joindre_email && !invoice.billing_period_id) {
    if (!envoyerSansBons) {
      return jsonResponse({ code: "BONS_MANQUANTS", error: "Ce client reçoit ses bons avec la facture, mais cette facture n'a pas de période (mois) : impossible de retrouver ses bons. Facture non envoyée — rattachez-la à sa période depuis la Boîte de réception." }, 409);
    }
    motifSansBons = "Facture sans période — envoyée sans bons sur confirmation";
  } else if (preferences && preferences.bons_joindre_email) {
    const { data: bons, error: eBons } = await supabase
      .from("supporting_documents").select("fichier_path")
      .eq("client_id", client.id).eq("billing_period_id", invoice.billing_period_id).eq("type_document", "bon");
    if (eBons) {
      return jsonResponse({ error: "Impossible de lire les bons de ce client — facture non envoyée, réessayez." }, 500);
    }
    if ((!bons || bons.length === 0) && !envoyerSansBons) {
      return jsonResponse({ code: "BONS_MANQUANTS", error: "Ce client reçoit ses bons avec la facture, mais aucun bon n'est rattaché à ce client pour ce mois. Facture non envoyée. Dans la Boîte de réception, choisissez le client de chaque bon « sans client », puis renvoyez — ou, s'il ne doit plus les recevoir, modifiez sa fiche client (Bons justificatifs : autre choix que « Joindre aux e-mails »)." }, 409);
    }
    if (!bons || bons.length === 0) motifSansBons = "Aucun bon rattaché pour ce mois — envoyée sans bons sur confirmation";
    for (const bon of bons || []) {
      const { data: fichierBon, error: eBon } = await supabase
        .storage.from("documents-a-traiter").download(bon.fichier_path);
      if (eBon || !fichierBon) {
        console.error("Bon illisible, envoi refusé:", bon.fichier_path, eBon);
        return jsonResponse({ error: `Impossible de récupérer le bon « ${bon.fichier_path.split("/").pop()} » — facture non envoyée, pour ne pas partir sans ses bons. Réessayez, ou redéposez ce bon dans la Boîte de réception.` }, 500);
      }
      attachments.push({
        filename: bon.fichier_path.split("/").pop() || "bon.pdf",
        content: new Uint8Array(await fichierBon.arrayBuffer()),
      });
    }
  }

  // 7) Message — mêmes variables et même logique de composition que
  // l'aperçu affiché dans Paramètres > Comptes Clients (voir en-tête).
  const moisTexte = billingPeriod ? MOIS_FR[(billingPeriod.mois || 1) - 1] : "";
  const variablesCorps: Record<string, string> = {
    "{{interlocuteur}}": composerFormuleAppel(contact),
    "{{compte_client}}": client.raison_sociale,
    "{{mois}}": moisTexte,
    "{{année}}": billingPeriod ? String(billingPeriod.annee) : "",
    "{{établissement}}": parametres.nom_etablissement || "",
    "{{signature}}": composerSignature(parametres),
  };
  // 13/08/2026, demande de Frédéric : "mets dans l'objet le mois en
  // majuscule" — uniquement l'objet, jamais le corps (la phrase "pour le mois
  // de juillet 2026" reste en minuscules dans le message). On clone donc les
  // variables pour l'objet avec {{mois}} en majuscules, sans toucher au reste
  // du modèle ni à celles utilisées pour le corps.
  const variablesObjet: Record<string, string> = { ...variablesCorps, "{{mois}}": moisTexte.toUpperCase() };
  const objetDefaut = "Votre facture — {{compte_client}}";
  const corpsDefaut = "{{interlocuteur}}\n\nVeuillez trouver ci-joint votre facture.\n\n{{signature}}";
  const objet = substituerModele((template && template.objet) || objetDefaut, variablesObjet);
  const corps = substituerModele((template && template.corps) || corpsDefaut, variablesCorps);
  const corpsHtml = composerCorpsHtml(objet, corps);

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
      html: corpsHtml,
      attachments,
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
    nouvelle_valeur: `Envoyée à ${contact.email_principal}` + (attachments.length > 1 ? ` — ${attachments.length - 1} bon(s) joint(s)` : ""),
  });
  if (motifSansBons) {
    const { error: eTrace } = await supabase.from("client_comptes_audit_logs").insert({
      site: client.site, client_id: client.id, entite_type: "invoice", entite_id: invoice.id,
      action: "envoi_sans_bons",
      nouvelle_valeur: `Envoyée à ${contact.email_principal} sans bons`,
      motif: motifSansBons,
    });
    if (eTrace) console.error("Trace envoi_sans_bons non écrite:", eTrace);
  }

  return jsonResponse({ success: true, destinataire: contact.email_principal });
});
