// Metro. SDMT

package parser

import akka.actor.ActorRef
import org.geolatte.geom.{G2D, LineString}

import messages.Messages.Next
import utils.Position


case class Path(features: LineFeatures, geometry: LineString[G2D]) {

  lazy val pos: Position = new Position(geometry.getEndPosition.getLat, geometry.getEndPosition.getLon)
  def x: Double = this.pos.x
  def y: Double = this.pos.y
}

object Path {

  def sortLines(lines: Seq[Path]): Seq[Path] = {
    val lineHead: Seq[Path] = lines.filter(l => l.features.tipoparada == "C")
    val lineLast: Seq[Path] = lines.filter(l => l.features.tipoparada == "T")
    val linesMid: Seq[Path] = lines.filter(l => l.features.tipoparada != "C" && l.features.tipoparada != "T")
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

  def sendNextStation(lineActors: Seq[ActorRef]): Unit= {
    val currentNextLineActors = for {
      i <- lineActors.indices
      next: Int = if (i + 1 < lineActors.length) i + 1 else 0
      currentActor: ActorRef = lineActors(i)
      nextActor: ActorRef = lineActors(next)
    } yield (currentActor, nextActor)
    currentNextLineActors.foreach { case (current, next) => current ! Next(next) }
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
