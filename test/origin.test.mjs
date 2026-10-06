import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, isAllowedOrigin } from '../lib/origin.mjs';

test('normaliza barra final, espaços, maiúsculas e porta padrão', () => {
  const allowed = allowedOrigins({ APP_ORIGIN: '  https://CHECKOUT.example:443/  ' });
  assert.ok(isAllowedOrigin('https://checkout.example', allowed));
});
test('permite somente domínios explicitamente configurados', () => {
  const allowed = allowedOrigins({ APP_ORIGIN: 'https://checkout.example', APP_ORIGINS: 'https://www.checkout.example, https://preview.example/' });
  assert.ok(isAllowedOrigin('https://www.checkout.example', allowed));
  assert.ok(isAllowedOrigin('https://preview.example', allowed));
  for (const value of [undefined, 'null', 'https://evil.example', 'https://checkout.example.evil.example', 'http://checkout.example', 'https://checkout.example:444', 'https://user@checkout.example']) assert.equal(isAllowedOrigin(value, allowed), false);
});
test('configuração inválida não abre acesso e localhost é apenas fallback local', () => {
  assert.equal(allowedOrigins({ APP_ORIGIN: 'invalid' }).size, 0);
  assert.ok(isAllowedOrigin('http://localhost:3000', allowedOrigins({})));
  assert.equal(isAllowedOrigin('http://localhost:3000', allowedOrigins({ APP_ORIGIN: 'https://checkout.example' })), false);
});
