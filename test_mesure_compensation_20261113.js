// Mesure de la compensation : moteur pur, sans écriture. Cas Petromix Floup avec stock et livraisons fictifs.
const assert=require('assert'); const fs=require('fs'); const path=require('path');
require('./nexus-mesure-compensation.js');
const M=globalThis.NexusMesureCompensation;
const lire=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
let echecs=0;
function t(nom,fn){try{fn();console.log('  ok  '+nom);}catch(e){echecs++;console.log('  ECHEC '+nom+'\n     '+e.message);}}
const proche=(a,b,tol)=>assert(Math.abs(a-b)<=Math.abs(b)*(tol||1e-9)+1e-9,a+' vs '+b);

// Floup : 903 ventes le mois précédent, vente 0,93, achat net 0,54 × 0,90 = 0,486 ; pendant : vente 0,72, 30 jours.
const floup={article:'PETROMIX FLOUP',ventesMoisPrecedent:903,joursReference:30,achatAvant:0.486,achatPendant:0.486,venteAvant:0.93,ventePendant:0.72,
  jours:30,stockDebut:1000,livraisons:500,stockFin:600};
// Volume pendant qui donne exactement un taux visé (stock début 2000, aucune livraison).
function pourTaux(taux,over){
  const margeJourAvant=903/30*(0.93-0.486), mu=0.72-0.486;
  const ventes=taux*margeJourAvant/mu*30;
  return Object.assign({},floup,{stockDebut:5000,livraisons:0,stockFin:5000-ventes},over||{});
}

t('Floup : ventes, marges, seuil, taux et gain',()=>{
  const r=M.mesurerProduit(floup);
  assert(r.mesurable); proche(r.ventesJourAvant,30.1); proche(r.ventesPendant,900); proche(r.ventesJourPendant,30);
  proche(r.margeUniteAvant,0.444); proche(r.margeUnitePendant,0.234);
  proche(r.margeJourAvant,30.1*0.444); proche(r.margeJourPendant,30*0.234);
  proche(r.seuil,30.1*0.444/0.234); proche(r.taux,30*0.234/(30.1*0.444));
  proche(r.gain,(30*0.234-30.1*0.444)*30);
  assert.strictEqual(r.etat,'insuffisante');
});
t('sources du stock : comptage, puis Decenium, puis saisie',()=>{
  assert.deepStrictEqual(M.choisirStock({comptage:10,decenium:20,saisie:30}),{valeur:10,source:'comptage'});
  assert.deepStrictEqual(M.choisirStock({decenium:20,saisie:30}),{valeur:20,source:'decenium'});
  assert.deepStrictEqual(M.choisirStock({comptage:null,decenium:'',saisie:30}),{valeur:30,source:'saisie'});
  assert.deepStrictEqual(M.choisirStock({comptage:0}),{valeur:0,source:'comptage'});
  assert.deepStrictEqual(M.choisirStock({}),{valeur:null,source:null});
});
t('limites du taux : 89,9 %, 90 %, 100 %, 109,9 %',()=>{
  const e=x=>M.mesurerProduit(pourTaux(x));
  assert.strictEqual(e(0.899).etat,'insuffisante');
  assert.strictEqual(e(0.90).etat,'a_ameliorer');
  assert.strictEqual(e(0.999).etat,'a_ameliorer');
  assert.strictEqual(e(1.00).etat,'encourageante');
  assert.strictEqual(e(1.099).etat,'encourageante');
});
t('110 % : à renouveler seulement si le gain après coûts atteint 100 €',()=>{
  assert.strictEqual(M.etat(1.10,99),'encourageante');
  assert.strictEqual(M.etat(1.10,99.99),'encourageante');
  assert.strictEqual(M.etat(1.10,100),'a_renouveler');
  assert.strictEqual(M.etat(1.5,100),'a_renouveler');
  assert.strictEqual(M.etat(null,500),'non_mesurable');
});
t('campagne : le gain après coûts décide de « à renouveler »',()=>{
  const p=pourTaux(1.5);
  const g=M.mesurerCampagne([p]).gain; assert(g>100);
  const sans=M.mesurerCampagne([p],[]);
  assert.strictEqual(sans.etat,g>=100?'a_renouveler':'encourageante');
  const coute=M.mesurerCampagne([p],[{montant_ht:g-99}]);
  proche(coute.gainApresCouts,99); assert.strictEqual(coute.etat,'encourageante');
  const juste=M.mesurerCampagne([p],[{montant_ht:g-100}]);
  proche(juste.gainApresCouts,100); assert.strictEqual(juste.etat,'a_renouveler');
});
t('marge pendant nulle ou négative : seuil impossible',()=>{
  [0.486,0.4].forEach(v=>{
    const r=M.mesurerProduit(Object.assign({},floup,{ventePendant:v}));
    assert(r.impossible); assert.strictEqual(r.seuil,null); assert(r.margeJourPendant<=1e-9);
  });
});
t('données manquantes : non mesurable, jamais zéro inventé',()=>{
  const r=M.mesurerProduit(Object.assign({},floup,{stockFin:null}));
  assert(!r.mesurable); assert(r.manquants.includes('stockFin')); assert.strictEqual(r.etat,'non_mesurable'); assert.strictEqual(r.taux,null);
  const r2=M.mesurerProduit(Object.assign({},floup,{stockDebut:''})); assert(r2.manquants.includes('stockDebut'));
  const r3=M.mesurerProduit(Object.assign({},floup,{jours:0})); assert(r3.manquants.includes('jours'));
});
t('part mesurable : 79 % non mesurable, 81 % mesurable ; 80 % exact bloque (manquant de 20 %)',()=>{
  // Deux produits à marge/jour avant : A pèse w, B pèse le reste. B sans données.
  const A=Object.assign({},pourTaux(1.0),{article:'A'});
  const mA=903/30*(0.93-0.486);
  const unB=part=>{ // B pèse (1-part) du total
    const mB=mA*(1-part)/part; const venteAvant=0.486+mB/(903/30);
    return Object.assign({},floup,{article:'B',venteAvant:venteAvant,stockFin:null});
  };
  const c79=M.mesurerCampagne([A,unB(0.79)]); proche(c79.partMesurable,0.79,1e-6);
  assert(!c79.mesurable); assert.strictEqual(c79.etat,'non_mesurable');
  const c81=M.mesurerCampagne([A,unB(0.81)]); proche(c81.partMesurable,0.81,1e-6);
  assert(c81.mesurable);
  const c80=M.mesurerCampagne([A,unB(0.80)]); proche(c80.partMesurable,0.80,1e-6);
  assert(!c80.mesurable,'un manquant de 20 % pile bloque (règle des 20 %)');
});
t('un produit manquant pesant 20 % ou plus bloque la mesure',()=>{
  const A=Object.assign({},pourTaux(1.0),{article:'A'});
  const mA=903/30*(0.93-0.486);
  const B=Object.assign({},floup,{article:'B',venteAvant:0.486+mA*0.25/(903/30),stockFin:null}); // 20 % du total
  const c=M.mesurerCampagne([A,B]); assert(!c.mesurable);
});
t('lancement : pas de référence avant, exclu du taux, marge pendant affichée',()=>{
  const L={article:'NOUVEAU',nouveauProduit:true,achatPendant:1,ventePendant:1.3,jours:10,stockDebut:0,livraisons:200,stockFin:50};
  const r=M.mesurerProduit(L); assert(r.lancement); assert.strictEqual(r.etat,'lancement'); assert.strictEqual(r.taux,null);
  proche(r.ventesPendant,150); proche(r.margePendantTotale,45);
  const A=pourTaux(1.2);
  const seul=M.mesurerCampagne([A]), avec=M.mesurerCampagne([A,L]);
  proche(avec.taux,seul.taux); proche(avec.gain,seul.gain); proche(avec.margeLancement,45); assert.strictEqual(avec.nbLancements,1);
  const que=M.mesurerCampagne([L]); assert(!que.mesurable); assert.strictEqual(que.etat,'non_mesurable');
});
t('somme en euros entre produits, pas une moyenne de pourcentages',()=>{
  const A=pourTaux(1.0), B=Object.assign({},pourTaux(0.5),{article:'B',ventesMoisPrecedent:90});
  const c=M.mesurerCampagne([A,B]), a=M.mesurerProduit(A), b=M.mesurerProduit(B);
  proche(c.gain,a.gain+b.gain); proche(c.margeJourAvant,a.margeJourAvant+b.margeJourAvant);
  proche(c.taux,(a.margeJourPendant+b.margeJourPendant)/(a.margeJourAvant+b.margeJourAvant));
  assert(Math.abs(c.taux-(a.taux+b.taux)/2)>1e-3,'ce n’est pas la moyenne des taux');
});
t('pertes : comptées comme des ventes, affichées',()=>{
  const sans=M.mesurerProduit(floup), avec=M.mesurerProduit(Object.assign({},floup,{pertes:12}));
  proche(avec.ventesPendant,sans.ventesPendant); assert.strictEqual(avec.pertes,12); assert.strictEqual(sans.pertes,null);
});
t('prix de vente sous le prix normal hors promotion déclarée : signalé',()=>{
  assert(M.mesurerProduit(Object.assign({},floup,{prixNormal:0.93})).prixSousNormal);
  assert(!M.mesurerProduit(Object.assign({},floup,{prixNormal:0.93,promotionDeclaree:true})).prixSousNormal);
  assert(!M.mesurerProduit(Object.assign({},floup,{prixNormal:0.74})).prixSousNormal);
});
t('moteur pur : aucun accès réseau ni écriture',()=>{
  const src=lire('nexus-mesure-compensation.js');
  assert(!/fetch\(|XMLHttpRequest|\.from\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|require\(/.test(src));
});
t('constantes de la doctrine',()=>{
  assert.strictEqual(M.SEUIL_INSUFFISANTE,0.9); assert.strictEqual(M.SEUIL_EQUILIBRE,1); assert.strictEqual(M.SEUIL_RENOUVELER,1.1);
  assert.strictEqual(M.GAIN_MIN_RENOUVELER,100); assert.strictEqual(M.PART_MIN_MESURABLE,0.8);
});
if(echecs){console.log(echecs+' échec(s)');process.exit(1);} console.log('OK');
