import guideMd from '../../../../docs/GUIA-DA-OFICINA.md?raw';
import tiledMd from '../../../../docs/GUIA-DO-TILED.md?raw';

/* Os guias (docs/GUIA-DA-OFICINA.md e docs/GUIA-DO-TILED.md) dentro da Oficina. Um arquivo só: o que se lê aqui é o que está no repositório.
   Markdown simples (títulos, parágrafos, listas, tabelas, citações, código e negrito), sempre escapado antes. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(https?:\/\/[^\s<)]*[^\s<).,;:])/g, '<a href="$1">$1</a>');   // sem o ponto final da frase
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Cada guia com o seu endereço (#guia, #tiled) e o prefixo dos títulos (#g-…, #t-…), para os índices não se misturarem.
export const GUIDES = { guia: { md: guideMd, p: 'g' }, tiled: { md: tiledMd, p: 't' } } as const;
export function renderGuide(md: string = guideMd, p = 'g') {
  const lines = md.replace(/\r\n/g, '\n').split('\n'), out: string[] = [], toc: string[] = [];
  let i = 0;
  const para: string[] = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para.length = 0; } };
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { flush(); i++; continue; }
    const h = l.match(/^(#{1,3}) (.*)$/);
    if (h) {
      flush();
      const lvl = h[1].length, id = slug(h[2]);
      out.push(`<h${lvl} id="${p}-${id}">${inline(h[2])}</h${lvl}>`);
      if (lvl === 2) toc.push(`<li><a href="#${p}-${id}">${inline(h[2])}</a></li>`);
      i++; continue;
    }
    if (l.startsWith('|')) {   // tabela: cabeçalho, separador, linhas
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) { rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim())); i++; }
      const [head, , ...body] = rows;
      out.push(`<table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    if (l.startsWith('> ')) {
      flush();
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) { q.push(lines[i].replace(/^> ?/, '')); i++; }
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`);
      continue;
    }
    const li = l.match(/^(-|\d+\.) (.*)$/);
    if (li) {
      flush();
      const ordered = li[1] !== '-', items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(-|\d+\.) (.*)$/);
        if (m) { items.push(m[2]); i++; continue; }
        if (/^ {2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++; continue; }   // continuação da linha
        break;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(t => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    para.push(l.trim()); i++;
  }
  flush();
  // o índice entra logo depois da introdução (antes da primeira seção)
  const first = out.findIndex(s => s.startsWith('<h2'));
  out.splice(first, 0, `<nav class="toc" aria-label="Índice"><strong>Neste guia</strong><ul>${toc.join('')}</ul></nav>`);
  return out.join('\n');
}
