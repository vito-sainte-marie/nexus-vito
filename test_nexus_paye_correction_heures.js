// Correction manuelle des heures retenues (03/09/2026, demande de Frédéric :
// « je veux pouvoir modifier car cet exceptionnel peut arriver, mais ça ne
// doit pas prendre trop de place car c'est exceptionnel »).
//
// La contrainte d'interface fait partie de la règle : le contrôle doit être
// REPLIÉ par défaut. Une carte qui étale un formulaire pour un cas rare fait
// payer à tous les jours le coût de l'exception.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Paye-v1.html'), 'utf8');
let ok = 0;
function verifier(libelle, condition) {
  console.log(`${condition ? 'OK  ' : 'ÉCHEC'} — ${libelle}`);
  assert.ok(condition, libelle);
  ok++;
}

verifier('le champ de correction existe',
  /class="h-box"[^>]*data-key=/.test(html) && /class="h-val"/.test(html));
verifier('il est REPLIÉ par défaut — l’exception ne coûte rien au cas courant',
  /class="h-box"[^>]*hidden/.test(html));
verifier('il ne s’affiche que là où des heures ont été attribuées',
  /i\.heuresAttribuees!=null\?`<div class="h-box"/.test(html));
verifier('l’ouverture passe par un simple crayon, pas un bouton pleine largeur',
  /class="h-edit"[\s\S]{0,220}✎/.test(html));
verifier('le crayon annonce sa fonction aux lecteurs d’écran',
  /aria-label="Corriger les heures retenues"/.test(html));
verifier('la saisie est bornée à des heures plausibles',
  /class="h-val" type="number" min="0" max="24"/.test(html));
verifier('une valeur hors bornes est refusée avant tout appel réseau',
  /!Number\.isFinite\(h\)\|\|h<0\|\|h>24/.test(html));
verifier('la correction est enregistrée en minutes, avec impact paie',
  /quantiteMinutes:Math\.round\(h\*60\)/.test(html) && /statut:'valide',impactPaye:true/.test(html));
verifier('la note conserve le barème NEXUS à côté de la valeur retenue',
  /barème NEXUS : \$\{item\.heuresAttribuees\} h/.test(html));
verifier('un échec d’enregistrement est dit, jamais silencieux',
  /correction des heures[\s\S]{0,260}Rien n'a été modifié/.test(html));

console.log(`\n${ok} vérifications passées.`);
