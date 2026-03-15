-- 1. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'revisor', 'visor')),
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Fichas Técnicas
CREATE TABLE IF NOT EXISTS fichas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folio TEXT NOT NULL,
  sifais TEXT NOT NULL,
  concepto TEXT,
  m2 NUMERIC,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  calle TEXT,
  mecanica BOOLEAN DEFAULT false,
  gas BOOLEAN DEFAULT false,
  agua BOOLEAN DEFAULT false,
  drenaje BOOLEAN DEFAULT false,
  alumbrado BOOLEAN DEFAULT false,
  via_ciclista BOOLEAN DEFAULT false,
  zap TEXT,
  origen_recursos TEXT,
  definicion TEXT,
    expediente INTEGER DEFAULT 0,
  topografia BOOLEAN DEFAULT false,
  status_mecanica BOOLEAN DEFAULT false,
  status_gas BOOLEAN DEFAULT false,
  status_agua BOOLEAN DEFAULT false,
  status_drenaje BOOLEAN DEFAULT false,
  status_percent INTEGER DEFAULT 0,
  anio INTEGER, -- Nuevo campo para el año
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Comentarios
CREATE TABLE IF NOT EXISTS comentarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_id UUID REFERENCES fichas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES usuarios(id),
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('aprobacion', 'revision', 'datos_incorrectos')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Insertar usuario administrador por defecto
INSERT INTO usuarios (username, password_hash, role, nombre)
VALUES ('Edgar', 'Semovinfra12', 'admin', 'Administrador')
ON CONFLICT (username) DO NOTHING;

-- 5. Habilitar acceso público a las tablas (Row Level Security)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;

-- 6. Tabla de Archivos PDF (optimizados)
CREATE TABLE IF NOT EXISTS archivos_ficha (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_id UUID REFERENCES fichas(id) ON DELETE CASCADE,
  nombre_original TEXT NOT NULL,
  nombre_optimizado TEXT NOT NULL,
  peso_original BIGINT, -- en bytes
  peso_optimizado BIGINT, -- en bytes
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Añadir columna usuario_id si no existe (para compatibilidad con versiones anteriores)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archivos_ficha' AND column_name = 'usuario_id') THEN
    ALTER TABLE archivos_ficha ADD COLUMN usuario_id UUID REFERENCES usuarios(id);
  END IF;
END $$;

-- Políticas de acceso público (para la clave anon)
CREATE POLICY "Allow all access to usuarios" ON usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to fichas" ON fichas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to comentarios" ON comentarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to archivos_ficha" ON archivos_ficha FOR ALL USING (true) WITH CHECK (true);

-- Políticas de acceso para Supabase Storage (archivos_ficha)
-- NOTA: Estas políticas se aplican a la tabla interna de storage de Supabase
CREATE POLICY "Allow public access to archivos_ficha bucket" ON storage.objects
FOR ALL USING (bucket_id = 'archivos_ficha' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'))
WITH CHECK (bucket_id = 'archivos_ficha' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'));