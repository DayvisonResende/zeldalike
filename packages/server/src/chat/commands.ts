import { ITEMS, addItem, isItem, type ItemId, type Player, type World } from '@vale/shared';

/* Comandos do chat: começam com "/" e nunca são mostrados aos outros. A resposta vai só para quem digitou.
   Todos: /ajuda, /quem. Administradores (lista "admins" no config.yaml): o resto. */
export interface Found { p: Player; w: World; id: string }
export interface CommandContext {
  admin: boolean;
  me: Found;
  reply(text: string): void;
  online(): Found[];
  find(name: string): Found | null;
  announce(text: string): void;
  kick(id: string, reason: string): void;
  mute(id: string, minutes: number): void;
  unmute(id: string): boolean;
  party(action: 'invite' | 'accept' | 'decline' | 'leave' | 'show', arg: string): void;
  startInvasion(): boolean;
  backup(): Promise<string>;
}

const PUBLIC = ['/ajuda — esta lista', '/quem — quem está online e onde', '/ignorar nome — esconde as mensagens de alguém, só para você (/designorar, /ignorados)',
  '/grupo — quem está no seu grupo', '/convidar nome — chama para o grupo', '/aceitar e /recusar — respondem a um convite', '/sairdogrupo', '/p texto — fala só com o grupo'];
const PARTY = { grupo: 'show', convidar: 'invite', aceitar: 'accept', recusar: 'decline', sairdogrupo: 'leave' } as const;
const ADMIN = [
  '/anunciar texto — aviso para todo o servidor',
  '/expulsar nome [motivo] — tira do servidor (pode voltar)',
  '/silenciar nome [minutos] — sem chat por um tempo (padrão: 10)',
  '/dessilenciar nome',
  '/invasao — começa uma invasão de gelecas agora',
  '/dar [nome] item [quantidade] — sem nome, para você; item pelo nome ou id (coracao, cajado-de-fogo, ouro…)',
  '/backup — cópia do banco agora'
];

// "a b \"c d\"" → ['a', 'b', 'c d']
function args(text: string) { return [...text.matchAll(/"([^"]+)"|(\S+)/g)].map(m => m[1] ?? m[2]); }
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, '-');
// Item pelo id (firestaff) ou pelo nome sem acento, com hífen no lugar do espaço (cajado-de-fogo); "ouro" = ouro.
export function findItem(word: string): ItemId | 'gold' | null {
  const n = norm(word);
  if (n === 'ouro' || n === 'gold') return 'gold';
  if (isItem(n)) return n;
  return (Object.keys(ITEMS) as ItemId[]).find(id => norm(ITEMS[id].name) === n) ?? null;
}
const where = (f: Found) => f.w.map.regionAt(f.p.x, f.p.y)?.name ?? f.w.map.data.name;

export async function runCommand(ctx: CommandContext, text: string) {
  const [raw = '', ...a] = args(text.slice(1));
  const cmd = norm(raw);
  const need = (who: string) => { const f = ctx.find(who); if (!f) ctx.reply(`Ninguém online com o nome "${who}".`); return f; };

  if (cmd === 'ajuda') { ctx.reply('Comandos: ' + [...PUBLIC, ...(ctx.admin ? ADMIN : [])].join(' · ')); return; }
  if (cmd === 'quem') {
    const all = ctx.online();
    ctx.reply(`Online (${all.length}): ` + all.map(f => `${f.p.name} (${where(f)})`).join(', '));
    return;
  }
  if (cmd in PARTY) {
    const action = PARTY[cmd as keyof typeof PARTY];
    if (action === 'invite' && !a[0]) { ctx.reply('Use: /convidar nome'); return; }
    ctx.party(action, a.join(' '));
    return;
  }
  const known = ['anunciar', 'expulsar', 'silenciar', 'dessilenciar', 'invasao', 'dar', 'backup'];
  if (!known.includes(cmd)) { ctx.reply(`Comando desconhecido: /${raw}. /ajuda mostra os comandos.`); return; }
  if (!ctx.admin) { ctx.reply(`Só administradores podem usar /${cmd}.`); return; }

  switch (cmd) {
    case 'anunciar': {
      const msg = text.slice(1).trim().slice(raw.length).trim();
      if (!msg) { ctx.reply('Use: /anunciar texto'); return; }
      ctx.announce(msg); return;
    }
    case 'expulsar': {
      if (!a[0]) { ctx.reply('Use: /expulsar nome [motivo]'); return; }
      const f = need(a[0]); if (!f) return;
      if (f.id === ctx.me.id) { ctx.reply('Você não pode expulsar a si mesmo.'); return; }
      ctx.kick(f.id, a.slice(1).join(' ')); ctx.reply(`${f.p.name} foi expulso.`); return;
    }
    case 'silenciar': {
      if (!a[0]) { ctx.reply('Use: /silenciar nome [minutos]'); return; }
      const f = need(a[0]); if (!f) return;
      const min = a[1] ? Number(a[1]) : 10;
      if (!Number.isFinite(min) || min <= 0 || min > 24 * 60) { ctx.reply('Minutos: de 1 a 1440.'); return; }
      ctx.mute(f.id, min); ctx.reply(`${f.p.name} está sem chat por ${min} min.`); return;
    }
    case 'dessilenciar': {
      if (!a[0]) { ctx.reply('Use: /dessilenciar nome'); return; }
      const f = need(a[0]); if (!f) return;
      ctx.reply(ctx.unmute(f.id) ? `${f.p.name} pode falar de novo.` : `${f.p.name} não estava silenciado.`); return;
    }
    case 'invasao':
      ctx.reply(ctx.startInvasion() ? 'Invasão começando.' : 'Já há uma invasão em andamento (ou a zona do config não existe).'); return;
    case 'dar': {
      // /dar Joel coracao 5 · /dar coracao 5 (para você)
      const named = a.length >= 2 && !findItem(a[0]);   // o primeiro termo não é item: é o nome de quem recebe
      const target = named ? need(a[0]) : ctx.me;
      if (!target) return;
      const rest = named ? a.slice(1) : a;
      const item = rest[0] ? findItem(rest[0]) : null, n = rest[1] ? Math.floor(Number(rest[1])) : 1;
      if (!item) { ctx.reply('Item desconhecido. Use o nome (coracao, cajado-de-fogo…) ou o id (heart, firestaff…).'); return; }
      if (!Number.isFinite(n) || n < 1 || n > 9999) { ctx.reply('Quantidade: de 1 a 9999.'); return; }
      const p = target.p, label = item === 'gold' ? `${n} de ouro` : `${n} ${ITEMS[item].name}`;
      if (item === 'gold') p.gold += n;
      else {
        const left = addItem(p.bag, item, n, target.w.rules.inventory.stack);
        p.bagVersion++;
        if (left) { ctx.reply(`Inventário de ${p.name} cheio: entraram ${n - left} de ${n}.`); return; }
      }
      ctx.reply(`${p.name} recebeu ${label}.`); return;
    }
    case 'backup': {
      try { ctx.reply(`Backup feito: ${await ctx.backup()}`); } catch (e) { ctx.reply(`Backup falhou: ${e instanceof Error ? e.message : e}`); }
      return;
    }
  }
}
