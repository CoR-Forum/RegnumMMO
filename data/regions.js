/**
 * Shared region and border definitions for the Regnum map.
 * Coordinates are in game space (0..6144). Update the point arrays to refine shapes.
 */
const regionData = {
  worldBorder: {
    name: 'Mainland Perimeter',
    points: [
      [0, 0],
      [6144, 0],
      [6144, 6144],
      [0, 6144]
    ],
    style: {
      color: '#f9b233',
      weight: 2,
      dashArray: '12 8',
      fill: false
    }
  },
  islandBorders: [
    {
      name: 'Syrtis Inner Realm',
      type: 'island',
      points: [
        [0, 3600],
        [1800, 3600],
        [2300, 4700],
        [1600, 5600],
        [700, 6144],
        [0, 6144]
      ],
      style: {
        color: '#2ecc71',
        weight: 2,
        fillColor: '#2ecc71',
        fillOpacity: 0.05
      }
    },
    {
      name: 'Ignis Mainland',
      type: 'island',
      points: [
        [3600, 0],
        [6144, 0],
        [6144, 2000],
        [5400, 2700],
        [4200, 2300],
        [3600, 1400]
      ],
      style: {
        color: '#e74c3c',
        weight: 2,
        fillColor: '#e74c3c',
        fillOpacity: 0.05
      }
    },
    {
      name: 'Alsius Mainland',
      type: 'island',
      points: [
        [0, 0],
        [2700, 0],
        [3100, 1200],
        [2400, 2100],
        [1300, 2300],
        [0, 1700]
      ],
      style: {
        color: '#3498db',
        weight: 2,
        fillColor: '#3498db',
        fillOpacity: 0.05
      }
    },
    {
      name: 'War Zone Heartland',
      type: 'neutral',
      points: [
        [2100, 1900],
        [4200, 1900],
        [4700, 3200],
        [3600, 4400],
        [2200, 4300]
      ],
      style: {
        color: '#f1c40f',
        weight: 2,
        fillColor: '#f1c40f',
        fillOpacity: 0.04,
        dashArray: '6 4'
      }
    }
  ],
  areas: [
    {
      name: 'Ilreah Village',
      realm: 'Syrtis',
      type: 'city',
      points: [
        [80, 5200],
        [520, 5200],
        [620, 5520],
        [520, 5850],
        [120, 5850]
      ],
      style: {
        color: '#27ae60',
        weight: 2,
        fillColor: '#2ecc71',
        fillOpacity: 0.12
      }
    },
    {
      name: 'Ignis Citadel',
      realm: 'Ignis',
      type: 'city',
      points: [
        [4700, 420],
        [5250, 420],
        [5450, 900],
        [5050, 1150],
        [4700, 950]
      ],
      style: {
        color: '#c0392b',
        weight: 2,
        fillColor: '#e74c3c',
        fillOpacity: 0.12
      }
    },
    {
      name: 'Alsius Stronghold',
      realm: 'Alsius',
      type: 'city',
      points: [
        [1330, 150],
        [1750, 150],
        [1870, 520],
        [1570, 760],
        [1320, 540]
      ],
      style: {
        color: '#2471a3',
        weight: 2,
        fillColor: '#3498db',
        fillOpacity: 0.12
      }
    },
    {
      name: 'War Camp',
      realm: 'Neutral',
      type: 'outpost',
      points: [
        [2900, 2700],
        [3450, 2700],
        [3600, 3050],
        [3200, 3400],
        [2850, 3150]
      ],
      style: {
        color: '#f39c12',
        weight: 2,
        fillColor: '#f1c40f',
        fillOpacity: 0.12
      }
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = regionData;
} else {
  window.REGION_DATA = regionData;
}
