import http from 'node:http';
import { readFile, mkdir, writeFile, readdir, stat, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildSale, signToken, readToken, blackcat, CheckoutError } from './lib/checkout.mjs';
import { allowedOrigins, isAllowedOrigin } from './lib/origin.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.DATA_DIR || resolve(root, 'data'));
const apiKey = process.env.BLACKCAT_API_KEY;
const secret = process.env.CHECKOUT_SECRET;
const port = Number(process.env.PORT || 3000);
const origins = allowedOrigins();
const staticFiles = { '/': ['index.html','text/html; charset=utf-8'], '/style.css': ['style.css','text/css; charset=utf-8'], '/app.js': ['app.js','text/javascript; charset=utf-8'], '/favicon.svg': ['favicon.svg','image/svg+xml'], '/product-reference.png': ['product-reference.png','image/png'] };
const rateLimits = new Map();
staticFiles['/banner-pix.png'] = ['banner-pix.png','image/png'];
const cleanup = setInterval(async () => {
  for (const [key, value] of rateLimits) if (value.reset < Date.now()) rateLimits.delete(key);
  try { for (const name of await readdir(dataDir)) if (/^[a-f\d]{64}\.json$/.test(name) && (await stat(resolve(dataDir,name))).mtimeMs < Date.now() - 3 * 86400000) await unlink(resolve(dataDir,name)); } catch { /* Directory may not exist before the first payment. */ }
}, 60000);
cleanup.unref();

function send(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function configured() { if (!apiKey || !secret || secret.length < 32) throw new CheckoutError('O pagamento está temporariamente indisponível. Tente novamente mais tarde.', 503); }
async function parseBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new CheckoutError('Formato de solicitação inválido.',415);
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 12000) throw new CheckoutError('Solicitação muito grande.',413); }
  try { return JSON.parse(raw); } catch { throw new CheckoutError('Solicitação inválida.'); }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && staticFiles[url.pathname]) {
      const [file,type] = staticFiles[url.pathname];
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      return res.end(await readFile(resolve(root,'public',file)));
    }
    if (url.pathname === '/api/checkout' && req.method === 'POST') {
      configured();
      if (!isAllowedOrigin(req.headers.origin, origins)) throw new CheckoutError('Origem de solicitação inválida. O endereço deste checkout precisa estar autorizado na configuração do site.',403);
      const ip = req.socket.remoteAddress;
      const rate = rateLimits.get(ip) || { count: 0, reset: Date.now() + 60000 };
      if (rate.reset < Date.now()) { rate.count = 0; rate.reset = Date.now() + 60000; }
      rate.count++; rateLimits.set(ip,rate);
      if (rate.count > 10) throw new CheckoutError('Muitas tentativas. Aguarde um minuto.',429);
      const input = await parseBody(req);
      if (!input || typeof input !== 'object') throw new CheckoutError('Solicitação inválida.');
      if (!/^[a-f\d-]{36}$/i.test(input.requestId ?? '')) throw new CheckoutError('Identificador de compra inválido.');
      const sale = buildSale(input);
      sale.externalRef = input.requestId;
      const hash = createHash('sha256').update(JSON.stringify(sale)).digest('hex');
      const filename = resolve(dataDir, `${createHash('sha256').update(input.requestId).digest('hex')}.json`);
      await mkdir(dataDir, { recursive: true });
      try { await writeFile(filename, JSON.stringify({ hash, pending: true }), { flag: 'wx', mode: 0o600 }); }
      catch (err) {
        if (err.code !== 'EEXIST') throw err;
        let previous;
        try { previous = JSON.parse(await readFile(filename,'utf8')); } catch { throw new CheckoutError('Pagamento em processamento. Aguarde antes de tentar novamente.',409); }
        if (previous.hash !== hash) throw new CheckoutError('Essa tentativa já está vinculada a outro pedido.',409);
        if (previous.result) return send(res,200,previous.result);
        throw new CheckoutError('Sua solicitação está em análise. Para evitar uma cobrança duplicada, confirme a situação com o vendedor antes de iniciar outra compra.',409);
      }
      // A failed or ambiguous request remains reserved; the gateway does not document idempotency.
      const data = await blackcat('/sales/create-sale',apiKey,sale);
      if (!data.transactionId || !data.paymentData?.copyPaste && !data.paymentData?.qrCode) throw new CheckoutError('O banco não retornou os dados do Pix. Confirme a situação com o vendedor antes de tentar outra compra.',502);
      const result = { token: signToken(data.transactionId,secret), amount: sale.amount, status: data.status, paymentData: { copyPaste: data.paymentData.copyPaste || data.paymentData.qrCode, qrCodeBase64: data.paymentData.qrCodeBase64 || null, expiresAt: data.paymentData.expiresAt || null } };
      await writeFile(filename,JSON.stringify({ hash, result }), { mode: 0o600 });
      return send(res,201,result);
    }
    if (url.pathname === '/api/status' && req.method === 'GET') {
      configured();
      const transactionId = readToken(req.headers.authorization?.replace(/^Bearer /,''),secret);
      const data = await blackcat(`/sales/${encodeURIComponent(transactionId)}/status`,apiKey);
      return send(res,200,{ status: data.status });
    }
    send(res,404,{ error: 'Página não encontrada.' });
  } catch (err) {
    // Never log customer information, API keys, or gateway response bodies.
    const status = err instanceof CheckoutError ? err.status : 500;
    if (status >= 500) console.error(`Checkout request failed (${status}, ${err.name}).`);
    send(res,status,{ error: err instanceof CheckoutError ? err.message : 'Não foi possível concluir a solicitação. Verifique sua conexão e tente novamente.' });
  }
});
server.requestTimeout = 35000;
server.listen(port, () => console.log(`Checkout: http://localhost:${port}${apiKey && secret ? '' : ' (configure as credenciais para habilitar Pix)'}`));
