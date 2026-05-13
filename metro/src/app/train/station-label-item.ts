export interface PlatformItem {
  id: string;
  line: string;
  sentido: string;
  destination: string;
  total: number;
}

export interface StationLabelItem {
  name: string;
  x: number;
  y: number;
  lines: string[];
  platforms: PlatformItem[];
  total: number;
  transit: number;
}
