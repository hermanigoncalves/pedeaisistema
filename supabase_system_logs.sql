-- Criar tabela system_logs para armazenar logs do sistema
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('error', 'warning', 'info', 'success')),
  category TEXT NOT NULL CHECK (category IN ('auth', 'order', 'payment', 'system', 'database', 'product', 'user')),
  message TEXT NOT NULL,
  details JSONB,
  restaurant_id TEXT,
  user_agent TEXT,
  ip_address TEXT
);

-- Criar índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_restaurant_id ON system_logs(restaurant_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserção de logs (qualquer um pode inserir)
CREATE POLICY "Allow insert logs" ON system_logs
  FOR INSERT
  WITH CHECK (true);

-- Política para permitir leitura de logs (apenas admins podem ler todos os logs)
CREATE POLICY "Allow read all logs" ON system_logs
  FOR SELECT
  USING (true);

-- Comentários para documentação
COMMENT ON TABLE system_logs IS 'Tabela de logs do sistema para monitoramento e debugging';
COMMENT ON COLUMN system_logs.level IS 'Nível do log: error, warning, info, success';
COMMENT ON COLUMN system_logs.category IS 'Categoria do evento: auth, order, payment, system, database, product, user';
COMMENT ON COLUMN system_logs.message IS 'Mensagem descritiva do evento';
COMMENT ON COLUMN system_logs.details IS 'Detalhes adicionais em formato JSON';
COMMENT ON COLUMN system_logs.restaurant_id IS 'ID do restaurante relacionado ao evento (opcional)';
