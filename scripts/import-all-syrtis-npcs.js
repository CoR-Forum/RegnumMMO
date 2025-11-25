const fs = require('fs');
const path = require('path');

// Read the TSV file
const tsvPath = path.join(__dirname, '../rodata/syrtis_fandom_npcs.txt');
const tsvContent = fs.readFileSync(tsvPath, 'utf-8');

// Parse TSV properly
const lines = tsvContent.trim().split('\n');
const npcs = [];

// Skip header line (index 0), process data lines
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const values = line.split('\t');
  
  const npc = {
    name: values[0],
    area: values[1],
    level: 40,
    realm: 'Syrtis',
    position: {
      x: parseInt(values[3]) || 0,
      y: parseInt(values[4]) || 0
    },
    title: values[2],
    race: (values[5] && values[5] !== 'None') ? values[5] : null,
    'class': (values[6] && values[6] !== 'None') ? values[6] : null
  };
  
  // Add quest count if > 0
  const questCount = parseInt(values[7]) || 0;
  if (questCount > 0) {
    npc.quest_count = questCount;
  }
  
  // Detect shop NPCs based on profession
  const shopProfessions = ['Merchant', 'Weaponsmith', 'Blacksmith', 'Alchemist', 'Tailor', 'Woodworker', 'Enchanter', 'Farrier'];
  if (shopProfessions.includes(values[2])) {
    npc.has_shop = true;
  }
  
  npcs.push(npc);
}

console.log(`Parsed ${npcs.length} Syrtis NPCs from file`);

// Read current gameData.js and get non-Syrtis NPCs
const gameDataPath = path.join(__dirname, '../data/gameData.js');
const gameData = require(gameDataPath);
const otherNpcs = gameData.npcs.filter(npc => npc.realm !== 'Syrtis');

console.log(`Found ${otherNpcs.length} non-Syrtis NPCs (${otherNpcs.filter(n => n.realm === 'Ignis').length} Ignis, ${otherNpcs.filter(n => n.realm === 'Alsius').length} Alsius)`);

// Combine NPCs
const allNpcs = [...npcs, ...otherNpcs];

// Generate NPC array string
const npcStrings = allNpcs.map(npc => {
  const props = [];
  props.push(`name: '${npc.name.replace(/'/g, "\\'")}'`);
  if (npc.area) props.push(`area: '${npc.area.replace(/'/g, "\\'")}'`);
  props.push(`level: ${npc.level}`);
  props.push(`realm: '${npc.realm}'`);
  props.push(`position: { x: ${npc.position.x}, y: ${npc.position.y} }`);
  props.push(`title: '${npc.title.replace(/'/g, "\\'")}'`);
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

console.log('\n✓ Successfully updated gameData.js');
console.log(`  - Syrtis NPCs: ${npcs.length}`);
console.log(`  - Ignis NPCs: ${ignisNpcs.length}`);
console.log(`  - Alsius NPCs: ${alsiusNpcs.length}`);
console.log(`  - Total: ${allNpcs.length} NPCs`);
