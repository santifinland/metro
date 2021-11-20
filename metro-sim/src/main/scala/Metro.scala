// Metro. SDMT

import scalax.collection.Graph
import scalax.collection.edge.WDiEdge

import parser.Path
import Metro.{PlatformPrefix, StationPrefix}


class Metro(lines: Map[String, Seq[Path]], lineLinks: Option[Seq[(Path, Path)]] = None) {

  def buildMetroGraph(): Graph[String, WDiEdge] = {
    val stations: Iterable[String] = this.lines
      .values
      .flatten
      .map(x => stationName(x.features.denominacion, x.features.codigoestacion))
    val platforms: Iterable[String] = this.lines
      .values
      .flatten
      .map(x => platformName(x.features.denominacion, x.features.codigoanden))
    val nodes: Iterable[String] = stations ++ platforms
    val lineEdges: Iterable[WDiEdge[String]] = lines.values.flatMap(buildLineEdges)
    val interLineEdges: Iterable[WDiEdge[String]] = buildInterLineEdges(lines)
    Graph.from(nodes, lineEdges ++ interLineEdges)
  }

  def platformName(stationName: String, platformCode: Int): String = {
    PlatformPrefix + stationName.replaceAll(" ", "_") + "_" + platformCode
  }

  def stationName(stationName: String, stationCode: String): String = {
    StationPrefix + stationName.replaceAll(" ", "_") + "_" + stationCode
  }

  def buildLineEdges(linePaths: Seq[Path]): Seq[WDiEdge[String]] = {
    (for {
      i <- linePaths.indices
      currentStation: String = stationName(linePaths(i).features.denominacion, linePaths(i).features.codigoestacion)
      weight: Double = linePaths(i).features.longitudtramoanterior
      currentPlatform: String = platformName(linePaths(i).features.denominacion, linePaths(i).features.codigoanden)
      nextPath: Path = if (i + 1 < linePaths.length) linePaths(i + 1) else linePaths.head
      nextStation: String = stationName(nextPath.features.denominacion, nextPath.features.codigoestacion)
      nextPlatform: String = platformName(nextPath.features.denominacion, nextPath.features.codigoanden)
      s1: WDiEdge[String] = WDiEdge(currentStation, currentPlatform)(1)
      s1bis: WDiEdge[String] = WDiEdge(currentPlatform, currentStation)(1)
      p: WDiEdge[String] = WDiEdge(currentPlatform, nextPlatform)(weight)
      s2: WDiEdge[String] = WDiEdge(nextPlatform, nextStation)(1)
      s2bis: WDiEdge[String] = WDiEdge(nextStation, nextPlatform)(1)
    } yield List(s1, s1bis, p, s2, s2bis)).flatten
  }

  def buildInterLineEdges(lines: Map[String, Seq[Path]]): Iterable[WDiEdge[String]] = {
    val stationWithTransfers: Map[String, Iterable[Path]] = lines.values.flatten.groupBy(x => x.features.denominacion)
    val transferPairs = stationWithTransfers
      .values
      .filter { case (x: Iterable[Path]) => x.size > 2 }
      .map { case (x: Iterable[Path]) =>
        x.map(y => stationName(y.features.denominacion, y.features.codigoestacion)) }
      .map { case (x: Iterable[String]) => computePairs(x.toList) }
    transferPairs
      .flatten
      .map { case (a: String, b: String) => WDiEdge(a, b)(5) }
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
