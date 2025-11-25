/**
 * Map Markers Data
 * Static markers for points of interest on the game map
 */

const markers = [
  // Debug/test markers (blue default icon)
  {
    name: 'Test Point 1',
    description: '2998.2917480469, 2963.8518066406',
    position: { x: 2998.2917480469, y: 2963.8518066406 },
    type: 'debug',
    icon_color: 'blue'
  },
  {
    name: 'Test Point 2',
    description: '3746.0209960938, 2191.4299316406',
    position: { x: 3746.0209960938, y: 2191.4299316406 },
    type: 'debug',
    icon_color: 'blue'
  },
  {
    name: 'Test Point 3',
    description: '4908.4072265625, 1669.7856445313',
    position: { x: 4908.4072265625, y: 1669.7856445313 },
    type: 'debug',
    icon_color: 'blue'
  },
  {
    name: 'Test Point 4',
    description: '2632.6618652344, 3177.3698730469',
    position: { x: 2632.6618652344, y: 3177.3698730469 },
    type: 'debug',
    icon_color: 'blue'
  },
  {
    name: 'Test Point 5',
    description: '2451.1330566406, 3987.1953125',
    position: { x: 2451.1330566406, y: 3987.1953125 },
    type: 'debug',
    icon_color: 'blue'
  },
  {
    name: 'Corner Point 1',
    description: '6144, 6144',
    position: { x: 6144, y: 6144 },
    type: 'debug',
    icon_color: 'blue'
  },
  {
    name: 'Corner Point 2',
    description: '8862, 8879',
    position: { x: 8862, y: 8879 },
    type: 'debug',
    icon_color: 'blue'
  },
  {
    name: 'Origin Point',
    description: '0, 0',
    position: { x: 0, y: 0 },
    type: 'debug',
    icon_color: 'blue'
  },

  // Points of Interest (red icon)
  {
    name: 'Unknown',
    description: 'Unknown (dungeon_cave)',
    position: { x: 2406.7099, y: 5454.85 },
    type: 'dungeon_cave',
    icon_color: 'red'
  },
  {
    name: 'Trelleborg Fort',
    description: 'Trelleborg Fort (fort)',
    position: { x: 1596.988, y: 2518.0109 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Syrtis Great Wall',
    description: 'Syrtis Great Wall (fort)',
    position: { x: 2345.4399, y: 4063.4899 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Unknown',
    description: 'Unknown (zeppelin)',
    position: { x: 2537.416, y: 3463.257 },
    type: 'zeppelin',
    icon_color: 'red'
  },
  {
    name: 'Herbred Fort',
    description: 'Herbred Fort (fort)',
    position: { x: 2872.4121, y: 3265.644 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Imperia Castle',
    description: 'Imperia Castle (fort)',
    position: { x: 2625.32, y: 1129.3299 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Unknown',
    description: 'Unknown (zeppelin)',
    position: { x: 526.782, y: 5393.2402 },
    type: 'zeppelin',
    icon_color: 'red'
  },
  {
    name: 'Unknown',
    description: 'Unknown (zeppelin)',
    position: { x: 1047.7709, y: 5462.9482 },
    type: 'zeppelin',
    icon_color: 'red'
  },
  {
    name: 'Menirah Fort',
    description: 'Menirah Fort (fort)',
    position: { x: 3332.6547, y: 1772.056 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Aggersborg Fort',
    description: 'Aggersborg Fort (fort)',
    position: { x: 2668.666, y: 2487.7219 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Shaanarid Castle',
    description: 'Shaanarid Castle (fort)',
    position: { x: 4652.1899, y: 3054.52 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Samal Fort',
    description: 'Samal Fort (fort)',
    position: { x: 3639.7409, y: 2509.854 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Unknown',
    description: 'Unknown (zeppelin)',
    position: { x: 1261.153, y: 4598.1489 },
    type: 'zeppelin',
    icon_color: 'red'
  },
  {
    name: 'Eferias Castle',
    description: 'Eferias Castle (fort)',
    position: { x: 3665.6298, y: 4873.1801 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Ignis Great Wall',
    description: 'Ignis Great Wall (fort)',
    position: { x: 4170.4111, y: 1977.4531 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Alsius Great Wall',
    description: 'Alsius Great Wall (fort)',
    position: { x: 1730.38, y: 2103.4899 },
    type: 'fort',
    icon_color: 'red'
  },
  {
    name: 'Algaros Fort',
    description: 'Algaros Fort (fort)',
    position: { x: 1725.5009, y: 3259.6547 },
    type: 'fort',
    icon_color: 'red'
  }
];

module.exports = markers;
