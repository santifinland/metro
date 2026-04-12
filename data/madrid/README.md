# Madrid Metro Reference Data

Real and inferred data about the Madrid Metro network.

## Files

| File | Contents | Source |
|------|----------|--------|
| `lines.json` | Per-line: terminals, station count, length, rolling stock, wagon/train capacity, headways, operating hours, platform length | Wikipedia + metromadrid.es |
| `rolling_stock.json` | Per-series: manufacturer, car dimensions, seated/standing capacity, max speed, lines served | Wikipedia rolling stock articles |
| `station_depths.json` | Known per-station depths + line averages + recommended simulation transit times | Inferred + blog sources |
| `schedules.json` | Operating hours, headways by time of day, depot/terminal departure stations | Wikipedia + metromadrid.es |
| `frequencies.json` | **Official GTFS headways** by line, day type (weekday/friday/saturday/sunday), and time slot | **CRTM GTFS feed 20250527** |
| `inter_station_times.json` | **Real travel time** between consecutive stations for each line (seconds) | **CRTM GTFS stop_times 20250527** |

## Key facts

- **All lines**: 06:05 → 02:00, every day of the year
- **Peak headway**: 3 min (core lines L1–L7, L10) / 5 min (others)
- **Off-peak headway**: 5–8 min / night: 7–12 min
- **Deepest station**: Cuatro Caminos L6 platform, ~45 m
- **Shallowest lines**: L1, L2, L4, L5 (narrow gauge, mostly 8–12 m)
- **Largest trains**: L6 Serie 8400 6-car (1 272 pax), L7/L10 Serie 9000 6-car (1 274 pax)
- **Smallest trains**: ML1/ML2/ML3 Citadis tram (200 pax)

## Confidence levels

| Data | Confidence |
|------|-----------|
| Terminals, station count, line length | High — Wikipedia + official |
| Rolling stock model per line | High |
| Train capacity (seated + standing) | High — from rolling stock specs |
| Operating hours (06:05–02:00) | High — official |
| Peak headways (3–5 min) | Medium — Wikipedia / press |
| Per-station depths | Low (only Cuatro Caminos L6 verified at 45 m) |
| Line-average depths | Medium — inferred from construction type |
| Transit time street→platform | Inferred — no official dataset exists |

## License

All files in this directory are derived works released under **CC-BY-SA 4.0**.
See [LICENSE](LICENSE) for full attribution requirements.

| Source | Files | License |
|--------|-------|---------|
| [CRTM GTFS feed 20250527](https://crtm.maps.arcgis.com/home/item.html?id=5c7f2951962540d69ffe8f640d94c246) | `frequencies.json`, `inter_station_times.json`, `initial_conditions.json`, `train_service.json` | CC-BY-SA — *Powered by CRTM — www.crtm.es* |
| [Wikipedia — Metro de Madrid](https://es.wikipedia.org/wiki/Metro_de_Madrid) | `lines.json`, `rolling_stock.json`, `station_depths.json`, `schedules.json` | CC-BY-SA 4.0 |

## Sources

- Wikipedia: Metro de Madrid and individual line articles
- urbanrail.net — Madrid Metro
- metromadrid.es — official line pages
- vialibre-ffe.com — rolling stock specifications
- nosolometro.blogspot.com — station depth records
- CRTM GTFS: https://datos.crtm.es
