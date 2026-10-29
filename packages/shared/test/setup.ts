// Antes de cada arquivo de teste: os itens de content/items/ no registro (no jogo, quem faz isso é o servidor).
import fs from 'node:fs';
import { setItems, type ItemDef } from '../src';

const DIR = new URL('../../../content/items/', import.meta.url);
setItems(Object.fromEntries(fs.readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), JSON.parse(fs.readFileSync(new URL(f, DIR), 'utf8')) as ItemDef])));
