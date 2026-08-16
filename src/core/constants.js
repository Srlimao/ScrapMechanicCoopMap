// World Bounds, Cell Constants & Default POIs for Scrap Mechanic

export const CELL_SIZE = 64; // Meters per cell
export const MAP_MIN_X = -4096; // 128 cells total (-64 to +64)
export const MAP_MAX_X = 4096;
export const MAP_MIN_Y = -3072; // 96 cells total (-48 to +48)
export const MAP_MAX_Y = 3072;

export const DEFAULT_SURVIVAL_POIS = [
    {
        slug: 'crashed-ship',
        name: 'Crashed Ship',
        category: 'landmark',
        precision: 'exact',
        x: -2372, y: -2623, z: 8,
        icon: 'fa-ship',
        color: '#38bdf8',
        desc: 'Better keep the ship coordinates handy. This ship may be the only way off the planet.'
    },
    {
        slug: 'drillbot-mountain',
        name: 'The Gyro-Core',
        category: 'story',
        precision: 'exact',
        x: -2510, y: -2640, z: 30,
        icon: 'fa-mountain',
        color: '#a855f7',
        desc: 'Cross the bridge and search the island for a way Underground.'
    },
    {
        slug: 'mechanic-station',
        name: 'Mechanic Station',
        category: 'service',
        precision: 'area-center',
        x: -1856, y: -1664,
        icon: 'fa-wrench',
        color: '#ff7a00',
        desc: 'A home away from home for any Mechanic. Equipped for crafting and vehicle maintenance.'
    },
    {
        slug: 'farmers-hideout',
        name: 'Hideout (Trader)',
        category: 'trade',
        precision: 'area-center',
        x: -1024, y: -1024,
        icon: 'fa-handshake',
        color: '#10b981',
        desc: 'The Farmers trade goods for weapons, garment boxes, and components.'
    },
    {
        slug: 'vegetable-packing-station',
        name: 'Vegetable Packing Station',
        category: 'trade',
        precision: 'area-center',
        x: -1088, y: -1472,
        icon: 'fa-boxes-packing',
        color: '#06b6d4',
        desc: 'Bring vegetables to pack into crates for delivery to the Trader Hideout.'
    },
    {
        slug: 'fruit-packing-station',
        name: 'Fruit Packing Station',
        category: 'trade',
        precision: 'area-center',
        x: 640, y: 640,
        icon: 'fa-boxes-packing',
        color: '#06b6d4',
        desc: 'Bring fruit to pack into crates for delivery to the Trader Hideout.'
    },
    {
        slug: 'scrap-garage',
        name: 'Scrap Garage',
        category: 'service',
        precision: 'area-center',
        x: 0, y: 960,
        icon: 'fa-screwdriver-wrench',
        color: '#eab308',
        desc: 'A place where creations can be built from blueprints.'
    },
    {
        slug: 'growlab-1',
        name: 'Growlab 1 (Meadow)',
        category: 'growlab',
        precision: 'area-center',
        x: -2432, y: -1088,
        icon: 'fa-flask-vial',
        color: '#22c55e',
        desc: 'Hostile Growlab facility in Meadow. Contains carrot seeds.'
    },
    {
        slug: 'growlab-2',
        name: 'Growlab 2 (Desert)',
        category: 'growlab',
        precision: 'area-center',
        x: 320, y: -1472,
        icon: 'fa-flask-vial',
        color: '#eab308',
        desc: 'Hostile Growlab facility in Desert. Contains redbeet seeds.'
    },
    {
        slug: 'growlab-3',
        name: 'Growlab 3 (Burnt Forest)',
        category: 'growlab',
        precision: 'area-center',
        x: -2624, y: 1152,
        icon: 'fa-flask-vial',
        color: '#f97316',
        desc: 'Hostile Growlab facility in Burnt Forest. Contains banana seeds.'
    },
    {
        slug: 'growlab-4',
        name: 'Growlab 4 (Autumn Forest)',
        category: 'growlab',
        precision: 'area-center',
        x: 2368, y: 1216,
        icon: 'fa-flask-vial',
        color: '#ef4444',
        desc: 'Hostile Growlab facility in Autumn Forest. Contains blueberry seeds.'
    },
    {
        slug: 'growlab-5',
        name: 'Growlab 5 (Autumn Forest)',
        category: 'growlab',
        precision: 'area-center',
        x: 1984, y: -2368,
        icon: 'fa-flask-vial',
        color: '#ef4444',
        desc: 'Hostile Growlab facility in Autumn Forest. Contains orange seeds.'
    },
    {
        slug: 'growlab-6',
        name: 'Growlab 6 (Mountain / Lake)',
        category: 'growlab',
        precision: 'area-center',
        x: -704, y: 2240,
        icon: 'fa-flask-vial',
        color: '#3b82f6',
        desc: 'Hostile Growlab facility near Lake. Contains pineapple seeds.'
    },
    {
        slug: 'growlab-7',
        name: 'Growlab 7 (Field)',
        category: 'growlab',
        precision: 'area-center',
        x: 1472, y: -448,
        icon: 'fa-flask-vial',
        color: '#14b8a6',
        desc: 'Hostile Growlab facility in Field. Contains broccoli seeds.'
    }
];
