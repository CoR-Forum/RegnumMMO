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
    { name: 'Irehok', level: 60, realm: 'Syrtis', position: { x: 1156, y: 4592 } },
    { name: 'Basilissa', level: 60, realm: 'Syrtis', position: { x: 1123, y: 4536 } }
  ]
};

module.exports = gameData;