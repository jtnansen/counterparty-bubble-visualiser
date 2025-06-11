// Color constants
export const COLORS = {
  GREEN_FILL: '#061019',
  RED_FILL: '#061019', 
  GREEN_STROKE: '#34CF82',
  RED_STROKE: '#FF7F7B',
  NAVY_FILL: '#2a3f50',
  MAIN_NODE_STROKE: '#061019',
  BACKGROUND: '#061019',
  UI_BACKGROUND: '#2a3f50',
  ACCENT: '#34CF82',
  WHITE: '#FFFFFF',
  BLUE_HIGHLIGHT: '#008EFF'
};

// Size constants
export const SIZES = {
  MAIN_NODE_RADIUS: 30,
  DEFAULT_COUNTERPARTY_RADIUS: 24,
  LINK_WIDTH: {
    MAIN_TO_MAIN: 1,
    AGGREGATED: 0.4,
    TRANSACTION: 0.01
  },
  STROKE_WIDTH: {
    MAIN_NODE: 2,
    HIGHLIGHTED: 3.4,
    COUNTERPARTY_BASE: 0.1
  }
};

// Physics simulation constants
export const PHYSICS = {
  FORCES: {
    LINK_STRENGTH: 0.8,
    CHARGE_MAIN: -600,
    CHARGE_COUNTERPARTY: -150,
    COLLISION_STRENGTH: 0.7,
    MAIN_NODE_REPULSION_MULTIPLIER: 6,
    MAIN_NODE_REPULSION_STRENGTH: 0.5,
    PENDULUM_MAINTENANCE_TOLERANCE: 20,
    PENDULUM_MAINTENANCE_ALPHA: 0.4,
    ARROW_REPULSION_MIN_DISTANCE: 90,
    ARROW_REPULSION_STRENGTH: 0.4
  },
  LINK_DISTANCE: {
    MAIN_TO_COUNTERPARTY: 180,
    MAIN_TO_MAIN: 120
  },
  VELOCITY_DECAY: 0.7,
  COLLISION_PADDING_MAIN: 4,
  COLLISION_PADDING_COUNTERPARTY: 1,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 10
};

// UI constants
export const UI = {
  CONTROLS_WIDTH: 300,
  CONTROLS_PADDING: 10,
  TOOLTIP_OFFSET: 10,
  CONTEXT_MENU_Z_INDEX: 1000,
  DRAG_THRESHOLD: 5,
  FONT_SIZE_MAX: 7.2,
  FONT_SIZE_RATIO: 0.27,
  TEXT_TRUNCATION_RATIO: 2.2,
  ZOOM_SCALE_EXTENT: [0.1, 10]
};

// Node positioning constants
export const POSITIONING = {
  PENDULUM_DISTANCE_VARIANCE: 100,
  PENDULUM_BASE_DISTANCE: 150,
  PENDULUM_ANGLE_SPREAD: 0.6, // ±54 degrees
  PENDULUM_TOLERANCE: 20,
  CURVE_DISTANCE_BASE: 25,
  CURVE_DISTANCE_MULTIPLIER: 40,
  SPREAD_RANGE: 1.0
};

// Filter constants
export const FILTERS = {
  MIN_TOTAL_VOLUME: 1,
  DEFAULT_RANGE_MIN: '1',
  DEFAULT_RANGE_MAX: '',
  SMART_CONTRACT_EMOJI: '🤖',
  EXCHANGE_EMOJI: '🏦'
};

// Animation constants
export const ANIMATION = {
  CONTEXT_MENU_HIDE_DELAY: 100,
  SIMULATION_RESTART_ALPHA: 0.3,
  SIMULATION_TARGET_ALPHA: 0.1,
  LOCK_SYMBOL_SIZE: '12px'
};

// Default timeframes
export const TIMEFRAMES = [
  { value: '30D', label: '30 Days' },
  { value: '90D', label: '90 Days' },  
  { value: '1Y', label: '1 Year' },
  { value: '5Y', label: '5 Years' }
];

// Size metrics options
export const SIZE_METRICS = [
  { value: 'totalVolume', label: 'Total Volume' },
  { value: 'usdNetflow', label: 'USD Netflow' },
  { value: 'volIn', label: 'Volume In' },
  { value: 'volOut', label: 'Volume Out' },
  { value: 'uniform', label: 'Uniform' }
];

// Label modes
export const LABEL_MODES = [
  { value: 'label', label: 'Nansen Labels' },
  { value: 'address', label: 'Addresses' }
];

// Scale factor ranges for auto-scaling
export const SCALE_FACTOR_RANGES = [
  { threshold: 30000000, factor: 0.1 },
  { threshold: 20000000, factor: 0.2 },
  { threshold: 10000000, factor: 0.3 },
  { threshold: 5000000, factor: 0.4 },
  { threshold: 1000000, factor: 0.5 },
  { threshold: 0, factor: 1.0 }
];

// Context menu highlight colors
export const HIGHLIGHT_COLORS = [
  'red', '#00FF00', 'yellow', '#8A2BE2', 'orange', 'white', '#87CEEB'
]; 