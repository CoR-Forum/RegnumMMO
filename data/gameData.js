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
  items: [
    // Weapons - not stackable
    { name: 'Wooden Sword', description: 'A simple wooden training sword', type: 'weapon', rarity: 'common', value: 10, level_requirement: 1, stackable: false },
    { name: 'Iron Sword', description: 'A sturdy iron blade', type: 'weapon', rarity: 'common', value: 50, level_requirement: 5, stackable: false },
    { name: 'Steel Longsword', description: 'A finely crafted steel sword', type: 'weapon', rarity: 'uncommon', value: 150, level_requirement: 15, stackable: false },
    { name: 'Elven Bow', description: 'A graceful bow made from ancient wood', type: 'weapon', rarity: 'rare', value: 300, level_requirement: 20, stackable: false },
    { name: 'Dwarven Axe', description: 'A heavy axe forged in dwarven fires', type: 'weapon', rarity: 'rare', value: 350, level_requirement: 25, stackable: false },
    
    // Armor - not stackable
    { name: 'Leather Armor', description: 'Basic leather protection', type: 'armor', rarity: 'common', value: 25, level_requirement: 1, stackable: false },
    { name: 'Chain Mail', description: 'Interlocking metal rings', type: 'armor', rarity: 'common', value: 75, level_requirement: 10, stackable: false },
    { name: 'Plate Armor', description: 'Heavy metal plates for maximum protection', type: 'armor', rarity: 'uncommon', value: 200, level_requirement: 20, stackable: false },
    
    // Consumables - stackable
    { name: 'Health Potion', description: 'Restores 50 health points', type: 'consumable', rarity: 'common', value: 15, level_requirement: 1, stackable: true },
    { name: 'Mana Potion', description: 'Restores 50 mana points', type: 'consumable', rarity: 'common', value: 15, level_requirement: 1, stackable: true },
    { name: 'Greater Health Potion', description: 'Restores 150 health points', type: 'consumable', rarity: 'uncommon', value: 45, level_requirement: 10, stackable: true },
    { name: 'Bread', description: 'A loaf of fresh bread', type: 'consumable', rarity: 'common', value: 5, level_requirement: 1, stackable: true },
    { name: 'Cheese', description: 'A wheel of aged cheese', type: 'consumable', rarity: 'common', value: 8, level_requirement: 1, stackable: true }
  ],
  shopItems: [
    // Syrtis merchants
    { npcName: 'Myron', itemName: 'Wooden Sword', quantity: 10, price: 12 },
    { npcName: 'Myron', itemName: 'Leather Armor', quantity: 5, price: 30 },
    { npcName: 'Myron', itemName: 'Health Potion', quantity: 20, price: 18 },
    { npcName: 'Myron', itemName: 'Bread', quantity: 50, price: 6 },
    { npcName: 'Myron', itemName: 'Iron Sword', quantity: 3, price: 60 },
    { npcName: 'Myron', itemName: 'Chain Mail', quantity: 2, price: 90 },
    { npcName: 'Myron', itemName: 'Mana Potion', quantity: 15, price: 18 },
    { npcName: 'Myron', itemName: 'Cheese', quantity: 30, price: 10 },
    
    // Ignis merchants
    { npcName: 'Morrigan', itemName: 'Steel Longsword', quantity: 2, price: 180 },
    { npcName: 'Morrigan', itemName: 'Plate Armor', quantity: 1, price: 250 },
    { npcName: 'Morrigan', itemName: 'Greater Health Potion', quantity: 10, price: 50 },
    { npcName: 'Morrigan', itemName: 'Elven Bow', quantity: 1, price: 350 },
    { npcName: 'Nyx', itemName: 'Iron Sword', quantity: 5, price: 55 },
    { npcName: 'Nyx', itemName: 'Chain Mail', quantity: 3, price: 85 },
    { npcName: 'Nyx', itemName: 'Health Potion', quantity: 25, price: 17 },
    
    // Alsius merchants
    { npcName: 'Astrid', itemName: 'Dwarven Axe', quantity: 1, price: 400 },
    { npcName: 'Astrid', itemName: 'Plate Armor', quantity: 2, price: 230 },
    { npcName: 'Astrid', itemName: 'Greater Health Potion', quantity: 8, price: 48 },
    { npcName: 'Sigrid', itemName: 'Steel Longsword', quantity: 3, price: 170 },
    { npcName: 'Sigrid', itemName: 'Chain Mail', quantity: 4, price: 80 },
    { npcName: 'Sigrid', itemName: 'Mana Potion', quantity: 20, price: 16 },
    { npcName: 'Sigrid', itemName: 'Bread', quantity: 40, price: 5 }
  ],
  npcs: [
    // Syrtis NPCs
    { name: 'Acael', level: 50, realm: 'Syrtis', position: { x: 424, y: 5460 }, title: 'Guard', race: 'Alturian', class: 'Archer', roaming_type: 'patrol', roaming_radius: 50, roaming_speed: 2, has_guard_duties: true, has_quests: false },
    { name: 'Addyax', level: 50, realm: 'Syrtis', position: { x: 442, y: 5459 }, title: 'Guard', race: 'Half Elf', class: 'Archer', roaming_type: 'patrol', roaming_radius: 50, roaming_speed: 2, has_guard_duties: true, has_quests: false },
    { name: 'Ahlob', level: 50, realm: 'Syrtis', position: { x: 463, y: 5428 }, title: 'Guard', race: 'Alturian', class: 'Warrior', roaming_type: 'patrol', roaming_radius: 50, roaming_speed: 2, has_guard_duties: true, has_quests: false },
    { name: 'Annada Silverfinder', level: 50, realm: 'Syrtis', position: { x: 484, y: 5437 }, title: 'Woodworker', race: 'Wood Elf', class: 'Archer', roaming_type: 'static', has_quests: false },
    { name: 'Arnar', level: 50, realm: 'Syrtis', position: { x: 463, y: 5450 }, title: 'Alchemist', race: 'Alturian', class: 'Mage', roaming_type: 'static', has_quests: false },
    { name: 'Bahuat Silverfinder', level: 50, realm: 'Syrtis', position: { x: 455, y: 5413 }, title: 'Tailor', race: 'Wood Elf', class: 'None', roaming_type: 'static', has_quests: false },
    { name: 'Bisat', level: 50, realm: 'Syrtis', position: { x: 474, y: 5419 }, title: 'Guard', race: 'Wood Elf', class: 'Mage', roaming_type: 'patrol', roaming_radius: 50, roaming_speed: 2, has_guard_duties: true, has_quests: false },
    { name: 'Dardanh', level: 50, realm: 'Syrtis', position: { x: 445, y: 5438 }, title: 'Weaponsmith', race: 'Alturian', class: 'Warrior', roaming_type: 'static', has_blacksmith: true, has_quests: false },
    { name: 'Gaeta', level: 50, realm: 'Syrtis', position: { x: 440, y: 5447 }, title: 'Warrior Trainer', race: 'Alturian', class: 'Knight', roaming_type: 'static', has_quests: false },
    { name: 'Halma Ex', level: 50, realm: 'Syrtis', position: { x: 478, y: 5448 }, title: 'Guard', race: 'Half Elf', class: 'Warrior', roaming_type: 'patrol', roaming_radius: 50, roaming_speed: 2, has_guard_duties: true, has_quests: false },
    { name: 'Ilens', level: 50, realm: 'Syrtis', position: { x: 458, y: 5447 }, title: 'Town Crier', race: 'Alturian', class: 'Mage', roaming_type: 'static', has_quests: false },
    { name: 'Lotiel', level: 50, realm: 'Syrtis', position: { x: 453, y: 5452 }, title: 'Mage Trainer', race: 'Wood Elf', class: 'Mage', roaming_type: 'static', has_quests: false },
    { name: 'Magdala', level: 50, realm: 'Syrtis', position: { x: 452, y: 5459 }, title: 'Tailor', race: 'Alturian', class: 'Mage', roaming_type: 'static', has_quests: false },
    { name: 'Maru Rem', level: 50, realm: 'Syrtis', position: { x: 432, y: 5419 }, title: 'Denizen', race: 'Alturian', class: 'None', roaming_type: 'static', has_quests: false },
    { name: 'Meras', level: 50, realm: 'Syrtis', position: { x: 488, y: 5418 }, title: 'Denizen', race: 'Wood Elf', class: 'None', roaming_type: 'static', has_quests: false },
    { name: 'Myron', level: 50, realm: 'Syrtis', position: { x: 443, y: 5422 }, title: 'Merchant', race: 'Alturian', class: 'Mage', roaming_type: 'wander', roaming_radius: 30, roaming_speed: 1, has_shop: true, has_quests: false },
    { name: 'Ollaun', level: 50, realm: 'Syrtis', position: { x: 437, y: 5442 }, title: 'Denizen', race: 'Alturian', class: 'None', roaming_type: 'static', has_quests: false },
    { name: 'Rahelia', level: 50, realm: 'Syrtis', position: { x: 470, y: 5411 }, title: 'Enchanter', race: 'Alturian', class: 'Mage', roaming_type: 'static', has_quests: false },
    { name: 'Ruby', level: 50, realm: 'Syrtis', position: { x: 472, y: 5428 }, title: 'Archer Trainer', race: 'Alturian', class: 'Warrior', roaming_type: 'static', has_quests: false },
    { name: 'Tudruel', level: 50, realm: 'Syrtis', position: { x: 469, y: 5432 }, title: 'Denizen', race: 'Wood Elf', class: 'None', roaming_type: 'static', has_quests: false },
    { name: 'Verild', level: 50, realm: 'Syrtis', position: { x: 497, y: 5465 }, title: 'Farrier', race: 'Alturian', class: 'None', roaming_type: 'static', has_quests: false },
    { name: 'Xidi', level: 50, realm: 'Syrtis', position: { x: 469, y: 5455 }, title: 'Guard', race: 'Wood Elf', class: 'Mage', roaming_type: 'patrol', roaming_radius: 50, roaming_speed: 2, has_guard_duties: true, has_quests: false },
    
    // Ignis NPCs
    { name: 'Varkoth', level: 65, realm: 'Ignis', position: { x: 2500, y: 3200 }, title: 'Warlord', roaming_type: 'static', has_quests: true },
    { name: 'Morrigan', level: 50, realm: 'Ignis', position: { x: 2550, y: 3250 }, title: 'Weaponsmith', roaming_type: 'wander', roaming_radius: 40, roaming_speed: 1.5, has_shop: true },
    { name: 'Drakkar', level: 60, realm: 'Ignis', position: { x: 2600, y: 3300 }, title: 'Elite Guard', roaming_type: 'patrol', roaming_radius: 80, roaming_speed: 2.5, has_guard_duties: true },
    { name: 'Sable', level: 45, realm: 'Ignis', position: { x: 2450, y: 3150 }, title: 'Mystic', roaming_type: 'static', has_quests: true },
    { name: 'Forge', level: 55, realm: 'Ignis', position: { x: 2650, y: 3350 }, title: 'Master Blacksmith', roaming_type: 'static', has_blacksmith: true },
    { name: 'Nyx', level: 40, realm: 'Ignis', position: { x: 2400, y: 3100 }, title: 'Apothecary', roaming_type: 'wander', roaming_radius: 25, roaming_speed: 1, has_shop: true },
    
    // Alsius NPCs
    { name: 'Thrain', level: 70, realm: 'Alsius', position: { x: 1800, y: 2800 }, title: 'High King', roaming_type: 'static', has_quests: true },
    { name: 'Gundar', level: 55, realm: 'Alsius', position: { x: 1850, y: 2850 }, title: 'Royal Guard', roaming_type: 'patrol', roaming_radius: 60, roaming_speed: 1.8, has_guard_duties: true },
    { name: 'Helga', level: 45, realm: 'Alsius', position: { x: 1750, y: 2750 }, title: 'Priestess', roaming_type: 'static', has_healing: true },
    { name: 'Bjorn', level: 60, realm: 'Alsius', position: { x: 1900, y: 2900 }, title: 'Forge Master', roaming_type: 'static', has_blacksmith: true },
    { name: 'Astrid', level: 50, realm: 'Alsius', position: { x: 1700, y: 2700 }, title: 'Armorer', roaming_type: 'wander', roaming_radius: 35, roaming_speed: 0.8, has_shop: true },
    { name: 'Erik', level: 65, realm: 'Alsius', position: { x: 1950, y: 2950 }, title: 'Elder', roaming_type: 'static', has_quests: true },
    { name: 'Sigrid', level: 40, realm: 'Alsius', position: { x: 1650, y: 2650 }, title: 'Provisioner', roaming_type: 'wander', roaming_radius: 45, roaming_speed: 1.2, has_shop: true },
    { name: 'Torvald', level: 58, realm: 'Alsius', position: { x: 2000, y: 3000 }, title: 'Sentinel', roaming_type: 'patrol', roaming_radius: 90, roaming_speed: 2.2, has_guard_duties: true }
  ]
};

module.exports = gameData;