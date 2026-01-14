# 🔒 URGENTE: GUÍA DE SEGURIDAD - TOKEN EXPUESTO

## ⚠️ ¿Qué pasó?

Discord detectó que tu token de bot se publicó en GitHub. El token antiguo **YA NO SIRVE** y necesitas generar uno nuevo.

---

## ✅ PASOS A SEGUIR (EN ORDEN):

### 1️⃣ OBTENER NUEVO TOKEN DE DISCORD

1. Ve a: https://discord.com/developers/applications/1434540590619562014/bot
2. En la sección "TOKEN", haz clic en **"Reset Token"** (Resetear Token)
3. **COPIA EL TOKEN** y guárdalo temporalmente (desaparecerá después)

---

### 2️⃣ CONFIGURAR VARIABLES EN RENDER

1. Ve a tu dashboard de Render: https://dashboard.render.com
2. Selecciona tu servicio del bot "plugbottickets"
3. Ve a **"Environment"** en el menú izquierdo
4. Haz clic en **"Add Environment Variable"**
5. Agrega TODAS estas variables (una por una):

```
Variable: DISCORD_TOKEN
Value: [PEGA_AQUÍ_EL_NUEVO_TOKEN_QUE_COPIASTE]

Variable: CLIENT_ID
Value: 1434540590619562014

Variable: GUILD_ID
Value: 1434533421266505778

Variable: TICKETS_CATEGORY
Value: 1434536298143813773

Variable: SUPPORT_ROLE
Value: 1434537778674143287

Variable: ADMIN_ROLE
Value: 1434537186140754043

Variable: TICKET_PANEL_CHANNEL
Value: 1434536298143813773

Variable: REVIEW_CHANNEL
Value: 1458586114989228135

Variable: SUPABASE_URL
Value: https://twewcjgphqunpjchwliv.supabase.co

Variable: SUPABASE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3ZXdjamdwaHF1bnBqY2h3bGl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNjQwNDksImV4cCI6MjA3Nzk0MDA0OX0.GTIQg6CRy9h1RZElisKFWG-3Cqup2KqrDxxSwLk105s

Variable: SUPABASE_TABLE
Value: orders

Variable: CREDENTIALS_TABLE
Value: credentials

Variable: NODE_ENV
Value: production
```

6. Haz clic en **"Save Changes"** (Guardar Cambios)

---

### 3️⃣ REDEPLOY EN RENDER

1. Después de guardar las variables, Render preguntará si quieres hacer redeploy
2. Haz clic en **"Manual Deploy"** → **"Deploy latest commit"**
3. Espera a que termine el despliegue (3-5 minutos)

---

### 4️⃣ VERIFICAR QUE FUNCIONA

1. Ve a tu servidor de Discord
2. Verifica que el bot esté **ONLINE** (con el punto verde)
3. Prueba un comando: `/ticket panel` o `/replace`

---

## 🛡️ ¿Qué arreglamos?

✅ **config-production.js** ya NO tiene tokens hardcodeados  
✅ **config.json** está en `.gitignore` (no se sube a GitHub)  
✅ **config-production.js** está en `.gitignore`  
✅ Todos los valores sensibles ahora están en **variables de entorno**  
✅ Los cambios ya están en GitHub

---

## ⚠️ IMPORTANTE PARA EL FUTURO

- **NUNCA** pongas tokens directamente en el código
- Siempre usa variables de entorno (`process.env.NOMBRE`)
- El archivo `config.json` es solo para desarrollo LOCAL
- En producción (Render), todo se maneja con variables de entorno

---

## ❓ Si el bot NO funciona después del deploy:

1. Ve a Render → Logs
2. Busca errores relacionados con "token" o "login"
3. Verifica que hayas copiado bien el nuevo token (sin espacios)

---

## 📝 Archivo de referencia

Puedes ver todas las variables necesarias en: `.env.example`
