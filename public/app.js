const form = document.querySelector('#checkout-form');
const error = document.querySelector('#form-error');
const buy = document.querySelector('#buy');
const screen = document.querySelector('#pix-screen');
const money = value => (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const prices = { pivot: 2700, pack: 6700, bnc: 9700 };
let payment = null;
let timer;
let checking = false;
let requestId;
try { requestId = sessionStorage.getItem('checkout-request') || crypto.randomUUID(); sessionStorage.setItem('checkout-request',requestId); } catch { requestId = crypto.randomUUID(); }
const selected = () => [...form.querySelectorAll('[name=offers]:checked')].map(input => input.value);
function updateTotal() { const total = 19700 + selected().reduce((sum,id) => sum + prices[id],0); document.querySelectorAll('[data-total]').forEach(node => node.textContent = money(total)); }
form.querySelectorAll('[name=offers]').forEach(input => input.addEventListener('change',updateTotal));
function showError(message, input) { error.textContent = message; error.hidden = false; if (input) { input.setAttribute('aria-invalid','true'); input.focus(); } }
form.addEventListener('input',event => event.target.removeAttribute('aria-invalid'));
document.querySelector('#phone').addEventListener('input',event => { const value = event.target.value.replace(/\D/g,'').slice(0,11); event.target.value = value.length > 6 ? `(${value.slice(0,2)}) ${value.slice(2,value.length - 4)}-${value.slice(-4)}` : value; });
document.querySelector('#document').addEventListener('input',event => { const n = event.target.value.replace(/\D/g,'').slice(0,14); event.target.value = n.length <= 11 ? n.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})(\d{1,2})$/,'$1-$2') : n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/,'$1.$2.$3/$4-$5'); });
form.addEventListener('submit', async event => {
  event.preventDefault(); error.hidden = true;
  for (const input of form.querySelectorAll('input[required]')) {
    if (!input.checkValidity()) return showError(input.type === 'email' ? 'Informe um e-mail válido.' : 'Preencha este campo para continuar.',input);
  }
  if (form.elements.email.value.trim().toLowerCase() !== form.elements.confirmEmail.value.trim().toLowerCase()) return showError('Os e-mails precisam ser iguais.',form.elements.confirmEmail);
  buy.disabled = true; buy.textContent = 'GERANDO SEU PIX…';
  try {
    const body = { ...Object.fromEntries(new FormData(form)), offers: selected(), requestId };
    const params = new URLSearchParams(location.search);
    for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) if (params.has(key)) body[key] = params.get(key);
    const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(55000) });
    let data;
    try { data = await response.json(); }
    catch { throw new Error('O serviço de pagamento está temporariamente indisponível. Aguarde e tente novamente.'); }
    if (!response.ok) throw new Error(data.error || 'Não foi possível gerar o Pix.');
    payment = data;
    try { sessionStorage.setItem('checkout-payment',JSON.stringify(data)); } catch { /* Payment remains usable without browser storage. */ }
    renderPayment();
  } catch (err) { showError(err.name === 'TimeoutError' || err instanceof TypeError ? 'Não foi possível confirmar a resposta. Antes de tentar novamente, confira com o vendedor se o Pix foi gerado.' : err.message); }
  finally { buy.disabled = false; buy.innerHTML = 'COMPRAR AGORA <span aria-hidden="true">✓</span>'; }
});
function renderPayment() {
  form.hidden = true; screen.hidden = false;
  document.querySelector('#pix-amount').textContent = money(payment.amount);
  document.querySelector('#pix-code').value = payment.paymentData.copyPaste;
  const qr = document.querySelector('#qr-image');
  let image = payment.paymentData.qrCodeBase64;
  if (image && /^[A-Za-z0-9+/=\s]+$/.test(image)) image = 'data:image/png;base64,' + image;
  if (image && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/.test(image)) { qr.src = image; qr.hidden = false; }
  const expires = new Date(payment.paymentData.expiresAt);
  document.querySelector('#expires').textContent = payment.paymentData.expiresAt && Number.isFinite(expires.getTime()) ? `Válido até ${expires.toLocaleString('pt-BR')}.` : '';
  screen.focus(); screen.scrollIntoView({ behavior: 'smooth', block: 'start' });
  clearInterval(timer); timer = setInterval(checkStatus,8000); checkStatus();
}
async function checkStatus() {
  if (!payment || checking) return;
  checking = true;
  try {
    const response = await fetch('/api/status',{ headers: { Authorization: `Bearer ${payment.token}` }, signal: AbortSignal.timeout(28000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const status = String(data.status).toUpperCase();
    const label = document.querySelector('#payment-status');
    label.textContent = status === 'PAID' ? 'Pagamento confirmado! Sua compra foi aprovada.' : status === 'CANCELLED' ? 'Este Pix foi cancelado ou expirou.' : status === 'REFUNDED' ? 'O pagamento foi estornado.' : 'Aguardando pagamento…';
    if (['PAID','CANCELLED','REFUNDED'].includes(status)) {
      clearInterval(timer);
      document.querySelector('#copy').hidden = true; document.querySelector('#qr-image').hidden = true;
      document.querySelector('#pix-code').hidden = true; document.querySelector('label[for=pix-code]').hidden = true;
      document.querySelector('#check-status').hidden = true;
      document.querySelector('#pix-title').textContent = status === 'PAID' ? 'Compra aprovada!' : 'Situação do pagamento';
      screen.querySelector('p').textContent = status === 'PAID' ? 'O pagamento do seu Combo de Cursos foi recebido.' : 'Confira abaixo a situação da sua compra.';
      document.querySelector('#new-order').hidden = status !== 'CANCELLED';
    }
  } catch { document.querySelector('#payment-status').textContent = 'Não foi possível atualizar o status. Use “Verificar pagamento” em instantes.'; }
  finally { checking = false; }
}
document.querySelector('#check-status').addEventListener('click',checkStatus);
document.querySelector('#copy').addEventListener('click',async () => {
  try { await navigator.clipboard.writeText(payment.paymentData.copyPaste); document.querySelector('#copy-status').textContent = 'Código copiado! Agora cole no aplicativo do seu banco.'; }
  catch { document.querySelector('#pix-code').focus(); document.querySelector('#pix-code').select(); document.querySelector('#copy-status').textContent = 'Selecione e copie o código acima.'; }
});
document.querySelector('#new-order').addEventListener('click',() => { try { sessionStorage.removeItem('checkout-payment'); sessionStorage.removeItem('checkout-request'); } catch {} location.reload(); });
try { const saved = JSON.parse(sessionStorage.getItem('checkout-payment')); if (saved?.token && saved?.paymentData?.copyPaste) { payment = saved; renderPayment(); } } catch { /* No saved payment. */ }

