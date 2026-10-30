import { MAX_ATTACK_SPEED, RARITY_COLOR, RARITY_NAME, STAT_KEYS, STAT_LABEL, balance, gearLines, type CalcRules, type EffectKind, type Rarity, isKind, WEAR_EFFECTS, WEAR_NAME, statLines, type WearDef, type WearSlot, setItems, type GearDef, type GearKind, type GearRules, type ItemCatalogMsg, type ItemDef, type Stats } from '@vale/shared';
import { Api, ApiError, loadSession, saveSession } from '../net/api';
import './oficina.css';
import { renderGuide } from './guide';

/* Oficina: criar e editar itens (docs/OFICINA.md). Grava em content/items/ pelo servidor (só com OFICINA=1, no PC). */
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SERVER = import.meta.env.DEV ? `${location.protocol}//${location.hostname}:2567` : location.origin;
const api = new Api(SERVER + '/api');
api.token = loadSession()?.token ?? null;

type Kind = 'use' | 'material' | 'gear' | 'wear';
let items: ItemCatalogMsg = {};
let editing: string | null = null;    // id do item aberto (null = novo)
let icon: string | null = null;       // PNG escolhido agora (data URL), ainda não gravado
let idTouched = false;                // mexeram no id à mão: para de seguir o nome
let rules: CalcRules | null = null;   // números do config: armas de base, magias, monstros, PvP (prévia e calculadora)

const kindOf = (d: ItemDef): Kind => d.gear ? 'gear' : d.wear ? 'wear' : d.heal || d.mana ? 'use' : 'material';
// "Espada de Gelo" → "espada-de-gelo"
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const loadImage = (src: string) => new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });

/* ---------- Entrar ---------- */
async function start() {
  if (!api.token) { showLogin(); return; }
  try {
    const me = await api.request<{ username: string }>('/oficina/me');
    $('who').textContent = me.username; $('logout').hidden = false;
    $('login').hidden = true; $('blocked').hidden = true; $('work').hidden = false;
    rules = await api.request<CalcRules>('/oficina/rules');
    await refresh();
    openItem(null);
  } catch (e) {
    const err = e as ApiError;
    if (err.status === 401) { showLogin(); return; }
    $('blocked').hidden = false; $('login').hidden = true; $('work').hidden = true;
    $('blocked').textContent = err.status === 404 ? 'A Oficina está desligada neste servidor. Ela roda no seu PC: use "npm run dev" (liga OFICINA=1).' : err.message;
  }
}
function showLogin() { $('login').hidden = false; $('work').hidden = true; $('blocked').hidden = true; $<HTMLInputElement>('user').focus(); }
$('login').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const r = await api.login($<HTMLInputElement>('user').value.trim(), $<HTMLInputElement>('pass').value);
    api.token = r.token; saveSession(r); $('loginError').textContent = '';
    await start();
  } catch (err) { $('loginError').textContent = (err as Error).message; }
});
$('logout').addEventListener('click', async () => { try { await api.logout(); } catch { } saveSession(null); api.token = null; location.reload(); });

/* ---------- Lista ---------- */
async function refresh() {
  items = await api.request<ItemCatalogMsg>('/oficina/items');
  renderList();
}
function renderList() {
  const q = slug($<HTMLInputElement>('filter').value);
  const ids = Object.keys(items).sort((a, b) => items[a].name.localeCompare(items[b].name));
  $('count').textContent = `(${ids.length})`;
  $('items').replaceChildren(...ids.filter(id => !q || id.includes(q) || slug(items[id].name).includes(q)).map(id => {
    const li = document.createElement('li'), b = document.createElement('button'), img = new Image();
    img.src = items[id].icon; img.alt = ''; img.width = 32; img.height = 32;
    b.type = 'button'; b.append(img, Object.assign(document.createElement('span'), { textContent: items[id].name, style: `color:${RARITY_COLOR[items[id].rarity ?? 'common']}` }), Object.assign(document.createElement('code'), { textContent: id }));
    b.setAttribute('aria-current', String(id === editing));
    b.addEventListener('click', () => openItem(id));
    li.append(b);
    return li;
  }));
}
$('filter').addEventListener('input', renderList);
$('newItem').addEventListener('click', () => openItem(null));

/* ---------- Editor ---------- */
const field = (id: string) => $<HTMLInputElement>(id);
// Um campo por atributo (ataque, poder mágico…).
// Sorteio: mínimo e máximo de cada atributo que um exemplar pode trazer.
$('rollInputs').replaceChildren(...STAT_KEYS.map(k => {
  const l = document.createElement('label'), pair = document.createElement('span');
  pair.className = 'rollpair';
  for (const end of ['min', 'max']) {
    const i = Object.assign(document.createElement('input'), { id: `rl-${k}-${end}`, type: 'number', inputMode: 'decimal', placeholder: end === 'min' ? 'mín' : 'máx' });
    i.addEventListener('input', preview); pair.append(i);
  }
  l.append(STAT_LABEL[k][0].toUpperCase() + STAT_LABEL[k].slice(1), pair);
  return l;
}));
$('statInputs').replaceChildren(...STAT_KEYS.map(k => {
  const l = document.createElement('label'), i = Object.assign(document.createElement('input'), { id: 'st-' + k, type: 'number', step: k.endsWith('Regen') ? '0.5' : '1', inputMode: 'decimal' });
  if (k === 'attackSpeed') { i.min = '0'; i.max = String(MAX_ATTACK_SPEED); }
  if (k === 'defense') i.min = '0';
  i.addEventListener('input', preview);
  l.append(STAT_LABEL[k][0].toUpperCase() + STAT_LABEL[k].slice(1) + (k === 'attackSpeed' ? ' (%)' : ''), i);
  return l;
}));
function openItem(id: string | null) {
  editing = id; icon = null; idTouched = !!id;
  const d: ItemCatalogMsg[string] = id ? items[id] : { name: '', desc: '', icon: '' };
  $('editTitle').textContent = id ? `Editar: ${d.name}` : 'Novo item';
  $('save').textContent = id ? 'Salvar' : 'Criar item';
  field('name').value = d.name; field('desc').value = d.desc;
  field('id').value = id ?? ''; field('id').readOnly = !!id;
  $('idHint').textContent = id ? 'O id não muda: inventários e o banco guardam o id.' : 'Sai do nome. Depois de criado, nunca muda (o banco guarda o id).';
  field('heal').value = d.heal ? String(d.heal) : ''; field('mana').value = d.mana ? String(d.mana) : '';
  const kind = kindOf(d), g = d.gear ?? d.wear;   // atributos, sorteio e efeito: os mesmos campos nos dois
  document.querySelectorAll<HTMLInputElement>('input[name=kind]').forEach(r => { r.checked = r.value === kind; });
  $<HTMLSelectElement>('like').value = d.gear?.like ?? 'sword';
  $<HTMLSelectElement>('wearSlot').value = d.wear?.slot ?? 'head';
  $<HTMLSelectElement>('like').disabled = !!id && isKind(id);   // os cajados de base são o próprio jeito de ser
  field('damage').value = d.gear?.damage ? String(d.gear.damage) : '';
  for (const k of STAT_KEYS) field('st-' + k).value = g?.stats?.[k] ? String(g.stats[k]) : '';
  field('useColor').checked = !!d.gear?.color; field('color').value = d.gear?.color ?? '#9fb8ff';
  $<HTMLSelectElement>('rarity').value = d.rarity ?? 'common';
  for (const k of STAT_KEYS) { const r = g?.rolls?.[k]; field(`rl-${k}-min`).value = r ? String(r[0]) : ''; field(`rl-${k}-max`).value = r ? String(r[1]) : ''; }
  $<HTMLSelectElement>('effect').value = g?.effect?.kind ?? ''; field('effectValue').value = g?.effect ? String(g.effect.value) : '';
  $('iconError').textContent = ''; $('formErrors').replaceChildren(); $('status').textContent = '';
  field('iconFile').value = '';
  syncKind(); void drawIcon(id ? d.icon : null); preview();
  void loadUses(id);
  renderList();
  if (!id) field('name').focus();
}
const kindNow = () => (document.querySelector<HTMLInputElement>('input[name=kind]:checked')?.value ?? 'material') as Kind;
function syncKind() {
  const k = kindNow(), like = $<HTMLSelectElement>('like').value;
  $('useFields').hidden = k !== 'use'; $('gearFields').hidden = k !== 'gear' && k !== 'wear';
  // vestir usa a mesma caixa: no lugar de "comporta-se como", dano e cor, o espaço onde se veste
  const wear = k === 'wear';
  $('gearLegend').textContent = wear ? 'Vestir' : 'Equipamento';
  $('wearField').hidden = !wear; $('likeField').hidden = wear; $('colorField').hidden = wear;
  $('statsLabel').textContent = wear ? 'Atributos (enquanto estiver vestido)' : 'Atributos (enquanto estiver no A ou no C)';
  $('damageField').hidden = wear || (like !== 'sword' && like !== 'bow');
  if (rules) field('damage').placeholder = String(like === 'bow' ? rules.weapons.arrow : rules.weapons.sword);
  $('damageHint').textContent = like === 'sword' ? 'Vazio: o da espada de base. Giro e dash crescem junto.' : 'Vazio: o do arco de base.';
  field('color').disabled = !field('useColor').checked;
  // raridade: sorteio só até raro; efeito só em épico e lendário (e o efeito precisa combinar com a arma)
  const r = rarityNow(), fixed = r === 'epic' || r === 'legendary';
  $('rollFields').hidden = fixed; $('effectFields').hidden = !fixed;
  for (const o of $<HTMLSelectElement>('effect').options) o.disabled = wear ? !!o.value && !WEAR_EFFECTS.includes(o.value as EffectKind) : (o.value === 'pierce' && like !== 'bow') || (o.value === 'wave' && like !== 'sword');
  if ($<HTMLSelectElement>('effect').selectedOptions[0]?.disabled) $<HTMLSelectElement>('effect').value = '';
  field('effectValue').disabled = !$<HTMLSelectElement>('effect').value;
  $('effectHint').textContent = wear ? 'Vale enquanto estiver vestido, contra monstros. Soma com o da arma.' : 'Muda o jeito de lutar, não só o número. Vale enquanto o item está no A ou no C, contra monstros.';
  $('rarityHint').textContent = r === 'common' ? 'O básico. Equipamento comum às vezes vem com 1 atributo sorteado.'
    : r === 'uncommon' ? 'Verde. Equipamento incomum vem com 1 atributo sorteado.' : r === 'rare' ? 'Azul. Equipamento raro vem com 2 atributos sorteados.'
    : r === 'epic' ? 'Roxo. Fixo (sem sorteio), com um efeito. Achar um é anunciado no chat.'
    : 'Dourado. Fixo e único, com um efeito. Achar um é anunciado no chat. Precisa de um caminho garantido (ver "Onde aparece").';
  $('rarityHint').style.color = RARITY_COLOR[r];
}
const rarityNow = () => $<HTMLSelectElement>('rarity').value as Rarity;
$('rarity').addEventListener('change', () => { syncKind(); preview(); });
['effect', 'effectValue'].forEach(id => $(id).addEventListener('input', () => { syncKind(); preview(); }));
['like', 'wearSlot'].forEach(id => $(id).addEventListener('change', () => { syncKind(); preview(); }));
['damage', 'useColor', 'color'].forEach(id => field(id).addEventListener('input', () => { syncKind(); preview(); }));
document.querySelectorAll('input[name=kind]').forEach(r => r.addEventListener('change', () => { syncKind(); preview(); }));
field('name').addEventListener('input', () => { if (!editing && !idTouched) field('id').value = slug(field('name').value); preview(); });
field('id').addEventListener('input', () => { idTouched = true; field('id').value = field('id').value.toLowerCase().replace(/[^a-z0-9-]/g, ''); });
field('desc').addEventListener('input', preview);
['heal', 'mana'].forEach(id => field(id).addEventListener('input', preview));
function preview() {
  $('pvName').textContent = field('name').value.trim() || 'Nome';
  $('pvName').style.color = RARITY_COLOR[rarityNow()];
  $('pvDesc').textContent = field('desc').value.trim() || 'descrição';
  // equipamento: os números como o jogo mostra no inventário
  calc();
  if (kindNow() === 'wear') {
    const d = wearData(), li = (t: string) => Object.assign(document.createElement('li'), { textContent: t });
    $('pvLines').hidden = false;
    $('pvLines').replaceChildren(li(`Veste em: ${WEAR_NAME[d.slot]}`), ...statLines(d.stats ?? {}).map(li));
    return;
  }
  const g = kindNow() === 'gear' && rules ? gearData() : null;
  $('pvLines').hidden = !g;
  if (!g || !rules) return;
  setItems({ rascunho: { name: '', desc: '', gear: g } });
  $('pvLines').replaceChildren(...gearLines(rules, 'rascunho').map(t => Object.assign(document.createElement('li'), { textContent: t })));
}
// Calculadora: o efeito prático dos números que estão no formulário, a cada tecla.
function calc() {
  const k = kindNow(), num = (id: string) => Number(field(id).value) || 0;
  const draft: ItemDef = { name: '', desc: '', ...(k === 'use' ? { heal: num('heal') || undefined, mana: num('mana') || undefined } : {}), ...(k === 'gear' ? { gear: gearData() } : {}), ...(k === 'wear' ? { wear: wearData() } : {}) };
  const b = rules && k !== 'material' ? balance(rules, draft) : null;
  $('calc').hidden = !b || !b.lines.length;
  if (!b) return;
  $('calcLines').replaceChildren(...b.lines.map(t => Object.assign(document.createElement('li'), { textContent: t })));
  $('calcWarn').replaceChildren(...b.warnings.map(t => Object.assign(document.createElement('li'), { textContent: t })));
}
// O equipamento como está no formulário (só o que foi preenchido).
function gearData(): GearDef {
  const g: GearDef = { like: $<HTMLSelectElement>('like').value as GearKind };
  const dmg = Number(field('damage').value);
  if (dmg > 0 && (g.like === 'sword' || g.like === 'bow')) g.damage = Math.round(dmg);
  if (field('useColor').checked) g.color = field('color').value;
  return Object.assign(g, numbers());
}
// O que se veste como está no formulário.
const wearData = (): WearDef => ({ slot: $<HTMLSelectElement>('wearSlot').value as WearSlot, ...numbers() });
// Atributos, sorteio (até raro) e efeito (épico e lendário): iguais em equipamento e no que se veste.
function numbers() {
  const g: Pick<GearDef, 'stats' | 'rolls' | 'effect'> = {};
  const stats: Partial<Stats> = {};
  for (const k of STAT_KEYS) { const v = Number(field('st-' + k).value); if (v) stats[k] = v; }
  if (Object.keys(stats).length) g.stats = stats;
  const r = rarityNow();
  if (r === 'epic' || r === 'legendary') {
    const kind = $<HTMLSelectElement>('effect').value as EffectKind | '', v = Math.round(Number(field('effectValue').value));
    if (kind && v > 0) g.effect = { kind, value: v };
  } else {
    const rolls: GearDef['rolls'] = {};
    for (const k of STAT_KEYS) {
      const lo = field(`rl-${k}-min`).value.trim(), hi = field(`rl-${k}-max`).value.trim();
      if (lo || hi) rolls[k] = [Number(lo || hi), Number(hi || lo)];
    }
    if (Object.keys(rolls).length) g.rolls = rolls;
  }
  return g;
}

// O ícone grande (16×16 inteiro, com a grade transparente) e o do inventário (sem a borda vazia, como no jogo).
async function drawIcon(src: string | null) {
  const big = $<HTMLCanvasElement>('iconBig'), slot = $<HTMLCanvasElement>('iconSlot');
  const bx = big.getContext('2d')!; bx.clearRect(0, 0, 16, 16);
  if (!src) { slot.width = slot.height = 1; return; }
  const img = await loadImage(src);
  bx.drawImage(img, 0, 0);
  const d = bx.getImageData(0, 0, 16, 16).data;
  let x0 = 16, y0 = 16, x1 = -1, y1 = -1;
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if (d[(j * 16 + i) * 4 + 3]) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
  if (x1 < 0) { slot.width = slot.height = 1; return; }
  slot.width = x1 - x0 + 1; slot.height = y1 - y0 + 1;
  slot.getContext('2d')!.drawImage(big, -x0, -y0);
}
field('iconFile').addEventListener('change', async () => {
  const f = field('iconFile').files?.[0]; $('iconError').textContent = '';
  if (!f) return;
  if (f.type !== 'image/png') { $('iconError').textContent = 'Use um arquivo PNG.'; return; }
  const url = await new Promise<string>(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(f); });
  const img = await loadImage(url).catch(() => null);
  if (!img) { $('iconError').textContent = 'Não consegui abrir essa imagem.'; return; }
  if (img.width !== 16 || img.height !== 16) { $('iconError').textContent = `O ícone precisa ter 16×16 (este tem ${img.width}×${img.height}).`; return; }
  icon = url; void drawIcon(url);
});

/* ---------- Gravar ---------- */
$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const id = editing ?? field('id').value.trim(), kind = kindNow(), errors: string[] = [];
  const num = (k: string) => { const v = field(k).value.trim(); return v ? Number(v) : undefined; };
  const data: Record<string, unknown> = { name: field('name').value.trim(), desc: field('desc').value.trim() };
  if (rarityNow() !== 'common') data.rarity = rarityNow();
  if (kind === 'use') { const heal = num('heal'), mana = num('mana'); if (heal) data.heal = heal; if (mana) data.mana = mana; if (!heal && !mana) errors.push('Consumível precisa de cura ou mana (ou escolha Material).'); }
  if (kind === 'wear') {
    data.wear = wearData();
    const as = (data.wear as WearDef).stats?.attackSpeed ?? 0;
    if (as < 0 || as > MAX_ATTACK_SPEED) errors.push(`Velocidade de ataque: de 0 a ${MAX_ATTACK_SPEED}%.`);
  }
  if (kind === 'gear') {
    data.gear = gearData();
    const as = (data.gear as GearDef).stats?.attackSpeed ?? 0;
    if (as < 0 || as > MAX_ATTACK_SPEED) errors.push(`Velocidade de ataque: de 0 a ${MAX_ATTACK_SPEED}%.`);
  }
  if (!data.name) errors.push('Dê um nome ao item.');
  if (!id) errors.push('O id está vazio.');
  if (!editing && !icon) errors.push('Escolha o ícone (PNG 16×16).');
  if (!editing && items[id]) errors.push(`Já existe um item com o id "${id}".`);
  if (errors.length) { showErrors(errors); return; }
  $('save').toggleAttribute('disabled', true); $('status').textContent = 'Gravando…';
  try {
    await api.request(`/oficina/items/${id}`, editing ? 'PUT' : 'POST', { ...data, ...(icon ? { icon } : {}) });
    $('status').textContent = editing ? 'Salvo. Já está no jogo.' : 'Criado. Já está no jogo.';
    await new Promise(r => setTimeout(r, 500));   // o servidor recarrega a pasta
    await refresh(); openItem(id);
    $('status').textContent = 'Salvo. Já está no jogo.';
  } catch (err) { $('status').textContent = ''; showErrors((err as Error).message.split('\n')); }
  finally { $('save').toggleAttribute('disabled', false); }
});
function showErrors(list: string[]) { $('formErrors').replaceChildren(...list.map(t => Object.assign(document.createElement('li'), { textContent: t }))); }

/* ---------- Onde aparece (lojas e drops no config.yaml; baús no mapa) ---------- */
interface Uses {
  shops: { id: string; npc: string | null; buy?: number; sell?: number }[];
  drops: { enemy: string; name: string; chance?: number; min?: number; max?: number }[];
  chests: { map: string; x: number; y: number; chance: number; min: number; max: number }[];
}
let usesFor: string | null = null;
function numInput(cls: string, value: number | undefined, attrs: Record<string, string>) {
  const i = document.createElement('input');
  i.type = 'number'; i.className = cls; i.value = value === undefined ? '' : String(value); i.inputMode = 'decimal';
  for (const [k, v] of Object.entries(attrs)) i.setAttribute(k === 'ariaLabel' ? 'aria-label' : k, v);
  return i;
}
const cell = (...kids: (Node | string)[]) => { const td = document.createElement('td'); td.append(...kids); return td; };
async function loadUses(id: string | null) {
  usesFor = id; $('uses').hidden = !id; $('usesErrors').replaceChildren(); $('usesStatus').textContent = '';
  if (!id) return;
  const u = await api.request<Uses>(`/oficina/uses/${id}`);
  if (usesFor !== id) return;   // trocou de item enquanto carregava
  $('shopRows').replaceChildren(...u.shops.map(s => {
    const tr = document.createElement('tr'); tr.dataset.shop = s.id;
    tr.append(cell(s.id, ...(s.npc ? [Object.assign(document.createElement('small'), { textContent: s.npc })] : [])),
      cell(numInput('buy', s.buy, { min: '1', max: '99999', ariaLabel: `${s.id}: vende por` })), cell(numInput('sell', s.sell, { min: '1', max: '99999', ariaLabel: `${s.id}: compra por` })));
    return tr;
  }));
  $('dropRows').replaceChildren(...u.drops.map(d => {
    const tr = document.createElement('tr'); tr.dataset.enemy = d.enemy;
    const pct = d.chance === undefined ? undefined : Math.round(d.chance * 1000) / 10;
    tr.append(cell(d.name), cell(numInput('chance', pct, { min: '0.1', max: '100', step: '0.1', ariaLabel: `${d.name}: chance` })),
      cell(numInput('min', d.chance === undefined ? undefined : d.min, { min: '1', max: '99', placeholder: '1', ariaLabel: `${d.name}: mínimo` })),
      cell(numInput('max', d.chance === undefined ? undefined : d.max, { min: '1', max: '99', placeholder: '1', ariaLabel: `${d.name}: máximo` })));
    return tr;
  }));
  $('chestRows').replaceChildren(...(u.chests.length ? u.chests.map(c => Object.assign(document.createElement('li'), {
    textContent: `Mapa ${c.map}, tile x ${c.x}, y ${c.y}: ${Math.round(c.chance * 100)}%${c.max > 1 ? `, ${c.min === c.max ? c.max : `${c.min} a ${c.max}`} unidades` : ''}`
  })) : [Object.assign(document.createElement('li'), { textContent: 'Nenhum baú.' })]));
  // Regra: todo lendário tem um caminho garantido (loja, baú com 100% ou monstro com 100%); a sorte só adianta.
  const sure = u.shops.some(s => s.buy) || u.drops.some(d => d.chance === 1) || u.chests.some(c => c.chance === 1);
  $('legendWarn').hidden = items[id]?.rarity !== 'legendary' || sure;
  $('legendWarn').textContent = 'Lendário sem caminho garantido: ponha numa loja, num monstro com 100% (um chefe, por exemplo) ou num baú com 100% (no Tiled). Quem joga e explora sempre consegue; a sorte só adianta.';
}
$('saveUses').addEventListener('click', async () => {
  const id = usesFor; if (!id) return;
  const v = (tr: Element, cls: string) => { const t = (tr.querySelector('.' + cls) as HTMLInputElement).value.trim(); return t ? Number(t) : null; };
  const body = {
    shops: Object.fromEntries([...$('shopRows').children].map(tr => [(tr as HTMLElement).dataset.shop!, { buy: v(tr, 'buy'), sell: v(tr, 'sell') }])),
    drops: Object.fromEntries([...$('dropRows').children].map(tr => {
      const pct = v(tr, 'chance');
      return [(tr as HTMLElement).dataset.enemy!, pct === null || pct <= 0 ? null : { chance: Math.round(pct * 10) / 1000, min: v(tr, 'min') ?? 1, max: v(tr, 'max') ?? v(tr, 'min') ?? 1 }];
    }))
  };
  $('usesErrors').replaceChildren(); $('usesStatus').textContent = 'Gravando…';
  try {
    await api.request(`/oficina/uses/${id}`, 'PUT', body);
    $('usesStatus').textContent = 'Salvo no config.yaml. Já vale no jogo.';
    await new Promise(r => setTimeout(r, 400)); await loadUses(id);
    $('usesStatus').textContent = 'Salvo no config.yaml. Já vale no jogo.';
  } catch (err) {
    $('usesStatus').textContent = '';
    $('usesErrors').replaceChildren(...(err as Error).message.split('\n').map(t => Object.assign(document.createElement('li'), { textContent: t })));
  }
});

/* ---------- Guia (#guia) ---------- */
// O guia abre por cima de tudo, até sem login. Os links do índice (#g-…) rolam dentro dele.
function route() {
  const h = location.hash, reading = h === '#guia' || h.startsWith('#g-');
  if (reading && !$('guideBody').childElementCount) $('guideBody').innerHTML = renderGuide();
  $('guide').hidden = !reading; document.body.classList.toggle('reading', reading);
  if (h === '#guia') window.scrollTo(0, 0);
  else if (h.startsWith('#g-')) document.getElementById(h.slice(1))?.scrollIntoView();
}
window.addEventListener('hashchange', route);
route();

void start();
