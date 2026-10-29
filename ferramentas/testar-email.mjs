// Manda um e-mail de teste com as configurações SMTP recebidas por variáveis de ambiente.
// Usado pelo configurar-email.ps1 antes de salvar no .env.
import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS } = process.env;
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

try {
  await transporter.verify();
  await transporter.sendMail({
    from: `Gyde <${SMTP_USER}>`,
    to: SMTP_USER,
    subject: 'Gyde: e-mail configurado ✓',
    text: 'Tudo certo! O Gyde já consegue mandar códigos de confirmação por este e-mail.',
  });
  console.log('OK');
} catch (err) {
  const auth = /Invalid login|Username and Password not accepted|BadCredentials|535/i.test(err.message);
  console.log(auth ? 'ERRO_LOGIN' : `ERRO ${err.code || ''} ${err.message.split('\n')[0]}`);
  process.exit(1);
}
