import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { normalizeFeed } from '../lib/normalize.js';

export async function GET() {
  try {
    const upstream = await fetch('https://bustime.ttc.ca/gtfsrt/vehicles', {
      signal: AbortSignal.timeout(12000), headers: { 'Accept': 'application/x-google-protobuf' }
    });
    if (!upstream.ok) throw new Error(`TTC returned ${upstream.status}`);
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.length > 4000000) throw new Error('Unexpected feed size');
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(bytes);
    return Response.json(normalizeFeed(feed), { headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=30'
    }});
  } catch (error) {
    console.error('TTC feed unavailable:', error.message);
    return Response.json({ error: 'TTC positions are temporarily unavailable.' }, {
      status: 502, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
    });
  }
}
