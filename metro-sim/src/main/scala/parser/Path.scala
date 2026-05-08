// Metro. SDMT

package parser

import org.geolatte.geom.{G2D, LineString}

import utils.Position


case class Path(features: LineFeatures, geometry: LineString[G2D]) {

  lazy val pos: Position = new Position(geometry.getEndPosition.getLat, geometry.getEndPosition.getLon)
  def x: Double = this.pos.x
  def y: Double = this.pos.y
}

object Path {

  def sortLinePaths(line: Seq[Path]): Seq[Path] = {
    val lineHead: Seq[Path] = line.filter(l => l.features.tipoparada == "C")
    val lineLast: Seq[Path] = line.filter(l => l.features.tipoparada == "T")
    val linesMid: Seq[Path] = line.filter(l => l.features.tipoparada != "C" && l.features.tipoparada != "T")
    def sortDirectionLines(lines: Seq[Path], direction: String): Seq[Path] = {
      lines
        .filter(l => l.features.sentido == direction)
        .sortBy(_.features.numeroorden)
    }
    val stationsDirectionHead = lineHead match {
      case Nil => Seq[Path]()
      case _ => sortDirectionLines(linesMid, lineHead.head.features.sentido)
    }
    val stationsDirectionLast = lineLast match {
      case Nil => Seq[Path]()
      case _ => sortDirectionLines(linesMid, lineLast.head.features.sentido)
    }
    stationsDirectionHead ++ lineHead ++ stationsDirectionLast ++ lineLast
  }

}

case class LineFeatures(
    numerolineausuario: String,
    sentido: String,
    codigoestacion: String,
    codigoanden: Int,
    numeroorden: Int,
    tipoparada: String,
    denominacion: String,
    longitudtramoanterior: Double,
    velocidadtramoanterior: Float,
    modointercambiador: Option[Int],
    codigointercambiador: Option[String],
)

case class LineGeometry(coordinates: Seq[Seq[Double]])
