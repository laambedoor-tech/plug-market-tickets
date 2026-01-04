# 📝 Cómo Usar Comandos de Embed

## Comando: `!embed`

Envía mensajes personalizados con embed sin usar slash commands.

### Ejemplos de uso:

#### 1. Anuncio simple
```
!embed {"title":"📢 Anuncio Importante","description":"Contenido del anuncio aquí","color":"#9d4edd","footer":{"text":"Plug Market"}}
```

#### 2. Anuncio como en el ejemplo (Alternative Access)
```
!embed {"title":"Alternative Access Available","description":"If the domain nebulamarket.es is not working, please try using https://nebulamarket.myselauth.com/\n\nWe are working to fix the problem as soon as possible.\nThis issue does not affect everyone, only some users.\nThank you for your patience.","color":"#9d4edd","footer":{"text":"4 de enero de 2026"}}
```

#### 3. Con campos (fields)
```
!embed {"title":"📊 Estadísticas","description":"Información del servidor","color":"#06d6a0","fields":[{"name":"👥 Usuarios","value":"150","inline":true},{"name":"📊 Servidores","value":"5","inline":true}],"footer":{"text":"Plug Market"}}
```

#### 4. Anuncio de PayPal
```
!embed {"title":"💳 PayPal disabled for a few hours","color":"#ef476f","footer":{"text":"4 de enero de 2026"}}
```

#### 5. Con imagen y thumbnail
```
!embed {"title":"Mi Titulo","description":"Descripción","color":"#c77dff","image":{"url":"https://example.com/image.png"},"thumbnail":{"url":"https://example.com/thumb.png"},"footer":{"text":"Plug Market"}}
```

### Estructura completa disponible:
- `title` - Título del embed
- `description` - Descripción principal
- `color` - Color en hexadecimal (ej: #9d4edd)
- `fields` - Array de campos adicionales
  - `name` - Nombre del campo
  - `value` - Valor del campo
  - `inline` - true/false (mostrar lado a lado)
- `footer` - Pie de página
  - `text` - Texto del footer
- `image` - Imagen grande del embed
  - `url` - URL de la imagen
- `thumbnail` - Imagen pequeña
  - `url` - URL de la imagen
- `author` - Autor del mensaje
  - `name` - Nombre
  - `url` - URL (opcional)
  - `icon_url` - Ícono (opcional)
- `timestamp` - Añade timestamp automáticamente (true)

### Ayuda
```
!help
```

## Notas:
- El mensaje del comando se elimina automáticamente
- Solo miembros con permisos pueden usar estos comandos (asegúrate de configurar permisos)
- Los colores deben estar en formato hexadecimal (#RRGGBB)
