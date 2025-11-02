const { Client, GatewayIntentBits, Collection, Events, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Cargar configuración (producción o desarrollo)
let config;
if (process.env.NODE_ENV === 'production') {
    config = require('./config-production.js');
} else {
    config = require('./config.json');
}

// Crear cliente de Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// Colección de comandos
client.commands = new Collection();

// Cargar comandos
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] El comando en ${filePath} no tiene las propiedades "data" o "execute" requeridas.`);
        }
    }
}

// Cargar eventos
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
    }
}

// Evento ready
client.once(Events.ClientReady, () => {
    console.log(`✅ Bot iniciado como ${client.user.tag}`);
    console.log(`🏪 Plug Market Tickets - Sistema de Soporte`);
    console.log(`📊 Sirviendo en ${client.guilds.cache.size} servidor(es)`);
    
    // Establecer actividad
    client.user.setActivity('Plug Market | /ticket', { type: ActivityType.Watching });
});

// Manejar interacciones
client.on(Events.InteractionCreate, async interaction => {
    // Comandos slash
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No se encontró el comando ${interaction.commandName}.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error ejecutando ${interaction.commandName}:`, error);
            
            const reply = {
                content: '❌ Hubo un error al ejecutar este comando.',
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
    
    // Botones y menús desplegables
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
        try {
            // Importar el manejador de tickets
            const ticketHandler = require('./handlers/ticketHandler');
            await ticketHandler.handleInteraction(interaction);
        } catch (error) {
            console.error('Error manejando interacción:', error);
            
            const reply = {
                content: '❌ Hubo un error al procesar tu solicitud.',
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }
});

// Manejar errores
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

// Puerto para hosting (Render, Heroku, etc.)
const PORT = process.env.PORT || 3000;

// Crear servidor HTTP simple para hosting
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Plug Market Tickets Bot is running!');
});

server.listen(PORT, () => {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
});

// Iniciar el bot
client.login(config.token);