/* Outillage des maquettes : jetons Nuit issus de NexusTheme (aucun littéral), boutons Jour/Nuit,
   badges d'état par NexusBadgeEtat, icône par NexusIcones. Aucune donnée, aucune écriture. */
(function(){
  var T=window.NexusTheme,B=window.NexusBadgeEtat,I=window.NexusIcones;
  if(T){var d=Object.keys(T.SOMBRE).map(function(k){return k+':'+T.SOMBRE[k]}).join(';');
    var s=document.createElement('style');s.textContent=':root{'+d+'}';document.head.insertBefore(s,document.head.firstChild);}
  // <span data-etat="gravite:a-verifier">Libellé</span> -> badge partagé
  function badge(el){var p=el.getAttribute('data-etat').split(':'),t=el.textContent.trim(),h='';
    if(p[0]==='gravite')h=B.gravite(p[1],{libelle:t});
    else if(p[0]==='traitement')h=B.traitement(p[1],{libelle:t});
    else if(p[0]==='qualification')h=B.qualification(p[1]);
    else h=B.neutre(t);
    el.outerHTML=h;}
  function icones(){
    document.querySelectorAll('[data-nexus-icone]').forEach(function(el){if(el.tagName!=='IMG')return;});
    if(I)I.appliquer(document);
    document.querySelectorAll('img[data-nexus-icone]').forEach(function(im){ // chemin relatif au dossier des maquettes
      ['src','srcset'].forEach(function(a){var v=im.getAttribute(a);if(v&&v.indexOf('assets/')===0)im.setAttribute(a,'../../../'+v);
        else if(v&&a==='srcset')im.setAttribute(a,v.replace(/(^|, )assets\//g,'$1../../../assets/'));});});}
  document.querySelectorAll('[data-etat]').forEach(badge);
  function pref(){icones();}
  pref();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(pref,0)});
  var r=document.querySelector('.reglage');
  if(r&&T){r.innerHTML=['sombre','jour'].map(function(x){return '<button type="button" data-theme-reglage="'+x+'" aria-pressed="false">'+(x==='jour'?'Jour':'Nuit')+'</button>'}).join('');
    T.brancherMenu(r);var c=document.documentElement.getAttribute('data-theme')==='jour'?'jour':'sombre';
    r.querySelector('[data-theme-reglage="'+c+'"]').setAttribute('aria-pressed','true');}
  var q=location.search.match(/largeur=(375|1280)/);if(q)document.body.className='v'+q[1];
})();
