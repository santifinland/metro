export interface MoveTrain {
  message: 'moveTrain';
  train: string;
  x: number;
  y: number;
  people?: number;
  capacity?: number;
  anden?: number;
  travelMs?: number;
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
  people?: number;
  capacity?: number;
  anden?: number;
  travelMs?: number;
}

export interface RemoveTrain {
  message: 'removeTrain';
  train: string;
}

export interface TimeMultiplier {
  message: 'timeMultiplier';
  multiplier: number;
}

export interface PeopleInPlatform {
  message: 'peopleInPlatform';
  anden: number;
  people: number;
}

export interface PeopleInStation {
  message: 'peopleInStation';
  stationId: string;
  people: number;
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

export interface SimTime {
  message: 'simTime';
  ms: number;
}

export interface ResetAck {
  message: 'reset';
}

export interface SimLoad {
  message: 'simLoad';
  load: number;
  eventsPerTick: number;
  queueSize: number;
}

export interface SimPaused {
  message: 'simPaused';
  paused: boolean;
}

export type SimulationMessage =
  | MoveTrain
  | PeopleInLinePlatforms
  | PeopleInLineStations
  | PeopleInPlatform
  | PeopleInStation
  | PeopleInTrains
  | PeopleInMetro
  | PeopleInSimulation
  | NewTrain
  | RemoveTrain
  | TimeMultiplier
  | PlatformOvercrowded
  | StationOvercrowded
  | SimTime
  | ResetAck
  | SimLoad
  | SimPaused;
