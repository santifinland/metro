// Metro. SDMT

import scalax.collection.Graph
import scalax.collection.edge.WDiEdge

import parser.Path
import Metro.{PlatformPrefix, StationPrefix}

trait MetroNode {
  val name: String
  val line: String
}

class StationNode(val name: String, val line: String) extends MetroNode
class PlatformNode(val name: String, val line: String) extends MetroNode

class Metro(sortedLinePaths: Map[String, Seq[Path]]) {

  def buildMetroGraph(): Graph[MetroNode, WDiEdge] = {
    val stations: Iterable[MetroNode] = this.sortedLinePaths
      .flatMap { case (line: String, paths: Seq[Path]) => paths.map { x =>
        new StationNode(stationName(x.features.denominacion, x.features.codigoestacion), line)
      } }
    val platforms: Iterable[MetroNode] = this.sortedLinePaths
      .flatMap { case (line: String, paths: Seq[Path]) => paths.map { x =>
        new PlatformNode(platformName(x.features.denominacion, x.features.codigoanden), line)
      } }
    val nodes: Iterable[MetroNode] = stations ++ platforms
    val lineEdges: Iterable[WDiEdge[MetroNode]] = sortedLinePaths
      .values
      .flatMap(x => buildLineEdges(x, stations, platforms))
    val interLineEdges: Iterable[WDiEdge[MetroNode]] = buildInterLineEdges(sortedLinePaths, stations, platforms)
    Graph.from(nodes, lineEdges ++ interLineEdges)
  }

  def platformName(stationName: String, platformCode: Int): String = {
    PlatformPrefix + stationName.replaceAll(" ", "_") + "_" + platformCode
  }

  def stationName(stationName: String, stationCode: String): String = {
    StationPrefix + stationName.replaceAll(" ", "_") + "_" + stationCode
  }

  def buildLineEdges(linePaths: Seq[Path], stations: Iterable[MetroNode], platforms: Iterable[MetroNode])
  : Seq[WDiEdge[MetroNode]] = {
    (for {
      i <- linePaths.indices
      currentStationName: String = stationName(linePaths(i).features.denominacion, linePaths(i).features.codigoestacion)
      currentStation: MetroNode = stations.filter(x => x.name == currentStationName).head
      weight: Double = linePaths(i).features.longitudtramoanterior
      currentPlatformName: String = platformName(linePaths(i).features.denominacion, linePaths(i).features.codigoanden)
      currentPlatform: MetroNode = platforms.filter(x => x.name == currentPlatformName).head
      nextPath: Path = if (i + 1 < linePaths.length) linePaths(i + 1) else linePaths.head
      nextStationName: String = stationName(nextPath.features.denominacion, nextPath.features.codigoestacion)
      nextStation: MetroNode = stations.filter(x => x.name == nextStationName).head
      nextPlatformName: String = platformName(nextPath.features.denominacion, nextPath.features.codigoanden)
      nextPlatform: MetroNode = platforms.filter(x => x.name == nextPlatformName).head
      s1: WDiEdge[MetroNode] = WDiEdge(currentStation, currentPlatform)(1)
      s1bis: WDiEdge[MetroNode] = WDiEdge(currentPlatform, currentStation)(1)
      p: WDiEdge[MetroNode] = WDiEdge(currentPlatform, nextPlatform)(weight)
      s2: WDiEdge[MetroNode] = WDiEdge(nextPlatform, nextStation)(1)
      s2bis: WDiEdge[MetroNode] = WDiEdge(nextStation, nextPlatform)(1)
    } yield List(s1, s1bis, p, s2, s2bis)).flatten
  }

  def buildInterLineEdges(lines: Map[String, Seq[Path]], stations: Iterable[MetroNode], platforms: Iterable[MetroNode])
  : Iterable[WDiEdge[MetroNode]] = {
    val stationWithTransfers: Iterable[Iterable[Path]] = lines
      .values
      .flatten
      .groupBy(x => x.features.denominacion)
      .values
      .filter(x => x.size > 2)
    val transferPairs: Iterable[List[(MetroNode, MetroNode)]] = stationWithTransfers
      .map { case (x: Iterable[Path]) =>
        x.map { case (y: Path) =>
          val stationWithTransferName: String = stationName(y.features.denominacion, y.features.codigoestacion)
          stations.filter { case (z: StationNode) => z.name == stationWithTransferName }.head
        } }
      .map { case (x: Iterable[MetroNode]) => computePairs(x.toList) }
    transferPairs
      .flatten
      .map { case (a: MetroNode, b: MetroNode) => WDiEdge(a, b)(5) }
  }

  def computePairs[T](data: List[T]): List[(T, T)] =
    data
      .combinations(2)
      .flatMap { case List(a, b) => List((a, b), (b, a)) }
      .filter { case (a, b) => a != b }
      .toList
}

object Metro {

  val StationPrefix = "Station_"
  val PlatformPrefix = "Platform_"

}
