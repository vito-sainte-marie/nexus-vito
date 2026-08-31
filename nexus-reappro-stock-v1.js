// NEXUS — moteur de couverture stock / réassort V1
// Croise ventes récentes + Stock Engine central sans jamais confondre
// stock réel, stock théorique et écart de rapprochement.
(function(){
  'use strict';

  function normaliserTexte(v){
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
  }

  function joursInclus(debut,fin){
    if(!debut || !fin) return null;
    const a=new Date(`${debut}T00:00:00Z`);
    const b=new Date(`${fin}T00:00:00Z`);
    const n=Math.floor((b-a)/86400000)+1;
    return Number.isFinite(n) && n>0 ? n : null;
  }

  async function fetchAll(builderFactory,pageSize=1000){
    let out=[];
    for(let from=0;;from+=pageSize){
      const {data,error}=await builderFactory().range(from,from+pageSize-1);
      if(error) throw error;
      out=out.concat(data || []);
      if(!data || data.length<pageSize) break;
    }
    return out;
  }

  async function chargerConfig(site){
    const defaults={actif:true,seuilCritiqueJours:2,seuilCourtJours:5,ageMaxHeures:72};
    const {data,error}=await nexusClient.from('nexus_stock_reappro_config')
      .select('actif,seuil_critique_jours,seuil_court_jours,age_max_stock_heures')
      .eq('site',site).maybeSingle();
    if(error){
      console.warn('NEXUS Réassort — configuration indisponible, valeurs par défaut utilisées:',error);
      return defaults;
    }
    if(!data) return defaults;
    return {
      actif:data.actif!==false,
      seuilCritiqueJours:Number(data.seuil_critique_jours ?? 2),
      seuilCourtJours:Number(data.seuil_court_jours ?? 5),
      ageMaxHeures:Number(data.age_max_stock_heures ?? 72)
    };
  }

  async function dernierePeriode(site){
    const {data,error}=await nexusClient.from('products')
      .select('periode_debut,periode_fin')
      .eq('site',site)
      .not('periode_debut','is',null)
      .not('periode_fin','is',null)
      .order('periode_fin',{ascending:false})
      .order('periode_debut',{ascending:false})
      .limit(1);
    if(error) throw error;
    return data && data[0] ? data[0] : null;
  }

  async function chargerVentes(site){
    const periode=await dernierePeriode(site);
    if(!periode) return {periode:null,jours:null,lignes:[]};
    const lignes=await fetchAll(()=>nexusClient.from('products')
      .select('article,code_barres,categorie,quantite,periode_debut,periode_fin')
      .eq('site',site)
      .eq('periode_debut',periode.periode_debut)
      .eq('periode_fin',periode.periode_fin)
      .order('article',{ascending:true}));
    return {periode,jours:joursInclus(periode.periode_debut,periode.periode_fin),lignes};
  }

  function indexVentes(lignes){
    const barcode=new Map();
    const designation=new Map();
    for(const l of lignes || []){
      const q=Number(l.quantite || 0);
      if(!Number.isFinite(q)) continue;
      const bc=String(l.code_barres || '').trim();
      if(bc) barcode.set(bc,(barcode.get(bc)||0)+q);
      const nom=normaliserTexte(l.article);
      if(nom) designation.set(nom,(designation.get(nom)||0)+q);
    }
    return {barcode,designation};
  }

  function quantiteVendue(etat,index){
    const bc=String(etat.code_barres || '').trim();
    if(bc && index.barcode.has(bc)) return {quantite:index.barcode.get(bc),rapprochement:'code_barres'};
    const nom=normaliserTexte(etat.designation);
    if(nom && index.designation.has(nom)) return {quantite:index.designation.get(nom),rapprochement:'designation_exacte'};
    return {quantite:null,rapprochement:null};
  }

  function analyserLigne(etat,vente,jours,options={}){
    const seuilCritique=Number(options.seuilCritiqueJours ?? 2);
    const seuilCourt=Number(options.seuilCourtJours ?? 5);
    const ageMaxHeures=Number(options.ageMaxHeures ?? 72);
    const ref=NexusStock.stockPourUsage(etat,'reference');
    const reel=NexusStock.stockPourUsage(etat,'reel');

    const vendu=vente && Number.isFinite(Number(vente.quantite)) ? Number(vente.quantite) : null;
    const vitesse=(vendu!=null && jours>0) ? vendu/jours : null;
    const ageHeures=reel.date ? Math.max(0,(Date.now()-new Date(reel.date).getTime())/3600000) : null;
    const couverture=(reel.quantite!=null && vitesse!=null && vitesse>0) ? Number(reel.quantite)/vitesse : null;

    let statut='non_evaluable';
    let action='Aucune décision de réassort automatique.';
    let rang=4;

    if(options.actif===false){
      statut='moteur_desactive';
      action='Moteur de réassort désactivé dans les paramètres du site.';
    } else if(ref.nature==='theorique'){
      statut='theorique_seul';
      action='Contrôler physiquement le stock avant de décider d’un réassort.';
      rang=3;
    } else if(reel.quantite==null){
      statut='stock_reel_absent';
      action='Faire un comptage physique avant toute décision de réassort.';
      rang=3;
    } else if(ageHeures!=null && ageHeures>ageMaxHeures){
      statut='reel_trop_ancien';
      action='Actualiser le comptage physique avant de décider d’un réassort.';
      rang=3;
    } else if(vitesse==null){
      statut='ventes_non_rapprochees';
      action='Stock réel connu, mais ventes non rapprochées : pas de recommandation de commande.';
      rang=4;
    } else if(vitesse<=0){
      statut='pas_de_rotation';
      action='Pas de réassort suggéré sur la base de cette période de ventes.';
      rang=4;
    } else if(Number(reel.quantite)<=0){
      statut='rupture_reelle';
      action='Préparer le réassort immédiatement.';
      rang=1;
    } else if(couverture<=seuilCritique){
      statut='couverture_critique';
      action='Préparer le réassort.';
      rang=1;
    } else if(couverture<=seuilCourt){
      statut='couverture_courte';
      action='Surveiller et préparer le prochain réassort.';
      rang=2;
    } else {
      statut='couverture_suffisante';
      action='Aucun réassort urgent détecté.';
      rang=4;
    }

    return {
      produit_id:etat.produit_id,
      article:etat.designation,
      categorie:etat.categorie,
      code_barres:etat.code_barres,
      stock_reel:reel.quantite,
      stock_reel_date:reel.date,
      stock_reference_nature:ref.nature,
      ventes_periode:vendu,
      jours_periode:jours,
      ventes_par_jour:vitesse,
      couverture_jours:couverture,
      age_stock_heures:ageHeures,
      statut,action,rang,
      rapprochement_ventes:vente ? vente.rapprochement : null
    };
  }

  async function analyserSite(site,options={}){
    if(!site) throw new Error('NEXUS Réassort: site requis');
    if(!window.NexusStock) throw new Error('NEXUS Réassort: Stock Engine indisponible');
    const [etats,ventes,config]=await Promise.all([NexusStock.chargerEtat(site),chargerVentes(site),chargerConfig(site)]);
    const regles={...config,...options};
    const idx=indexVentes(ventes.lignes);
    const analyses=etats.map(etat=>analyserLigne(etat,quantiteVendue(etat,idx),ventes.jours,regles));
    return {site,periode:ventes.periode,jours:ventes.jours,config:regles,analyses};
  }

  function candidatsConseiller(resultat){
    return (resultat && resultat.analyses || [])
      .filter(a=>['rupture_reelle','couverture_critique','couverture_courte','theorique_seul','reel_trop_ancien'].includes(a.statut))
      .map(a=>({
        candidate_id:`REAPPRO-${a.statut}-${a.produit_id}`,
        produit_id:a.produit_id,
        ruleId:`R-REAPPRO-${String(a.statut).toUpperCase()}`,
        rang:a.rang,
        moteur:'stock',
        etat:a.statut==='rupture_reelle'?'📦 RUPTURE OBSERVÉE':a.statut==='couverture_critique'?'📦 COUVERTURE CRITIQUE':a.statut==='couverture_courte'?'📦 À SURVEILLER':'📦 DONNÉE À ACTUALISER',
        impact_eur:0,
        article:a.article,
        categorie:a.categorie,
        decision:a.action,
        pourquoi:a.couverture_jours!=null
          ? `Stock réel ${Number(a.stock_reel)} · ventes moyennes ${a.ventes_par_jour.toFixed(2)}/jour · couverture estimée ${a.couverture_jours.toFixed(1)} jour${a.couverture_jours>=2?'s':''}.`
          : a.statut==='theorique_seul'
            ? 'NEXUS ne dispose que d’un stock théorique : aucune commande n’est proposée sans contrôle physique.'
            : 'La donnée physique disponible n’est pas assez récente pour décider d’un réassort.',
        impact:'Limiter le risque de rupture sans commander sur une donnée de stock incertaine.',
        confiance:a.statut==='rupture_reelle'||a.statut==='couverture_critique'||a.statut==='couverture_courte'?'B':'C',
        validable:false,
        couverture_jours:a.couverture_jours,
        stock_source:a.stock_reference_nature
      }));
  }

  // Aucune quantité de commande n'est inventée ici : fournisseur, délai
  // d'approvisionnement et conditionnement devront être paramétrés avant
  // que NEXUS puisse proposer une quantité d'achat fiable.
  window.NexusReappro=Object.freeze({analyserSite,candidatsConseiller,chargerVentes,chargerConfig,analyserLigne});
})();
