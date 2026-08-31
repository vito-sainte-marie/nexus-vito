// NEXUS — Conseiller Stock V3
// Pont entre le Stock Engine central et les moteurs de décision.
// Ne crée une recommandation de stock que lorsque la donnée disponible
// permet de la formuler sans confondre réel, théorique et comparaison provisoire.
(function(){
  'use strict';

  async function attendreDependances(max=80){
    for(let i=0;i<max;i++){
      if(window.NexusStock && window.nexusRequireAuth) return true;
      await new Promise(r=>setTimeout(r,100));
    }
    return false;
  }

  function candidatDepuisEtat(etat){
    const ref=window.NexusStock.stockPourUsage(etat,'reference');
    const comparaison=window.NexusStock.comparer(etat);
    const article=etat.designation || etat.article || 'Référence';
    const categorie=etat.categorie || etat.categorie_nom || null;

    if(ref.quantite == null) return null;

    if(ref.nature==='reel' && Number(ref.quantite) <= 0){
      return {
        candidate_id:`STOCK-REEL-RUPTURE-${etat.produit_id}`,
        produit_id:etat.produit_id,
        ruleId:'R-STOCK-REEL-RUPTURE', rang:1, moteur:'stock',
        etat:'📦 RUPTURE OBSERVÉE', impact_eur:0, article, categorie,
        decision:`Vérifiez immédiatement la disponibilité de ${article}.`,
        pourquoi:`Le dernier stock physique observé est de ${Number(ref.quantite)}. NEXUS s'appuie ici sur un comptage réel${ref.transfertsInternesIntegres ? ' intégrant les transferts internes postérieurs' : ''}.`,
        impact:'Éviter qu’une indisponibilité physique connue interrompe les ventes.',
        confiance:'A', stock_source:'reel', stock_date:ref.date || null, validable:false
      };
    }

    if(ref.nature==='theorique' && Number(ref.quantite) <= 0){
      return {
        candidate_id:`STOCK-THEORIQUE-VERIFIER-${etat.produit_id}`,
        produit_id:etat.produit_id,
        ruleId:'R-STOCK-THEORIQUE-VERIFIER', rang:2, moteur:'stock',
        etat:'📦 À VÉRIFIER', impact_eur:0, article, categorie,
        decision:`Contrôlez physiquement ${article} avant toute décision.`,
        pourquoi:`Le stock logiciel est de ${Number(ref.quantite)}, mais aucun stock physique exploitable n’est disponible. NEXUS ne présente pas cette valeur comme une rupture réelle.`,
        impact:'Confirmer la situation sans créer de double gestion avec le logiciel de stock.',
        confiance:'C', stock_source:'theorique', stock_date:ref.date || null, validable:false
      };
    }

    if(comparaison.comparable && Number(comparaison.ecart)!==0){
      return {
        candidate_id:`STOCK-ECART-COMPARABLE-${etat.produit_id}`,
        produit_id:etat.produit_id,
        ruleId:'R-STOCK-ECART-COMPARABLE', rang:2, moteur:'stock',
        etat:'📦 ÉCART À EXPLIQUER', impact_eur:0, article, categorie,
        decision:`Expliquez l’écart de stock de ${article} avant toute correction.`,
        pourquoi:`Stock physique ${comparaison.reel} · stock théorique ${comparaison.theorique} · écart ${comparaison.ecart}. Les deux mesures sont suffisamment proches dans le temps pour être comparées.`,
        impact:'Identifier la cause avant une régularisation et conserver une trace fiable.',
        confiance:'B', stock_source:'comparaison_fiable', stock_date:ref.date || null, validable:false
      };
    }
    return null;
  }

  async function chargerCandidats(site){
    if(!site) return [];
    const etats=await window.NexusStock.chargerEtat(site);

    // La couverture / commande du stock GLOBAL est une capacité optionnelle.
    // Quand elle est désactivée pour un site équipé d'un logiciel de gestion,
    // le Conseiller ne remonte pas de signaux de commande/rupture globale.
    // Les écarts réel ↔ théorique restent utiles pour le contrôle et sont conservés.
    let reapproGlobalActif=false;
    if(window.NexusReappro && window.NexusReappro.chargerConfig){
      try{ reapproGlobalActif=(await window.NexusReappro.chargerConfig(site)).actif===true; }
      catch(err){ console.warn('Conseiller Stock — configuration réappro global indisponible:',err); }
    }

    let candidats=etats.map(candidatDepuisEtat).filter(Boolean);
    if(!reapproGlobalActif){
      candidats=candidats.filter(c=>c.ruleId==='R-STOCK-ECART-COMPARABLE');
      return candidats;
    }

    if(window.NexusReappro){
      try{
        const analyse=await window.NexusReappro.analyserSite(site);
        const reappro=window.NexusReappro.candidatsConseiller(analyse);
        const produitsReappro=new Set(reappro.map(c=>String(c.produit_id || c.candidate_id.split('-').pop())));
        candidats=candidats.filter(c=>{
          if(c.ruleId==='R-STOCK-ECART-COMPARABLE') return true;
          return !produitsReappro.has(String(c.produit_id));
        });
        candidats=candidats.concat(reappro);
      }catch(err){
        console.warn('Conseiller Stock — couverture indisponible, repli sur signaux stock simples:',err);
      }
    }
    return candidats;
  }

  function resumer(etats){
    const total=etats.length;
    const reel=etats.filter(e=>e.stock_reel_observe!=null).length;
    const theorique=etats.filter(e=>e.stock_theorique!=null).length;
    const comparables=etats.filter(e=>window.NexusStock.comparer(e).comparable).length;
    const indisponibles=etats.filter(e=>window.NexusStock.stockPourUsage(e,'reference').quantite==null).length;
    return {total,reel,theorique,comparables,indisponibles};
  }

  window.NexusConseillerStock=Object.freeze({chargerCandidats,candidatDepuisEtat,resumer});

  (async()=>{
    if(!(await attendreDependances())) return;
    if(window.NexusConseiller && !window.NexusConseiller.chargerCandidatsStock){
      window.NexusConseiller.chargerCandidatsStock=chargerCandidats;
    }
  })();
})();
