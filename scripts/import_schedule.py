"""Import the matching TTC SurfaceGTFS zip. Never substitute merged GTFS IDs."""
import csv, io, json, sys, zipfile
from pathlib import Path
from datetime import datetime, timezone
z = zipfile.ZipFile(sys.argv[1])
def rows(name):
    with z.open(name) as f:
        yield from csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig'))
routes = {r['route_id']: {'number': r['route_short_name'], 'name': r['route_long_name'].title(),
    'type': 'streetcar' if r['route_type'] == '0' else 'bus', 'shapes': []} for r in rows('routes.txt')}
shape_routes = {}
for r in rows('trips.txt'):
    shape_routes[r['shape_id']] = r['route_id']
shapes = {}
for r in rows('shapes.txt'):
    shapes.setdefault(r['shape_id'], []).append((int(r['shape_pt_sequence']), float(r['shape_pt_lat']), float(r['shape_pt_lon'])))
for sid, points in shapes.items():
    route = routes.get(shape_routes.get(sid))
    if not route: continue
    pts = sorted(points)
    # Simplified display polylines; preserve endpoints, not used for journey routing.
    route['shapes'].append([[p[1], p[2]] for i,p in enumerate(pts) if i % 5 == 0 or i == len(pts)-1])
stops = {r['stop_id']: {'name': r['stop_name'], 'lat': float(r['stop_lat']), 'lon': float(r['stop_lon'])} for r in rows('stops.txt')}
info = list(rows('feed_info.txt'))
out = Path(__file__).resolve().parents[1] / 'public/data'
(out/'network.json').write_text(json.dumps({'importedAt':datetime.now(timezone.utc).isoformat(), 'feedInfo':info,'routes':routes,'stops':stops},separators=(',',':')))
print(f'Imported {len(routes)} routes, {len(stops)} stops, {len(shapes)} route shapes')
