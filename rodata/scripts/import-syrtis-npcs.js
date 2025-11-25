const fs = require('fs');
const path = require('path');

// Syrtis NPCs data from syrtis_fandom_npcs.txt
const syrtisNpcsData = `Coral	Initiation Valley	Guard	269	5429	Alturian	Warrior	2
Rothel	Initiation Valley	Guard	273	5455	Alturian	Knight	0
Rulec	Initiation Valley	Guide	253	5419	Alturian	None	0
Sibyl	Initiation Valley	Denizen	579	5452	Half Elf	None	1
Utelor	Initiation Valley	Denizen	251	5418	Wood Elf	None	1
Acael	Ilreah Village	Guard	424	5460	Alturian	Archer	0
Addyax	Ilreah Village	Guard	442	5459	Half Elf	Archer	1
Ahlob	Ilreah Village	Guard	463	5428	Alturian	Warrior	1
Annada Silverfinder	Ilreah Village	Woodworker	484	5437	Wood Elf	Archer	2
Arnar	Ilreah Village	Alchemist	463	5450	Alturian	Mage	2
Bahuat Silverfinder	Ilreah Village	Tailor	455	5413	Wood Elf	None	0
Bisat	Ilreah Village	Guard	474	5419	Wood Elf	Mage	2
Dardanh	Ilreah Village	Weaponsmith	445	5438	Alturian	Warrior	1
Gaeta	Ilreah Village	Warrior Trainer	440	5447	Alturian	Knight	2
Halma Ex	Ilreah Village	Guard	478	5448	Half Elf	Warrior	5
Ilens	Ilreah Village	Town Crier	458	5447	Alturian	Mage	2
Lotiel	Ilreah Village	Mage Trainer	453	5452	Wood Elf	Mage	1
Magdala	Ilreah Village	Tailor	452	5459	Alturian	Mage	0
Maru Rem	Ilreah Village	Denizen	432	5419	Alturian	None	0
Meras	Ilreah Village	Denizen	488	5418	Wood Elf	None	0
Myron	Ilreah Village	Merchant	443	5422	Alturian	Mage	1
Ollaun	Ilreah Village	Denizen	437	5442	Alturian	None	3
Rahelia	Ilreah Village	Enchanter	470	5411	Alturian	Mage	3
Ruby	Ilreah Village	Archer Trainer	472	5428	Alturian	Warrior	1
Tudruel	Ilreah Village	Denizen	469	5432	Wood Elf	None	1
Verild	Ilreah Village	Farrier	497	5465	Alturian	None	0
Xidi	Ilreah Village	Guard	469	5455	Wood Elf	Mage	2
Agus	Big Falls	Elite Guard	463	5590	Wood Elf	Archer	1
Draul	Big Falls	Denizen	458	5648	Alturian	None	0
Elured	Drah-na Mount	Denizen	737	5938	Alturian	Mage	3
Adult Eaglet	Drah-na Mount	Guard	610	6026	Alturian	Warrior	0
Pigeon Eaglet	Drah-na Mount	Guard	764	5973	Alturian	Warrior	0
Young Eaglet	Drah-na Mount	Guard	609	6022	Alturian	Warrior	0`;

// Parse the data
const lines = syrtisNpcsData.trim().split('\n');
const npcs = [];

lines.forEach(line => {
  const values = line.split('\t');
  
  const npc = {
    name: values[0],
    area: values[1],
    level: 40,
    realm: 'Syrtis',
    position: { x: parseInt(values[3]), y: parseInt(values[4]) },
    title: values[2],
    race: values[5] !== 'None' ? values[5] : null,
    'class': values[6] !== 'None' ? values[6] : null
  };
  
  const questCount = parseInt(values[7]);
  if (questCount > 0) {
    npc.quest_count = questCount;
  }
  
  const shopProfessions = ['Merchant', 'Weaponsmith', 'Blacksmith', 'Alchemist', 'Tailor', 'Woodworker', 'Enchanter', 'Farrier'];
  if (shopProfessions.includes(values[2])) {
    npc.has_shop = true;
  }
  
  npcs.push(npc);
});

// Read current gameData.js and get non-Syrtis NPCs
const gameDataPath = path.join(__dirname, '../data/gameData.js');
const gameData = require(gameDataPath);
const otherNpcs = gameData.npcs.filter(npc => npc.realm !== 'Syrtis');

// Combine NPCs
const allNpcs = [...npcs, ...otherNpcs];

// Generate NPC array string
const npcStrings = allNpcs.map(npc => {
  const props = [];
  props.push(`name: '${npc.name}'`);
  if (npc.area) props.push(`area: '${npc.area}'`);
  props.push(`level: ${npc.level}`);
  props.push(`realm: '${npc.realm}'`);
  props.push(`position: { x: ${npc.position.x}, y: ${npc.position.y} }`);
  props.push(`title: '${npc.title}'`);
  if (npc.race) props.push(`race: '${npc.race}'`);
  props.push(`'class': ${npc.class ? `'${npc.class}'` : 'null'}`);
  if (npc.roaming_type) props.push(`roaming_type: '${npc.roaming_type}'`);
  if (npc.roaming_radius !== undefined) props.push(`roaming_radius: ${npc.roaming_radius}`);
  if (npc.roaming_speed !== undefined) props.push(`roaming_speed: ${npc.roaming_speed}`);
  if (npc.has_quests) props.push(`has_quests: true`);
  if (npc.quest_count !== undefined) props.push(`quest_count: ${npc.quest_count}`);
  if (npc.has_shop) props.push(`has_shop: true`);
  if (npc.has_guard_duties) props.push(`has_guard_duties: true`);
  if (npc.has_blacksmith) props.push(`has_blacksmith: true`);
  if (npc.has_healing) props.push(`has_healing: true`);
  
  return `    { ${props.join(', ')} }`;
});

// Read file and replace NPCs section
const gameDataContent = fs.readFileSync(gameDataPath, 'utf-8');
const npcArrayStart = gameDataContent.indexOf('  npcs: [');
const npcArrayEnd = gameDataContent.lastIndexOf('  ]\n};');

const beforeNpcs = gameDataContent.substring(0, npcArrayStart);
const afterNpcs = gameDataContent.substring(npcArrayEnd);

const ignisNpcs = otherNpcs.filter(n => n.realm === 'Ignis');
const alsiusNpcs = otherNpcs.filter(n => n.realm === 'Alsius');

const newNpcArray = `  npcs: [
    // Syrtis NPCs (${npcs.length} total)
${npcStrings.slice(0, npcs.length).join(',\n')},
    
    // Ignis NPCs
${npcStrings.slice(npcs.length, npcs.length + ignisNpcs.length).join(',\n')},
    
    // Alsius NPCs
${npcStrings.slice(npcs.length + ignisNpcs.length).join(',\n')}
${afterNpcs}`;

fs.writeFileSync(gameDataPath, beforeNpcs + newNpcArray, 'utf-8');

console.log('✓ Successfully updated gameData.js');
console.log(`  - Syrtis NPCs: ${npcs.length}`);
console.log(`  - Ignis NPCs: ${ignisNpcs.length}`);
console.log(`  - Alsius NPCs: ${alsiusNpcs.length}`);
console.log(`  - Total: ${allNpcs.length} NPCs`);
