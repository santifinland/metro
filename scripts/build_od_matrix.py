#!/usr/bin/env python3
"""
Build OD matrix and district-to-station mapping for the Metro de Madrid simulator.

Usage:
    python3 scripts/build_od_matrix.py

Outputs:
    data/madrid/district_to_stations.json
    data/madrid/od_matrix.json

If a MITMA data file is available locally (pipe-separated .txt or .txt.gz),
pass it as an argument:
    python3 scripts/build_od_matrix.py path/to/20200218_maestra1_mitma_distrito.txt.gz

MITMA data can be downloaded from:
    https://opendata-movilidad.mitma.es
    Dataset: maestra1-mitma-distritos/ficheros-diarios/
    Pre-COVID reference weeks are under 0000-referencia/
"""

import json
import math
import sys
import gzip
import csv
import io
import os
import urllib.request
from collections import defaultdict
from pathlib import Path


DATA_DIR = Path(__file__).parent.parent / "data"
OUT_DIR  = DATA_DIR / "madrid"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ── Step 1: Build district → stations mapping ──────────────────────────────

def build_district_to_stations() -> tuple[dict, dict]:
    """
    Returns:
        district_to_stations: {district_code: [empresa_code, ...]}
        empresa_to_district:  {empresa_code: district_code}
    """
    with open(DATA_DIR / "stations.json") as f:
        stations_geo = json.load(f)
    with open(DATA_DIR / "entrance.json") as f:
        entrance_data = json.load(f)

    emp_entrance = {
        str(int(e["entrance"]["CODIGOEMPRESA"])): e["entrance"]["ENTRANCE"]
        for e in entrance_data["entrances"]
    }

    district_to_stations: dict[str, list[dict]] = {}
    empresa_to_district:  dict[str, str] = {}

    for feat in stations_geo["features"]:
        p      = feat["properties"]
        prov   = str(p.get("CODIGOPROVINCIA", "")).zfill(2)
        mun    = str(p.get("CODIGOMUNICIPIO", "")).zfill(3)
        ent    = str(p.get("CODIGOENTIDAD", ""))
        emp    = str(p.get("CODIGOEMPRESA", ""))
        name   = p.get("DENOMINACION", "")
        coords = feat["geometry"]["coordinates"]

        if not ent or len(ent) < 2 or not emp:
            continue
        district_code = prov + mun + ent[-2:]

        if district_code not in district_to_stations:
            district_to_stations[district_code] = []

        if emp not in [s["empresa"] for s in district_to_stations[district_code]]:
            district_to_stations[district_code].append({
                "empresa":  emp,
                "name":     name,
                "lon":      coords[0],
                "lat":      coords[1],
                "entrance": emp_entrance.get(emp, 0),
            })
            empresa_to_district[emp] = district_code

    # Compute district centroids and total entrance
    result: dict[str, dict] = {}
    for code, stations in district_to_stations.items():
        lons = [s["lon"] for s in stations]
        lats = [s["lat"] for s in stations]
        result[code] = {
            "centroid":       [sum(lons) / len(lons), sum(lats) / len(lats)],
            "total_entrance": sum(s["entrance"] for s in stations),
            "stations":       [s["empresa"] for s in stations],
        }

    return result, empresa_to_district


# ── Step 2a: OD matrix from MITMA file ────────────────────────────────────

def build_od_from_mitma(mitma_path: str, district_to_stations: dict) -> dict:
    """
    Parse a MITMA maestra1 file (pipe-separated, optionally gzipped).
    Returns od_matrix: {hour: {origin: {dest: weight}}} with normalised weights.
    Only keeps (origin, dest) pairs where both districts are in district_to_stations.
    """
    known = set(district_to_stations.keys())
    raw: dict[int, dict[str, dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))

    opener = gzip.open if mitma_path.endswith(".gz") else open
    with opener(mitma_path, "rt", encoding="utf-8") as fh:
        reader = csv.DictReader(fh, delimiter="|")
        for row in reader:
            origen   = row.get("origen", "").strip()
            destino  = row.get("destino", "").strip()
            periodo  = row.get("periodo", "").strip()
            viajes   = row.get("viajes", "0").strip().replace(",", ".")
            if origen not in known or destino not in known or origen == destino:
                continue
            try:
                h = int(periodo)
                v = float(viajes)
            except ValueError:
                continue
            raw[h][origen][destino] += v

    return _normalize_od(raw)


# ── Step 2b: Synthetic OD matrix from gravity model ───────────────────────

def build_od_synthetic(district_to_stations: dict) -> dict:
    """
    Gravity model: weight(O→D, h) ∝ entrance(D)^0.8 / distance(O,D)^1.2 × peak_factor(h)
    Normalized so weights sum to 1 for each (O, h).
    Peak factors capture AM peak (suburban → city) and PM peak (city → suburban).
    """
    codes    = sorted(district_to_stations.keys())
    centroids = {c: district_to_stations[c]["centroid"] for c in codes}
    entrances = {c: max(district_to_stations[c]["total_entrance"], 1) for c in codes}

    # Madrid city district (most central, largest)
    MADRID_CITY = "2807901"

    def haversine(c1, c2) -> float:
        lon1, lat1 = math.radians(c1[0]), math.radians(c1[1])
        lon2, lat2 = math.radians(c2[0]), math.radians(c2[1])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        return 6371 * 2 * math.asin(math.sqrt(a))  # km

    # Hour multipliers for O→D direction
    # Based on Madrid HourDistribution + commuting patterns
    HOUR_DIST = {
        6: 1, 7: 2, 8: 6, 9: 11, 10: 7, 11: 5, 12: 6, 13: 6, 14: 6,
        15: 8, 16: 6, 17: 7, 18: 8, 19: 8, 20: 7, 21: 5, 22: 3, 23: 2,
    }
    MAX_HOUR = max(HOUR_DIST.values())

    raw: dict[int, dict[str, dict[str, float]]] = {}

    for h in range(24):
        base_mul = HOUR_DIST.get(h, 0.5) / MAX_HOUR
        # For AM peak (7-10), boost suburb→city; for PM (17-20) boost city→suburb
        am_peak = h in (7, 8, 9)
        pm_peak = h in (17, 18, 19)

        raw[h] = {}
        for orig in codes:
            raw[h][orig] = {}
            orig_is_city    = orig == MADRID_CITY
            orig_is_suburb  = not orig_is_city

            for dest in codes:
                if dest == orig:
                    continue
                dest_is_city   = dest == MADRID_CITY
                dest_is_suburb = not dest_is_city

                dist_km = haversine(centroids[orig], centroids[dest])
                dist_km = max(dist_km, 1.0)

                gravity = (entrances[dest] ** 0.8) / (dist_km ** 1.2)

                # Peak adjustments
                if am_peak and orig_is_suburb and dest_is_city:
                    gravity *= 2.5
                if pm_peak and orig_is_city and dest_is_suburb:
                    gravity *= 2.0
                if am_peak and orig_is_city and dest_is_suburb:
                    gravity *= 0.5
                if pm_peak and orig_is_suburb and dest_is_city:
                    gravity *= 0.5

                gravity *= base_mul
                raw[h][orig][dest] = gravity

    return _normalize_od(raw)


def _normalize_od(raw: dict) -> dict:
    """Normalize weights per (origin, hour) so they sum to 1."""
    od: dict[str, dict[str, dict[str, float]]] = {}
    for h, origins in raw.items():
        od[str(h)] = {}
        for orig, dests in origins.items():
            total = sum(dests.values())
            if total <= 0:
                continue
            od[str(h)][orig] = {d: round(v / total, 6) for d, v in dests.items() if v > 0}
    return od


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    print("Building district → stations mapping …")
    district_to_stations, empresa_to_district = build_district_to_stations()

    out_d2s = OUT_DIR / "district_to_stations.json"
    with open(out_d2s, "w") as f:
        json.dump({
            "district_to_stations": {k: v["stations"] for k, v in district_to_stations.items()},
            "empresa_to_district":  empresa_to_district,
        }, f, indent=2, ensure_ascii=False)
    print(f"  → {out_d2s}  ({len(district_to_stations)} districts)")

    mitma_path = sys.argv[1] if len(sys.argv) > 1 else None
    if mitma_path and os.path.exists(mitma_path):
        print(f"Building OD matrix from MITMA file: {mitma_path} …")
        od = build_od_from_mitma(mitma_path, district_to_stations)
        source = "MITMA"
    else:
        if mitma_path:
            print(f"  MITMA file not found: {mitma_path}")
        print("Building synthetic OD matrix (gravity model) …")
        od = build_od_synthetic(district_to_stations)
        source = "synthetic"

    out_od = OUT_DIR / "od_matrix.json"
    with open(out_od, "w") as f:
        json.dump({"source": source, "od": od}, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  → {out_od}  (source={source})")
    print("Done.")


if __name__ == "__main__":
    main()
