// Metro. SDMT

package parser

import play.api.libs.json._


/** Loaded from data/madrid/od_matrix.json */
case class ODMatrix(
  source: String,
  // hour → originDistrict → Map[destDistrict, weight]   (weights sum to 1 per origin/hour)
  od: Map[Int, Map[String, Map[String, Double]]]
)

/** Loaded from data/madrid/district_to_stations.json */
case class DistrictData(
  // district code → list of empresa codes
  districtToStations: Map[String, Seq[String]],
  // empresa code → district code
  empresaToDistrict: Map[String, String]
)


object ODParser {

  def parseODMatrix(json: String): ODMatrix = {
    val root = Json.parse(json)
    val source = (root \ "source").as[String]
    val odRaw  = (root \ "od").as[Map[String, Map[String, Map[String, Double]]]]
    val od = odRaw.map { case (h, origins) => h.toInt -> origins }
    ODMatrix(source, od)
  }

  def parseDistrictData(json: String): DistrictData = {
    val root = Json.parse(json)
    val d2s  = (root \ "district_to_stations").as[Map[String, Seq[String]]]
    val e2d  = (root \ "empresa_to_district").as[Map[String, String]]
    DistrictData(d2s, e2d)
  }
}
