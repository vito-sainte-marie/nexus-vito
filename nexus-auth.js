// NEXUS — nexus-auth.js
// À inclure sur CHAQUE page qui nécessite une connexion (Cockpit, Missions, Plan d'action, etc.)
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="nexus-auth.js?v=20260904-0104"></script>

const NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";
const NEXUS_SUPABASE_ANON_KEY = "sb_publishable_7dV43gZxDYg6MOa6xzmdDQ_m8Mean5p";

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

// ────────────────────────────────────────────────────────────────────
// Reconnaître la page courante — pourquoi en clair, ici, et pas ailleurs.
//
// La branche de développement identifie la page par `NexusPage.est(...)`,
// un module chargé au build juste avant celui-ci. Production est servie
// BRUTE par GitHub Pages : aucun build ne tourne, aucune balise n'est
// injectée, et `nexus-page.js` n'est chargé par aucun écran. Appeler
// `NexusPage` ici lèverait une exception au premier écran ouvert.
//
// `NexusPage` existe parce que Cloudflare Pages retire l'extension `.html`
// et que l'écran de prise de poste ne se reconnaissait plus lui-même —
// boucle de redirection infinie, 04/09/2026. GitHub Pages sert `/X.html`
// tel quel : la comparaison directe ci-dessous est exacte sur cet
// hébergeur. Elle redeviendra insuffisante le jour où l'hébergement
// changera ou où le mode d'artefact « construit » entrera en service ;
// c'est ce jour-là, et pas avant, qu'il faudra charger `nexus-page.js`.
// ────────────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
// RÈGLE D'ACCÈS — L'AUTHENTIFICATION N'EST JAMAIS UNE PREUVE DE PRÉSENCE
// (16/09/2026)
//
//   « L'authentification n'est jamais une preuve de présence.
//
//     La navigation dans NEXUS, la consultation du Cockpit ou l'accès à
//     l'espace personnel ne doivent créer ni service, ni shift, ni
//     pointage, ni retard, ni variable de paie.
//
//     Après connexion et avant toute prise de poste, NEXUS présente deux
//     chemins distincts :
//       1. Consulter NEXUS — navigation sans preuve de présence ;
//       2. Commencer mon service — action explicite créant le service
//          opérationnel.
//
//     Aucun service ne peut être créé implicitement par le login, le
//     chargement d'un écran, une redirection ou la consultation d'une
//     donnée.
//
//     Cette règle s'applique aux employés comme aux managers. »
//
// CE QUE LA RÈGLE CORRIGE. Jusqu'au 16/09/2026, `nexusRequireAuth()` — la
// porte unique des 52 écrans authentifiés — traitait TOUTE page de la même
// façon : pas de service courant ⇒ renvoi vers la prise de poste. Un
// employé qui voulait seulement relire ses écarts validés devait donc
// d'abord ouvrir un service, et la simple consultation fabriquait la
// preuve de présence qu'elle n'aurait jamais dû produire. La garde n'était
// pas mal placée — elle est bien centralisée depuis S-4 — elle était trop
// LARGE : elle confondait « consulter ses propres données » et « agir sur
// le terrain ».
//
// POURQUOI UNE LISTE EN DUR. La catégorie d'un écran est une propriété de
// l'écran, jamais une donnée de la requête : aucun paramètre d'URL, aucun
// champ de formulaire, aucune valeur de `localStorage` n'entre dans
// `nexusCategorieAcces()`. Un utilisateur qui modifierait sa requête ne
// peut pas se déclarer « en consultation » sur un écran opérationnel.
//
// CE QUE CETTE CLASSIFICATION N'EST PAS. Ce n'est pas une autorisation
// d'accès aux données. Elle ne décide que d'une REDIRECTION de navigation.
// L'autorisation reste entièrement du côté Supabase — RLS et `auth.uid()`
// — et ne dépend d'aucune valeur venue du navigateur. Relâcher la
// redirection ne rend pas une ligne de plus.
//
// PAR DÉFAUT, UN ÉCRAN NON CLASSÉ EST OPÉRATIONNEL : l'oubli conserve
// l'ancien contrat au lieu de l'ouvrir. `test_acces_hors_service_20260916.js`
// vérifie de surcroît que les quatre listes couvrent TOUS les écrans du
// dépôt, pour qu'un écran nouveau soit classé sciemment, pas par défaut.
// ════════════════════════════════════════════════════════════════════
/* NEXUS-ACCES-REGLE:DEBUT — bloc pur, extrait et exécuté tel quel par les épreuves */
const NEXUS_PAGES_SEQUENCE_OBLIGATOIRE=['NEXUS-Pointage-v1.html','NEXUS-Prise-De-Poste-v1.html'];

// CONSULTATION — l'employé y lit ce qui le concerne, le manager y pilote et
// y administre. Aucun de ces écrans n'exige d'être en service : les ouvrir
// ne crée ni service, ni shift, ni pointage, ni retard, ni variable de paie.
const NEXUS_PAGES_CONSULTATION = [
  // Espace personnel de l'employé + accueil (qui porte les deux chemins).
  'NEXUS-App-v1.html',
  'NEXUS-Mon-Evolution-v1.html',
  'NEXUS-Mon-Planning-v1.html',
  'NEXUS-Progression-v1.html',
  'NEXUS-Apprentissage-v1.html',
  'NEXUS-Boite-Reception-v1.html',
  'NEXUS-Documentation-v1.html',
  // Pilotage et contrôle du manager — nommés par l'arbitrage du 16/09/2026 :
  // « le manager doit pouvoir consulter le Cockpit, contrôler Verify,
  // regarder les carburants, consulter les employés, analyser les résultats,
  // effectuer une tâche administrative, sans être automatiquement considéré
  // comme présent ou en service. »
  'NEXUS-Cockpit-v2.html',
  'NEXUS-Verify-v1.html',
  'NEXUS-Carburants-Pilotage-v1.html',
  'NEXUS-Resultats-Equipe-v1.html',
  'NEXUS-Evaluation-Employe-v1.html',
  'NEXUS-Analyse-Ecarts-v1.html',
  'NEXUS-FDJ-Analyse-v1.html',
  'NEXUS-Centre-Intelligence-v1.html',
  'NEXUS-Radar-Manager-v1.html',
  'NEXUS-Capital-v1.html',
  'NEXUS-Rapport-v1.html',
  'NEXUS-Journal-v1.html',
  'NEXUS-Tracabilite-v1.html',
  // Tâches administratives.
  'NEXUS-Planning-v1.html',
  'NEXUS-Assignations-v1.html',
  'NEXUS-Paye-v1.html',
  'NEXUS-Campagne-v1.html',
  'NEXUS-Import-v1.html',
  'NEXUS-Admin-API-v1.html',
  'NEXUS-Admin-Sites-v1.html',
  'NEXUS-Parametres-Station-v1.html',
  'NEXUS-Parametres-Inventaire-v1.html',
  'NEXUS-Parametres-Rappels-v1.html',
  'NEXUS-Parametres-Comptes-Clients-v1.html',
  'NEXUS-FDJ-Parametres-v1.html',
  'NEXUS-Debug-v1.html',
  'NEXUS-Debug-Createur-v1.html',
];

// OPÉRATIONNEL — le geste de terrain d'un quart. La garde reste ENTIÈRE :
// ces écrans continuent d'exiger un service ouvert et le pointage d'arrivée.
// C'est la moitié de l'arbitrage qu'il ne faut pas perdre de vue : dissocier
// n'est pas désarmer.
const NEXUS_PAGES_OPERATIONNELLES = [
  'NEXUS-Missions-v1.html',
  'NEXUS-Brief-v1.html',
  'NEXUS-Inventaire-v1.html',
  'NEXUS-Inventaire-Manager-v1.html',
  'NEXUS-Scanner-v1.html',
  'NEXUS-Scanner-Stock-v1.html',
  'NEXUS-Stock-Localise-v1.html',
  'NEXUS-Rayon-v1.html',
  'NEXUS-Produits-v1.html',
  'NEXUS-Carburants-v1.html',
  'NEXUS-Carburant-Reception-v1.html',
  'NEXUS-FDJ-v1.html',
  'NEXUS-FDJ-Manager-v1.html',
  'NEXUS-Coach-FDJ-v1.html',
  'NEXUS-Comptes-Clients-v1.html',
  'NEXUS-Tempo-v1.html',
];

// PUBLIQUES — aucune session n'y est exigée : elles n'appellent pas
// `nexusRequireAuth()`. Elles ne sont listées que pour qu'aucun écran du
// dépôt n'échappe au classement, et donc à la relecture.
const NEXUS_PAGES_PUBLIQUES = [
  'NEXUS-Login-v1.html',
  'NEXUS-Home-Concept-v1.html',
  'NEXUS-API-v1.html',
  'NEXUS-CGU-v1.html',
  'NEXUS-Confidentialite-v1.html',
  'NEXUS-Mentions-Legales-v1.html',
  'NEXUS-FAQ-v1.html',
  'NEXUS-Feuille-de-Route-v1.html',
  'NEXUS-Propos-v1.html',
];

/**
 * À quelle catégorie d'accès appartient cet écran ?
 *
 * 'sequence'     — les deux écrans du parcours de prise de poste eux-mêmes ;
 *                  les garder gardés provoquerait une boucle de redirection.
 * 'consultation' — lecture de ses propres données, pilotage, administration.
 * 'publique'     — pas de session exigée.
 * 'operationnel' — geste de terrain : la garde s'applique. C'est AUSSI le
 *                  défaut, pour qu'un écran oublié reste fermé.
 */
function nexusCategorieAcces(page){
  if(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE.includes(page))return 'sequence';
  if(NEXUS_PAGES_CONSULTATION.includes(page))return 'consultation';
  if(NEXUS_PAGES_PUBLIQUES.includes(page))return 'publique';
  return 'operationnel';
}

/**
 * Cet écran exige-t-il un service opérationnel ouvert ?
 *
 * LA question des trois portes — celle de la prise de poste, celle du
 * pointage d'arrivée, et celle de l'accueil. Elles posaient la même question
 * de trois façons ; elles la posent désormais une seule fois, ici.
 */
function nexusPageExigeServiceOperationnel(page){
  return nexusCategorieAcces(page) === 'operationnel';
}
/**
 * Un ecran OPERATIONNEL est-il reellement ATTEIGNABLE dans cet etat ?
 *
 * Les deux gardes de `nexusRequireAuth` posent DEUX questions, pas une :
 * `nexusPriseDePosteManquante` exige un service ouvert, puis
 * `nexusPointageArriveeManquant` exige, EN PLUS, l'arrivee pointee du jour.
 * Un service ouvert ne suffit donc pas — et c'est exactement le defaut releve
 * le 18/09/2026 par le parcours connecte sur Test : un pompiste en service
 * dont l'arrivee n'etait pas pointee (S2), puis une caissiere `professional`
 * dans le meme etat (S5), recevaient les tuiles Missions, Inventaire, FDJ et
 * Reception — et les quatre ecrans rebondissaient vers
 * `NEXUS-Pointage-v1.html`. Le lot du matin n'avait ferme que la premiere
 * porte. Le contre-temoin S6, arrivee pointee, ouvre les memes ecrans sans
 * rebond : la condition du defaut est « en service + arrivee non pointee ».
 *
 * Fonction PURE : ni horloge, ni base, ni `window`. Elle repond sur des faits
 * que l'appelant a deja etablis, et elle n'accorde AUCUN droit — la RLS ne la
 * lit pas. C'est la regle d'AFFICHAGE, ecrite ici, a cote des deux gardes
 * qu'elle resume, plutot que redevinee une troisieme fois par un ecran.
 *
 * `etat` = { enService, arriveePointeeJour, pointageActif, consultationExterne,
 * estManager }. `arriveePointeeJour` est bien l'arrivee de la JOURNEE, comme
 * la garde : celui qui a pointe son arrivee sur un premier service du jour
 * n'est pas renvoye au pointage par le second — meme si l'accueil compte ses
 * etapes de progression par service (correctif du 13/09/2026).
 */
function nexusEcranOperationnelAtteignable(etat){
  const e = etat || {};
  // Les deux gardes s'effacent pour un manager et pour une consultation
  // externe : chez eux, un ecran operationnel ne rebondit pas.
  if(e.estManager || e.consultationExterne) return true;
  // Premiere porte — aucun service ouvert aujourd'hui.
  if(!e.enService) return false;
  // Seconde porte. Un site sans pointage ne l'exige jamais
  // (`pointage_actif = false`) ; partout ailleurs l'arrivee du jour est
  // exigee. Le defaut est donc « pointage exige » : une erreur reseau ou une
  // colonne absente ne doit pas faire promettre un ecran que la garde, elle,
  // refermera.
  if(e.pointageActif === false) return true;
  return !!e.arriveePointeeJour;
}
/* NEXUS-ACCES-REGLE:FIN */
// Manager ou gérant — LA réponse, une seule fois. Elle était écrite deux
// fois dans ce fichier et une fois de plus dans chaque écran qui en a besoin.
// Ce n'est pas une habilitation : les droits réels sont ceux de la RLS, qui
// ne lit pas cette fonction. C'est la règle d'AFFICHAGE et de journal — à
// qui NEXUS propose une action, et qui il nomme quand il l'enregistre.
function nexusEstManager(employee){
  return !!employee && (employee.role === 'manager' || employee.role === 'gerant');
}

async function nexusPointageArriveeManquant(employee){const page=window.location.pathname.split('/').pop();if(!nexusPageExigeServiceOperationnel(page)||employee.consultation_externe)return false;const siteId=employee.site_id;const manager=nexusEstManager(employee);const {data:config}=await nexusClient.from('station_config').select('pointage_actif, manager_pointage_requis').eq('site',siteId).maybeSingle();if(config&&config.pointage_actif===false)return false;if(manager&&(!config||!config.manager_pointage_requis))return false;
  // 19/09/2026 — LE FUSEAU NE VIENT PLUS DE CETTE REQUETE. Il venait de la
  // meme lecture `station_config`, ce qui coutait zero requete mais lisait la
  // colonne DEPRECIEE, dont la ligne peut manquer. L'autorite est
  // `sites.timezone` : une requete de plus au premier appel de la page, une
  // seule, et le cache par site sert tout le reste de l'ecran.
  const fuseau=await nexusFuseauSite(siteId);
  if(!fuseau){
    // Jour de la station indetermine : NEXUS ne peut pas savoir si l'arrivee
    // du jour manque. Il ne reclame donc rien. Reclamer un pointage contre un
    // jour devine est pire que se taire, et cette garde n'ouvre aucune porte
    // — elle affiche une relance, elle n'autorise rien.
    console.error('Pointage arrivee manquant : jour de la station indetermine \u2014 aucune relance.');
    return false;
  }
  const today=nexusJourDansFuseau(new Date(), fuseau);
  const {data:arrivee,error}=await nexusClient.from('pointages').select('id').eq('employee_id',employee.id).eq('date',today).eq('type','arrivee').maybeSingle();if(error){console.error('Vérification pointage arrivée:',error);return false;}return !arrivee;}
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

async function nexusPriseDePosteManquante(employee){const page=window.location.pathname.split('/').pop();if(!nexusPageExigeServiceOperationnel(page)||employee.consultation_externe)return false;const manager=nexusEstManager(employee);if(manager)return false;// S-4 / Q2 : la porte d'accès regarde le service RÉELLEMENT actif, plus
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
 * Servait aux DEUX portes qui menaient a la prise de poste : celle de
 * nexusPriseDePosteManquante, et celle de NEXUS-App-v1.html. La premiere
 * seule avait ete corrigee le 11/09/2026, et l'ecran d'accueil continuait a
 * rediriger : une correction posee sur une porte quand il y en a deux ne
 * corrige rien, elle deplace l'endroit ou l'on se cogne.
 *
 * 16/09/2026 : il y en avait TROIS, et la porte de l'accueil a ete supprimee
 * — l'accueil est un ecran de consultation. Cette fonction n'a donc plus
 * qu'UN appelant, nexusPriseDePosteManquante. On l'ecrit ici parce qu'un
 * motif faux survit a sa propre peremption : « sert aux deux portes » etait
 * vrai le 11/09 et ne l'est plus.
 *
 * En cas d'erreur de lecture : false, donc ancien contrat conserve. On ne
 * relache pas une porte parce qu'on n'a pas pu la lire.
 */
async function nexusDepartPointeAujourdhui(employee){
  if(!employee||!employee.id)return false;
  // `pointages.date` est ecrite dans le jour de la station : la relire dans
  // celui de l'appareil ferait manquer le depart pointe le soir meme, et la
  // porte de la prise de poste se refermerait sur quelqu'un qui vient de
  // partir.
  const fuseau = await nexusFuseauSite(employee.site_id);
  if(!fuseau){
    // Meme contrat que l'erreur de lecture ci-dessous : on ne relache pas une
    // porte parce qu'on n'a pas su dater la journee.
    console.error('Depart du jour : jour de la station indetermine \u2014 depart repute non pointe.');
    return false;
  }
  const journee = nexusJourDansFuseau(new Date(), fuseau);
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
