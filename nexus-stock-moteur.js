// NEXUS Stock Engine — source centrale de lecture du stock.
// Principe : le stock réel et le stock théorique restent deux vérités distinctes.
// Aucun moteur NEXUS ne doit les additionner ni écraser l'une avec l'autre.
// V2 : un écart n'est exploitable que si les deux stocks sont alignés dans le temps.
(function(){
  'use strict';

  const VUE_V2='nexus_stock_etat_v2';
  const VUE_V1='nexus_stock_etat';

  function assertClient(){
    if(typeof nexusClient === 'undefined') throw new Error('NEXUS Stock Engine: nexusClient indisponible');
  }

  async function executerLecture(vue,site,options={}){
    let q=nexusClient.from(vue).select('*').eq('site',site);
    if(options.actifsSeulement !== false) q=q.eq('actif',true);
    if(options.produitId) q=q.eq('produit_id',options.produitId);
    if(options.categorieId) q=q.eq('categorie_id',options.categorieId);
    if(options.natureReference) q=q.eq('stock_reference_nature',options.natureReference);
    return q.order('designation',{ascending:true});
  }

  async function chargerEtat(site,options={}){
    assertClient();
    if(!site) throw new Error('NEXUS Stock Engine: site requis');

    let {data,error}=await executerLecture(VUE_V2,site,options);
    if(error){
      // Compatibilité transitoire : une ancienne base peut ne pas encore avoir la vue V2.
      const fallback=await executerLecture(VUE_V1,site,options);
      data=fallback.data;
      error=fallback.error;
    }
    if(error) throw error;
    return (data || []).map(normaliserEtat);
  }

  async function chargerProduit(site,produitId){
    const rows=await chargerEtat(site,{produitId,actifsSeulement:false});
    return rows[0] || null;
  }

  function normaliserEtat(etat){
    if(!etat) return etat;
    return {
      ...etat,
      stock_reel_observe:etat.stock_reel_observe ?? etat.stock_reel ?? null,
      stock_reel_observe_le:etat.stock_reel_observe_le ?? etat.stock_reel_le ?? null,
      ecart_brut_non_aligne:etat.ecart_brut_non_aligne ?? etat.ecart_reel_theorique ?? null,
      comparaison_fiable:etat.comparaison_fiable === true,
      ecart_reference:Object.prototype.hasOwnProperty.call(etat,'ecart_reference') ? etat.ecart_reference : null,
      stock_reference_le:etat.stock_reference_le ?? (etat.stock_reference_nature==='reel' ? etat.stock_reel_le : etat.stock_theorique_le) ?? null,
      stock_reference_confiance:etat.stock_reference_confiance ?? (etat.stock_reference_nature==='reel' ? 'non_evaluee' : etat.stock_reference_nature==='theorique' ? 'theorique' : 'insuffisante'),
      stock_reference_statut:etat.stock_reference_statut ?? (etat.stock_reference_nature==='reel' ? 'observe' : etat.stock_reference_nature==='theorique' ? 'theorique_seul' : 'indisponible')
    };
  }

  function stockPourUsage(etat,politique='reference'){
    etat=normaliserEtat(etat);
    if(!etat) return {quantite:null,nature:'indisponible',source:null,date:null,confiance:'insuffisante'};

    if(politique==='reel'){
      return {
        quantite:etat.stock_reel_observe,
        nature:etat.stock_reel_observe == null ? 'indisponible' : 'reel',
        source:etat.stock_reel_source,
        date:etat.stock_reel_observe_le,
        confiance:etat.stock_reference_nature==='reel' ? etat.stock_reference_confiance : 'non_evaluee'
      };
    }

    if(politique==='theorique'){
      return {
        quantite:etat.stock_theorique,
        nature:etat.stock_theorique == null ? 'indisponible' : 'theorique',
        source:etat.stock_theorique_source,
        date:etat.stock_theorique_le,
        confiance:etat.stock_theorique == null ? 'insuffisante' : 'theorique'
      };
    }

    return {
      quantite:etat.stock_reference,
      nature:etat.stock_reference_nature,
      source:etat.stock_reference_nature==='reel' ? etat.stock_reel_source : etat.stock_theorique_source,
      date:etat.stock_reference_le,
      confiance:etat.stock_reference_confiance,
      statut:etat.stock_reference_statut
    };
  }

  function comparer(etat){
    etat=normaliserEtat(etat);
    if(!etat) return {reel:null,theorique:null,ecart:null,ecartBrut:null,comparable:false,raison:'donnee_absente'};

    const deuxValeurs=etat.stock_reel_observe != null && etat.stock_theorique != null;
    return {
      reel:etat.stock_reel_observe,
      reelLe:etat.stock_reel_observe_le,
      theorique:etat.stock_theorique,
      theoriqueLe:etat.stock_theorique_le,
      // Seul ecart_reference est décisionnel. L'écart brut reste explicatif.
      ecart:etat.comparaison_fiable ? etat.ecart_reference : null,
      ecartBrut:etat.ecart_brut_non_aligne,
      comparable:deuxValeurs && etat.comparaison_fiable,
      deltaSecondes:etat.delta_t_secondes ?? null,
      raison:!deuxValeurs ? 'source_manquante' : etat.comparaison_fiable ? 'aligne_temporellement' : 'horodatages_non_alignes'
    };
  }

  function expliquer(etat){
    etat=normaliserEtat(etat);
    if(!etat) return {titre:'Stock indisponible',detail:'Aucune source de stock exploitable.',niveau:'insuffisant'};
    const comparaison=comparer(etat);

    if(etat.stock_reference_nature==='indisponible'){
      return {titre:'Stock indisponible',detail:'Ni inventaire physique ni stock théorique rapproché.',niveau:'insuffisant'};
    }
    if(etat.stock_reference_nature==='reel' && etat.stock_theorique == null){
      return {titre:'Stock réel disponible',detail:'Inventaire physique disponible. Aucun stock théorique n’est actuellement rapproché.',niveau:etat.stock_reference_confiance};
    }
    if(etat.stock_reference_nature==='theorique'){
      return {titre:'Stock théorique uniquement',detail:'Aucun inventaire physique exploitable. NEXUS conserve la valeur importée comme théorie, sans la présenter comme stock réel.',niveau:'theorique'};
    }
    if(comparaison.comparable){
      return {titre:'Réel et théorique comparables',detail:'Les deux mesures sont suffisamment proches dans le temps pour interpréter leur écart.',niveau:etat.stock_reference_confiance};
    }
    return {titre:'Deux stocks, mais comparaison provisoire',detail:'Le réel et le théorique existent, mais leurs horodatages sont trop éloignés. NEXUS ne transforme pas l’écart brut en anomalie.',niveau:etat.stock_reference_confiance};
  }

  window.NexusStock=Object.freeze({
    chargerEtat,
    chargerProduit,
    stockPourUsage,
    comparer,
    expliquer,
    normaliserEtat,
    doctrine:Object.freeze({
      reel:'inventaire physique observé et horodaté',
      theorique:'stock logiciel/importé, conservé séparément',
      reference:'priorité au réel lorsqu’il existe, sans écraser le théorique',
      ecart:'un écart ne devient décisionnel que si réel et théorique sont temporellement comparables',
      import:'un nouvel import actualise le théorique uniquement ; il ne remplace jamais le réel'
    })
  });
})();
