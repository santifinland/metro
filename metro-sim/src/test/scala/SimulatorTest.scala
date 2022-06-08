// Metro. SDMT

import org.geolatte.geom.builder.DSL.{g, linestring}
import org.scalatest.flatspec.AnyFlatSpec
import org.geolatte.geom.crs.CoordinateReferenceSystems.WGS84
import org.scalatest.matchers.should
import scalax.collection.Graph
import scalax.collection.edge.WDiEdge
import parser.{Entrance, LineFeatures, Path, StationIds}


class SimulatorTest extends AnyFlatSpec with should.Matchers {

  "A Simulator" should "build a accumulated probability distribution" in {
    val l1 = LineFeatures("L1", "1", "s1", 1, 1, "C", "p1", "m1", "m", "c1", 100.0, 1.0f, 1, None, None, "t1", "1",
       "i1", "s1", "p1", "a1")
    val g1 = linestring(WGS84, g(4.43,53.21), g(4.44,53.20), g(4.45,53.19))
    val p1 = Path(l1, g1)
    val l2 = LineFeatures("L2", "2", "s2", 1, 1, "C", "p2", "m2", "m", "c2", 100.0, 1.0f, 1, None, None, "t2", "2",
      "i2", "s2", "p2", "a2")
    val g2 = linestring(WGS84, g(4.43,53.21), g(4.44,53.20), g(4.45,53.19))
    val p2 = Path(l2, g2)
    val paths = List(p1, p2)
    val linePaths: Map[String, Seq[Path]] = paths
      .groupBy(l => l.features.numerolineausuario)
      .map { case (line, paths) => line -> Path.sortLinePaths(paths) }
    val metroGraph: Graph[MetroNode, WDiEdge] =
      new Metro(linePaths, 2, 1).buildMetroGraph()

    val stations: List[MetroNode] = metroGraph
      .nodes
      .filter(x => x.name.startsWith(Metro.StationPrefix))
      .map(x => x.toOuter)
      .toList
    println(s"""stations test $stations""")
    val stationIdsEntrance: Map[StationIds, Option[Entrance]] =
      Map(StationIds("s1", "s1", "1") -> Some(Entrance("1", 1.0)),
         StationIds("s2", "s2", "2") -> Some(Entrance("2", 6.0)))
    val res = Simulator.buildStationDistribution(stations, stationIdsEntrance)
    res.size should be (2)
    println(s"""Res $res""")
  }


}
