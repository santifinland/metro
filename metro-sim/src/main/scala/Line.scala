// Metro. SDMT

import org.geolatte.geom.{G2D, LineString}


case class Line(features: LineFeatures, geometry: LineString[G2D]) {

  lazy val pos: Position = new Position(geometry.getEndPosition.getLat, geometry.getEndPosition.getLon)
  def x: Double = this.pos.x
  def y: Double = this.pos.y
}

case class LineFeatures(
    numerolineausuario: String,
    sentido: String,
    codigoestacion: String,
    codigoanden: Int,
    numeroorden: Int,
    tipoparada: String,
    denominacion: String,
    codigomunicipio: String,
    municipio: String,
    coronatarifaria: String,
    longitudtramoanterior: Double,
    velocidadtramoanterior: Float,
    modolinea: Int,
    modointercambiador: Int,
    codigointercambiador: String,
    idftramo: String,
    idflinea: String,
    idfitinerario: String,
    idfestacion: String,
    idfposte: String,
    idfanden: String
)

case class LineGeometry(geometryType: String, coordinates: Seq[Seq[Double]])
