import type { ChatChannel, ChatMsg, ChatRequest } from '@vale/shared';

const FADE_MS = 10000;   // linhas somem do histórico depois disso (voltam com o chat aberto)
const MAX_LINES = 60;
const CH_LABEL: Record<ChatChannel, string> = { local: 'Perto', global: 'Todos' };

export interface ChatHooks { send(req: ChatRequest): void; closed(): void }

// Histórico no canto e caixa de texto. Enter abre e envia, Esc fecha, Tab troca o canal.
export class ChatBox {
  private log = document.getElementById('chatlog')!;
  private bar = document.getElementById('chatbar') as HTMLFormElement;
  private input = document.getElementById('chatInput') as HTMLInputElement;
  private chBtn = document.getElementById('chatCh') as HTMLButtonElement;
  private ch: ChatChannel = 'local';

  constructor(private hooks: ChatHooks, maxLength = 120) {
    this.input.maxLength = maxLength;
    this.bar.addEventListener('submit', e => { e.preventDefault(); this.send(); });
    this.chBtn.addEventListener('click', () => { this.toggleChannel(); this.input.focus(); });
    this.input.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); this.toggleChannel(); } });
    this.setChannel('local');
  }
  get open() { return !this.bar.hidden; }
  show() {
    this.bar.hidden = false; this.log.classList.add('open');
    this.log.scrollTop = this.log.scrollHeight;
    this.input.focus();
  }
  hide() {
    if (!this.open) return;
    this.bar.hidden = true; this.log.classList.remove('open'); this.input.value = '';
    this.hooks.closed();
  }
  add(m: ChatMsg, mine: boolean) {
    const line = document.createElement('div');
    line.className = 'line ' + m.ch + (mine ? ' mine' : '');
    if (m.ch === 'global') line.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: '[Todos] ' }));
    if (m.name) line.append(Object.assign(document.createElement('b'), { textContent: m.name + ': ' }));
    line.append(document.createTextNode(m.text));   // sempre texto puro: ninguém injeta HTML pelo chat
    this.log.append(line);
    while (this.log.children.length > MAX_LINES) this.log.firstElementChild!.remove();
    if (!this.open || this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 40) this.log.scrollTop = this.log.scrollHeight;
    setTimeout(() => line.classList.add('old'), FADE_MS);
  }
  private send() {
    let text = this.input.value, ch = this.ch;
    const cmd = text.match(/^\/(t|todos|g)\s+/i);   // "/t mensagem" manda para todos
    if (cmd) { text = text.slice(cmd[0].length); ch = 'global'; }
    if (text.trim()) this.hooks.send({ text, ch });
    this.hide();
  }
  private toggleChannel() { this.setChannel(this.ch === 'local' ? 'global' : 'local'); }
  private setChannel(ch: ChatChannel) {
    this.ch = ch;
    this.chBtn.textContent = CH_LABEL[ch]; this.chBtn.dataset.ch = ch;
    this.chBtn.setAttribute('aria-label', `Canal: ${CH_LABEL[ch]} (Tab troca)`);
    this.input.placeholder = ch === 'local' ? 'Falar com quem está perto…' : 'Falar com todo o servidor…';
  }
}
