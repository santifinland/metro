// Canvas coordinate system: 3400×2000 maps the bounding box of the Madrid metro network.
// Longitude/latitude coordinates are linearly projected into this pixel space.
export const CANVAS_WIDTH = 3400;
export const CANVAS_HEIGHT = 2000;

// How often (ms) the train canvas layer is redrawn
export const REDRAW_PERIOD_MS = 2000;

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
