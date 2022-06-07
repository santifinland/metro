// Metro. SDMT

package parser

import play.api.libs.functional.syntax.toFunctionalBuilderOps
import play.api.libs.json.Format.GenericFormat
import play.api.libs.json._


case class StationIds(name: String, id: String, secondaryId: String)


class StationParser {

  def parseStations(metro: String): Seq[StationIds] = {
    val raw: JsValue = Json.parse(metro)
    (raw \ "features" \\ "properties")
      .toSeq
      .flatMap(x => parseStation(x))
  }

  def parseStation(x: JsValue): Option[StationIds] = {
    x.validate(stationReads) match {
      case s: JsSuccess[StationIds] => Some(s.value)
      case e: JsError =>
        scribe.debug(s"Error $e")
        scribe.debug(s"Error ${e.errors}")
        None
    }
  }

  implicit val stationReads: Reads[StationIds] = (
    (JsPath \ "DENOMINACION").read[String] and
      (JsPath \ "CODIGOESTACION").read[String] and
      (JsPath \ "CODIGOEMPRESA").read[String]
  )(StationIds.apply _)
}
