// Metro. SDMT

import org.geolatte.geom.{Geometry, LineString, Point}


class Line(stations: Array[Station]) {
}

case class LineProperties(
    numerolineausuario: String,
    sentido: String,
    codigoestacion: String,
    codigoanden: Int,
    numeroorden: Int,
    tipoparada: String,
    denominacion: String,
    codigomunicipio: String,
    municipio: String,
    coronatarifaria: String,
    longitudtramoanterior: Double,
    velocidadtramoanterior: Float,
    modolinea: Int,
    modointercambiador: Int,
    codigointercambiador: String,
    idftramo: String,
    idflinea: String,
    idfitinerario: String,
    idfestacion: String,
    idfposte: String,
    idfanden: String,
    geometry: Any
)