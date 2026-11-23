const fs=require('fs');const s=fs.readFileSync(__dirname+'/NEXUS-Produits-v1.html','utf8');
const m=s.match(/function gtin14\(x\) \{[\s\S]*?\n  \}\n/);if(!m){console.log('FAIL fonction absente');process.exit(1)}
const gtin14=new Function(m[0]+';return gtin14')();
let ok=0,ko=0;const t=(n,a,b)=>{if(a===b)ok++;else{ko++;console.log('FAIL',n,a,b)}};
t('ean13','0'+'4006381333931',gtin14('4006381333931'));
t('upca','00036000291452',gtin14('036000291452'));
t('upc=ean13',gtin14('036000291452'),gtin14('0036000291452'));
t('gtin8','00000096385074',gtin14('96385074'));
t('14',gtin14('04006381333931'),'04006381333931');
t('11 refuse',null,gtin14('03600029145'));
t('10',null,gtin14('3600029145'));
t('cle fausse',null,gtin14('4006381333932'));
t('lettres',null,gtin14('40063813A3931'));
t('15',null,gtin14('004006381333931'));
t('vide',null,gtin14(''));t('null',null,gtin14(null));
console.log(ok+' passed / '+ko+' failed');process.exit(ko?1:0);
