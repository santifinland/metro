// Metro. SDMT

import au.id.jazzy.play.geojson.Crs._
import au.id.jazzy.play.geojson.Geometry._
import au.id.jazzy.play.geojson.LatLng
import au.id.jazzy.play.geojson.LatLng.latLngFormat
import au.id.jazzy.play.geojson.LineString.lineStringWrites
import org.geolatte.geom.{Geometry, LineString, Point}
import play.api.libs.functional.syntax.toFunctionalBuilderOps
import play.api.libs.json.Format.GenericFormat
import play.api.libs.json._


class MetroParser(metro: String) {

  def parseMetro(metro: String): Seq[LineProperties] = {
    val raw: JsValue = Json.parse(metro)
    val features: Seq[JsValue] = (raw \ "features" \\ "properties").toSeq
    features.flatMap(parseTramo)
  }

  def parseTramo(features: JsValue): Option[LineProperties] = {
    (features).validate(tramoReads) match {
      case s: JsSuccess[LineProperties] => Some(s.value)
      case _: JsError => None
    }
  }

  implicit val tramoReads: Reads[LineProperties] = (
    (JsPath \ "NUMEROLINEAUSUARIO").read[String] and
      (JsPath \ "SENTIDO").read[String] and
      (JsPath \ "CODIGOESTACION").read[String] and
      (JsPath \ "CODIGOANDEN").read[Int] and
      (JsPath \ "NUMEROORDEN").read[Int] and
      (JsPath \ "TIPOPARADA").read[String] and
      (JsPath \ "DENOMINACION").read[String] and
      (JsPath \ "CODIGOMUNICIPIO").read[String] and
      (JsPath \ "MUNICIPIO").read[String] and
      (JsPath \ "CORONATARIFARIA").read[String] and
      (JsPath \ "LONGITUDTRAMOANTERIOR").read[Double] and
      (JsPath \ "VELOCIDADTRAMOANTERIOR").read[Float] and
      (JsPath \ "MODOLINEA").read[Int] and
      (JsPath \ "MODOINTERCAMBIADOR").read[Int] and
      (JsPath \ "CODIGOINTERCAMBIADOR").read[String] and
      (JsPath \ "IDFTRAMO").read[String] and
      (JsPath \ "IDFLINEA").read[String] and
      (JsPath \ "IDFITINERARIO").read[String] and
      (JsPath \ "IDFESTACION").read[String] and
      (JsPath \ "IDFPOSTE").read[String] and
      (JsPath \ "IDFANDEN").read[String] and
      (JsPath \ "geometry" \ "coordinates").read[LineString[LatLng]]
  )(LineProperties.apply _)
}
