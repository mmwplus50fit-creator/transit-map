import { GET } from '../api/vehicles.js';
import { writeFile } from 'node:fs/promises';
const response = await GET();
if (!response.ok) throw new Error(await response.text());
const data = await response.json();
data.snapshot = true;
await writeFile(new URL('../public/data/snapshot.json', import.meta.url), JSON.stringify(data));
console.log(`Saved ${data.vehicles.length} observed vehicles. Feed time ${new Date(data.feedTimestamp*1000).toISOString()}`);
