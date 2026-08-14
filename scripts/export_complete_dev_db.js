import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ipcawfdvdwcvrcdbegny.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwY2F3ZmR2ZHdjdnJjZGJlZ255Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTQ5Mzc3NiwiZXhwIjoyMTAxMDY5Nzc2fQ.bj7I4qd3vHgmyNpG-o95N46k8MLTy3UnupGoR10yDgg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function inferPgType(key, sampleRow) {
  const val = sampleRow[key];
  if (key === 'id') {
    if (typeof val === 'number') return 'BIGSERIAL PRIMARY KEY';
    return 'UUID PRIMARY KEY DEFAULT uuid_generate_v4()';
  }
  if (key.endsWith('_id') && typeof val === 'string' && val.length === 36) return 'UUID';
  if (typeof val === 'boolean') return 'BOOLEAN';
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return 'INTEGER';
    return 'NUMERIC(10,2)';
  }
  if (typeof val === 'object' && val !== null) return 'JSONB';
  if (typeof val === 'string' && val.includes('T') && val.includes('-') && !isNaN(Date.parse(val))) return 'TIMESTAMPTZ';
  return 'TEXT';
}

function sanitizeMigrationSql(sqlContent) {
  let cleaned = sqlContent;

  // 1. Converter ADD COLUMN sem IF NOT EXISTS para ADD COLUMN IF NOT EXISTS
  cleaned = cleaned.replace(/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/gi, 'ADD COLUMN IF NOT EXISTS ');

  // 2. Envolver ALTER PUBLICATION com tag $pub$
  cleaned = cleaned.replace(/ALTER\s+PUBLICATION\s+([^\s;]+)\s+ADD\s+TABLE\s+([^;]+);/gi, (match, pubName, tableName) => {
    return `DO $pub$ BEGIN\n    ALTER PUBLICATION ${pubName} ADD TABLE ${tableName};\nEXCEPTION WHEN OTHERS THEN NULL;\nEND $pub$;`;
  });

  // 3. Garantir DROP POLICY IF EXISTS antes de qualquer CREATE POLICY
  cleaned = cleaned.replace(
    /(?:DROP\s+POLICY\s+IF\s+EXISTS\s+[^;]+;\s*)?CREATE\s+POLICY\s+("?[^"\r\n]+"|\w+)\s+ON\s+([^\s\r\n]+)/gi,
    (match, policyName, tableName) => {
      return `DROP POLICY IF EXISTS ${policyName} ON ${tableName};\nCREATE POLICY ${policyName} ON ${tableName}`;
    }
  );

  return cleaned;
}

async function exportFullDevDatabase() {
  console.log('⚡ Gerando DDL com ADD COLUMN IF NOT EXISTS automático...');

  const masterTables = ['Restaurantes', 'Produtos', 'Usuários', 'admin_acessos', 'estoque_restaurantes'];
  const allTables = [
    'Restaurantes',
    'Produtos',
    'Usuários',
    'admin_acessos',
    'estoque_restaurantes',
    'Pedidos',
    'mensagens',
    'delivery_persons',
    'delivery_person_stores',
    'delivery_requests',
    'entregador_locations'
  ];

  const tableDataMap = {};
  for (const tableName of allTables) {
    try {
      const { data } = await supabase.from(tableName).select('*').limit(100);
      tableDataMap[tableName] = data || [];
    } catch (e) {
      tableDataMap[tableName] = [];
    }
  }

  // PARTE 1: TABELAS E EXTENSÕES (01_schema_tabelas.sql)
  let sqlPart1 = [];
  sqlPart1.push(`-- PARTE 1: EXTENSÕES E TABELAS BASE (RECRIAÇÃO LIMPA)`);
  sqlPart1.push(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  sqlPart1.push(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n`);

  for (const tableName of allTables) {
    const data = tableDataMap[tableName];
    sqlPart1.push(`-- --- Tabela: ${tableName} ---`);
    sqlPart1.push(`DROP TABLE IF EXISTS public."${tableName}" CASCADE;`);

    if (data && data.length > 0) {
      const allColumnsMap = {};
      for (const row of data) {
        for (const [col, val] of Object.entries(row)) {
          if (!allColumnsMap[col]) {
            allColumnsMap[col] = val;
          }
        }
      }

      const colDefs = [];
      for (const colName of Object.keys(allColumnsMap)) {
        const pgType = inferPgType(colName, allColumnsMap);
        colDefs.push(`    "${colName}" ${pgType}`);
      }

      sqlPart1.push(`CREATE TABLE public."${tableName}" (\n${colDefs.join(',\n')}\n);\n`);
    } else {
      sqlPart1.push(`CREATE TABLE public."${tableName}" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now()
);\n`);
    }

    if (tableName === 'Restaurantes') {
      sqlPart1.push(`CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurantes_email ON public."Restaurantes"(email);\n`);
    }
  }

  // PARTE 2: TRIGGERS, FUNÇÕES E RLS (02_triggers_rls.sql)
  let sqlPart2 = [];
  sqlPart2.push(`-- PARTE 2: MIGRATIONS, TRIGGERS, FUNÇÕES E RLS (IDEMPOTENTE)`);
  sqlPart2.push(`CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurantes_email ON public."Restaurantes"(email);\n`);

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      let content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      content = sanitizeMigrationSql(content);
      sqlPart2.push(`-- Migração: ${file}`);
      sqlPart2.push(content.trim());
      sqlPart2.push('\n');
    }
  }

  // PARTE 3: DADOS CADASTRAIS (03_dados_iniciais.sql)
  let sqlPart3 = [];
  sqlPart3.push(`-- PARTE 3: CARGA DE DADOS CADASTRAIS`);

  for (const tableName of masterTables) {
    const data = tableDataMap[tableName] || [];
    if (data.length > 0) {
      sqlPart3.push(`-- Tabela: ${tableName} (${data.length} linhas)`);
      for (const row of data) {
        const keys = Object.keys(row).map(k => `"${k}"`).join(', ');
        const vals = Object.values(row).map(v => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'boolean') return v ? 'true' : 'false';
          if (typeof v === 'number') return v;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');

        sqlPart3.push(`INSERT INTO public."${tableName}" (${keys}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
      }
      sqlPart3.push('\n');
    }
  }

  // Gravar arquivos modulares
  const filesToSave = [
    { name: '01_schema_tabelas.sql', content: sqlPart1.join('\n') },
    { name: '02_triggers_rls.sql', content: sqlPart2.join('\n') },
    { name: '03_dados_iniciais.sql', content: sqlPart3.join('\n') },
    { name: 'schema_dev_full.sql', content: [sqlPart1.join('\n'), sqlPart2.join('\n'), sqlPart3.join('\n')].join('\n\n') }
  ];

  const mainDir = process.cwd();
  const backendDir = path.join(process.cwd(), '..', 'backenddelivery');

  for (const f of filesToSave) {
    fs.writeFileSync(path.join(mainDir, f.name), f.content, 'utf-8');
    if (fs.existsSync(backendDir)) {
      fs.writeFileSync(path.join(backendDir, f.name), f.content, 'utf-8');
    }
  }

  console.log('✅ 02_triggers_rls.sql atualizado com ADD COLUMN IF NOT EXISTS!');
}

exportFullDevDatabase();
