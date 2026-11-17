const path=require('path'),fs=require('fs');globalThis.window=globalThis;
// Usage : node mesurer_manques_contexte.js <dossier des 3 modules de la tête #332> <docs/reference/scanner-tarifaire-dossiers>
// Mesure l'effet de chaque entrée du contexte que la page ne fournit pas, contre la base de la preuve 440/440. Lecture seule, aucun réseau.
const D=process.argv[2], R=process.argv[3];
require(path.join(D,'nexus-produits-mesure.js'));const T=require(path.join(D,'nexus-politique-tarifaire.js'));const A=require(path.join(D,'nexus-politique-tarifaire-registres.js'));
const T1=path.join(R,'01-T1-moteur/t1');const cfg=require(path.join(T1,'config_sainte_marie_t1.js'));const C=cfg.contexte;
const lire=f=>JSON.parse(fs.readFileSync(path.join(T1,'donnees',f),'utf8'));
const ventes=lire('ventes_decenium_2periodes.json').map(r=>Object.assign({},r,{categorie:String(r.categorie||'').replace(/Ã /g,'à').replace(/\s+/g,' ').trim()}));
const RS=new Set(cfg.RAYONS);
const exp=JSON.parse(fs.readFileSync(path.join(R,'05-T2-recette-fonctionnelle/t2/recette_fonctionnelle/preuves/export_61_test_20261117-1417.json'),'utf8'));
const reg=exp.registres||(Array.isArray(exp)&&exp[0]&&exp[0].registres)||exp;
function run(nom,scope,base){const P1=ventes.filter(r=>r.periode_debut==='2026-09-19'&&(!scope||RS.has(r.categorie))),P2=ventes.filter(r=>r.periode_debut==='2026-10-05'&&(!scope||RS.has(r.categorie)));
 const res=T.analyser(P2,P1,A.contexteDepuisRegistres(reg,base));const s=res.synthese;
 const a5stock=res.lignes.filter(l=>l.alertes.some(a=>a.code==='A5'&&JSON.stringify(a).includes('absente du relevé'))).length;
 console.log(nom.padEnd(34),'refs',s.references,'fiab',JSON.stringify(s.fiabilite),'statuts',JSON.stringify(s.statuts),'alertes',JSON.stringify(s.alertes),'A5 stock',a5stock,'gainMinFiable',JSON.stringify(res.gains.decisionnels.minimum));}
const preuve={periode:C.periode,jours:C.jours,stockSource:C.stockSource,tva:C.tva,justifications:C.justifications,motifsDivergents:C.motifsDivergents,natureDe:C.natureDe,stock:lire('stock_pa_net_ht_20261110.json').lignes};
run('preuve 440 (base T1)',true,preuve);
run('page: sans stock (stockFourni false)',true,{...preuve,stock:undefined,stockFourni:false});
run('page: sans explications TVA',true,{...preuve,tva:{confirmations:[]}});
run('page: sans motifsDivergents',true,{...preuve,motifsDivergents:undefined});
run('page: tout le catalogue (sans périmètre)',false,preuve);
run('page: cumul des 4 manques',false,{periode:C.periode,justifications:C.justifications,natureDe:C.natureDe,tva:{confirmations:[]},stockFourni:false});
