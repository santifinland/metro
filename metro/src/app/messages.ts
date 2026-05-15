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

export interface PersonEntry { id: string; destination: string; }

export interface PersonsInTrain {
  message: 'personsInTrain';
  train: string;
  persons: PersonEntry[];
}

export interface PersonsInPlatform {
  message: 'personsInPlatform';
  anderId: string;
  persons: PersonEntry[];
}

export interface PersonPath {
  message: 'personPath';
  person: string;
  nodes: string[];
}

export interface PersonLocation {
  message: 'personLocation';
  person: string;
  locType: 'platform' | 'station' | 'train';
  locId: string;
}

export interface PersonArrived {
  message: 'personArrived';
  person: string;
}

// ── Path-query debug types ────────────────────────────────────────────────────

/** A single node returned in a pathResult response. */
export interface PathNode {
  /** "station" or "platform" */
  kind: 'station' | 'platform';
  /** Internal graph ID, e.g. "Station_EMPALME_101" */
  id: string;
  /** Human-readable label, e.g. "EMPALME" or "CASA DE CAMPO (andén 420)" */
  label: string;
  /** Line(s) the node belongs to, e.g. "L5" or "L10a" */
  line: string;
}

/**
 * Response to a {"message":"queryPath","from":"…","to":"…"} request.
 * Sent by the backend whenever a path query is answered.
 */
export interface PathResult {
  message: 'pathResult';
  from: string;
  to: string;
  found: boolean;
  /** Human-readable error when found=false. */
  error?: string;
  /** Ordered sequence of graph nodes from origin to destination. */
  nodes: PathNode[];
}

// ── Outgoing messages (client → server) ──────────────────────────────────────

export interface MsgPause             { message: 'pause'; }
export interface MsgResume            { message: 'resume'; }
export interface MsgReset             { message: 'reset'; }
export interface MsgSetSpeed          { message: 'setSpeed'; factor: number; }
export interface MsgTrackPerson       { message: 'trackPerson'; personId: string; }
export interface MsgUntrackPerson     { message: 'untrackPerson'; }
export interface MsgRequestPlatformPersons { message: 'requestPlatformPersons'; platformId: string; }
export interface MsgRequestTrainPersons   { message: 'requestTrainPersons';    trainId: string; }
export interface MsgQueryPath         { message: 'queryPath'; from: string; to: string; }

export type OutgoingMessage =
  | MsgPause
  | MsgResume
  | MsgReset
  | MsgSetSpeed
  | MsgTrackPerson
  | MsgUntrackPerson
  | MsgRequestPlatformPersons
  | MsgRequestTrainPersons
  | MsgQueryPath;

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
  | SimPaused
  | PersonsInTrain
  | PersonsInPlatform
  | PersonPath
  | PersonLocation
  | PersonArrived
  | PathResult;
