import { FastifyInstance } from 'fastify';
import { execSync } from 'child_process';

/**
 * Lista as impressoras instaladas no sistema operacional.
 * No Windows usa `wmic printer get Name`.
 * No Linux/Mac usa `lpstat -e`.
 */
function getSystemPrinters(): string[] {
  try {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: wmic retorna cada nome em uma linha
      const raw = execSync('wmic printer get Name /format:list', {
        encoding: 'utf-8',
        timeout: 5000,
      });
      return raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith('Name='))
        .map((l) => l.replace(/^Name=/, '').trim())
        .filter(Boolean);
    }

    if (platform === 'linux' || platform === 'darwin') {
      const raw = execSync('lpstat -e 2>/dev/null || lpstat -a 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      });
      return raw
        .split(/\r?\n/)
        .map((l) => l.split(' ')[0].trim())
        .filter(Boolean);
    }

    return [];
  } catch {
    // Se o comando falhar (ex: wmic não instalado), retorna lista vazia
    return [];
  }
}

export function registerSystemRoutes(app: FastifyInstance) {
  /**
   * GET /api/system/printers
   * Retorna a lista de impressoras instaladas no sistema
   */
  app.get('/api/system/printers', async (_req, reply) => {
    const printers = getSystemPrinters();
    return reply.send({ printers });
  });
}
