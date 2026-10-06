# Vercel — sem banco de dados

Use o preset Node.js e as variáveis `BLACKCAT_API_KEY`, `CHECKOUT_SECRET` e `APP_ORIGIN=https://ultimo-combo-vitalicio.vercel.app`. Faça um novo deploy após alterar as variáveis.

Na Vercel, as tentativas são guardadas no diretório temporário do sistema, nunca na pasta somente leitura do projeto. Não é necessário configurar DATA_DIR, Redis ou banco de dados. A liberação do acesso aos cursos é manual.

O navegador preserva o Pix na sessão e o servidor reaproveita uma tentativa quando ela ainda existe na mesma instância. **Esse armazenamento é temporário e não é compartilhado entre instâncias: não garante deduplicação após reinícios ou troca de instância.** O externalRef é enviado à Black Cat, mas sua documentação não garante idempotência por esse campo. Antes de repetir uma tentativa com resposta incerta, confira a transação no painel da Black Cat.

Os campos no celular usam fonte de 16px para evitar zoom automático de foco sem impedir o zoom manual de acessibilidade. Erros do servidor registram a etapa e o código técnico, sem incluir credenciais ou dados pessoais.
