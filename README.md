# Checkout — Último Combo Vitalício

Checkout responsivo em Roboto, com Combo de Cursos por **R$ 197,00 no Pix** e adicionais opcionais de **R$ 27,00**, **R$ 67,00** e **R$ 97,00**. Layout e textos baseados nas referências fornecidas. O Pack inclui o Mestres do Pivot; os três adicionais permanecem independentes como na referência.

## Executar

Requer Node.js 22.13 ou superior. Sem dependências externas de execução.

1. Copie `.env.example` para `.env`.
2. Preencha `BLACKCAT_API_KEY` com a chave do painel Black Cat.
3. Gere `CHECKOUT_SECRET` com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. Execute `npm start` (ou `node --env-file-if-exists=.env server.mjs`).
5. Abra `http://localhost:3000`.

Sem credenciais, a página abre normalmente, mas a criação de Pix retorna indisponibilidade, sem simular pagamento.

## Hospedar

Use hospedagem com processo Node.js permanente, HTTPS e disco persistente (VPS, container ou serviço equivalente). Comando inicial: `npm start`. Configure `APP_ORIGIN` com a URL pública exata, sem barra final, `BLACKCAT_API_KEY`, `CHECKOUT_SECRET` e `DATA_DIR` apontando para o volume persistente. `PORT` pode ser fornecida pela plataforma.

**GitHub Pages não executa este servidor.** Este projeto não deve ser colocado diretamente em funções efêmeras/serverless: a prevenção de duplicidade usa arquivos no disco e exige uma única instância com volume persistente. Para múltiplas instâncias, substituir esse controle por banco compartilhado com reserva atômica. O limite de tentativas usa o endereço da conexão; sob proxy, ajustar a infraestrutura para aplicar limites por visitante, sem confiar indiscriminadamente em cabeçalhos enviados pelo cliente.

## Integração Black Cat

Documentação consultada: https://docs.blackcatoficial.com/

- `POST /sales/create-sale` com `X-API-Key` no servidor, valores em centavos, itens digitais e dados do comprador.
- QR Code, copia e cola e validade são exibidos a partir da resposta real.
- `GET /sales/{transactionId}/status` consultado pelo servidor. O navegador recebe token assinado, nunca a chave privada.
- O total é recalculado no servidor a partir de uma lista fixa de produtos. Preços enviados pelo navegador são ignorados.
- CPF/CNPJ, telefone e confirmação de e-mail são validados.
- A mesma tentativa de compra não cria uma segunda cobrança. Reservas e resultados ficam em `DATA_DIR`, sem armazenar nome, e-mail ou documento. Registros são removidos após três dias.
- Se a resposta do gateway for ambígua, a tentativa fica bloqueada para evitar duplicidade; conferir a transação pelo `externalRef` no painel antes de liberar manualmente a reserva. Não há promessa de idempotência do provedor na documentação consultada.
- A sessão de Pix é mantida no navegador para resistir a recarregamento. Tokens de consulta expiram em 48 horas.

## Limites e ativação

O checkout confirma o pagamento consultando o gateway. **Entrega de acesso ao curso, e-mail transacional e automação de matrícula não estão implementados**: dependem da plataforma de cursos e do fluxo de liberação do vendedor. Não há mensagem prometendo entrega automática.

A integração foi verificada com respostas simuladas no formato documentado; uma transação real ainda exige a chave Black Cat e validação na hospedagem. Não publique chaves no GitHub. A arte do produto é exibida a partir do recorte visual do anexo; substitua por arquivo original em alta resolução se disponível. Os textos promocionais reproduzem as referências, inclusive as contagens e descontos apresentados nelas.

## Testes

`npm test` ou `node --test` verifica preços, oito combinações de adicionais, validações, tokens e contrato do gateway com resposta simulada.
