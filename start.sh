#!/bin/bash
# Script para reiniciar el bot automáticamente si falla

MAX_RETRIES=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "🚀 Intento de inicio #$((RETRY_COUNT + 1))"
    node index.js
    
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        echo "✅ Bot finalizado correctamente"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "❌ Bot falló con código $EXIT_CODE"
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "⏳ Esperando 10 segundos antes de reintentar..."
            sleep 10
        fi
    fi
done

if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Bot falló después de $MAX_RETRIES intentos"
    exit 1
fi
