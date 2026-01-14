-- ============================================
-- AGREGAR CAMPO 'replaced' A LA TABLA ORDERS
-- ============================================
-- Ejecuta esto en tu Supabase SQL Editor si aún no existe el campo
-- ============================================

-- Agregar columna 'replaced' si no existe
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS replaced BOOLEAN DEFAULT false;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_orders_replaced ON orders(replaced);

-- Ver la estructura de la tabla para verificar
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'orders'
-- ORDER BY ordinal_position;
