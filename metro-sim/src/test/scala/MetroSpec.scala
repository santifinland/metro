import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers
import scala.collection.immutable.SortedMap

import parser.{EntranceParser, MetroParser, Path, StationParser}
import utils.{Distribution, Position}


class MetroSpec extends AnyFlatSpec with Matchers {

  // ── Metro.stationName ────────────────────────────────────────────────────

  "Metro.stationName" should "add Station_ prefix" in {
    Metro.stationName("Sol", "1") should startWith(Metro.StationPrefix)
  }

  it should "replace spaces with underscores" in {
    Metro.stationName("Casa de Campo", "42") should include("Casa_de_Campo")
  }

  it should "strip diacritics" in {
    val name = Metro.stationName("Príncipe Pío", "99")
    name should not include "í"
    name should include("Principe_Pio")
  }

  // ── Metro.platformName ───────────────────────────────────────────────────

  "Metro.platformName" should "add Platform_ prefix" in {
    Metro.platformName("Sol", 1) should startWith(Metro.PlatformPrefix)
  }

  it should "include the platform code" in {
    Metro.platformName("Sol", 420) should endWith("420")
  }

  it should "strip diacritics" in {
    val name = Metro.platformName("Príncipe Pío", 7)
    name should not include "í"
  }

  // ── Position ──────────────────────────────────────────────────────────────

  "Position" should "place Madrid center at roughly canvas center" in {
    val p = new Position(40.4202961, -3.718762)
    p.x shouldBe (1700.0 +- 1.0)
    p.y shouldBe (1000.0 +- 1.0)
  }

  it should "place a point north of center higher on canvas (smaller y)" in {
    val center = new Position(40.4202961, -3.718762)
    val north  = new Position(40.5, -3.718762)
    north.y should be < center.y
  }

  it should "place a point east of center further right (larger x)" in {
    val center = new Position(40.4202961, -3.718762)
    val east   = new Position(40.4202961, -3.6)
    east.x should be > center.x
  }

  // ── Distribution ─────────────────────────────────────────────────────────

  "Distribution" should "return 0 when probability is at or below the lowest key" in {
    val d = new Distribution(SortedMap(0.0 -> 1, 0.5 -> 2, 0.9 -> 3))
    d.value(0.0) shouldBe 0
  }

  it should "return the correct bucket for a mid probability" in {
    val d = new Distribution(SortedMap(0.0 -> 1, 0.5 -> 2, 0.9 -> 3))
    d.value(0.3) shouldBe 1
    d.value(0.7) shouldBe 2
  }

  it should "return the highest bucket for high probability" in {
    val d = new Distribution(SortedMap(0.0 -> 1, 0.5 -> 2, 0.9 -> 3))
    d.value(0.95) shouldBe 3
  }

  // ── EntranceParser ────────────────────────────────────────────────────────

  "EntranceParser" should "parse a valid entrance JSON" in {
    val json =
      """|{
         |  "entrances": [
         |    { "entrance": { "CODIGOEMPRESA": "101", "ENTRANCE": 948967.0 } },
         |    { "entrance": { "CODIGOEMPRESA": "102", "ENTRANCE": 193500.0 } }
         |  ]
         |}""".stripMargin
    val result = new EntranceParser().parseEntrances(json)
    result should have size 2
    result.map(_.id) should contain ("101")
    result.find(_.id == "101").map(_.entrance) shouldBe Some(948967.0)
  }

  it should "return empty seq for empty entrances array" in {
    val json = """{ "entrances": [] }"""
    new EntranceParser().parseEntrances(json) shouldBe empty
  }

  it should "skip malformed entries" in {
    val json =
      """|{
         |  "entrances": [
         |    { "entrance": { "CODIGOEMPRESA": "101", "ENTRANCE": 100.0 } },
         |    { "entrance": { "MISSING_FIELD": true } }
         |  ]
         |}""".stripMargin
    val result = new EntranceParser().parseEntrances(json)
    result should have size 1
  }

  // ── StationParser ─────────────────────────────────────────────────────────

  "StationParser" should "parse valid station features JSON" in {
    val json =
      """|{
         |  "type": "FeatureCollection",
         |  "features": [
         |    { "properties": {
         |        "DENOMINACION": "SOL",
         |        "CODIGOESTACION": "1",
         |        "CODIGOEMPRESA": "101"
         |    }},
         |    { "properties": {
         |        "DENOMINACION": "GRAN VIA",
         |        "CODIGOESTACION": "2",
         |        "CODIGOEMPRESA": "102"
         |    }}
         |  ]
         |}""".stripMargin
    val result = new StationParser().parseStations(json)
    result should have size 2
    result.map(_.name) should contain ("SOL")
    result.find(_.name == "SOL").map(_.id) shouldBe Some("1")
  }

  it should "return empty seq for no features" in {
    val json = """{ "type": "FeatureCollection", "features": [] }"""
    new StationParser().parseStations(json) shouldBe empty
  }

  it should "skip entries with missing required fields" in {
    val json =
      """|{
         |  "type": "FeatureCollection",
         |  "features": [
         |    { "properties": { "DENOMINACION": "SOL", "CODIGOESTACION": "1", "CODIGOEMPRESA": "101" } },
         |    { "properties": { "DENOMINACION": "INCOMPLETE" } }
         |  ]
         |}""".stripMargin
    val result = new StationParser().parseStations(json)
    result should have size 1
    result.head.name shouldBe "SOL"
  }

  // ── Metro.buildMetroGraph (integration) ───────────────────────────────────

  "Metro.buildMetroGraph" should "build a graph with stations and platforms" in {
    val metro  = scala.io.Source.fromFile("data/tramos.json").mkString
    val paths  = new MetroParser(metro).parseMetro(metro)
    val sorted = paths
      .groupBy(_.features.numerolineausuario)
      .map { case (line, ps) => line -> Path.sortLinePaths(ps) }
    val graph = new Metro(sorted, 2000, 10).buildMetroGraph()

    graph.nodes.size should be > 100
    graph.edges.size should be > 100
    graph.nodes.exists(_.value.name.startsWith(Metro.StationPrefix))   shouldBe true
    graph.nodes.exists(_.value.name.startsWith(Metro.PlatformPrefix))  shouldBe true
  }

  it should "contain at least one interchange (multi-line) station" in {
    val metro  = scala.io.Source.fromFile("data/tramos.json").mkString
    val paths  = new MetroParser(metro).parseMetro(metro)
    val sorted = paths
      .groupBy(_.features.numerolineausuario)
      .map { case (line, ps) => line -> Path.sortLinePaths(ps) }
    val graph = new Metro(sorted, 2000, 10).buildMetroGraph()

    val multiLine = graph.nodes.filter { n =>
      n.value.name.startsWith(Metro.StationPrefix) && n.value.lines.size >= 2
    }
    multiLine.nonEmpty shouldBe true
  }

  it should "produce station nodes with at least one line" in {
    val metro  = scala.io.Source.fromFile("data/tramos.json").mkString
    val paths  = new MetroParser(metro).parseMetro(metro)
    val sorted = paths
      .groupBy(_.features.numerolineausuario)
      .map { case (line, ps) => line -> Path.sortLinePaths(ps) }
    val graph = new Metro(sorted, 2000, 10).buildMetroGraph()

    val stations = graph.nodes.filter(_.value.name.startsWith(Metro.StationPrefix))
    stations.forall(_.value.lines.nonEmpty) shouldBe true
  }
}
