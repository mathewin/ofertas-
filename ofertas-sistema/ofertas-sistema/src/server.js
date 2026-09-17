import express from 'express';
import path from 'node:path';
import config, { PUBLIC_DIR } from './config.js';
import { initDb, getDriver, logEvent } from './db/index.js';
import publicRouter from './api/public.js';
import adminRouter from './api/admin.js';
import { startScheduler, stopScheduler } from './tracker/scheduler.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use('/api/admin', adminRouter);
app.use('/api', publicRouter);

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), db: getDriver().dialect });
});

app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'Rota nao encontrada' });
});

app.use((error, req, res, next) => {
  console.error('[erro]', error);
  if (res.headersSent) return next(error);
  res.status(500).json({ ok: false, error: error.message || 'Erro interno' });
});

async function bootstrap() {
  await initDb();
  await logEvent('system', 'info', `Servidor iniciado (driver: ${getDriver().dialect})`);

  const server = app.listen(config.port, () => {
    console.log(`Sistema de ofertas rodando em http://localhost:${config.port}`);
    console.log(`Site:  http://localhost:${config.port}/`);
    console.log(`Painel: http://localhost:${config.port}/admin`);
  });

  await startScheduler();

  const shutdown = async () => {
    stopScheduler();
    server.close(async () => {
      try {
        await getDriver().close();
      } catch {
        // ignora falhas ao fechar
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar o sistema:', error);
  process.exit(1);
});

export default app;
