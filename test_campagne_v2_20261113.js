// Campagne NEXUS V2, phase 1 : refonte visuelle (présentation seule).
const assert=require('assert'); const fs=require('fs'); const path=require('path'); const crypto=require('crypto');
global.window={}; require('./nexus-vocabulaire.js'); const V=window.NexusVocab; const lire=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
let echecs=0; function t(nom,fn){try{fn();console.log('  ok   '+nom)}catch(e){echecs++;console.log('  FAIL '+nom+'\n       '+e.message)}}
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,f))).digest('hex');
const page=lire('NEXUS-Campagne-v2.html'); const C=V.campagne;
const bloc=JSON.stringify(C);

t('v2 indépendante de la v1 ; nexus-campagnes.js garde ses fonctions',()=>{
  assert(!/NEXUS-Campagne-v1/.test(page),'la v2 référence la v1');
  const NC=lire('nexus-campagnes.js');
  ['analyserImpactCampagne','analyserCampagnes','analyserImpactProduits','analyserImpactPanierMoyen','texteConseillerCampagne'].forEach(f=>assert(NC.includes(f),f+' absente'));
});
t('expressions interdites absentes',()=>{
  for(const s of ['va dans le bon sens','achats avancés']){
    assert(!page.includes(s),s+' dans la page'); assert(!bloc.includes(s),s+' dans le lexique');
  }
});
t('aucun tiret cadratin (page et bloc lexique)',()=>{
  assert(!page.includes('—')); assert(!bloc.includes('—'));
});
t('six cartes, quatre En préparation, compensation et simulateur disponibles, sans chiffre',()=>{
  assert.deepStrictEqual(C.cartes.filter(c=>c.dispo).map(c=>c.cle),['compensation','simulateur']);
  assert.deepStrictEqual(C.cartes.map(c=>c.cle),['promotions','compensation','produits-moteurs','produits-a-revoir','simulateur','renouveler']);
  assert.strictEqual(C.enPreparation,'En préparation');
  C.cartes.forEach(c=>assert(!/\d/.test(c.titre+c.texte),'chiffre dans '+c.cle));
  assert(!/tuile disponible|class="tuile[^"]*\b(lien|dispo)/.test(page));
  assert(/aria-disabled="true"/.test(page));
  assert(!/<a[^>]*class="tuile/.test(page));
});
t('états : tableau de démonstration seulement',()=>{
  assert.deepStrictEqual(C.etats.map(e=>e.cle),['insuffisante','a-ameliorer','encourageante','a-renouveler','non-mesurable']);
  assert(/data-demo="etats"/.test(page));
  assert(page.includes("get('apercu_etats') === '1'"),'tableau sans paramètre apercu_etats');
  assert(/<div id="blocEtats" hidden>/.test(page),'bloc des états visible par défaut');
  assert(/if \(apercuEtats\) \$\('etats'\)\.innerHTML/.test(page),'rendu des états hors paramètre');
  const rendu=page.slice(page.indexOf('function carteResume'),page.indexOf('function afficher'));
  assert(rendu.length>50); assert(!/etat|rentabilite/.test(rendu),'état dans le rendu des campagnes');
  assert(!/etat/.test(page.slice(page.indexOf('function afficher'),page.indexOf('async function chargerEtAfficher'))));
});
t('échappement du texte saisi',()=>{
  const m=page.match(/function esc\(s\)\{[\s\S]*?\n\}/); assert(m);
  const esc=new Function(m[0]+';return esc')();
  const o=esc('<img src=x onerror=alert(1)>'); assert(!o.includes('<')&&!o.includes('>')); assert(o.includes('&lt;img'));
  assert.strictEqual(esc('"\'&'),'&quot;&#39;&amp;');
  assert(!/onclick=/.test(page),'onclick en ligne');
});
t('pas de débordement horizontal (contrôles statiques 390 et 360)',()=>{
  assert(/\.app\{[^}]*overflow-x:hidden/.test(page));
  assert(/\.tuiles\{[^}]*grid-template-columns:1fr;/.test(page));
  assert(/@media \(min-width:600px\)\{\.tuiles\{grid-template-columns:1fr 1fr/.test(page));
  assert(/\.tuile\{[^}]*min-width:0/.test(page));
  assert(/overflow-wrap|word-break/.test(page));
  assert(/name="viewport"/.test(page));
});
t('empreintes des six icônes premium',()=>{
  const h={promotions:'20b6129e','compensation':'8e1e6a4e','produits-moteurs':'b1bba6e0','produits-a-revoir':'ff7335ef',simulateur:'8dcce757',renouveler:'42e24cd9'};
  for(const k in h) assert(sha('assets/icones/campagne/premium/campagne-'+k+'.svg').startsWith(h[k]),k);
});
t('empreintes et tailles de l\'image d\'en-tête',()=>{
  const h={800:['291d8c73',47942],1200:['6252ac37',86978],1600:['6d439ef8',133024]};
  for(const k in h){const f='assets/campagne/campagne-entete-'+k+'.webp'; assert(sha(f).startsWith(h[k][0]),f); assert.strictEqual(fs.statSync(path.join(__dirname,f)).size,h[k][1],f);}
  assert(/campagne-entete-800\.webp 800w/.test(page)&&/campagne-entete-1200\.webp 1200w/.test(page)&&/campagne-entete-1600\.webp 1600w/.test(page));
  assert(/class="entete"[^>]*alt=""/.test(page)); assert(page.includes('--banniere-cadrage'));
});
t('kit d\'icônes : 84 fichiers, sans README ni aperçu',()=>{
  const n=d=>fs.readdirSync(path.join(__dirname,d)).length;
  assert.strictEqual(n('assets/icones/campagne/premium')+n('assets/icones/campagne/simple'),84);
  assert(!fs.existsSync(path.join(__dirname,'assets/icones/campagne/README.txt'))&&!fs.existsSync(path.join(__dirname,'assets/icones/campagne/apercu.png')));
});
t('page déclarée (auth, forfait) et liée seulement depuis les points d\'entrée et le bandeau de la V1',()=>{
  assert(lire('nexus-auth.js').includes("'NEXUS-Campagne-v2.html'"));
  assert(lire('nexus-forfait.js').includes("'NEXUS-Campagne-v2.html'"));
  const liens=fs.readdirSync(__dirname).filter(f=>/\.(html|js)$/.test(f)&&f!=='NEXUS-Campagne-v2.html'&&!/^test_/.test(f)&&f!=='nexus-auth.js'&&f!=='nexus-forfait.js').filter(f=>lire(f).includes('Campagne-v2'));
  assert.deepStrictEqual(liens.sort(),['NEXUS-App-v1.html','NEXUS-Campagne-v1.html','NEXUS-Documentation-v1.html','nexus-desktop.js','nexus-recherche.js']);
});
t('textes affichés issus du lexique',()=>{
  assert(page.includes('V.cartes')&&page.includes('V.enPreparation'));
  assert(C.titre&&C.historiqueIntro);
});
t('retouches 20261113 : une seule mention, deux décimales, texte',()=>{
  assert(!/class="acces"/.test(page),'deuxième mention En préparation');
  assert((page.match(/V\.enPreparation/g)||[]).length===1);
  assert(page.includes('minimumFractionDigits:2'));
  assert(/const fmtNb = v => Math\.round\(v\)/.test(page));
  assert((8.5).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})==='8,50');
  assert(C.cartes.find(c=>c.cle==='produits-a-revoir').texte==='Repérer les produits dont les ventes ne compensent pas la remise.');
  assert(/@media \(max-width:599px\)[\s\S]*\.header::after/.test(page),'dégradé mobile');
});
t('mesure de la compensation : câblage de la page et lexique',()=>{
  assert(/<script src="nexus-mesure-compensation\.js/.test(page));
  assert(/id="mesure"/.test(page));
  assert(/data-carte="compensation"/.test(page) || /querySelector\('\[data-carte="compensation"\]'\)/.test(page));
  assert(!/octroi/i.test(page), 'octroi encore dans la page');
  assert(!/octroi/i.test(bloc), 'octroi encore dans le lexique');
  assert(!/campagne_mesures_produits[^;]*from\('products'\)/.test(page));
  assert(!/from\('products'\)\s*\.(insert|update|upsert|delete)/.test(page), 'écriture dans products');
  const M=C.mesure;
  assert(M && Object.keys(M).length>=50);
  const tout=JSON.stringify(M);
  assert(!/va dans le bon sens|achats avancés/i.test(tout));
  ['campagne_mesures_produits','campagne_couts','fournisseurs_conditions'].forEach(n=>assert(page.includes(n),n));
});
t('mesure : retrait des produits supprimés, coûts insérés avant suppression, 30 jours par défaut signalés',()=>{
  const i=page.indexOf('async function mesEnregistrer'); const f=page.slice(i,i+4500);
  assert(/campagne_mesures_produits'\)\.delete\(\)\.in\('id'/.test(f),'retrait des lignes absentes de la liste');
  const ins=f.indexOf("from('campagne_couts').insert"), del=f.indexOf("from('campagne_couts').delete()");
  assert(ins>0 && del>ins,'coûts : insertion avant suppression');
  assert(/\.delete\(\)\.in\('id', anciens\)/.test(f),'suppression par identifiants');
  assert(page.includes('MV.joursDefaut') && C.mesure.joursDefaut==='30 jours par défaut');
  Object.keys(C.mesure.sources).forEach(k=>assert(['comptage','decenium','saisie'].includes(k),k));
});
process.exit(echecs?1:0);
