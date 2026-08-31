// NEXUS — nexus-auth.js
// À inclure sur CHAQUE page qui nécessite une connexion (Cockpit, Missions, Plan d'action, etc.)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="nexus-auth.js"></script>

const NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";
const NEXUS_SUPABASE_ANON_KEY = "sb_publishable_7dV43gZxDYg6MOa6xzmdDQ_m8Mean5p";

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);

(function chargerExtensionsInventaireV2() {
  const page = window.location.pathname.split('/').pop();
  if (page === 'NEXUS-Inventaire-v1.html') {
    const scriptTest = document.createElement('script');
    scriptTest.src = 'nexus-inventaire-mode-test.js';
    scriptTest.defer = true;
    document.head.appendChild(scriptTest);

    const scriptTransferts = document.createElement('script');
    scriptTransferts.src = 'nexus-inventaire-transferts-internes.js';
    scriptTransferts.defer = true;
    document.head.appendChild(scriptTransferts);
  }
  if (['NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html'].includes(page)) {
    const scriptStockEntry = document.createElement('script');
    scriptStockEntry.src = 'nexus-inventaire-stock-localise-entry.js';
    scriptStockEntry.defer = true;
    document.head.appendChild(scriptStockEntry);
  }
  if (['NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html', 'NEXUS-Parametres-Inventaire-v1.html'].includes(page)) {
    const scriptRotation = document.createElement('script');
    scriptRotation.src = 'nexus-inventaire-rotation-intelligente.js';
    scriptRotation.defer = true;
    document.head.appendChild(scriptRotation);
  }
  if (page === 'NEXUS-Parametres-Inventaire-v1.html') {
    const scriptReglages = document.createElement('script');
    scriptReglages.src = 'nexus-inventaire-reglages-specifiques.js';
    scriptReglages.defer = true;
    document.head.appendChild(scriptReglages);

    const scriptStockLocalise = document.createElement('script');
    scriptStockLocalise.src = 'nexus-inventaire-parametres-stock-localise.js';
    scriptStockLocalise.defer = true;
    document.head.appendChild(scriptStockLocalise);

    const scriptReglesUx = document.createElement('script');
    scriptReglesUx.src = 'nexus-inventaire-regles-ux-v2.js';
    scriptReglesUx.defer = true;
    document.head.appendChild(scriptReglesUx);

    const scriptReglesFinition = document.createElement('script');
    scriptReglesFinition.src = 'nexus-inventaire-regles-finition-v2.js';
    scriptReglesFinition.defer = true;
    document.head.appendChild(scriptReglesFinition);
  }
  if (page === 'NEXUS-Stock-Localise-v1.html') {
    const scriptStockLocaliseUx = document.createElement('script');
    scriptStockLocaliseUx.src = 'nexus-inventaire-stock-localise-ux-v2.js';
    scriptStockLocaliseUx.defer = true;
    document.head.appendChild(scriptStockLocaliseUx);

    const scriptControleCible = document.createElement('script');
    scriptControleCible.src = 'nexus-inventaire-stock-controle-cible-v2.js';
    scriptControleCible.defer = true;
    document.head.appendChild(scriptControleCible);
  }
  if (page === 'NEXUS-FDJ-v1.html') {
    const scriptCorrectionDepart = document.createElement('script');
    scriptCorrectionDepart.src = 'nexus-fdj-correction-stock-depart.js';
    scriptCorrectionDepart.defer = true;
    document.head.appendChild(scriptCorrectionDepart);
  }
  if (page === 'NEXUS-FDJ-Manager-v1.html') {
    const scriptFdjManagerStabilite = document.createElement('script');
    scriptFdjManagerStabilite.src = 'nexus-fdj-manager-stabilite.js';
    scriptFdjManagerStabilite.defer = true;
    document.head.appendChild(scriptFdjManagerStabilite);
  }
  if (page === 'NEXUS-Inventaire-Manager-v1.html') {
    const scriptManagerPremium = document.createElement('script');
    scriptManagerPremium.src = 'nexus-inventaire-manager-premium-v2.js';
    scriptManagerPremium.defer = true;
    document.head.appendChild(scriptManagerPremium);

    const scriptManagerFullwidth = document.createElement('script');
    scriptManagerFullwidth.src = 'nexus-inventaire-manager-fullwidth-v2.js';
    scriptManagerFullwidth.defer = true;
    document.head.appendChild(scriptManagerFullwidth);
  }
})();

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
    await nexusClient.auth.signOut();
    window.location.href = "NEXUS-Login-v1.html";
    return null;
  }

  if (!employee.site_id) {
    console.error('nexusRequireAuth: employé sans site_id — configuration de compte incomplète. Refus de continuer avec un site déduit arbitrairement.');
    await nexusClient.auth.signOut();
    window.location.href = "NEXUS-Login-v1.html?erreur=site_manquant";
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

  employee.role_reel = employee.role;

  if (await nexusPriseDePosteManquante(employee)) {
    const pageActuelle = (window.location.pathname.split('/').pop() || 'NEXUS-App-v1.html') + window.location.search;
    window.location.href = `NEXUS-Prise-De-Poste-v1.html?retour=${encodeURIComponent(pageActuelle)}`;
    return null;
  }

  if (await nexusPointageArriveeManquant(employee)) {
    const pageActuelle = (window.location.pathname.split('/').pop() || 'NEXUS-App-v1.html') + window.location.search;
    window.location.href = `NEXUS-Pointage-v1.html?retour=${encodeURIComponent(pageActuelle)}`;
    return null;
  }

  const pageActuelleAuth = window.location.pathname.split('/').pop();
  if (pageActuelleAuth === 'NEXUS-Inventaire-v1.html' && (employee.role_reel === 'manager' || employee.role_reel === 'gerant')) {
    const roleTestDemande = new URLSearchParams(window.location.search).get('test_role');
    const aliases = {
      caissier: 'caissier', caissiere: 'caissier', 'caissière': 'caissier',
      pompiste: 'pompiste', renfort: 'renfort'
    };
    const roleTest = roleTestDemande ? aliases[String(roleTestDemande).toLowerCase()] : null;
    employee.role_test_inventaire = roleTest || null;
    employee.mode_test_inventaire = !!roleTest;
  }

  return employee;
}

const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE = ['NEXUS-Pointage-v1.html', 'NEXUS-Prise-De-Poste-v1.html'];

async function nexusPointageArriveeManquant(employee) {
  const pageActuelle = window.location.pathname.split('/').pop();
  if (NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(pageActuelle)) return false;
  if (employee.consultation_externe) return false;

  const siteId = employee.site_id;
  const estNiveauManager = employee.role === 'manager' || employee.role === 'gerant';

  const { data: config } = await nexusClient
    .from('station_config').select('pointage_actif, manager_pointage_requis').eq('site', siteId).maybeSingle();

  if (config && config.pointage_actif === false) return false;

  if (estNiveauManager) {
    if (!config || !config.manager_pointage_requis) return false;
  }

  const d = new Date();
  const todayISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { data: arrivee, error } = await nexusClient
    .from('pointages').select('id').eq('employee_id', employee.id).eq('date', todayISO).eq('type', 'arrivee').maybeSingle();
  if (error) { console.error('Vérification pointage arrivée:', error); return false; }
  return !arrivee;
}

async function nexusPriseDePosteManquante(employee) {
  const pageActuelle = window.location.pathname.split('/').pop();
  if (NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(pageActuelle)) return false;
  if (employee.consultation_externe) return false;

  const estNiveauManager = employee.role === 'manager' || employee.role === 'gerant';
  if (estNiveauManager) return false;

  const d = new Date();
  const debutJourISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;
  const { data: shiftDuJour, error } = await nexusClient
    .from('shifts').select('id').eq('employee_id', employee.id).gte('heure_debut', debutJourISO).limit(1).maybeSingle();
  if (error) { console.error('Vérification prise de poste:', error); return false; }
  return !shiftDuJour;
}

async function nexusLogout() {
  await nexusClient.auth.signOut();
  window.location.href = "index.html";
}

function nexusQuitterConsultation() {
  localStorage.removeItem('nexus_site_consulte_createur');
  window.location.href = "NEXUS-App-v1.html";
}
