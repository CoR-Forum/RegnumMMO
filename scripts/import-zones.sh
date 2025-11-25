#!/bin/bash

# Import zones from zone_data_dump.txt to markers.js

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ZONE_FILE="$PROJECT_DIR/rodata/zone_data_dump.txt"
MARKERS_FILE="$PROJECT_DIR/data/markers.js"

echo "Importing zones from zone_data_dump.txt to markers.js..."

# Start building the markers array
MARKERS="const markers = ["

# Parse zone data
while IFS='|' read -r zone_id zone_name position_data; do
    # Clean up whitespace
    zone_id=$(echo "$zone_id" | sed 's/Zone ID: //g' | xargs)
    zone_name=$(echo "$zone_name" | sed 's/Name: //g' | xargs)
    position_data=$(echo "$position_data" | xargs)
    
    # Skip header or empty lines
    [[ "$zone_id" =~ ^[0-9]+$ ]] || continue
    [[ -z "$zone_name" ]] && continue
    
    # Check if position data exists
    if [[ "$position_data" == "No position data" ]]; then
        echo "  Skipping zone $zone_id ($zone_name) - no position data"
        continue
    fi
    
    # Extract x and z coordinates from "Random Pos: x=1073, z=1410"
    if [[ "$position_data" =~ Random\ Pos:\ x=([0-9]+),\ z=([0-9]+) ]]; then
        x="${BASH_REMATCH[1]}"
        z="${BASH_REMATCH[2]}"
        
        # Escape single quotes in zone name
        zone_name="${zone_name//\'/\\\'}"
        
        # Add marker entry
        MARKERS="$MARKERS
  {
    name: '$zone_name',
    description: 'Zone $zone_id',
    position: { x: $x, y: $z },
    type: 'zone',
    icon_color: 'orange'
  },"
    fi
done < "$ZONE_FILE"

# Remove trailing comma and close array
MARKERS="${MARKERS%,}
];"

# Count markers
MARKER_COUNT=$(echo "$MARKERS" | grep -c "name:")

echo "Parsed $MARKER_COUNT zone markers"

# Create the complete markers.js file
cat > "$MARKERS_FILE" << 'EOF'
/**
 * Map Markers Data
 * Static markers for points of interest on the game map
 */

EOF

echo "$MARKERS" >> "$MARKERS_FILE"

cat >> "$MARKERS_FILE" << 'EOF'

module.exports = markers;
EOF

echo ""
echo "✓ Successfully updated $MARKERS_FILE"
echo "  Total zone markers: $MARKER_COUNT"
