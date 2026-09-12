# 🏪 sloWmo Tickets Bot

Un bot de Discord avanzado para manejar tickets de soporte, inspirado en el sistema Nebula Tickets pero personalizado para sloWmo.

## ✨ Características

- 🎫 Sistema de tickets con categorías múltiples
- 🎨 Interfaz hermosa con embeds y botones interactivos
- 🔒 Sistema de permisos robusto
- 📊 Logs de actividad completos
- 🛠️ Fácil configuración y personalización
- 💙 Diseño inspirado en sloWmo

### 📋 Categorías de Tickets

1. **🛒 Compras** - Para realizar compras de productos
2. **📦 Producto no recibido** - Soporte para productos no recibidos
3. **🔄 Reemplazar** - Solicitar reemplazo de productos
4. **💬 Soporte** - Soporte general del equipo de staff

## 🚀 Instalación

### 1. Prerrequisitos

- Node.js 18.0.0 o superior
- Un bot de Discord creado en [Discord Developer Portal](https://discord.com/developers/applications)
- Permisos de administrador en tu servidor de Discord

### 2. Configurar el Bot

1. **Clona o descarga este repositorio**
2. **Instala las dependencias:**
   ```bash
   npm install
   ```

3. **Configura el archivo `config.json`:**
   ```json
   {
     "token": "TU_TOKEN_DEL_BOT",
     "clientId": "ID_DEL_BOT",
     "guildId": "ID_DEL_SERVIDOR",
     "ticketsCategory": "ID_CATEGORIA_TICKETS",
     "supportRole": "ID_ROL_SOPORTE",
     "adminRole": "ID_ROL_ADMIN",
     "logChannel": "ID_CANAL_LOGS"
   }
   ```

### 3. Configurar Discord

#### Crear categoría y roles:

1. **Crear una categoría** llamada "📁 TICKETS" en tu servidor
2. **Crear roles:**
   - `@Support` - Para el equipo de soporte
   - `@Admin` - Para administradores
3. **Crear canal de logs** (opcional) llamado `#ticket-logs`

#### Obtener IDs:

1. Activa el **Modo Desarrollador** en Discord (Configuración > Avanzado > Modo Desarrollador)
2. Haz clic derecho en los elementos y selecciona **Copiar ID**
3. Pega los IDs en el archivo `config.json`

### 4. Configurar Permisos del Bot

El bot necesita los siguientes permisos:

- ✅ Leer Mensajes
- ✅ Enviar Mensajes
- ✅ Insertar Enlaces
- ✅ Adjuntar Archivos
- ✅ Leer Historial de Mensajes
- ✅ Usar Comandos de Barra
- ✅ Gestionar Canales
- ✅ Gestionar Roles

### 5. Registrar Comandos Slash

```bash
node deploy-commands.js
```

### 6. Iniciar el Bot

```bash
npm start
```

O para desarrollo:
```bash
npm run dev
```

## 🎛️ Comandos

### `/ticket panel`
Crea el panel principal de tickets con menú desplegable.

### `/ticket close [razón]`
Cierra el ticket actual con una razón opcional.

### `/ticket add <usuario>`
Añade un usuario al ticket actual.

### `/ticket remove <usuario>`
Remueve un usuario del ticket actual.

### `/setup info`
Muestra información de la configuración actual.

### `/setup test`
Prueba la configuración del bot y reporta problemas.

## 🎨 Personalización

### Colores

Puedes cambiar los colores en `config.json`:

```json
"colors": {
  "primary": "#3a86ff",    // Color principal (azul)
  "secondary": "#7dc4ff",  // Color secundario
  "success": "#06d6a0",    // Verde para éxito
  "error": "#ef476f",      // Rojo para errores
  "warning": "#ffd166"     // Amarillo para advertencias
}
```

### Emojis

Personaliza los emojis en `config.json`:

```json
"emojis": {
  "ticket": "🎫",
  "purchases": "🛒",
  "support": "💬",
  "replace": "🔄",
  "notReceived": "📦",
  "close": "🔒",
  "delete": "🗑️",
  "add": "➕",
  "remove": "➖"
}
```

### Imágenes

Para personalizar las imágenes en los embeds:

1. Sube tus imágenes a Discord
2. Copia los enlaces de las imágenes
3. Reemplaza los enlaces en:
   - `commands/ticket.js` (líneas con `.setThumbnail()` y `.setImage()`)
   - `handlers/ticketHandler.js` (líneas con `.setFooter()`)

## 🔧 Solución de Problemas

### El bot no responde:
1. Verifica que el token sea correcto
2. Asegúrate de que el bot tenga permisos
3. Revisa la consola para errores

### Los comandos no aparecen:
1. Ejecuta `node deploy-commands.js` nuevamente
2. Verifica que `clientId` y `guildId` sean correctos
3. Espera unos minutos si son comandos globales

### Los tickets no se crean:
1. Verifica que `ticketsCategory` sea el ID correcto de una categoría
2. Asegúrate de que el bot tenga permisos para crear canales
3. Revisa que los roles de soporte existan

### Usar `/setup test` para diagnosticar problemas automáticamente.

## 📊 Estructura del Proyecto

```
sloWmo Tickets/
├── commands/
│   ├── ticket.js       # Comando principal de tickets
│   └── setup.js        # Comandos de configuración
├── events/
│   ├── ready.js        # Evento cuando el bot se inicia
│   └── interactionCreate.js
├── handlers/
│   └── ticketHandler.js # Lógica principal de tickets
├── utils/
│   └── utils.js        # Utilidades y funciones helper
├── config.json         # Configuración del bot
├── package.json        # Dependencias del proyecto
├── deploy-commands.js  # Script para registrar comandos
├── index.js           # Archivo principal del bot
└── README.md          # Este archivo
```

## 🤝 Soporte

Si tienes problemas con el bot:

1. Revisa este README completo
2. Usa `/setup test` para diagnosticar
3. Revisa la consola para errores
4. Verifica que todos los IDs en `config.json` sean correctos

## 📝 Créditos

- Inspirado en el diseño de Nebula Tickets
- Creado para sloWmo ([slowmo.es](https://slowmo.es))
- Desarrollado con Discord.js v14

---

**¡Disfruta tu nuevo sistema de tickets para sloWmo! 🏪✨**