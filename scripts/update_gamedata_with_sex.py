#!/usr/bin/env python3
"""
Script to update gameData.js with sex information from npc_fandom_data.json
"""

import json
import re
from pathlib import Path

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
NPC_DATA_FILE = PROJECT_ROOT / "data" / "npc_fandom_data.json"
GAME_DATA_FILE = PROJECT_ROOT / "data" / "gameData.js"

def load_fandom_data():
    """Load NPC fandom data."""
    with open(NPC_DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def read_game_data():
    """Read the gameData.js file."""
    with open(GAME_DATA_FILE, 'r', encoding='utf-8') as f:
        return f.read()

def write_game_data(content):
    """Write the updated gameData.js file."""
    with open(GAME_DATA_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

def update_npc_entries(game_data_content, fandom_data):
    """Update NPC entries to include sex field."""
    
    # Pattern to find NPC entries and capture name
    # Match: { name: 'X', ... position: {...}, ...other fields... }
    lines = game_data_content.split('\n')
    updated_lines = []
    
    for line in lines:
        # Check if this is an NPC line (contains name: and position:)
        if "name: '" in line and 'position:' in line:
            # Extract NPC name
            name_match = re.search(r"name:\s*'([^']+)'", line)
            if name_match:
                npc_name = name_match.group(1)
                
                # Check if sex already exists
                if ', sex:' not in line:
                    # Get sex from fandom data
                    if npc_name in fandom_data and fandom_data[npc_name].get('sex'):
                        sex_value = fandom_data[npc_name]['sex']
                        
                        # Find position to insert sex (after position: {...})
                        # Match the position object
                        position_match = re.search(r'(position:\s*\{[^}]+\})', line)
                        if position_match:
                            position_end = position_match.end()
                            # Insert sex field right after position
                            line = line[:position_end] + f", sex: '{sex_value}'" + line[position_end:]
        
        updated_lines.append(line)
    
    return '\n'.join(updated_lines)

def main():
    print("=" * 60)
    print("Updating gameData.js with Sex information")
    print("=" * 60)
    
    # Load fandom data
    print("\nLoading NPC fandom data...")
    fandom_data = load_fandom_data()
    print(f"Loaded {len(fandom_data)} NPC records")
    
    # Count NPCs with sex data
    npcs_with_sex = sum(1 for npc in fandom_data.values() if npc.get('sex'))
    print(f"NPCs with sex data: {npcs_with_sex}")
    
    # Read game data
    print("\nReading gameData.js...")
    game_data_content = read_game_data()
    
    # Update NPC entries
    print("\nUpdating NPC entries...")
    updated_content = update_npc_entries(game_data_content, fandom_data)
    
    # Write back
    print("Writing updated gameData.js...")
    write_game_data(updated_content)
    
    print("\n" + "=" * 60)
    print("✓ Update complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
