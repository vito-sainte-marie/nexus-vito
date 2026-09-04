// NEXUS — nexus-auth.js
// À inclure sur CHAQUE page qui nécessite une connexion (Cockpit, Missions, Plan d'action, etc.)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="nexus-auth.js?v=20260904-0104"></script>

// Configuration d'environnement (04/09/2026). L'URL et la clé ne sont plus
// écrites ici : elles viennent de `nexus-config.js`, généré au build depuis
// les variables d'environnement. Un même code source sert donc la recette et
// la production, et c'est le build — jamais le dépôt — qui décide de la base
// visée.
//
// ÉCHEC FERMÉ : sans configuration valide, NEXUS refuse de démarrer et le
// dit. Il ne retombe sur aucune valeur par défaut — une valeur par défaut
// serait forcément celle d'un environnement, et ferait écrire la recette
// dans la base de l'autre.
const NEXUS_CFG = (typeof window !== 'undefined' && window.NEXUS_CONFIG) || null;
if (!NEXUS_CFG || !NEXUS_CFG.supabaseUrl || !NEXUS_CFG.supabaseCle || !NEXUS_CFG.environnement) {
  const manquant = !NEXUS_CFG ? 'nexus-config.js n’a pas été chargé'
    : 'nexus-config.js est incomplet (' + ['environnement','supabaseUrl','supabaseCle'].filter(c => !NEXUS_CFG[c]).join(', ') + ')';
  const message = 'NEXUS ne peut pas démarrer : ' + manquant
    + '. Ce fichier est produit au moment du build par outils/generer-config.js ; '
    + 'sans lui, l’application ignore à quelle base elle doit parler et refuse de deviner.';
  document.addEventListener('DOMContentLoaded', () => {
    document.body.innerHTML = '<div style="max-width:640px;margin:14vh auto;padding:22px;'
      + 'font:14px/1.6 system-ui,sans-serif;color:#EDF1F5;background:#141B22;'
      + 'border:1px solid #F0546B;border-radius:12px">'
      + '<strong style="color:#F0546B">Configuration absente</strong><br><br>'
      + message.replace(/</g, '&lt;') + '</div>';
  }, { once: true });
  throw new Error(message);
}

const NEXUS_SUPABASE_URL = NEXUS_CFG.supabaseUrl;
const NEXUS_SUPABASE_ANON_KEY = NEXUS_CFG.supabaseCle;
const NEXUS_ENVIRONNEMENT = NEXUS_CFG.environnement;

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);

(function chargerExtensionsInventaireV2() {
  const page = window.location.pathname.split('/').pop();
  const STOCK_BUILD = '20260831-1408';
  const versionnerStock = src => `${src}?v=${STOCK_BUILD}`;

  const pagesHorizon=['NEXUS-Inventaire-Manager-v1.html','NEXUS-Carburants-Pilotage-v1.html','NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Scanner-v1.html','NEXUS-Radar-Manager-v1.html','NEXUS-Centre-Intelligence-v1.html'];
  if(pagesHorizon.includes(page)){const s=document.createElement('script');s.src=versionnerStock('nexus-horizon-operationnel.js');s.defer=true;document.head.appendChild(s);}

  if (page === 'NEXUS-Inventaire-v1.html') {
    const scriptTransferts = document.createElement('script'); scriptTransferts.src = 'nexus-inventaire-transferts-internes.js'; scriptTransferts.defer = true; document.head.appendChild(scriptTransferts);
    const scriptCond = document.createElement('script'); scriptCond.src = versionnerStock('nexus-inventaire-cigarettes-conditionnement-v1.js'); scriptCond.defer = true; document.head.appendChild(scriptCond);
  }
  if (['NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html'].includes(page)) {
    const s=document.createElement('script');s.src='nexus-inventaire-stock-localise-entry.js';s.defer=true;document.head.appendChild(s);
  }
  if (['NEXUS-Inventaire-v1.html','NEXUS-Inventaire-Manager-v1.html','NEXUS-Parametres-Inventaire-v1.html'].includes(page)) {
    const s=document.createElement('script');s.src='nexus-inventaire-rotation-intelligente.js';s.defer=true;document.head.appendChild(s);
  }
  if (page === 'NEXUS-Parametres-Inventaire-v1.html') {
    ['nexus-inventaire-reglages-specifiques.js','nexus-inventaire-parametres-stock-localise.js','nexus-inventaire-regles-ux-v2.js','nexus-inventaire-regles-finition-v2.js',versionnerStock('nexus-inventaire-parametres-reassort-v1.js')].forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  }
  if (page === 'NEXUS-Stock-Localise-v1.html') {
    const scripts=[versionnerStock('nexus-inventaire-conditionnement.js'),'nexus-inventaire-stock-localise-ux-v2.js','nexus-inventaire-stock-controle-cible-v2.js','nexus-inventaire-stock-transfert-v2.js',versionnerStock('nexus-inventaire-reassort-boutique-v1.js'),versionnerStock('nexus-inventaire-conditionnement-stock-localise.js'),versionnerStock('nexus-inventaire-stock-transfert-deeplink-v1.js')];
    scripts.forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  }

  const pagesStockMoteur=['NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Scanner-v1.html','NEXUS-Radar-Manager-v1.html','NEXUS-Centre-Intelligence-v1.html'];
  if(pagesStockMoteur.includes(page)){const s=document.createElement('script');s.src=versionnerStock('nexus-stock-moteur.js');s.defer=true;document.head.appendChild(s);}
  const pagesDecisionStock=['NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Centre-Intelligence-v1.html'];
  if(pagesDecisionStock.includes(page)) ['nexus-reappro-stock-v1.js','nexus-conseiller-stock-v3.js'].forEach(src=>{const s=document.createElement('script');s.src=versionnerStock(src);s.defer=true;document.head.appendChild(s);});
  if(page==='NEXUS-Cockpit-v2.html'){const s=document.createElement('script');s.src=versionnerStock('nexus-cockpit-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-Scanner-v1.html'){const s=document.createElement('script');s.src=versionnerStock('nexus-scanner-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-Radar-Manager-v1.html'){const s=document.createElement('script');s.src=versionnerStock('nexus-radar-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-FDJ-v1.html'){const s=document.createElement('script');s.src='nexus-fdj-correction-stock-depart.js';s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-FDJ-Manager-v1.html'){const s=document.createElement('script');s.src='nexus-fdj-manager-stabilite.js';s.defer=true;document.head.appendChild(s);}
  if(page==='NEXUS-Inventaire-Manager-v1.html') ['nexus-inventaire-manager-premium-v2.js','nexus-inventaire-manager-fullwidth-v2.js',versionnerStock('nexus-inventaire-manager-reassort-cigarettes-v3.js'),versionnerStock('nexus-inventaire-couverture-operationnelle-v1.js')].forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  if(page==='NEXUS-Carburants-Pilotage-v1.html'){
    ['nexus-carburant-commande-coherence-v1.js','nexus-carburant-demarrage-mois-v1.js'].forEach(src=>{const s=document.createElement('script');s.src=versionnerStock(src);s.defer=true;document.head.appendChild(s);});
  }
  if(page==='NEXUS-Carburant-Reception-v1.html'){const s=document.createElement('script');s.src=versionnerStock('nexus-reception-mobile-fix-v1.js');s.defer=true;document.head.appendChild(s);}
})();

async function nexusAttendreGardeModeTestInventaire() {
  if (window.NEXUS_INVENTAIRE_MODE_TEST_READY) return true;
  for (let i = 0; i < 120; i++) {
    await new Promise(resolve => setTimeout(resolve, 25));
    if (window.NEXUS_INVENTAIRE_MODE_TEST_READY) return true;
  }
  console.error('Mode test Inventaire : garde de simulation non prête, test annulé par sécurité.');
  return false;
}

async function nexusRequireAuth() {
  const { data: { session } } = await nexusClient.auth.getSession();
  if (!session) { window.location.href = "NEXUS-Login-v1.html"; return null; }
  const { data: employee, error } = await nexusClient.from("employees").select("id, username, nom, role, est_createur, site_id").eq("id", session.user.id).single();
  if (error || !employee) { await nexusClient.auth.signOut(); window.location.href = "NEXUS-Login-v1.html"; return null; }
  if (!employee.site_id) { console.error('nexusRequireAuth: employé sans site_id — configuration de compte incomplète.'); await nexusClient.auth.signOut(); window.location.href = "NEXUS-Login-v1.html?erreur=site_manquant"; return null; }
  employee.consultation_externe=false;
  if(employee.est_createur){const siteConsulte=localStorage.getItem('nexus_site_consulte_createur');if(siteConsulte&&siteConsulte!==employee.site_id){employee.site_id=siteConsulte;employee.consultation_externe=true;}}
  employee.role_reel=employee.role;
  if(await nexusPriseDePosteManquante(employee)){const p=(window.location.pathname.split('/').pop()||'NEXUS-App-v1.html')+window.location.search;window.location.href=`NEXUS-Prise-De-Poste-v1.html?retour=${encodeURIComponent(p)}`;return null;}
  if(await nexusPointageArriveeManquant(employee)){const p=(window.location.pathname.split('/').pop()||'NEXUS-App-v1.html')+window.location.search;window.location.href=`NEXUS-Pointage-v1.html?retour=${encodeURIComponent(p)}`;return null;}
  const pageActuelleAuth=window.location.pathname.split('/').pop();
  if(pageActuelleAuth==='NEXUS-Inventaire-v1.html'&&(employee.role_reel==='manager'||employee.role_reel==='gerant')){
    const r=new URLSearchParams(window.location.search).get('test_role');
    const a={caissier:'caissier',caissiere:'caissier','caissière':'caissier',pompiste:'pompiste',renfort:'renfort'};
    const rt=r?a[String(r).toLowerCase()]:null;
    employee.role_test_inventaire=rt||null;
    employee.mode_test_inventaire=!!rt;
    // Sécurité P0 : si un rôle de test est demandé, l'authentification ne
    // rend la main à l'écran Inventaire qu'une fois les no-op d'écriture et
    // le quart virtuel installés. Si la garde ne charge pas, on retire le
    // paramètre de test plutôt que d'exécuter une simulation potentiellement
    // écrivante sur les données officielles.
    if (employee.mode_test_inventaire) {
      const gardePrete = await nexusAttendreGardeModeTestInventaire();
      if (!gardePrete) {
        employee.role_test_inventaire = null;
        employee.mode_test_inventaire = false;
        const u = new URL(window.location.href);
        u.searchParams.delete('test_role');
        window.location.replace(u.pathname.split('/').pop() + u.search + u.hash);
        return null;
      }
    }
  }
  return employee;
}

const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE=['NEXUS-Pointage-v1.html','NEXUS-Prise-De-Poste-v1.html'];
async function nexusPointageArriveeManquant(employee){const page=window.location.pathname.split('/').pop();if(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(page)||employee.consultation_externe)return false;const siteId=employee.site_id;const manager=employee.role==='manager'||employee.role==='gerant';const {data:config}=await nexusClient.from('station_config').select('pointage_actif, manager_pointage_requis').eq('site',siteId).maybeSingle();if(config&&config.pointage_actif===false)return false;if(manager&&(!config||!config.manager_pointage_requis))return false;const d=new Date();const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const {data:arrivee,error}=await nexusClient.from('pointages').select('id').eq('employee_id',employee.id).eq('date',today).eq('type','arrivee').maybeSingle();if(error){console.error('Vérification pointage arrivée:',error);return false;}return !arrivee;}
async function nexusPriseDePosteManquante(employee){const page=window.location.pathname.split('/').pop();if(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(page)||employee.consultation_externe)return false;const manager=employee.role==='manager'||employee.role==='gerant';if(manager)return false;const d=new Date();const debut=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T00:00:00`;const {data:shiftDuJour,error}=await nexusClient.from('shifts').select('id').eq('employee_id',employee.id).gte('heure_debut',debut).limit(1).maybeSingle();if(error){console.error('Vérification prise de poste:',error);return false;}return !shiftDuJour;}
async function nexusLogout(){await nexusClient.auth.signOut();window.location.href="index.html";}
function nexusQuitterConsultation(){localStorage.removeItem('nexus_site_consulte_createur');window.location.href="NEXUS-App-v1.html";}
