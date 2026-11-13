// Branchement de Campagne V2 dans NEXUS : aucun point d'entrée ne mène à la V1.
const assert=require('assert'); const fs=require('fs'); const path=require('path');
const lire=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
let echecs=0; function t(nom,fn){try{fn();console.log('  ok   '+nom)}catch(e){echecs++;console.log('  FAIL '+nom+'\n       '+e.message)}}
const ENTREES=['NEXUS-App-v1.html','nexus-desktop.js','nexus-recherche.js','NEXUS-Documentation-v1.html'];
ENTREES.forEach(f=>t('entrée '+f+' : V2 présente, V1 absente',()=>{
  const s=lire(f);
  assert(s.includes('NEXUS-Campagne-v2.html'),'la V2 manque');
  assert(!s.includes('NEXUS-Campagne-v1.html'),'la V1 est encore référencée');
}));
t('menu : l\'entrée Campagnes ouvre la V2',()=>{
  assert(/<a class="nav-item"[^>]*href="NEXUS-Campagne-v2\.html"/.test(lire('NEXUS-App-v1.html')));
});
t('table des titres : la V2 porte « Campagne NEXUS »',()=>{
  assert(/'NEXUS-Campagne-v2\.html': 'Campagne NEXUS'/.test(lire('NEXUS-App-v1.html')));
});
t('bureau et recherche : tuile et entrée Campagnes sur la V2',()=>{
  assert(/label: 'Campagnes'[^\n]*href: 'NEXUS-Campagne-v2\.html'/.test(lire('nexus-desktop.js')));
  assert(/label: 'Campagnes'[^\n]*href: 'NEXUS-Campagne-v2\.html'/.test(lire('nexus-recherche.js')));
});
t('documentation : l\'entrée campagnes ouvre la V2',()=>{
  assert(/id: 'campagnes'[^\n]*href: 'NEXUS-Campagne-v2\.html'/.test(lire('NEXUS-Documentation-v1.html')));
});
t('raccourcis : Campagne absente du catalogue, donc aucun raccourci ne peut mener à la V1',()=>{
  assert(!/Campagne/.test(lire('nexus-raccourcis-catalogue.js')));
});
t('V1 et V2 restent autorisées (auth, forfait)',()=>{
  ['nexus-auth.js','nexus-forfait.js'].forEach(f=>{const s=lire(f);
    assert(s.includes("'NEXUS-Campagne-v1.html'")&&s.includes("'NEXUS-Campagne-v2.html'"),f)});
});
t('V1 : bandeau sobre vers la nouvelle version',()=>{
  const s=lire('NEXUS-Campagne-v1.html');
  assert(s.includes('Ancienne version. La nouvelle version de Campagne est dans le menu.'));
  assert(/<a href="NEXUS-Campagne-v2\.html"[^>]*>Ouvrir la nouvelle version<\/a>/.test(s));
});
if(echecs){console.log(echecs+' échec(s)');process.exit(1)} console.log('Tous les tests passent.');
