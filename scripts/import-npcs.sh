#!/bin/bash

# Import NPCs from TSV files into gameData.js

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

SYRTIS_FILE="$PROJECT_DIR/rodata/syrtis_fandom_npcs.txt"
IGNIS_FILE="$PROJECT_DIR/rodata/ignis_fandom_npcs.txt"
ALSIUS_FILE="$PROJECT_DIR/rodata/alsius_fandom_npcs.txt"
GAMEDATA_FILE="$PROJECT_DIR/data/gameData.js"

# Function to parse TSV and generate NPC entries
parse_npcs() {
    local file=$1
    local realm=$2
    local output=""
    
    # Skip header line, read data lines
    tail -n +2 "$file" | while IFS=$'\t' read -r name area profession x z race class quests; do
        # Skip empty lines or header-like lines
        [[ -z "$name" ]] && continue
        [[ "$name" == "Name" ]] && continue
        
        # Skip entries with missing coordinates
        [[ -z "$x" || -z "$z" ]] && continue
        [[ ! "$x" =~ ^[0-9]+$ ]] && continue
        [[ ! "$z" =~ ^[0-9]+$ ]] && continue
        
        # Escape single quotes in strings (replace ' with \')
        name="${name//\'/\\\'}"
        area="${area//\'/\\\'}"
        profession="${profession//\'/\\\'}"
        
        # Remove any remaining backslashes that might cause issues
        name="${name//\\\\/\\}"
        area="${area//\\\\/\\}"
        profession="${profession//\\\\/\\}"
        
        # Handle None values
        [[ "$race" == "None" ]] && race=""
        [[ "$class" == "None" ]] && class=""
        
        # Build NPC object
        npc="    { name: '$name', area: '$area', level: 40, realm: '$realm', position: { x: $x, y: $z }, title: '$profession'"
        
        # Add race if not empty
        [[ -n "$race" ]] && npc="$npc, race: '$race'"
        
        # Add class (always include, null if empty)
        if [[ -n "$class" ]]; then
            npc="$npc, 'class': '$class'"
        else
            npc="$npc, 'class': null"
        fi
        
        # Add quest_count if > 0
        [[ "$quests" -gt 0 ]] && npc="$npc, quest_count: $quests"
        
        # Add has_shop for shop professions
        case "$profession" in
            Merchant|Weaponsmith|Blacksmith|Alchemist|Tailor|Woodworker|Enchanter|Farrier)
                npc="$npc, has_shop: true"
                ;;
        esac
        
        npc="$npc }"
        echo "$npc"
    done
}

echo "Parsing NPC files..."

# Parse all three realms
echo "  - Reading Syrtis NPCs..."
SYRTIS_NPCS=$(parse_npcs "$SYRTIS_FILE" "Syrtis")
if [[ -n "$SYRTIS_NPCS" ]]; then
    SYRTIS_COUNT=$(echo "$SYRTIS_NPCS" | wc -l | tr -d ' ')
else
    SYRTIS_COUNT=0
fi

echo "  - Reading Ignis NPCs..."
IGNIS_NPCS=$(parse_npcs "$IGNIS_FILE" "Ignis")
if [[ -n "$IGNIS_NPCS" ]]; then
    IGNIS_COUNT=$(echo "$IGNIS_NPCS" | wc -l | tr -d ' ')
else
    IGNIS_COUNT=0
fi

echo "  - Reading Alsius NPCs..."
ALSIUS_NPCS=$(parse_npcs "$ALSIUS_FILE" "Alsius")
if [[ -n "$ALSIUS_NPCS" ]]; then
    ALSIUS_COUNT=$(echo "$ALSIUS_NPCS" | wc -l | tr -d ' ')
else
    ALSIUS_COUNT=0
fi

TOTAL_COUNT=$((SYRTIS_COUNT + IGNIS_COUNT + ALSIUS_COUNT))

echo ""
echo "Found NPCs:"
echo "  - Syrtis: $SYRTIS_COUNT"
echo "  - Ignis: $IGNIS_COUNT"
echo "  - Alsius: $ALSIUS_COUNT"
echo "  - Total: $TOTAL_COUNT"
echo ""

# Join NPCs with commas
SYRTIS_JOINED=$(echo "$SYRTIS_NPCS" | sed '$!s/$/,/')
IGNIS_JOINED=$(echo "$IGNIS_NPCS" | sed '$!s/$/,/')
ALSIUS_JOINED=$(echo "$ALSIUS_NPCS" | sed '$!s/$/,/')

# Create the new NPCs array
NEW_NPCS="  npcs: [
    // Syrtis NPCs ($SYRTIS_COUNT total)
$SYRTIS_JOINED,
    
    // Ignis NPCs ($IGNIS_COUNT total)
$IGNIS_JOINED,
    
    // Alsius NPCs ($ALSIUS_COUNT total)
$ALSIUS_JOINED
  ]"

# Read the gameData.js file
GAMEDATA_CONTENT=$(<"$GAMEDATA_FILE")

# Find the start and end of the npcs array
START_MARKER="  npcs: ["
END_MARKER="  ]"

# Extract content before npcs array
BEFORE_NPCS="${GAMEDATA_CONTENT%%$START_MARKER*}"

# Combine everything
NEW_CONTENT="${BEFORE_NPCS}${NEW_NPCS}
};

module.exports = gameData;"

# Write to file
echo "$NEW_CONTENT" > "$GAMEDATA_FILE"

echo "✓ Successfully updated $GAMEDATA_FILE"
echo "  Total NPCs imported: $TOTAL_COUNT"
