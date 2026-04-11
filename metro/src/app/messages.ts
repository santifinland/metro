export interface MoveTrain {
  message: 'moveTrain';
  train: string;
  x: number;
  y: number;
}

export interface PeopleInLinePlatforms {
  message: 'peopleInLinePlatforms';
  line: string;
  people: number;
}

export interface PeopleInLineStations {
  message: 'peopleInLineStations';
  line: string;
  people: number;
}

export interface PeopleInTrains {
  message: 'peopleInTrains';
  people: number;
}

export interface PeopleInMetro {
  message: 'peopleInMetro';
  people: number;
}

export interface PeopleInSimulation {
  message: 'peopleInSimulation';
  people: number;
}

export interface NewTrain {
  message: 'newTrain';
  train: string;
  x: number;
  y: number;
}

export interface TimeMultiplier {
  message: 'timeMultiplier';
  multiplier: number;
}

export interface PlatformOvercrowded {
  message: 'platformOvercrowded';
  platform: string;
  people: number;
}

export interface StationOvercrowded {
  message: 'stationOvercrowded';
  platform: string;
  people: number;
}

export type SimulationMessage =
  | MoveTrain
  | PeopleInLinePlatforms
  | PeopleInLineStations
  | PeopleInTrains
  | PeopleInMetro
  | PeopleInSimulation
  | NewTrain
  | TimeMultiplier
  | PlatformOvercrowded
  | StationOvercrowded;
