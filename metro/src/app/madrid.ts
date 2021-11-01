import { Position } from './position'
import { Slot } from './slot'
import { Station } from './station'

export class Madrid {
  width: number;
  height: number;
  stations: Station[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.stations = [this.ppio(), this.opera(), this.sol(), this.atocha(), this.ccasal()]
    console.log(this.stations)
  }

  // Principe Pio
  ppio(): Station {
    const position = new Position(this.width, this.height, 40.42118636456124, -3.7192746085169675);
    const slots: Slot[] = []
    return new Station('Ppio', position, slots, this.opera())
  }

  // Opera
  opera(): Station {
    const position = new Position(this.width, this.height, 40.41809969956107, -3.7093573032619553)
    const slots: Slot[] = []
    return new Station('Opera', position, slots)
  }

  // Sol
  sol(): Station {
    const position = new Position(this.width, this.height, 40.416947964333424, -3.7034194154821765)
    const slots: Slot[] = []
    return new Station('Sol', position, slots)
  }

  // Atocha
  atocha(): Station {
    const position = new Position(this.width, this.height, 40.40649353898929, -3.689455973342957)
    const slots: Slot[] = []
    return new Station('Atocha', position, slots)
  }

  // Conde de Casal
  ccasal(): Station {
    const position = new Position(this.width, this.height, 40.40709162428091, -3.670025473949972)
    const slots: Slot[] = []
    return new Station('Conde de Casal', position, slots)
  }

}
