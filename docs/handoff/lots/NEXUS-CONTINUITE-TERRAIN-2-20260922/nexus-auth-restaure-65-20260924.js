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

// `nexus-page.js` est posé par le même build que `nexus-config.js`, juste
// avant ce fichier. Son absence ne doit pas se manifester par une
// `ReferenceError` au milieu d'un garde de navigation : on le dit.
// `nexus-build.js` porte l'identité de la génération ET la primitive qui
// épingle les ressources chargées à l'exécution. Sans lui, ce fichier ne peut
// pas construire une URL versionnée — et il ne doit surtout pas en inventer
// une : c'est exactement ce qu'il faisait jusqu'au 05/09/2026 avec sa propre
// constante de génération, figée au 31 août, qui gouvernait dix-huit scripts
// et faisait charger au Cockpit des fichiers vieux de cinq jours.
if (typeof NexusBuild === 'undefined' || typeof NexusBuild.versionner !== 'function') {
  throw new Error('NEXUS ne peut pas démarrer : nexus-build.js n’a pas été chargé. '
    + 'Il porte l’identité de la génération et la seule primitive autorisée à '
    + 'épingler une ressource. Aucune valeur de repli n’est prévue : une seconde '
    + 'génération est précisément le défaut que ce garde-fou empêche.');
}

if (typeof NexusPage === 'undefined' || typeof NexusPage.est !== 'function') {
  throw new Error('NEXUS ne peut pas démarrer : nexus-page.js n’a pas été chargé. '
    + 'Ce fichier identifie la page courante indépendamment de l’hébergeur ; '
    + 'sans lui, les gardes de séquence obligatoire boucleraient.');
}

const NEXUS_SUPABASE_URL = NEXUS_CFG.supabaseUrl;
const NEXUS_SUPABASE_ANON_KEY = NEXUS_CFG.supabaseCle;
const NEXUS_ENVIRONNEMENT = NEXUS_CFG.environnement;

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);

(function chargerExtensionsInventaireV2() {
  const page = NexusPage.identifiant();

  const pagesHorizon=['NEXUS-Inventaire-Manager-v1.html','NEXUS-Carburants-Pilotage-v1.html','NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Scanner-v1.html','NEXUS-Radar-Manager-v1.html','NEXUS-Centre-Intelligence-v1.html'];
  if(NexusPage.est(pagesHorizon)){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-horizon-operationnel.js');s.defer=true;document.head.appendChild(s);}

  if (NexusPage.est('NEXUS-Inventaire-v1.html')) {
    const scriptTransferts = document.createElement('script'); scriptTransferts.src = NexusBuild.versionner('nexus-inventaire-transferts-internes.js'); scriptTransferts.defer = true; document.head.appendChild(scriptTransferts);
    const scriptCond = document.createElement('script'); scriptCond.src = NexusBuild.versionner('nexus-inventaire-cigarettes-conditionnement-v1.js'); scriptCond.defer = true; document.head.appendChild(scriptCond);
  }
  if (NexusPage.est(['NEXUS-Inventaire-v1.html', 'NEXUS-Inventaire-Manager-v1.html'])) {
    const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-inventaire-stock-localise-entry.js');s.defer=true;document.head.appendChild(s);
  }
  if (NexusPage.est(['NEXUS-Inventaire-v1.html','NEXUS-Inventaire-Manager-v1.html','NEXUS-Parametres-Inventaire-v1.html'])) {
    const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-inventaire-rotation-intelligente.js');s.defer=true;document.head.appendChild(s);
  }
  if (NexusPage.est('NEXUS-Parametres-Inventaire-v1.html')) {
    [NexusBuild.versionner('nexus-inventaire-reglages-specifiques.js'),NexusBuild.versionner('nexus-inventaire-parametres-stock-localise.js'),NexusBuild.versionner('nexus-inventaire-regles-ux-v2.js'),NexusBuild.versionner('nexus-inventaire-regles-finition-v2.js'),NexusBuild.versionner('nexus-inventaire-parametres-reassort-v1.js')].forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  }
  if (NexusPage.est('NEXUS-Stock-Localise-v1.html')) {
    const scripts=[NexusBuild.versionner('nexus-inventaire-conditionnement.js'),NexusBuild.versionner('nexus-inventaire-stock-localise-ux-v2.js'),NexusBuild.versionner('nexus-inventaire-stock-controle-cible-v2.js'),NexusBuild.versionner('nexus-inventaire-stock-transfert-v2.js'),NexusBuild.versionner('nexus-inventaire-reassort-boutique-v1.js'),NexusBuild.versionner('nexus-inventaire-conditionnement-stock-localise.js'),NexusBuild.versionner('nexus-inventaire-stock-transfert-deeplink-v1.js')];
    scripts.forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  }

  const pagesStockMoteur=['NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Scanner-v1.html','NEXUS-Radar-Manager-v1.html','NEXUS-Centre-Intelligence-v1.html'];
  if(NexusPage.est(pagesStockMoteur)){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-stock-moteur.js');s.defer=true;document.head.appendChild(s);}
  const pagesDecisionStock=['NEXUS-App-v1.html','NEXUS-Cockpit-v2.html','NEXUS-Centre-Intelligence-v1.html'];
  if(NexusPage.est(pagesDecisionStock)) ['nexus-reappro-stock-v1.js','nexus-conseiller-stock-v3.js'].forEach(src=>{const s=document.createElement('script');s.src=NexusBuild.versionner(src);s.defer=true;document.head.appendChild(s);});
  if(NexusPage.est('NEXUS-Cockpit-v2.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-cockpit-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-Scanner-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-scanner-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-Radar-Manager-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-radar-stock-v3.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-FDJ-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-fdj-correction-stock-depart.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-FDJ-Manager-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-fdj-manager-stabilite.js');s.defer=true;document.head.appendChild(s);}
  if(NexusPage.est('NEXUS-Inventaire-Manager-v1.html')) [NexusBuild.versionner('nexus-inventaire-manager-premium-v2.js'),NexusBuild.versionner('nexus-inventaire-manager-fullwidth-v2.js'),NexusBuild.versionner('nexus-inventaire-manager-reassort-cigarettes-v3.js'),NexusBuild.versionner('nexus-inventaire-couverture-operationnelle-v1.js')].forEach(src=>{const s=document.createElement('script');s.src=src;s.defer=true;document.head.appendChild(s);});
  if(NexusPage.est('NEXUS-Carburants-Pilotage-v1.html')){
    ['nexus-carburant-commande-coherence-v1.js','nexus-carburant-demarrage-mois-v1.js'].forEach(src=>{const s=document.createElement('script');s.src=NexusBuild.versionner(src);s.defer=true;document.head.appendChild(s);});
  }
  if(NexusPage.est('NEXUS-Carburant-Reception-v1.html')){const s=document.createElement('script');s.src=NexusBuild.versionner('nexus-reception-mobile-fix-v1.js');s.defer=true;document.head.appendChild(s);}
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
  const pageActuelleAuth=NexusPage.identifiant();
  if(NexusPage.est('NEXUS-Inventaire-v1.html')&&(employee.role_reel==='manager'||employee.role_reel==='gerant')){
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
  // A3 / A3-6 (05/09/2026) — le nom du commerce dans les pieds de page.
  //
  // Trente écrans affichaient « Vito Sainte-Marie Usine » en pied de page.
  // Aucune décision n'en dépendait — c'est pourquoi ce lot est venu en
  // dernier — mais un produit multi-site ne peut pas signer chaque écran du
  // nom d'un autre client.
  //
  // Un seul mécanisme, ici, plutôt que trente lectures : cette fonction est
  // le seul endroit qui tourne sur TOUS les écrans. Elle remplit les
  // `<span class="nexus-nom-commerce">` et ne bloque rien — le rendu n'attend
  // pas le réseau. Même doctrine qu'en B1 : nom réel, sinon identifiant du
  // commerce, sinon libellé neutre. Jamais le nom d'un autre.
  nexusRemplirNomDuCommerce(employee);
  return employee;
}

let NEXUS_NOM_COMMERCE_PROMESSE = null;
async function nexusRemplirNomDuCommerce(employee) {
  const cibles = document.querySelectorAll('.nexus-nom-commerce');
  if (!cibles.length) return;
  const siteId = employee && employee.site_id;
  if (!NEXUS_NOM_COMMERCE_PROMESSE) {
    NEXUS_NOM_COMMERCE_PROMESSE = (async () => {
      const { data, error } = await nexusClient.from('sites').select('nom_entreprise').eq('site_id', siteId).maybeSingle();
      if (error) { console.error('Lecture identité du commerce :', error); return siteId || 'Commerce non identifié'; }
      if (!data || !data.nom_entreprise) { console.warn('Identité du commerce non configurée — pied de page neutre.'); return siteId || 'Commerce non identifié'; }
      return data.nom_entreprise;
    })();
  }
  const nom = await NEXUS_NOM_COMMERCE_PROMESSE;
  document.querySelectorAll('.nexus-nom-commerce').forEach(el => { el.textContent = nom; });
}

const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE=['NEXUS-Pointage-v1.html','NEXUS-Prise-De-Poste-v1.html'];

// Manager ou gérant — LA réponse, une seule fois. Elle était écrite deux
// fois dans ce fichier et une fois de plus dans chaque écran qui en a besoin.
// Ce n'est pas une habilitation : les droits réels sont ceux de la RLS, qui
// ne lit pas cette fonction. C'est la règle d'AFFICHAGE et de journal — à
// qui NEXUS propose une action, et qui il nomme quand il l'enregistre.
function nexusEstManager(employee){
  return !!employee && (employee.role === 'manager' || employee.role === 'gerant');
}
async function nexusPointageArriveeManquant(employee){if(NexusPage.est(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE)||employee.consultation_externe)return false;const siteId=employee.site_id;const manager=nexusEstManager(employee);const {data:config}=await nexusClient.from('station_config').select('pointage_actif, manager_pointage_requis').eq('site',siteId).maybeSingle();if(config&&config.pointage_actif===false)return false;if(manager&&(!config||!config.manager_pointage_requis))return false;const d=new Date();const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const {data:arrivee,error}=await nexusClient.from('pointages').select('id').eq('employee_id',employee.id).eq('date',today).eq('type','arrivee').maybeSingle();if(error){console.error('Vérification pointage arrivée:',error);return false;}return !arrivee;}

// Conservée uniquement pour nexusDepartPointeAujourdhui, qui reste sur
// l'horloge de l'appareil — hors périmètre de cette restauration
// (request-11 §4 : migration exclue, couplée à la classification d'accès).
function nexusDateLocaleISO(d){
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// ============================================================================
// CYCLE DE VIE DES SERVICES PENDANT LA PHASE PILOTE (16/09/2026)
//
// LE FAIT. Trois services étaient encore `en_cours` en Production : un depuis
// le 14/09, un depuis le 15/09, un quart du matin déjà fini. Personne n'avait
// pointé de départ. `nexusServiceCourant` les VOYAIT — il les ignorait depuis
// le 11/09 et l'écrivait dans la console — mais rien ne les refermait : ils
// restaient « actifs » pour le manager, indéfiniment.
//
// L'ARBITRAGE. NEXUS est utilisé de façon intermittente pendant le pilote.
// Exiger le pointage fermerait l'application à ceux qui ne l'ont pas utilisée ;
// inventer une heure de fin fabriquerait des durées fausses, comme les
// 2 jours 00 h 24 que la migration P-2 vient d'effacer. Le seul modèle
// cohérent : NEXUS referme seul, dit qu'il l'a fait, et n'écrit AUCUNE heure
// de fin — ou le manager régularise, et NEXUS écrit que c'est lui.
//
// CE QUE CETTE SECTION NE FAIT PAS. Elle ne décide pas ce qui est obsolète :
// la règle vit dans `nexus-pointage-regles.js`, et sans ce module rien n'est
// tenté plutôt qu'une version locale recopiée. Sept copies d'une même règle de
// pointage ont déjà coûté une journée.
//
// Quatre fonctions, et une seule écriture :
//   nexusReglesPilote()                    — le module de règles, ou null
//   nexusAppliquerCloturePilote()          — L'écriture, paramétrée par la décision
//   nexusCloturerServicesObsoletes()       — décision de NEXUS  (cloture_par NULL)
//   nexusServicesOuvertsDuSite()           — la lecture d'équipe du manager
//   nexusRegulariserServicesObsoletes()    — décision du manager (cloture_par = lui)
// ============================================================================
function nexusReglesPilote(){
  const regles = (typeof NexusPointageRegles !== 'undefined') ? NexusPointageRegles : null;
  if(regles && regles.MOTIF_CLOTURE_PILOTE && regles.SOURCE_CLOTURE_PILOTE) return regles;
  console.error('Cycle des services : nexus-pointage-regles.js n’est pas chargé par cet écran — aucune clôture n’est tentée. Ni le motif ni la source ne se recopient ici : ils n’existent qu’à un seul endroit, et un écran qui les recopierait les ferait diverger.');
  return null;
}

/**
 * L'ÉCRITURE de clôture — une seule, quelle que soit la décision.
 * ─────────────────────────────────────────────────────────────────
 * Deux appelants aujourd'hui : NEXUS qui referme seul au retour dans
 * l'application, et le manager qui régularise plusieurs services d'un geste.
 * Ils diffèrent par la DÉCISION — qui la prend, ce qu'elle inscrit — et par
 * rien d'autre. La forme écrite, elle, doit être rigoureusement la même :
 * `clos_sans_pointage`, `heure_fin` NULLE, un motif, une source, un instant.
 *
 * Séparer les deux chemins d'écriture reviendrait à préparer la divergence
 * que P-2 vient d'effacer en base — 43 heures de fin fabriquées en Test, 2 en
 * Production, parce qu'un chemin inventait ce qu'un autre refusait d'inventer.
 *
 * @param {Array}  services  [{ service: {id}, motif: <clé de MOTIF_CLOTURE_PILOTE> }]
 * @param {object} decision
 * @param {string} decision.source     une valeur de SOURCE_CLOTURE_PILOTE, jamais un littéral
 * @param {string} decision.par        l'employee.id du décideur, ou null si c'est NEXUS
 * @param {function} decision.motifPour (obsolete, MOTIFS) -> le texte écrit
 *
 * Retour : { closes, tentees, refuses, indisponible?, invalide? } — jamais
 * d'exception. Une clôture de ménage ne doit pas empêcher un écran de s'ouvrir.
 */
async function nexusAppliquerCloturePilote(services, decision){
  const regles = nexusReglesPilote();
  if(!regles) return { closes: 0, tentees: 0, refuses: [], indisponible: true };

  // La source est vérifiée ICI, avant la première écriture, et pas laissée à
  // `shifts_cloture_source_check`. La base refuserait tout aussi bien — mais
  // après le clic du manager, service par service, avec un message qu'il ne
  // peut pas lire.
  const sourcesConnues = Object.keys(regles.SOURCE_CLOTURE_PILOTE).map(c => regles.SOURCE_CLOTURE_PILOTE[c]);
  if(!decision || sourcesConnues.indexOf(decision.source) === -1 || typeof decision.motifPour !== 'function'){
    console.error('Cycle des services : décision de clôture invalide (source « ' + (decision && decision.source) + ' ») — rien n’est écrit.');
    return { closes: 0, tentees: 0, refuses: [], invalide: true };
  }
  if(!services || !services.length) return { closes: 0, tentees: 0, refuses: [] };

  const maintenant = new Date().toISOString();
  const refuses = [];
  let closes = 0;
  for(const obsolete of services){
    if(!obsolete || !obsolete.service || !obsolete.service.id){
      console.error('Cycle des services : entrée sans service identifié, ignorée.');
      continue;
    }
    // Le motif vient du module de règles, jamais d'un littéral local. Sans
    // motif, on ne referme pas : une clôture muette ne dirait pas pourquoi.
    const motif = decision.motifPour(obsolete, regles.MOTIF_CLOTURE_PILOTE);
    if(!motif){
      console.error('Cycle des services : aucun motif pour le service ' + obsolete.service.id + ' — il reste ouvert.');
      refuses.push(obsolete.service.id);
      continue;
    }
    const { data, error } = await nexusClient
      .from('shifts')
      .update({
        statut:         'clos_sans_pointage',
        // NULLE, et pas `now()`. C'est le cœur de l'arbitrage du 16/09 :
        // NEXUS ne sait pas quand l'employé a fini, donc NEXUS ne l'écrit pas.
        heure_fin:      null,
        cloture_source: decision.source,
        cloture_le:     maintenant,
        cloture_par:    decision.par || null,
        cloture_motif:  motif,
      })
      // `statut = en_cours` dans le filtre, et pas seulement l'identifiant :
      // deux onglets ouverts font la même chose en même temps. Le second ne
      // doit pas réécrire une clôture déjà posée, ni compter comme un succès.
      .eq('id', obsolete.service.id)
      .eq('statut', 'en_cours')
      .select('id');
    if(error){
      console.error('Cycle des services : clôture du service ' + obsolete.service.id + ' impossible —', error);
      refuses.push(obsolete.service.id);
      continue;
    }
    // Zéro ligne SANS erreur : un refus de RLS ne lève rien, et une clôture
    // concurrente non plus. On dit ce qui est mesuré, on ne tranche pas
    // entre deux causes qu'on n'a pas observées.
    if(!data || !data.length){
      console.error('Cycle des services : le service ' + obsolete.service.id + ' n’a pas été modifié — il a été fermé entre-temps, ou cette écriture est refusée.');
      refuses.push(obsolete.service.id);
      continue;
    }
    closes++;
  }
  return { closes, tentees: services.length, refuses };
}

/**
 * NEXUS referme seul, au retour dans l'application. `cloture_par` NULL :
 * aucun humain n'a pris cette décision, et le journal doit pouvoir le dire.
 */
async function nexusCloturerServicesObsoletes(employee, services){
  const regles = nexusReglesPilote();
  if(!regles) return { closes: 0, tentees: 0, refuses: [], indisponible: true };
  if(!employee || !employee.id || !services || !services.length) return { closes: 0, tentees: 0, refuses: [] };

  const bilan = await nexusAppliquerCloturePilote(services, {
    source: regles.SOURCE_CLOTURE_PILOTE.automatique,
    par:    null,
    // Le motif suit le critère qui a rendu le service obsolète ; le repli sur
    // `jour_precedent` couvre une clé que ce module ne connaîtrait pas encore.
    motifPour: (obsolete, MOTIFS) => MOTIFS[obsolete.motif] || MOTIFS.jour_precedent,
  });
  if(bilan.closes > 0){
    console.info('Cycle des services : ' + bilan.closes + ' service(s) refermé(s) sans heure de fin (phase pilote).');
  }
  return bilan;
}

/**
 * Les services encore ouverts du site — la lecture d'équipe, ici et nulle
 * part ailleurs.
 * ────────────────────────────────────────────────────────
 * Aucun écran de NEXUS ne lisait jusqu'ici les services de l'équipe : deux
 * seulement touchent `shifts`, et tous deux pour l'employé courant. Cette
 * lecture existe pour que l'action de régularisation du manager n'ouvre pas un
 * troisième accès direct à la table depuis une page.
 *
 * AUCUNE garde de rôle ici, volontairement : la barrière est `select_shifts`,
 * qui rend à un employé ordinaire ses propres services et à un manager ceux
 * de son site. Dupliquer la règle en JavaScript la ferait diverger le jour où
 * la RLS changerait, sans rien protéger — le client n'est pas une barrière.
 *
 * La jointure NOMME sa contrainte : `shifts` référence `employees` deux fois
 * (`employee_id` et `cloture_par`), et PostgREST refuse une relation ambiguë.
 *
 * Retour : { services: [...] } | { erreur: true, services: [] }
 */
async function nexusServicesOuvertsDuSite(employee){
  if(!employee || !employee.site_id){
    console.error('Services ouverts : site de l’employé inconnu — aucune lecture d’équipe. Un site indetermine ne se remplace pas par un site par defaut.');
    return { erreur: true, services: [] };
  }
  const PLAFOND = 200;
  const { data, error } = await nexusClient
    .from('shifts')
    .select('id, employee_id, role, quart, heure_debut, statut, site_id, employees!shifts_employee_id_fkey(nom)')
    .eq('site_id', employee.site_id)
    .eq('statut', 'en_cours')
    .order('heure_debut', { ascending: true })
    .limit(PLAFOND);
  if(error){
    console.error('Services ouverts : lecture impossible —', error);
    return { erreur: true, services: [] };
  }
  const lignes = data || [];
  // Un plafond atteint est un résultat tronqué, pas un résultat. On le dit
  // plutôt que de laisser un manager croire qu'il a tout vu.
  if(lignes.length === PLAFOND){
    console.warn('Services ouverts : ' + PLAFOND + ' lignes rendues, la liste est peut-être tronquée.');
  }
  return {
    services: lignes.map(sv => Object.assign({}, sv, {
      nom: (sv.employees && sv.employees.nom) || null,
    })),
  };
}

/**
 * Le manager régularise plusieurs services obsolètes en une action.
 * ─────────────────────────────────────────────────────
 * Exigence du 16/09/2026, mot pour mot : « le manager peut régulariser
 * plusieurs services obsolètes en une action ».
 *
 * LA GARDE DE RÔLE EST ICI, alors qu'elle est absente de la lecture ci-dessus.
 * Ce n'est pas une incohérence : en lecture, la RLS suffit, elle rend moins.
 * En écriture, la RLS refuserait elle aussi — mais `cloture_source` vaudrait
 * déjà 'manager' et `cloture_par` désignerait quelqu'un qui n'en est pas un.
 * Le journal du pilote doit dire vrai sur QUI a décidé ; c'est cette vérité-là
 * que la garde protège, pas l'accès.
 *
 * Le motif est IMPOSÉ : quel que soit le critère qui a rendu le service
 * obsolète, c'est un humain qui a tranché, et le journal l'écrit ainsi.
 */
async function nexusRegulariserServicesObsoletes(manager, obsoletes){
  const regles = nexusReglesPilote();
  if(!regles) return { closes: 0, tentees: 0, refuses: [], indisponible: true };
  if(!manager || !manager.id || !nexusEstManager(manager)){
    console.error('Régularisation refusée : seul un manager ou un gérant régularise les services de son équipe.');
    return { closes: 0, tentees: 0, refuses: [], refuse: true };
  }
  if(!obsoletes || !obsoletes.length) return { closes: 0, tentees: 0, refuses: [] };

  const bilan = await nexusAppliquerCloturePilote(obsoletes, {
    source: regles.SOURCE_CLOTURE_PILOTE.manager,
    par:    manager.id,
    motifPour: (obsolete, MOTIFS) => MOTIFS.manager,
  });
  if(bilan.closes > 0){
    console.info('Régularisation : ' + bilan.closes + ' service(s) refermé(s) sans heure de fin, à la main du manager.');
  }
  return bilan;
}

// ────────────────────────────────────────────────────────────────────
// S-4 (05/09/2026) — LE service courant. Une seule définition.
//
// NEXUS en avait QUATRE, réparties sur neuf lectures de `shifts` : une
// fenêtre de 24 h, une borne à minuit local de l'appareil, une borne de
// journée en UTC, et un seul lecteur — Pointage — qui regardait `statut`.
//
// Tant que rien ne clôturait un service, `statut` valait toujours
// 'en_cours' : les neuf convergeaient PAR ACCIDENT. Depuis S-2 (clôture au
// pointage de départ) et S-3 (clôture à la prise de poste suivante), les
// services se ferment réellement — et les huit lecteurs qui ignoraient
// `statut` renverraient un service TERMINÉ comme s'il était actif.
//
// Contrat, arbitré le 05/09/2026 :
//     employee_id = employé courant
//     site_id     = site courant
//     statut      = 'en_cours'
//     order by heure_debut desc limit 1
//
// AUCUN repli : ni fenêtre de 24 h, ni date du jour, ni dernier service
// historique, ni rôle habituel. Sans service actif, l'appelant reçoit
// `aucun: true` et applique son propre comportement métier — le refus est
// une réponse, pas un trou à combler.
//
// Le tri sur le plus récent subsiste bien que S-1 rende le cas impossible :
// défense de lecture contre un historique imparfait ou un import.
//
// Retour : { service } | { aucun: true } | { erreur: true }
// ============================================================================
// LE JOUR METIER SUIT LE FUSEAU DU SITE, JAMAIS L'HORLOGE DE L'APPAREIL
// (18/09/2026)
//
// CE QUI VIVAIT ICI. `nexusDateLocaleISO(d)` rendait le jour de l'APPAREIL
// (`getFullYear/getMonth/getDate`). Elle est SUPPRIMEE, pas conservee en
// alias : un motif faux survit a sa propre peremption, et une fonction qui
// nomme « date locale » le jour du telephone d'un employe en deplacement
// serait exactement ce motif.
//
// LE FAIT MESURE. Sur nexus-test le 18/09, meme instant absolu
// (2026-09-15T02:00:00Z), meme base, meme employe, meme site :
//
//     appareil America/Martinique -> jour 2026-09-14 -> service EN COURS, 0 cloture
//     appareil Europe/Paris       -> jour 2026-09-15 -> « aucun poste », 1 CLOTURE
//
// Un appareil hors du fuseau de sa station ne se contente donc pas de mal
// afficher : il DECLENCHE UNE ECRITURE, la cloture d'un service encore actif.
// Le commentaire de `nexusServiceCourant` nommait lui-meme cette condition de
// chute depuis le 11/09 — « un appareil hors du fuseau de sa station ». Elle
// est arrivee ; la borne est donc reprise ici.
//
// LA REGLE. La date metier suit le fuseau declare du site, et lui seul. A
// instant identique, deux appareils quelconques prennent la meme decision
// pour le meme site. La cloture des services REELLEMENT anciens est
// conservee telle quelle : elle est simplement adossee au jour de la
// station et non plus a celui de l'appareil.
//
// CE FUSEAU EST `sites.timezone`. Ce paragraphe a nomme
// `station_config.fuseau_horaire` du 18/09 au 20/09/2026 : c'etait deja faux
// a l'ecriture, la migration 20260905131500_fuseau_horaire_par_site.sql
// ayant porte l'autorite sur `sites.timezone` le 05/09. Le code a ete
// corrige le 19/09 (voir le bloc borne plus bas) ; cette phrase enseignait
// encore l'inverse. Un commentaire qui survit a la correction qu'il decrit
// redevient la source du prochain defaut.
//
// POURQUOI PAS `NexusStation.dateLocaleStation()` ? Elle fait exactement cela,
// et elle est plus stricte (elle refuse un fuseau absent au lieu de replier).
// Mais `nexus-station.js` n'est charge que par sept ecrans quand
// `nexus-auth.js` l'est par tous : en dependre ici rendrait la date metier
// indisponible precisement la ou elle manque. Meme formule, meme doctrine,
// deux portees — et c'est `nexus-station.js` qui reste la reference stricte.
//
// IL N'Y A PAS DE REPLI. Ce paragraphe en decrivait un, ultramarin par
// defaut, au motif qu'il valait mieux que l'Europe. Il a ete supprime du
// code le 19/09/2026 : une constante qu'aucune base ne porte est une
// troisieme source de verite, et l'appelant ne peut pas la distinguer d'une
// valeur lue. Un fuseau non resolu vaut desormais `null` — dater devient
// IMPOSSIBLE plutot que FAUX. Le raisonnement d'origine reste vrai pour
// autant : se tromper vers l'Europe AVANCE la journee et referme des
// services encore ouverts. C'est la raison de ne rien inventer, pas celle
// d'inventer mieux.
// ============================================================================
// Ces primitives sont bornees pour etre PORTEES telles quelles par les tests
// et par les harnais, comme l'est la regle d'acces : le jour metier est
// desormais une dependance de plusieurs gardes de ce fichier, et un test qui
// en recopierait une version locale validerait sa propre copie.
/* NEXUS-FUSEAU-METIER:DEBUT */
// L'AUTORITE DU FUSEAU EST `sites.timezone`, ET ELLE EST UNIQUE (19/09/2026).
//
// Ce bloc lisait `station_config.fuseau_horaire` et repliait sur une constante
// `America/Martinique`. Trois defauts tenaient ensemble :
//
//  1. La colonne lue est DEPRECIEE depuis le 05/09/2026. La migration
//     20260905131500_fuseau_horaire_par_site.sql l'ecrit dans le schema
//     lui-meme : « la source de verite du fuseau est sites.timezone. Colonne
//     conservee le temps que les lecteurs client migrent ». Ce bloc ETAIT le
//     lecteur non migre — il n'y a jamais eu deux autorites par conception,
//     il y avait une autorite et un retardataire.
//  2. La ligne `station_config` PEUT MANQUER. Elle manque aujourd'hui sur Test
//     pour `vito-sainte-marie` (mesure du 19/09/2026). Tant que le fuseau y
//     habite, « pas de configuration » et « pas de fuseau » sont le meme etat,
//     et c'est ce qui rendait un repli tentant. Dans `sites`, la ligne existe
//     toujours, `timezone` est NOT NULL et un trigger valide le nom IANA :
//     l'absence de valeur y est structurellement impossible.
//  3. Le repli etait une TROISIEME source de verite — une constante du code
//     qu'aucune base ne porte — et il etait SILENCIEUX : l'appelant ne pouvait
//     pas distinguer un fuseau lu d'un fuseau devine. Les deux bases disent
//     aujourd'hui America/Martinique partout ; la coincidence a masque le
//     defaut, elle ne l'a pas corrige.
//
// CE QUI NE CHANGE PAS : la RLS. `select_sites` et `select_station_config`
// ouvrent la lecture aux memes personnes — `authenticated`, site de l'employe
// ou createur autorise (mesure du 19/09/2026 sur Test). Changer de table
// n'ouvre ni ne ferme aucune porte.
//
// CE QUI CHANGE : un fuseau non resolu vaut desormais `null`. Dater devient
// IMPOSSIBLE plutot que FAUX, et chaque appelant le traite explicitement. Il
// n'existe plus un seul endroit ou NEXUS date dans un fuseau qu'il n'a pas lu.

// Un site -> son fuseau. Une page ne lit `sites` qu'une fois par site : le
// jour metier est demande a chaque garde d'acces, et une requete par garde
// transformerait une correction de justesse en cout de chargement.
// SEULS LES SUCCES sont memorises — une coupure passagere ne doit pas figer un
// « indetermine » jusqu'au rechargement de la page.
const nexusFuseauxSite = new Map();

// Un fuseau que CET appareil ne sait pas resoudre ferait lever `Intl` a chaque
// calcul de date. On le refuse une fois, a la lecture, plutot que de laisser
// l'exception remonter dans une garde d'acces.
function nexusFuseauValide(fuseau){
  if(typeof fuseau !== 'string' || !fuseau.trim()) return null;
  try{
    new Intl.DateTimeFormat('en-CA', { timeZone: fuseau });
    return fuseau;
  }catch(e){
    console.error('Fuseau du site inconnu de cet appareil : ' + fuseau + ' — le jour de la station reste indetermine.');
    return null;
  }
}

// Rend le fuseau retenu, ou `null`. Ne retient que ce qui est valide : un
// `null` en cache serait un repli silencieux deguise en memoire.
function nexusRetenirFuseau(siteId, valeur){
  const fuseau = nexusFuseauValide(valeur);
  if(siteId && fuseau) nexusFuseauxSite.set(siteId, fuseau);
  return fuseau;
}

/**
 * Le jour metier d'un instant, dans le fuseau d'une station.
 * Rend 'AAAA-MM-JJ' — le format des colonnes `date` de la base, d'ou 'en-CA'.
 * Rend `null` SANS FUSEAU : cette fonction ne choisit pas de fuseau a la place
 * de l'appelant, et un jour devine serait ecrit en base comme un jour lu.
 * Elle ne lit aucune configuration : le fuseau lui est fourni, et l'appelant
 * est proprietaire du site auquel ce jour se rapporte.
 */
function nexusJourDansFuseau(instant, fuseau){
  if(!fuseau) return null;
  const d = instant instanceof Date ? instant : new Date(instant);
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  return p.year + '-' + p.month + '-' + p.day;
}

/**
 * Le fuseau de la station, lu dans l'autorite unique `sites.timezone`.
 * Une lecture par page au plus. Rend `null` quand le fuseau n'a pas pu etre
 * obtenu — aucun repli, aucune valeur devinee. L'appelant decide ce que
 * « jour de la station indetermine » signifie chez lui ; il ne peut plus
 * l'ignorer sans le savoir.
 */
async function nexusFuseauSite(siteId){
  if(!siteId) return null;
  if(nexusFuseauxSite.has(siteId)) return nexusFuseauxSite.get(siteId);
  try{
    const { data, error } = await nexusClient
      .from('sites').select('timezone').eq('site_id', siteId).maybeSingle();
    if(error){
      console.error('Fuseau du site : lecture impossible — le jour de la station reste indetermine.', error);
      return null;
    }
    if(!data || !data.timezone){
      console.error('Fuseau du site : aucun `sites.timezone` visible pour ' + siteId + ' — le jour de la station reste indetermine.');
      return null;
    }
    return nexusRetenirFuseau(siteId, data.timezone);
  }catch(e){
    console.error('Fuseau du site : lecture impossible — le jour de la station reste indetermine.', e);
    return null;
  }
}

/* NEXUS-FUSEAU-METIER:FIN */
async function nexusServiceCourant(employee){
  if(!employee||!employee.id||!employee.site_id){
    console.error('Service courant : employé ou site non résolu — aucune lecture n\u2019est faite.');
    return { erreur: true };
  }
  const { data, error } = await nexusClient
    .from('shifts')
    .select('id, role, quart, heure_debut, site_id, statut')
    .eq('employee_id', employee.id)
    .eq('site_id', employee.site_id)
    .eq('statut', 'en_cours')
    .order('heure_debut', { ascending: false })
    .limit(5);
  if(error){ console.error('Service courant : lecture impossible \u2014', error); return { erreur: true }; }
  // JAMAIS le service de la veille (11/09/2026, arbitrage C.1/C.2 apres le
  // parcours Caissiere). La requete ne filtre que sur l'employe, le site et
  // le statut : un quart laisse ouvert hier revenait donc comme service du
  // jour. C'est ce qui a produit un retard de 1028 minutes ECRIT en base sur
  // une arrivee de 10 h 33.
  //
  // Le filtre se fait ici, sur la date locale de l'appareil, et non par une
  // borne SQL calculee dans le fuseau du site. Ce n'est PAS faute de donnee :
  // `sites.timezone` EXISTE en Production — la migration 20260905131500 y est
  // inscrite depuis le 05/09/2026. Une version anterieure de ce commentaire
  // affirmait le contraire ; c'etait faux, et un motif faux est pire qu'une
  // absence de motif, parce qu'il survit a sa propre peremption.
  //
  // Le vrai motif : la station est sur site avec ses employes, aucun quart n'y
  // franchit minuit (le quart 2 finit au plus tard a 22 h 10), et c'est deja
  // la regle que l'ecran de pointage applique. Deux definitions de la journee
  // pour un meme employe seraient pires qu'une definition imparfaite.
  //
  // Ce qui ferait tomber ce choix et imposerait la borne SQL : un quart a
  // cheval sur minuit, ou un appareil hors du fuseau de sa station.
  //
  // 18/09/2026 — LA SECONDE CONDITION EST ARRIVEE. Le filtre reste ici, en
  // JavaScript, mais il ne lit plus l'horloge de l'appareil : il lit le jour
  // de la STATION, dans son fuseau configure. Le quart a cheval sur minuit,
  // lui, imposerait toujours la borne SQL — il n'existe pas davantage
  // aujourd'hui qu'hier, et rien ici ne pretend le traiter.
  const fuseau = await nexusFuseauSite(employee.site_id);
  if(!fuseau){
    // 19/09/2026 — SANS FUSEAU, ON NE FILTRE PAS, ET ON NE REFERME RIEN.
    // Le filtre ci-dessous compare des jours ; deux `null` se ressemblent et
    // laisseraient passer le service de la veille, exactement le defaut du
    // 11/09 qui avait produit un retard de 1028 minutes. Et la cloture des
    // services obsoletes, plus bas, ECRIT en base : elle ne doit jamais
    // s'appuyer sur un jour que NEXUS n'a pas su lire.
    console.error('Service courant : jour de la station indetermine \u2014 aucun filtre, aucune cloture.');
    return { erreur: true };
  }
  const jourStation = nexusJourDansFuseau(new Date(), fuseau);
  const tous = data || [];
  const services = tous.filter(sv => sv.heure_debut && nexusJourDansFuseau(new Date(sv.heure_debut), fuseau) === jourStation);
  // Signale la PRESENCE d'un service ouvert d'un autre jour, pas l'absence
  // d'un service du jour : une absence n'est pas une anomalie, et un journal
  // d'erreur declenche par du vide apprend a ignorer les journaux.
  const ouvertsHorsDuJour = tous.length - services.length;
  if(ouvertsHorsDuJour > 0){
    console.error('Service courant : ' + ouvertsHorsDuJour + ' service(s) ouvert(s) commence(s) un autre jour, ignore(s) \u2014 le service de la veille n\'est jamais reutilise.');
    // 16/09/2026 — LES IGNORER NE SUFFISAIT PAS. Ils restaient `en_cours` en
    // base, donc « actifs » pour le manager, sans fin et sans terme. NEXUS les
    // referme ici, au moment exact où il constate leur existence.
    //
    // La liste vient de la règle, jamais de la soustraction ci-dessus : un
    // service sans `heure_debut` n'appartient à aucun jour, et ne doit donc
    // pas être refermé au motif qu'il n'est pas d'aujourd'hui.
    //
    // `await` : la lecture attend le ménage. C'est une requête par service
    // obsolète, et le cas normal est zéro. En échange, deux écrans ouverts
    // ne relancent pas indéfiniment la même clôture.
    const regles = (typeof NexusPointageRegles !== 'undefined') ? NexusPointageRegles : null;
    // LE CONTEXTE FOURNI ICI N'A PAS DE `seuilBascule`, et c'est délibéré.
    // `nexus-auth.js` est chargé par tous les écrans ; `nexus-station.js`, qui
    // sait lire les horaires du commerce, ne l'est que par sept d'entre eux.
    // Sans seuil, `serviceObsolete` n'applique que le critère du jour
    // précédent — un quart du matin fini le jour même sera refermé par le
    // Cockpit, qui possède ce seuil, ou demain par le critère du jour.
    // Fournir un seuil approximatif serait pire : NEXUS fermerait des services
    // encore en cours.
    const obsoletes = regles && regles.servicesObsoletes
      ? regles.servicesObsoletes(tous, { jourStation, jourDeService: d => nexusJourDansFuseau(d, fuseau) })
      : [];
    if(obsoletes.length) await nexusCloturerServicesObsoletes(employee, obsoletes);
  }
  if(!services.length) return { aucun: true };
  // S-1 pose un index unique partiel : plus d\u2019un service ouvert est
  // devenu impossible. Si cela se produit malgré tout, c\u2019est une anomalie
  // technique — on la signale, on ne la masque pas, et on retient le plus
  // récent pour ne pas bloquer l\u2019employé.
  if(services.length > 1){
    console.error('Service courant : ' + services.length + ' services ouverts pour cet employé alors que l\u2019unicité est garantie en base. Anomalie technique — le plus récent est retenu.');
  }
  return { service: services[0] };
}
async function nexusPriseDePosteManquante(employee){if(NexusPage.est(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE)||employee.consultation_externe)return false;const manager=nexusEstManager(employee);if(manager)return false;// S-4 / Q2 : la porte d'accès regarde le service RÉELLEMENT actif, plus
  // l'existence d'un service dans la journée de l'appareil. Après un
  // pointage de départ, l'employé n'a plus de service courant : s'il
  // revient sur un parcours qui en exige un, il est renvoyé vers la prise
  // de poste. C'est une conséquence voulue du contrat, pas un effet de bord.
  //
  // En cas d'erreur technique, on ne bloque pas : une panne de lecture ne
  // doit pas enfermer un employé hors de l'application.
  const r=await nexusServiceCourant(employee);
  if(r.erreur)return false;
  if(!r.aucun)return false;
  // Apres la cloture, la prise de poste ne s'impose plus (11/09/2026,
  // arbitrage C.3). L'employee qui vient de pointer son depart n'a plus de
  // service courant : l'ancien contrat la renvoyait aussitot vers
  // "Quel est votre role pour ce quart ?", comme ecran principal. Elle vient
  // de partir ; on ne lui redemande pas de reprendre. Reprendre un poste
  // reste possible, mais par une action volontaire, jamais par une
  // redirection automatique.
  return !(await nexusDepartPointeAujourdhui(employee));}

/**
 * L'employe a-t-il deja pointe son depart aujourd'hui ?
 *
 * Sert aux DEUX portes qui menaient a la prise de poste : celle de
 * nexusPriseDePosteManquante, et celle de NEXUS-App-v1.html. La premiere
 * seule avait ete corrigee le 11/09/2026, et l'ecran d'accueil continuait a
 * rediriger : une correction posee sur une porte quand il y en a deux ne
 * corrige rien, elle deplace l'endroit ou l'on se cogne.
 *
 * En cas d'erreur de lecture : false, donc ancien contrat conserve. On ne
 * relache pas une porte parce qu'on n'a pas pu la lire.
 */
async function nexusDepartPointeAujourdhui(employee){
  if(!employee||!employee.id)return false;
  const journee = nexusDateLocaleISO(new Date());
  const { data, error } = await nexusClient
    .from('pointages').select('id')
    .eq('employee_id', employee.id).eq('date', journee).eq('type', 'depart').limit(1);
  if(error){
    console.error('Depart du jour : lecture impossible \u2014', error);
    return false;
  }
  return !!(data && data.length);}
async function nexusLogout(){await nexusClient.auth.signOut();window.location.href="index.html";}
function nexusQuitterConsultation(){localStorage.removeItem('nexus_site_consulte_createur');window.location.href="NEXUS-App-v1.html";}
