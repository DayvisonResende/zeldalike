import { BOW_END, CAST_END, SWING, TICK_RATE } from './constants';
import type { GearDef } from './gear';
import type { ItemDef } from './items';
import type { EnemyType } from './rules';
import { MAX_ATTACK_SPEED, type GearRules } from './systems/stats';
import type { PvpAttack } from './systems/pvp';

/* ---------- Calculadora de equilíbrio (Oficina) ----------
   Enquanto os números de um item são digitados, mostra o efeito prático ("geleca em 1 golpe, Rei em 27") comparado
   com a arma inicial, e avisa o que sair muito do padrão. Só conta: o jogo de verdade tem esquiva, knockback e erro. */
export interface CalcRules extends GearRules {
  enemies: Record<EnemyType, { hp: number }>;
  pvp: { damage: Record<PvpAttack, number>; factor: number };
  player: { maxHp: number; maxMana: number };
}
export interface Balance { lines: string[]; warnings: string[] }

const MONSTERS: [EnemyType, string][] = [['slime', 'Geleca'], ['beetle', 'Besouro'], ['bat', 'Morcego'], ['king', 'Rei Geleca']];
const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const n1 = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
const hits = (hp: number, dmg: number) => dmg > 0 ? Math.ceil(hp / dmg) : Infinity;
const count = (k: number, one: string, many: string) => k === Infinity ? 'nunca' : `${k} ${k === 1 ? one : many}`;

export function balance(r: CalcRules, d: ItemDef): Balance {
  const lines: string[] = [], warnings: string[] = [];
  if (d.heal || d.mana) consumable(r, d, lines, warnings);
  if (d.gear) gear(r, d.gear, lines, warnings);
  return { lines, warnings };
}

function consumable(r: CalcRules, d: ItemDef, lines: string[], warnings: string[]) {
  if (d.heal) {
    lines.push(`Cura ${d.heal}: ${n1(d.heal / 25)} corações (o coração cura 25) · ${Math.round(d.heal / r.player.maxHp * 100)}% da vida de quem começa`);
    if (d.heal >= r.player.maxHp) warnings.push(`Enche a vida inteira de quem começa (${r.player.maxHp}). Vale um preço alto ou ser raro.`);
  }
  if (d.mana) {
    lines.push(`Mana ${d.mana}: ${n1(d.mana / 20)} poções (a poção dá 20) · ${Math.round(d.mana / r.player.maxMana * 100)}% da mana de quem começa`);
    if (d.mana >= r.player.maxMana) warnings.push(`Enche a mana inteira de quem começa (${r.player.maxMana}).`);
  }
}

function gear(r: CalcRules, g: GearDef, lines: string[], warnings: string[]) {
  const s = g.stats ?? {}, atk = s.attack ?? 0, mag = s.magic ?? 0, as = Math.min(MAX_ATTACK_SPEED, s.attackSpeed ?? 0) / 100;
  const perSec = (dmg: number, ticks: number) => dmg * TICK_RATE / (ticks / (1 + as));
  const monsters = (dmg: number, what: string) => lines.push(`${what}: ` + MONSTERS.map(([t, name]) => `${name} ${count(hits(r.enemies[t].hp, dmg), 'golpe', 'golpes').replace(/ golpes?$/, '')}`).join(' · '));
  const kingHits = (dmg: number) => hits(r.enemies.king.hp, dmg);

  if (g.like === 'sword' || g.like === 'bow') {
    const bow = g.like === 'bow', base = bow ? r.weapons.arrow : r.weapons.sword, ticks = bow ? BOW_END : SWING;
    const scale = (g.damage ?? base) / base, dmg = Math.round(base * scale) + atk;
    monsters(dmg, bow ? 'Flechas para derrubar' : 'Golpes para derrubar');
    if (!bow) lines.push(`Giro carregado: ${Math.round(r.weapons.spin * scale) + atk} · dash: ${Math.round(r.weapons.dash * scale) + atk}`);
    const dps = perSec(dmg, ticks), ref = perSec(base, ticks), rel = dps / ref - 1;
    lines.push(`Dano por segundo: ${n1(dps)} (${Math.abs(rel) < 0.005 ? `igual ${bow ? 'ao arco' : 'à espada'}` : `${pct(rel)} que ${bow ? 'o arco' : 'a espada'}`} inicial)`);
    const attack: PvpAttack = bow ? 'arrow' : 'sword', pvp = r.pvp.damage[attack] * scale + atk * r.pvp.factor, pvpBase = r.pvp.damage[attack];
    lines.push(`PvP: derruba quem começa (${r.player.maxHp} de vida) em ${count(hits(r.player.maxHp, pvp), bow ? 'flecha' : 'golpe', bow ? 'flechas' : 'golpes')} (a inicial: ${hits(r.player.maxHp, pvpBase)})`);
    if (rel >= 1) warnings.push(`${n1(rel + 1)}× o dano por segundo ${bow ? 'do arco' : 'da espada'} inicial: o começo do jogo pode ficar fácil demais.`);
    if (kingHits(dmg) <= 10) warnings.push(`Derruba o Rei Geleca em ${kingHits(dmg)} ${bow ? 'flechas' : 'golpes'}: o chefão perde a graça.`);
    if (hits(r.player.maxHp, pvp) <= 2) warnings.push('No PvP derruba alguém em 2 golpes ou menos.');
    if (rel < -0.2) lines.push(`Mais fraca que a inicial: só vale se trouxer outra vantagem (atributos).`);
  } else if (g.like === 'firestaff' || g.like === 'darktome') {
    const fire = g.like === 'firestaff', m = fire ? r.magic.fire : r.magic.shadow, big = fire ? r.magic.blast : r.magic.curse;
    const dmg = m.damage + mag;
    monsters(dmg, fire ? 'Bolas de fogo para derrubar' : 'Sombras para derrubar');
    lines.push(`Segurando: ${fire ? 'explosão' : 'maldição'} ${big.damage + mag} (${big.mana} de mana)`);
    lines.push(`Mana: ${m.mana} por magia · ${Math.floor((r.player.maxMana + (s.mp ?? 0)) / m.mana)} magias com a mana cheia de quem começa`);
    lines.push(`Dano por segundo: ${n1(perSec(dmg, CAST_END))} (o ${fire ? 'cajado' : 'grimório'} de base: ${n1(perSec(m.damage, CAST_END))})`);
    if (kingHits(dmg) <= 10) warnings.push(`Derruba o Rei Geleca em ${kingHits(dmg)} magias.`);
  } else if (g.like === 'hook') {
    lines.push(`Gancho: alcance de 8 tiles; em monstros, ${Math.round(r.weapons.arrow / 2) + atk} de dano e atordoa`);
  } else {
    const h = r.magic.heal, big = r.magic.bigHeal;
    lines.push(`Cura ${h.amount + mag} em você e em quem estiver perto (${h.mana} de mana) · segurando: ${big.amount + mag} (${big.mana})`);
    lines.push(`Curas com a mana cheia de quem começa: ${Math.floor((r.player.maxMana + (s.mp ?? 0)) / h.mana)}`);
    if (h.amount + mag >= r.player.maxHp / 2) warnings.push('Cada cura devolve metade da vida ou mais: o grupo fica difícil de derrubar.');
  }
  if (s.defense) {
    const cut = 1 - 100 / (100 + s.defense), pvpCut = 1 - 100 / (100 + s.defense * r.pvp.factor);
    lines.push(`Defesa ${s.defense}: leva ${Math.round(cut * 100)}% menos dano (no PvP, ${Math.round(pvpCut * 100)}%)`);
    if (s.defense >= 100) warnings.push('Defesa 100 ou mais: leva metade do dano ou menos.');
  }
  if (as >= 0.4) warnings.push(`Velocidade de ataque ${Math.round(as * 100)}%: perto do teto (${MAX_ATTACK_SPEED}%).`);
  if ((s.hp ?? 0) >= 100) warnings.push(`+${s.hp} de vida: dobra a vida de quem começa.`);
  if ((s.hpRegen ?? 0) >= 5 || (s.mpRegen ?? 0) >= 5) warnings.push('Regeneração de 5 por segundo ou mais: quase não precisa de coração nem poção.');
}
