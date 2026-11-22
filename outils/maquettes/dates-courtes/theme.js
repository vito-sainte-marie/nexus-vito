(function(){var r=document.documentElement,b=document.getElementById('bascule');
function maj(){b.textContent=r.getAttribute('data-theme')==='jour'?'Passer en Nuit':'Passer en Jour'}
b.addEventListener('click',function(){if(r.getAttribute('data-theme')==='jour')r.removeAttribute('data-theme');else r.setAttribute('data-theme','jour');maj()});maj()})();
