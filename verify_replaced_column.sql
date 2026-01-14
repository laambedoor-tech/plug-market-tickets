-- ============================================
-- VERIFICAR Y CREAR COLUMNA 'replaced' EN ORDERS
-- ============================================
-- Ejecuta esto en Supabase SQL Editor
-- ============================================

-- Verificar si la columna existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'replaced';

-- Si NO existe, créala:
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS replaced BOOLEAN DEFAULT false;

-- Actualizar todas las órdenes existentes a false (por defecto)
UPDATE orders SET replaced = false WHERE replaced IS NULL;

-- Verificar que se creó correctamente
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'replaced';

-- Ver algunas órdenes de ejemplo
SELECT id, short_id, replaced 
FROM orders 
LIMIT 10;
