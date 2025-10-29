const gameData = {
  realms: ['Syrtis', 'Ignis', 'Alsius'],
  races: {
    'Syrtis': ['Wood Elf', 'Alturian', 'Half Elf', 'Lamai'],
    'Ignis': ['Dark Elf', 'Esquelio', 'Molok', 'Lamai'],
    'Alsius': ['Dwarf', 'Nordo', 'Utghar', 'Lamai']
  },
  classes: {
    'Wood Elf': ['Archer', 'Mage'],
    'Alturian': ['Archer', 'Mage', 'Warrior'],
    'Half Elf': ['Archer', 'Warrior'],
    'Lamai': ['Archer', 'Mage', 'Warrior'],
    'Dark Elf': ['Mage', 'Warrior'],
    'Esquelio': ['Archer', 'Mage', 'Warrior'],
    'Molok': ['Archer', 'Warrior'],
    'Dwarf': ['Archer', 'Warrior'],
    'Nordo': ['Archer', 'Mage', 'Warrior'],
    'Utghar': ['Mage', 'Warrior']
  },
  startingAttributes: {
    'Wood Elf Archer': { conc: 12, const: 10, dex: 15, int: 13, str: 10 },
    'Wood Elf Mage': { conc: 10, const: 8, dex: 12, int: 16, str: 9 },
    'Alturian Archer': { conc: 11, const: 12, dex: 14, int: 11, str: 12 },
    'Alturian Mage': { conc: 9, const: 10, dex: 10, int: 15, str: 11 },
    'Alturian Warrior': { conc: 8, const: 14, dex: 9, int: 8, str: 16 },
    'Half Elf Archer': { conc: 10, const: 11, dex: 15, int: 10, str: 14 },
    'Half Elf Warrior': { conc: 9, const: 13, dex: 10, int: 9, str: 15 },
    'Lamai Archer': { conc: 11, const: 11, dex: 14, int: 12, str: 12 },
    'Lamai Mage': { conc: 10, const: 9, dex: 11, int: 15, str: 10 },
    'Lamai Warrior': { conc: 8, const: 13, dex: 9, int: 9, str: 16 },
    'Dark Elf Mage': { conc: 9, const: 8, dex: 11, int: 16, str: 11 },
    'Dark Elf Warrior': { conc: 8, const: 12, dex: 10, int: 9, str: 16 },
    'Esquelio Archer': { conc: 11, const: 10, dex: 15, int: 11, str: 13 },
    'Esquelio Mage': { conc: 9, const: 9, dex: 12, int: 15, str: 10 },
    'Esquelio Warrior': { conc: 8, const: 12, dex: 10, int: 8, str: 17 },
    'Molok Archer': { conc: 10, const: 12, dex: 14, int: 10, str: 14 },
    'Molok Warrior': { conc: 9, const: 14, dex: 9, int: 8, str: 15 },
    'Dwarf Archer': { conc: 10, const: 13, dex: 12, int: 9, str: 16 },
    'Dwarf Warrior': { conc: 8, const: 15, dex: 8, int: 7, str: 17 },
    'Nordo Archer': { conc: 11, const: 11, dex: 14, int: 11, str: 13 },
    'Nordo Mage': { conc: 9, const: 10, dex: 11, int: 15, str: 10 },
    'Nordo Warrior': { conc: 8, const: 13, dex: 9, int: 8, str: 17 },
    'Utghar Mage': { conc: 9, const: 9, dex: 10, int: 16, str: 11 },
    'Utghar Warrior': { conc: 8, const: 13, dex: 9, int: 8, str: 17 }
  },
  npcs: [
    // Syrtis NPCs
    { name: 'Irehok', level: 60, realm: 'Syrtis', position: { x: 1156, y: 4592 }, npc_type: 'quest_giver', roaming_type: 'static', has_quests: true },
    { name: 'Basilissa', level: 60, realm: 'Syrtis', position: { x: 1123, y: 4536 }, npc_type: 'merchant', roaming_type: 'wander', roaming_radius: 50, roaming_speed: 1, has_shop: true },
    { name: 'Eldrin', level: 45, realm: 'Syrtis', position: { x: 1200, y: 4600 }, npc_type: 'guard', roaming_type: 'patrol', roaming_radius: 100, roaming_speed: 2, has_guard_duties: true },
    { name: 'Sylvana', level: 35, realm: 'Syrtis', position: { x: 1100, y: 4550 }, npc_type: 'healer', roaming_type: 'static', has_healing: true },
    { name: 'Thalion', level: 50, realm: 'Syrtis', position: { x: 1180, y: 4620 }, npc_type: 'blacksmith', roaming_type: 'static', has_blacksmith: true },
    { name: 'Lirael', level: 40, realm: 'Syrtis', position: { x: 1050, y: 4500 }, npc_type: 'merchant', roaming_type: 'wander', roaming_radius: 30, roaming_speed: 0.5, has_shop: true },
    { name: 'Fendril', level: 55, realm: 'Syrtis', position: { x: 1220, y: 4650 }, npc_type: 'quest_giver', roaming_type: 'static', has_quests: true },
    
    // Ignis NPCs
    { name: 'Varkoth', level: 65, realm: 'Ignis', position: { x: 2500, y: 3200 }, npc_type: 'warlord', roaming_type: 'static', has_quests: true },
    { name: 'Morrigan', level: 50, realm: 'Ignis', position: { x: 2550, y: 3250 }, npc_type: 'merchant', roaming_type: 'wander', roaming_radius: 40, roaming_speed: 1.5, has_shop: true },
    { name: 'Drakkar', level: 60, realm: 'Ignis', position: { x: 2600, y: 3300 }, npc_type: 'guard', roaming_type: 'patrol', roaming_radius: 80, roaming_speed: 2.5, has_guard_duties: true },
    { name: 'Sable', level: 45, realm: 'Ignis', position: { x: 2450, y: 3150 }, npc_type: 'quest_giver', roaming_type: 'static', has_quests: true },
    { name: 'Forge', level: 55, realm: 'Ignis', position: { x: 2650, y: 3350 }, npc_type: 'blacksmith', roaming_type: 'static', has_blacksmith: true },
    { name: 'Nyx', level: 40, realm: 'Ignis', position: { x: 2400, y: 3100 }, npc_type: 'merchant', roaming_type: 'wander', roaming_radius: 25, roaming_speed: 1, has_shop: true },
    
    // Alsius NPCs
    { name: 'Thrain', level: 70, realm: 'Alsius', position: { x: 1800, y: 2800 }, npc_type: 'king', roaming_type: 'static', has_quests: true },
    { name: 'Gundar', level: 55, realm: 'Alsius', position: { x: 1850, y: 2850 }, npc_type: 'guard', roaming_type: 'patrol', roaming_radius: 60, roaming_speed: 1.8, has_guard_duties: true },
    { name: 'Helga', level: 45, realm: 'Alsius', position: { x: 1750, y: 2750 }, npc_type: 'healer', roaming_type: 'static', has_healing: true },
    { name: 'Bjorn', level: 60, realm: 'Alsius', position: { x: 1900, y: 2900 }, npc_type: 'blacksmith', roaming_type: 'static', has_blacksmith: true },
    { name: 'Astrid', level: 50, realm: 'Alsius', position: { x: 1700, y: 2700 }, npc_type: 'merchant', roaming_type: 'wander', roaming_radius: 35, roaming_speed: 0.8, has_shop: true },
    { name: 'Erik', level: 65, realm: 'Alsius', position: { x: 1950, y: 2950 }, npc_type: 'quest_giver', roaming_type: 'static', has_quests: true },
    { name: 'Sigrid', level: 40, realm: 'Alsius', position: { x: 1650, y: 2650 }, npc_type: 'merchant', roaming_type: 'wander', roaming_radius: 45, roaming_speed: 1.2, has_shop: true },
    { name: 'Torvald', level: 58, realm: 'Alsius', position: { x: 2000, y: 3000 }, npc_type: 'guard', roaming_type: 'patrol', roaming_radius: 90, roaming_speed: 2.2, has_guard_duties: true }
  ]
};

module.exports = gameData;