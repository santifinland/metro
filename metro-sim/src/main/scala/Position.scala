// Metro. SDMT

class Position(lat: Double, lon: Double) {

  val RADIUS = 6371
  val phi1 = 40.4202961;
  val phi0 = 40.4202961;
  val lambda0: Double = -3.718762;
  val width = 3400
  val height = 2000

  val x: Double = -1 * this.RADIUS * (lon - this.lambda0) * Math.cos(this.phi1) + (width / 2)
  val y: Double = -1 * this.RADIUS * (lat - this.phi0) + (height / 2)
}

