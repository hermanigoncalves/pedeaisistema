import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { supabase } from '../adapters/supabaseAdapter';
import { config } from '../config';

const BCRYPT_ROUNDS = 12;

/**
 * Controller de Autenticação — verifica senhas via bcrypt no servidor.
 * Elimina a comparação de senha em plaintext no frontend.
 */
export function registerAuthRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/login
   * Login do restaurante. Retorna o restauranteId se autenticado.
   */
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email e senha são obrigatórios' });
    }

    try {
      const { data, error } = await supabase.client
        .from('Restaurantes')
        .select('id, email, senha')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error || !data) {
        return reply.code(401).send({ error: 'Email ou senha inválidos' });
      }

      // Suporta tanto bcrypt hash quanto plaintext legado (para migração gradual)
      let isValid = false;
      if (data.senha.startsWith('$2')) {
        // Senha já hasheada com bcrypt
        isValid = await bcrypt.compare(password, data.senha);
      } else {
        // Senha ainda em plaintext — compara e faz hash na hora (migração lazy)
        isValid = data.senha === password;
        if (isValid) {
          const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
          await supabase.client
            .from('Restaurantes')
            .update({ senha: hashed })
            .eq('id', data.id);
          request.log.info({ id: data.id }, '[Auth] Senha migrada para bcrypt no login');
        }
      }

      if (!isValid) {
        return reply.code(401).send({ error: 'Email ou senha inválidos' });
      }

      return reply.code(200).send({ success: true, restauranteId: data.id });
    } catch (err: any) {
      request.log.error(err, '[Auth] Erro no login');
      return reply.code(500).send({ error: 'Erro interno ao realizar login' });
    }
  });

  /**
   * POST /api/auth/verify-password
   * Verifica a senha do restaurante logado (usado pelo PasswordModal).
   */
  app.post('/api/auth/verify-password', async (request, reply) => {
    const { restauranteId, password } = request.body as { restauranteId: string; password: string };

    if (!restauranteId || !password) {
      return reply.code(400).send({ error: 'ID do restaurante e senha são obrigatórios' });
    }

    try {
      const { data, error } = await supabase.client
        .from('Restaurantes')
        .select('id, senha')
        .eq('id', restauranteId)
        .maybeSingle();

      if (error || !data) {
        return reply.code(401).send({ error: 'Restaurante não encontrado' });
      }

      let isValid = false;
      if (data.senha.startsWith('$2')) {
        isValid = await bcrypt.compare(password, data.senha);
      } else {
        isValid = data.senha === password;
        if (isValid) {
          const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
          await supabase.client
            .from('Restaurantes')
            .update({ senha: hashed })
            .eq('id', data.id);
          request.log.info({ id: data.id }, '[Auth] Senha migrada para bcrypt em verify-password');
        }
      }

      if (!isValid) {
        return reply.code(401).send({ error: 'Senha incorreta' });
      }

      return reply.code(200).send({ success: true });
    } catch (err: any) {
      request.log.error(err, '[Auth] Erro ao verificar senha');
      return reply.code(500).send({ error: 'Erro ao verificar senha' });
    }
  });

  /**
   * POST /api/auth/admin-login
   * Login de administrador do sistema.
   */
  app.post('/api/auth/admin-login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email e senha são obrigatórios' });
    }

    try {
      const { data, error } = await supabase.client
        .from('admin_acessos' as any)
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error || !data) {
        return reply.code(401).send({ error: 'Credenciais inválidas' });
      }

      const adminData = data as any;

      // Suporta bcrypt e plaintext legado (migração lazy)
      let isValid = false;
      if (adminData.senha?.startsWith('$2')) {
        isValid = await bcrypt.compare(password, adminData.senha);
      } else {
        isValid = adminData.senha === password;
        if (isValid) {
          const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
          await supabase.client
            .from('admin_acessos' as any)
            .update({ senha: hashed })
            .eq('email', adminData.email);
          request.log.info('[Auth] Senha admin migrada para bcrypt no login');
        }
      }

      if (!isValid) {
        return reply.code(401).send({ error: 'Credenciais inválidas' });
      }

      return reply.code(200).send({ success: true });
    } catch (err: any) {
      request.log.error(err, '[Auth] Erro no admin-login');
      return reply.code(500).send({ error: 'Erro interno ao realizar login' });
    }
  });

  /**
   * POST /api/auth/migrate-passwords
   * Endpoint de migração ONE-SHOT. Faz hash de todas as senhas em plaintext.
   * Protegido por WEBHOOK_SECRET. Chame UMA VEZ após o deploy.
   */
  app.post('/api/auth/migrate-passwords', async (request, reply) => {
    // Proteção extra: só funciona se WEBHOOK_SECRET estiver configurado
    if (!config.WEBHOOK_SECRET) {
      return reply.code(403).send({ error: 'WEBHOOK_SECRET não configurado' });
    }

    try {
      const { data: restaurantes, error } = await supabase.client
        .from('Restaurantes')
        .select('id, senha');

      if (error) throw error;

      let migrated = 0;
      let skipped = 0;

      for (const r of restaurantes || []) {
        if (r.senha?.startsWith('$2')) {
          skipped++;
          continue; // Já hasheada
        }
        if (!r.senha) {
          skipped++;
          continue; // Sem senha, pular
        }

        const hashed = await bcrypt.hash(r.senha, BCRYPT_ROUNDS);
        await supabase.client
          .from('Restaurantes')
          .update({ senha: hashed })
          .eq('id', r.id);
        migrated++;
      }

      request.log.info({ migrated, skipped }, '[Auth] Migração de senhas concluída');
      return reply.send({ success: true, migrated, skipped });
    } catch (err: any) {
      request.log.error(err, '[Auth] Erro na migração');
      return reply.code(500).send({ error: err.message });
    }
  });
}
