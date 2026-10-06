import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSale, validDocument, signToken, readToken, blackcat } from '../lib/checkout.mjs';

const customer = { name: 'Cliente de Teste', email: 'teste@example.com', confirmEmail: 'teste@example.com', phone: '11999999999', document: '52998224725', offers: [] };
test('preço base e todas as oito combinações são calculados no servidor', () => {
  for (let mask = 0; mask < 8; mask++) {
    const offers = ['pivot','pack','bnc'].filter((_,i) => mask & (1 << i));
    const sale = buildSale({ ...customer, offers, amount: 1 });
    assert.equal(sale.amount, 19700 + offers.reduce((sum,id) => sum + ({ pivot:2700, pack:6700, bnc:9700 })[id],0));
    assert.equal(sale.items.reduce((sum,item) => sum + item.unitPrice * item.quantity,0),sale.amount);
  }
});
test('ofertas duplicadas não duplicam a cobrança e produtos desconhecidos são rejeitados', () => {
  assert.equal(buildSale({ ...customer, offers:['pivot','pivot'] }).amount,22400);
  assert.throws(() => buildSale({ ...customer, offers:['invalid'] }));
});
test('valida CPF, CNPJ, telefone e confirmação de e-mail', () => {
  assert.ok(validDocument('529.982.247-25')); assert.ok(validDocument('11.222.333/0001-81'));
  for (const n of ['11111111111','12345678900','11222333000180','']) assert.equal(validDocument(n),false);
  assert.throws(() => buildSale({ ...customer, phone:'123' }));
  assert.throws(() => buildSale({ ...customer, confirmEmail:'diferente@example.com' }));
});
test('token restringe consulta e rejeita adulteração e expiração', () => {
  const secret = 'test-secret-with-at-least-32-characters';
  const token = signToken('TXN-test',secret,1000);
  assert.equal(readToken(token,secret,2000),'TXN-test');
  assert.throws(() => readToken(token + 'x',secret,2000));
  assert.throws(() => readToken(token,secret,200000000));
  assert.throws(() => readToken(token,'other-secret',2000));
});
test('contrato Black Cat usa autenticação e parâmetros documentados', async () => {
  const sale = buildSale(customer);
  const data = await blackcat('/sales/create-sale','test-key',sale,async (url,options) => {
    assert.equal(url,'https://api.blackcatoficial.com/api/sales/create-sale');
    assert.equal(options.headers['X-API-Key'],'test-key');
    assert.equal(JSON.parse(options.body).amount,19700);
    return { ok:true, json:async () => ({ success:true,data:{ transactionId:'TXN-test',paymentData:{ copyPaste:'test' } } }) };
  });
  assert.equal(data.transactionId,'TXN-test');
  await assert.rejects(blackcat('/sales/create-sale','key',sale,async () => ({ ok:false,json:async () => ({ success:false,message:'private gateway error' }) })),/Não foi possível/);
});
