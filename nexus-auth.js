// NEXUS — nexus-auth.js
// À inclure sur CHAQUE page qui nécessite une connexion (Cockpit, Missions, Plan d'action, etc.)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="nexus-auth.js"></script>

const NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";
const NEXUS_SUPABASE_ANON_KEY = "sb_publishable_7dV43gZxDYg6MOa6xzmdDQ_m8Mean5p";

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);

// Vérifie qu'une session existe, sinon renvoie vers l'écran de connexion.
// Retourne les infos de l'employé connecté (id, username, nom, role) si OK.
async function nexusRequireAuth() {
  const { data: { session } } = await nexusClient.auth.getSession();

  if (!session) {
    window.location.href = "NEXUS-Login-v1.html";
    return null;
  }

  const { data: employee, error } = await nexusClient
    .from("employees")
    .select("id, username, nom, role")
    .eq("id", session.user.id)
    .single();

  if (error || !employee) {
    // Session valide mais pas de fiche employé associée -> déconnexion de sécurité
    await nexusClient.auth.signOut();
    window.location.href = "NEXUS-Login-v1.html";
    return null;
  }

  return employee;
}

// Déconnexion (à appeler depuis un bouton "Se déconnecter")
async function nexusLogout() {
  await nexusClient.auth.signOut();
  window.location.href = "NEXUS-Login-v1.html";
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
