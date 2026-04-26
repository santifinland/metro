// Canvas coordinate system: 3400×2000 maps the bounding box of the Madrid metro network.
// Longitude/latitude coordinates are linearly projected into this pixel space.
export const CANVAS_WIDTH = 3400;
export const CANVAS_HEIGHT = 2000;

// How often (ms) the train canvas layer is redrawn
export const REDRAW_PERIOD_MS = 2000;

// Number of wagons per metro line (Madrid Metro)
export const TRAIN_WAGONS: Record<string, number> = {
  '1': 6, '2': 6, '3': 6, '4': 4, '5': 6,
  '6-1': 6, '6-2': 6, '7a': 6, '7b': 6, '8': 6,
  '9A': 6, '9B': 6, '10a': 6, '10b': 6, '11': 4,
  '12-1': 6, '12-2': 6, 'R': 3,
};
export const DEFAULT_WAGONS = 6;

// Wagon dimensions in canvas coordinate space (scale with zoom)
export const WAGON_W    = 3.5;
export const WAGON_H    = 3.0;
export const WAGON_GAP  = 0.5;

// Colors per metro line (key = line identifier used in simulation messages)
export const LINE_COLORS: Record<string, string> = {
  '1': '#0097C9',
  '2': '#FF0E00',
  '3': '#FFBF00',
  '4': '#930C15',
  '5': '#4BC400',
  '6-1': '#9D9793',
  '6-2': '#9D9793',
  '7a': '#FF9B0D',
  '7b': '#FF9B0D',
  '8': '#FF5D9D',
  '9A': '#B51580',
  '9B': '#B51580',
  '10a': '#001A8E',
  '10b': '#001A8E',
  '11': '#006D21',
  '12-1': '#939301',
  '12-2': '#939301',
  'R': 'white',
};
