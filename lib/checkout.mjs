import { createHmac, timingSafeEqual } from 'node:crypto';

export const catalog = Object.freeze({
  combo: { title: 'Combo de Cursos do Josivaldo Santos', unitPrice: 19700 },
  pivot: { title: 'Desafio Mestres do Pivot', unitPrice: 2700 },
  pack: { title: 'Pack de Desafios (7 extras)', unitPrice: 6700 },
  bnc: { title: 'Batera na Cabeça 4.0', unitPrice: 9700 }
});
export class CheckoutError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const digits = value => String(value ?? '').replace(/\D/g, '');
export function validDocument(value) {
  const n = digits(value);
  if (![11, 14].includes(n.length) || /^(\d)\1+$/.test(n)) return false;
  const check = (part, weights) => {
    const remainder = [...part].reduce((s, d, i) => s + Number(d) * weights[i], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const weights = n.length === 11 ? [[10,9,8,7,6,5,4,3,2],[11,10,9,8,7,6,5,4,3,2]] : [[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]];
  return weights.every((w, i) => check(n.slice(0, n.length - 2 + i), w) === Number(n[n.length - 2 + i]));
}
export function buildSale(input) {
  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const phone = digits(input.phone);
  const document = digits(input.document);
  if (name.length < 3 || name.length > 120 || !name.includes(' ')) throw new CheckoutError('Informe seu nome completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new CheckoutError('Informe um e-mail válido.');
  if (email !== String(input.confirmEmail ?? '').trim().toLowerCase()) throw new CheckoutError('Os e-mails precisam ser iguais.');
  if (!/^[1-9]{2}\d{8,9}$/.test(phone)) throw new CheckoutError('Informe seu celular com DDD.');
  if (!validDocument(document)) throw new CheckoutError('Informe um CPF ou CNPJ válido.');
  if (!Array.isArray(input.offers) || input.offers.length > 3 || input.offers.some(id => !['pivot','pack','bnc'].includes(id))) throw new CheckoutError('Seleção de ofertas inválida.');
  const items = ['combo', ...new Set(input.offers)].map(id => ({ ...catalog[id], quantity: 1, tangible: false }));
  const sale = { amount: items.reduce((total, item) => total + item.unitPrice, 0), currency: 'BRL', paymentMethod: 'pix', items, customer: { name, email, phone, document: { number: document, type: document.length === 11 ? 'cpf' : 'cnpj' } }, pix: { expiresInDays: 1 } };
  for (const field of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) {
    if (typeof input[field] === 'string') sale[field] = input[field].slice(0, 200);
  }
  return sale;
}
export function signToken(transactionId, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ transactionId, expires: now + 48 * 3600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function readToken(token, secret, now = Date.now()) {
  try {
    const [payload, signature, extra] = String(token).split('.');
    if (extra || !payload || !signature) throw new Error();
    const expected = createHmac('sha256', secret).update(payload).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error();
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.expires < now || typeof data.transactionId !== 'string') throw new Error();
    return data.transactionId;
  } catch { throw new CheckoutError('Sessão de pagamento inválida ou expirada.', 401); }
}
export async function blackcat(path, apiKey, body, request = fetch) {
  const response = await request(`https://api.blackcatoficial.com/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000) });
  const result = await response.json();
  if (!response.ok || !result.success || !result.data) throw new CheckoutError('Não foi possível concluir a solicitação com o banco. Tente novamente em instantes.', 502);
  return result.data;
}
