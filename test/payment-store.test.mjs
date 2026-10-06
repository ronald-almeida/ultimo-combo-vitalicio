import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPaymentStore } from '../lib/payment-store.mjs';

test('armazenamento temporário reserva e recupera Pix sem banco de dados', async () => {
  const directory = await mkdtemp(join(tmpdir(),'checkout-test-'));
  try {
    const store = createPaymentStore({directory});
    assert.equal(await store.reserve('id','hash'),null);
    assert.deepEqual(await store.reserve('id','hash'),{hash:'hash',pending:true});
    const result = {token:'test',amount:19700};
    await store.save('id','hash',result);
    assert.deepEqual(await store.reserve('id','hash'),{hash:'hash',result});
  } finally { await rm(directory,{recursive:true,force:true}); }
});
