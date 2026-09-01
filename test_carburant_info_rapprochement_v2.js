const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'NEXUS-Carburants-Pilotage-v1.html'), 'utf8');

function verifier(condition, message) {
  if (!condition) throw new Error(message);
}

verifier(html.includes('data-rapprochement-info="${cle}"'), 'Le bouton Infos doit être présent sur chaque rapprochement.');
verifier(html.includes('id="rapprochementInfo_${cle}" style="display:none;"'), 'Le détail doit être masqué par défaut.');
verifier(html.includes('aria-expanded="false"'), 'Le bouton doit annoncer son état replié.');
verifier(html.includes('les ventes pendant la fenêtre ne peuvent pas expliquer ce surplus'), 'Un surplus ne doit pas être attribué aux ventes.');
verifier(html.includes('Pistes à contrôler — pas des causes affirmées'), 'Les hypothèses doivent rester explicitement conditionnelles.');
verifier(html.includes("pas encore la température produit / le volume compensé à 15 °C ni la météo rattachée"), 'Les données absentes ne doivent pas être présentées comme historisées.');
verifier(html.includes("...(cle === 'GO' ? ['répartition du GO entre ses deux cuves / collecteur'] : [])"), 'La piste multi-cuves doit être réservée au GO.');
verifier(html.includes('e.stopPropagation();\n        toggleInfoRapprochement'), 'Le bouton Infos ne doit pas ouvrir le relevé de contrôle de la carte.');

console.log('OK — détail de rapprochement compact, prudent et accessible.');
