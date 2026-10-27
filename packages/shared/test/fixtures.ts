import fs from 'node:fs';
import { fromTiled } from '../src';

// O mapa do Vale para os testes: uma cópia fixa em test/maps, para os testes não dependerem do mapa
// que você está editando no Tiled (content/maps). Se mudar o Vale de propósito e quiser testar com ele, copie para cá.
export const FIXTURE_DIR = new URL('./maps/', import.meta.url);
const read = (f: string) => JSON.parse(fs.readFileSync(new URL(f, FIXTURE_DIR), 'utf8'));
export const vale = fromTiled(read('vale.tmj'), read('vale.tsj'), 'vale.tmj').map;
export default vale;
