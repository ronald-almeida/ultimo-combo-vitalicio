import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CheckoutError } from './checkout.mjs';

// Best-effort deduplication in this instance only. No database is required.
// Vercel's temporary directory is writable but is not durable or shared.
export function createPaymentStore({ directory } = {}) {
  const file = id => resolve(directory, `${createHash('sha256').update(id).digest('hex')}.json`);
  return {
    async reserve(id, hash) {
      await mkdir(directory, { recursive: true });
      try { await writeFile(file(id), JSON.stringify({ hash, pending: true }), { flag: 'wx', mode: 0o600 }); return null; }
      catch (err) {
        if (err.code !== 'EEXIST') throw err;
        try { return JSON.parse(await readFile(file(id), 'utf8')); }
        catch { throw new CheckoutError('Pagamento em processamento. Aguarde antes de tentar novamente.',409); }
      }
    },
    async save(id, hash, result) {
      await writeFile(file(id), JSON.stringify({ hash, result }), { mode: 0o600 });
    }
  };
}
