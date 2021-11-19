// Metro. SDMT

import scalax.collection.{Graph, GraphEdge}
import scalax.collection.edge.WDiEdge

import parser.Path
import Metro.{PlatformPrefix, StationPrefix}


class Metro(lines: Map[String, Seq[Path]], lineLinks: Option[Seq[(Path, Path)]] = None) {

  def buildMetroGraph(): Graph[String, WDiEdge] = {
    val stations: Iterable[String] = this.lines.values.flatten.map(
      x => StationPrefix + x.features.denominacion.replaceAll(" ", "_") + x.features.codigoestacion)
    val platforms: Iterable[String] = this.lines.values.flatten.map(x => PlatformPrefix + x.features.codigoanden)
    val nodes: Iterable[String] = stations ++ platforms
    val lineEdges: Iterable[WDiEdge[String]] = lines.values.flatMap(buildLineEdges)
    val interLineEdges: Iterable[WDiEdge[String]] = buildInterLineEdges(lines)
    Graph.from(nodes, lineEdges ++ interLineEdges)
  }

  def buildLineEdges(linePaths: Seq[Path]): Seq[WDiEdge[String]] = {
    (for {
      i <- linePaths.indices
      currentStation: String = StationPrefix + linePaths(i).features.denominacion.replaceAll(" ", "") +
        linePaths(i).features.codigoestacion
      weight: Double = linePaths(i).features.longitudtramoanterior
      currentPlatform: String = PlatformPrefix + linePaths(i).features.codigoanden
      nextPath: Path = if (i + 1 < linePaths.length) linePaths(i + 1) else linePaths.head
      nextStation: String = StationPrefix + nextPath.features.denominacion.replaceAll(" ", "_") +
        nextPath.features.codigoestacion
      nextPlatform: String = PlatformPrefix + nextPath.features.codigoanden
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
        x.map(y => StationPrefix + y.features.denominacion.replaceAll(" ", "_") + y.features.codigoestacion) }
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
