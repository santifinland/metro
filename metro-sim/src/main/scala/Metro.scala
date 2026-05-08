// Metro. SDMT

import scalax.collection.Graph
import scalax.collection.edge.WDiEdge

import parser.Path


trait MetroNode {
  val name: String
  val label: String
  val lines: Seq[String]
  var partialPerson: Double = 0

  override def toString: String = this.name
  def setPartialPerson(p: Double): Unit = this.partialPerson = p
}

class StationNode(val name: String, val label: String, val lines: Seq[String]) extends MetroNode
class PlatformNode(val name: String, val label: String, val lines: Seq[String]) extends MetroNode

class Metro(sortedLinePaths: Map[String, Seq[Path]], weightStationStation: Double, weightStationPlatform: Double) {

  def buildMetroGraph(): Graph[MetroNode, WDiEdge] = {
    val stationsLines: Iterable[MetroNode] = this.sortedLinePaths
      .flatMap { case (line: String, paths: Seq[Path]) => paths.map { x =>
        new StationNode(Metro.stationId(x.features.codigoestacion), x.features.denominacion, Seq("L" + line))
      } }
    val stations: Iterable[MetroNode] = stationsLines
      .groupBy(x => x.name)
      .map { case (_: String, stationNodes: Iterable[MetroNode]) =>
        stationNodes.reduce((a, b) => new StationNode(a.name, a.label, a.lines ++ b.lines))
      }
    val platforms: Iterable[MetroNode] = this.sortedLinePaths
      .flatMap { case (line: String, paths: Seq[Path]) => paths.map { x =>
        new PlatformNode(Metro.platformId(x.features.codigoanden), x.features.denominacion, Seq("L" + line))
      } }
    val stationsByName: Map[String, MetroNode] = stations.map(s => s.name -> s).toMap
    val platformsByName: Map[String, MetroNode] = platforms.map(p => p.name -> p).toMap
    val nodes: Iterable[MetroNode] = stations ++ platforms
    val lineEdges: Iterable[WDiEdge[MetroNode]] = sortedLinePaths
      .values
      .flatMap(x => buildLineEdges(x, stationsByName, platformsByName))
    val interLineEdges: Iterable[WDiEdge[MetroNode]] = buildInterLineEdges(sortedLinePaths, stationsByName, platformsByName)
    Graph.from(nodes, lineEdges ++ interLineEdges)
  }

  def buildLineEdges(linePaths: Seq[Path], stationsByName: Map[String, MetroNode], platformsByName: Map[String, MetroNode])
  : Seq[WDiEdge[MetroNode]] = {
    (for {
      i              <- linePaths.indices
      currentStation  = stationsByName(Metro.stationId(linePaths(i).features.codigoestacion))
      weight: Double  = linePaths(i).features.longitudtramoanterior
      currentPlatform = platformsByName(Metro.platformId(linePaths(i).features.codigoanden))
      nextPath        = if (i + 1 < linePaths.length) linePaths(i + 1) else linePaths.head
      nextStation     = stationsByName(Metro.stationId(nextPath.features.codigoestacion))
      nextPlatform    = platformsByName(Metro.platformId(nextPath.features.codigoanden))
      s1              = WDiEdge(currentStation, currentPlatform)(weightStationPlatform)
      s1bis           = WDiEdge(currentPlatform, currentStation)(weightStationPlatform)
      p               = WDiEdge(currentPlatform, nextPlatform)(weight)
      s2              = WDiEdge(nextPlatform, nextStation)(weightStationPlatform)
      s2bis           = WDiEdge(nextStation, nextPlatform)(weightStationPlatform)
    } yield List(s1, s1bis, p, s2, s2bis)).flatten
  }

  def buildInterLineEdges(lines: Map[String, Seq[Path]], stationsByName: Map[String, MetroNode], platformsByName: Map[String, MetroNode])
  : Iterable[WDiEdge[MetroNode]] = {
    val stationWithTransfers: Iterable[Iterable[Path]] = lines
      .values
      .flatten
      .filter(x => x.features.codigointercambiador.isDefined)
      .groupBy(x => x.features.codigointercambiador.get)
      .values
      .filter(xs => xs.map(_.features.codigoestacion).toSeq.distinct.size > 1)
    val transferPairs: Iterable[List[(MetroNode, MetroNode)]] = stationWithTransfers
      .map { xs => xs.map { y => stationsByName(Metro.stationId(y.features.codigoestacion)) } }
      .map { xs => computePairs(xs.toList) }
    transferPairs
      .flatten
      .map { case (a, b) => WDiEdge(a, b)(weightStationStation) }
  }

  def computePairs[T](data: List[T]): List[(T, T)] =
    data
      .combinations(2)
      .flatMap { case List(a, b) => List((a, b), (b, a)) }
      .filter { case (a, b) => a != b }
      .toList
}

object Metro {

  val StationPrefix  = "Station_"
  val PlatformPrefix = "Platform_"

  def stationId(code: String): String = StationPrefix + code
  def platformId(code: Int): String   = PlatformPrefix + code
}
