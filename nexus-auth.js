// NEXUS — nexus-auth.js
// À inclure sur CHAQUE page qui nécessite une connexion (Cockpit, Missions, Plan d'action, etc.)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="nexus-auth.js"></script>

const NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";
const NEXUS_SUPABASE_ANON_KEY = "sb_publishable_7dV43gZxDYg6MOa6xzmdDQ_m8Mean5p";

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);

// Vérifie qu'une session existe, sinon renvoie vers l'écran de connexion.
// Retourne les infos de l'employé connecté (id, username, nom, role,
// est_createur, site_id) si OK. est_createur et site_id ajoutés le
// 15/07/2026 — fondation multi-site, voir migration-multisite-fondation.sql.
//
// Surcharge de site pour le createur (15/07/2026, migration-acces-createur.sql) :
// si le compte est createur ET qu'un site "en consultation" est enregistre
// localement, employee.site_id est remplace par ce site pour cet ecran.
// Ceci ne donne AUCUN acces reel — les policies RLS refusent toute lecture
// si le site cible n'a pas donne son consentement (acces_createur_autorise).
// Le pire cas d'une surcharge non autorisee est donc un ecran vide, jamais
// une fuite de donnees. employee.consultation_externe indique si une
// surcharge est active, pour que les ecrans puissent l'afficher.
async function nexusRequireAuth() {
  const { data: { session } } = await nexusClient.auth.getSession();

  if (!session) {
    window.location.href = "NEXUS-Login-v1.html";
    return null;
  }

  const { data: employee, error } = await nexusClient
    .from("employees")
    .select("id, username, nom, role, est_createur, site_id")
    .eq("id", session.user.id)
    .single();

  if (error || !employee) {
    // Session valide mais pas de fiche employé associée -> déconnexion de sécurité
    await nexusClient.auth.signOut();
    window.location.href = "NEXUS-Login-v1.html";
    return null;
  }

  employee.consultation_externe = false;
  if (employee.est_createur) {
    const siteConsulte = localStorage.getItem('nexus_site_consulte_createur');
    if (siteConsulte && siteConsulte !== employee.site_id) {
      employee.site_id = siteConsulte;
      employee.consultation_externe = true;
    }
  }

  return employee;
}

// Déconnexion (à appeler depuis un bouton "Se déconnecter")
async function nexusLogout() {
  await nexusClient.auth.signOut();
  window.location.href = "NEXUS-Login-v1.html";
}

// Quitte le mode consultation d'un autre site (créateur uniquement) et
// revient sur son propre site.
function nexusQuitterConsultation() {
  localStorage.removeItem('nexus_site_consulte_createur');
  window.location.href = "NEXUS-App-v1.html";
}

// Exemple d'utilisation en haut de chaque page protégée :
//
// <script>
//   nexusRequireAuth().then(employee => {
//     if (!employee) return; // déjà redirigé vers login.html
//     document.querySelector("#nom-employe").textContent = employee.nom;
//     // Afficher/masquer des blocs selon employee.role ici (ex: Plan d'action = manager/gerant only)
//   });
// </script>
