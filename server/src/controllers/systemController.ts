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

  /**
   * GET /api/system/download-print-agent
   * Retorna os arquivos do Agente de Impressão Windows pré-configurados para um restauranteId.
   */
  app.get('/api/system/download-print-agent', async (request, reply) => {
    const { restauranteId } = request.query as { restauranteId?: string };

    const envContent = `RESTAURANTE_ID=${restauranteId || ''}
SUPABASE_URL=${process.env.SUPABASE_URL || 'https://ipyaxotvhahjyrgnkngu.supabase.co'}
SUPABASE_SERVICE_ROLE_KEY=${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}
`;

    const batContent = `@echo off
title Agente de Impressao PedeAi -- Windows
cls
echo ============================================================
echo      AGENTE DE IMPRESSAO PEDEAI -- SALAO & DELIVERY
echo ============================================================
echo.
if not exist node_modules (
    echo [1/2] Instalando dependencias de impressao...
    call npm install --no-audit --no-fund
)
echo [2/2] Conectando impressora fisica ao PedeAi...
node index.js
pause
`;

    return reply.send({
      success: true,
      restauranteId: restauranteId || null,
      files: {
        '.env': envContent,
        'iniciar-impressora.bat': batContent,
        'package.json': JSON.stringify({
          name: "pedeai-print-agent",
          version: "1.0.0",
          description: "Agente de impressão local para o PedeAí",
          main: "index.js",
          scripts: { start: "node index.js" },
          dependencies: {
            "@supabase/supabase-js": "^2.45.0",
            "dotenv": "^16.4.5",
            "node-thermal-printer": "^4.4.0",
            "ws": "^8.21.0"
          }
        }, null, 2)
      },
      instructions: "Baixe a pasta print-agent, salve o arquivo .env e execute iniciar-impressora.bat no seu PC Windows."
    });
  });
}
