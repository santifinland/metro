// Metro. SDMT

import scalax.collection.Graph
import scalax.collection.edge.WDiEdge

import java.text.Normalizer
import parser.Path


trait MetroNode {
  val name: String
  val lines: Seq[String]

  override def toString: String = this.name
}

class StationNode(val name: String, val lines: Seq[String]) extends MetroNode
class PlatformNode(val name: String, val lines:Seq[ String]) extends MetroNode

class Metro(sortedLinePaths: Map[String, Seq[Path]], weightStationStation: Double, weightStationPlatform: Double) {

  def buildMetroGraph(): Graph[MetroNode, WDiEdge] = {
    val stationsLines: Iterable[MetroNode] = this.sortedLinePaths
      .flatMap { case (line: String, paths: Seq[Path]) => paths.map { x =>
        new StationNode(Metro.stationName(x.features.denominacion, x.features.codigoestacion), Seq("L" + line))
      } }
    val stations: Iterable[MetroNode] = stationsLines
      .groupBy(x => x.name)
      .map { case (_: String, stationNodes: Iterable[MetroNode]) =>
        stationNodes.reduce((a, b) => new StationNode(a.name, a.lines ++ b.lines) )
      }
    val platforms: Iterable[MetroNode] = this.sortedLinePaths
      .flatMap { case (line: String, paths: Seq[Path]) => paths.map { x =>
        new PlatformNode(Metro.platformName(x.features.denominacion, x.features.codigoanden), Seq("L" + line))
      } }
    val nodes: Iterable[MetroNode] = stations ++ platforms
    val lineEdges: Iterable[WDiEdge[MetroNode]] = sortedLinePaths
      .values
      .flatMap(x => buildLineEdges(x, stations, platforms))
    val interLineEdges: Iterable[WDiEdge[MetroNode]] = buildInterLineEdges(sortedLinePaths, stations, platforms)
    Graph.from(nodes, lineEdges ++ interLineEdges)
  }

  def buildLineEdges(linePaths: Seq[Path], stations: Iterable[MetroNode], platforms: Iterable[MetroNode])
  : Seq[WDiEdge[MetroNode]] = {
    (for {
      i <- linePaths.indices
      currentStationName: String = Metro.stationName(
        linePaths(i).features.denominacion, linePaths(i).features.codigoestacion)
      currentStation: MetroNode = stations.filter(x => x.name == currentStationName).head
      weight: Double = linePaths(i).features.longitudtramoanterior
      currentPlatformName: String = Metro.platformName(
        linePaths(i).features.denominacion, linePaths(i).features.codigoanden)
      currentPlatform: MetroNode = platforms.filter(x => x.name == currentPlatformName).head
      nextPath: Path = if (i + 1 < linePaths.length) linePaths(i + 1) else linePaths.head
      nextStationName: String = Metro.stationName(nextPath.features.denominacion, nextPath.features.codigoestacion)
      nextStation: MetroNode = stations.filter(x => x.name == nextStationName).head
      nextPlatformName: String = Metro.platformName(nextPath.features.denominacion, nextPath.features.codigoanden)
      nextPlatform: MetroNode = platforms.filter(x => x.name == nextPlatformName).head
      s1: WDiEdge[MetroNode] = WDiEdge(currentStation, currentPlatform)(weightStationPlatform)
      s1bis: WDiEdge[MetroNode] = WDiEdge(currentPlatform, currentStation)(weightStationPlatform)
      p: WDiEdge[MetroNode] = WDiEdge(currentPlatform, nextPlatform)(weight)
      s2: WDiEdge[MetroNode] = WDiEdge(nextPlatform, nextStation)(weightStationPlatform)
      s2bis: WDiEdge[MetroNode] = WDiEdge(nextStation, nextPlatform)(weightStationPlatform)
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
          val stationWithTransferName: String = Metro.stationName(y.features.denominacion, y.features.codigoestacion)
          stations.filter { case (z: StationNode) => z.name == stationWithTransferName }.head
        } }
      .map { case (x: Iterable[MetroNode]) => computePairs(x.toList) }
    transferPairs
      .flatten
      .map { case (a: MetroNode, b: MetroNode) => WDiEdge(a, b)(weightStationStation) }
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

  def platformName(stationName: String, platformCode: Int): String = {
    val name = PlatformPrefix + stationName.replaceAll(" ", "_") + "_" + platformCode
    val normalized = Normalizer.normalize(name, Normalizer.Form.NFD)
    normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
  }

  def stationName(stationName: String, stationCode: String): String = {
    val name = StationPrefix + stationName.replaceAll(" ", "_") + "_" + stationCode
    val normalized = Normalizer.normalize(name, Normalizer.Form.NFD)
    normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
  }
}
