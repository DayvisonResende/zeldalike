import fs from 'node:fs';
import type { MapData } from '@vale/shared';

export const WORLD_MAP: MapData = JSON.parse(fs.readFileSync(new URL('../../../content/maps/vale.json', import.meta.url), 'utf8'));
