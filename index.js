const { Client, GatewayIntentBits, Collection, Events, ActivityType, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env
require('dotenv').config();

// Cargar configuración desde variables de entorno
const config = require('./config-production.js');
console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
console.log('📝 Configuración cargada desde variables de entorno');

// Validar variables de entorno críticas
if (!config.token) {
    console.error('❌ ERROR CRÍTICO: DISCORD_TOKEN no está configurado en .env');
    process.exit(1);
}
if (!config.clientId) {
    console.warn('⚠️ ADVERTENCIA: CLIENT_ID no está configurado (necesario para registrar comandos slash)');
}
if (!config.guildId) {
    console.warn('ℹ️ INFO: GUILD_ID no está configurado (comandos se registrarán globalmente)');
}
console.log('✅ Token validado - Bot puede iniciar');

// Crear cliente de Discord con configuración optimizada para Render
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel],
    // Optimizaciones para reducir uso de memoria
    makeCache: require('discord.js').Options.cacheWithLimits({
        MessageManager: 0,
        PresenceManager: 0,
        ReactionManager: 0,
        GuildMemberManager: {
            maxSize: 1,
            keepOverLimit: member => member.id === client.user?.id
        }
    }),
    sweepers: {
        messages: {
            interval: 300,
            lifetime: 60
        }
    },
    // Configuración WebSocket para mejorar conectividad
    ws: {
        large_threshold: 50,
        compress: true,
        properties: {
            browser: 'Discord Client'
        }
    },
    // Configuración REST con timeouts más largos
    rest: {
        timeout: 60000,
        retries: 5
    },
    // Reducir shards y concurrencia
    shardCount: 1,
    presence: {
        status: 'online'
    }
});

// Colección de comandos
client.commands = new Collection();

// Inicializar Map de giveaways
client.giveaways = new Map();

// Cargar giveaways guardados
const giveawayCommand = require('./commands/giveaway');
if (giveawayCommand.loadGiveaways) {
    client.giveaways = giveawayCommand.loadGiveaways();
    // Restaurar timeouts para giveaways activos
    for (const [messageId, giveawayData] of client.giveaways.entries()) {
        if (giveawayData.activo && giveawayData.finaliza > Date.now()) {
            const tiempoRestante = giveawayData.finaliza - Date.now();
            setTimeout(async () => {
                await giveawayCommand.finalizarGiveaway(client, giveawayData);
            }, tiempoRestante);
        }
    }
    console.log(`📦 Cargados ${client.giveaways.size} giveaway(s) desde archivo`);
}

// Cargar comandos
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    // Archivos que no son comandos slash (manejadores de eventos/botones)
    const nonSlashCommands = ['suggestion.js'];

    for (const file of commandFiles) {
        // Saltar archivos que no son comandos slash
        if (nonSlashCommands.includes(file)) {
            console.log(`⏭️  Saltando ${file} (no es comando slash)`);
            continue;
        }

        const filePath = path.join(commandsPath, file);
        try {
            console.log(`🔍 Cargando comando: ${file}`);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`✅ Comando cargado: ${command.data.name}`);
            } else {
                console.log(`[WARNING] El comando en ${filePath} no tiene las propiedades "data" o "execute" requeridas.`);
            }
        } catch (err) {
            console.error(`❌ Error cargando comando ${file}:`, err.message);
        }
    }
}

// Cargar eventos (deshabilitado - eventos manejados directamente en index.js)
/*
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
*/

// Evento ready
client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot iniciado como ${client.user.tag}`);
    console.log(`🏪 Plug Market Tickets - Sistema de Soporte`);
    console.log(`📊 Sirviendo en ${client.guilds.cache.size} servidor(es)`);
    console.log(`🤖 Bot ID: ${client.user.id}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`📝 Comandos cargados: ${client.commands.size}`);
    
    // Listar comandos
    if (client.commands.size > 0) {
        console.log(`📋 Comandos disponibles: ${Array.from(client.commands.keys()).join(', ')}`);
    }
    
    // Establecer actividad
    client.user.setActivity('Plug Market | /ticket', { type: ActivityType.Watching });

    // Enviar embed de sugerencias automáticamente (DESACTIVADO)
    /*
    try {
        const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
        const channelId = '1462515403858382878';
        const channel = await client.channels.fetch(channelId);
        
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('🍃 Restock a Product / Add a New Product')
                .setDescription('• Request a **restock** of an product\n• Suggest **new products** you would like us to add')
                .setFooter({ text: 'TicketToolxyz - Ticketing without clutter', iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png' });

            const button = new ButtonBuilder()
                .setCustomId('open_suggestion_modal')
                .setLabel('🍃 Restock a Product / Add a New product')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(button);

            await channel.send({ embeds: [embed], components: [row] });
            console.log('✅ Embed de sugerencias enviado automáticamente');
        }
    } catch (error) {
        console.error('Error al enviar embed de sugerencias:', error);
    }
    */
});

// Manejar mensajes (comandos de prefijo)
client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;
    
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    if (command === 'embed') {
        try {
            const { EmbedBuilder } = require('discord.js');
            
            // Usar el contenido como JSON
            const jsonString = message.content.slice(prefix.length + 'embed'.length).trim();
            
            if (!jsonString) {
                return message.reply('❌ Uso: `!embed {json del embed}`');
            }
            
            const embedData = JSON.parse(jsonString);
            const embed = new EmbedBuilder(embedData);
            
            await message.channel.send({ embeds: [embed] });
            await message.delete().catch(() => {});
        } catch (error) {
            console.error('Error en comando embed:', error);
            message.reply(`❌ Error: ${error.message}`).then(msg => setTimeout(() => msg.delete(), 5000));
        }
    }
    
    if (command === 'help') {
        const { EmbedBuilder } = require('discord.js');
        const helpEmbed = new EmbedBuilder()
            .setColor('#9d4edd')
            .setTitle('📋 Comandos Disponibles')
            .addFields(
                { name: '!embed {json}', value: 'Envía un embed personalizado. Ej:\n```!embed {"title":"Mi Titulo","description":"Mi descripción","color":"#9d4edd"}```' }
            )
            .setTimestamp();
        
        return message.reply({ embeds: [helpEmbed] });
    }
});

// Manejar interacciones
client.on(Events.InteractionCreate, async interaction => {
    console.log(`🔔 Interacción recibida: ${interaction.type} - ${interaction.customId || interaction.commandName || 'sin ID'} de ${interaction.user.tag}`);
    try {
        // Comandos slash
        if (interaction.isChatInputCommand()) {
            let command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No se encontró el comando ${interaction.commandName}. Cargando fallback...`);
                try {
                    const possiblePath = path.join(commandsPath, `${interaction.commandName}.js`);
                    if (fs.existsSync(possiblePath)) {
                        const mod = require(possiblePath);
                        if ('data' in mod && 'execute' in mod) {
                            client.commands.set(mod.data.name, mod);
                            command = mod;
                            console.log(`✅ Fallback cargado: ${mod.data.name}`);
                        }
                    }
                } catch (e) {
                    console.error('❌ Fallback failed:', e.message);
                }
                if (!command) return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error ejecutando ${interaction.commandName}:`, error);
                
                const reply = {
                    content: '❌ Hubo un error al ejecutar este comando.',
                    flags: 64 // Ephemeral
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply).catch(() => {});
                } else {
                    await interaction.reply(reply).catch(() => {});
                }
            }
        }
        
        // Botones y menús desplegables
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            try {
                // Manejadores de diferentes módulos
                if (interaction.customId.startsWith('giveaway_')) {
                    const giveawayCommand = require('./commands/giveaway');
                    await giveawayCommand.handleGiveawayButton(interaction);
                    return; // Salir inmediatamente después de manejar
                } else if (interaction.customId.startsWith('invoice_')) {
                    const invoiceHandler = require('./handlers/invoiceHandler');
                    await invoiceHandler.handleInteraction(interaction);
                } else if (interaction.customId === 'open_suggestion_modal') {
                    const suggestionCommand = require('./commands/suggestion');
                    await suggestionCommand.handleButton(interaction);
                } else if (interaction.customId === 'suggestion_modal') {
                    const suggestionCommand = require('./commands/suggestion');
                    await suggestionCommand.handleModal(interaction);
                } else {
                    // Importar el manejador de tickets
                    const ticketHandler = require('./handlers/ticketHandler');
                    await ticketHandler.handleInteraction(interaction);
                }
            } catch (error) {
                console.error('Error manejando interacción:', error);
                
                // No responder si el error es de interacción ya respondida o desconocida
                if (error.code === 40060 || error.code === 10062 || error.code === 10008) {
                    return;
                }
                
                // Solo responder si la interacción aún no ha sido manejada
                try {
                    const reply = {
                        content: '❌ Hubo un error al procesar tu solicitud.',
                        flags: 64 // Ephemeral flag
                    };
                    
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(reply).catch(() => {});
                    } else {
                        await interaction.reply(reply).catch(() => {});
                    }
                } catch (replyError) {
                    // Si no podemos responder, solo logueamos
                    console.error('No se pudo responder a la interacción:', replyError.message);
                }
            }
        }
    } catch (globalError) {
        console.error('Global interaction error:', globalError);
    }
});

// Manejar errores
process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
});

// Manejar errores de Discord
client.on('error', error => {
    console.error('❌ Error del cliente de Discord:', error);
});

client.on('warn', info => {
    console.warn('⚠️ Advertencia de Discord:', info);
});

client.on('debug', info => {
    // Solo mostrar debug importante en producción
    if (process.env.NODE_ENV === 'production' && (
        info.includes('Session') || 
        info.includes('Gateway') || 
        info.includes('Heartbeat') ||
        info.includes('Ready')
    )) {
        console.log('🐛 DEBUG:', info);
    }
});

client.on('shardError', error => {
    console.error('❌ Error de shard:', error);
});

client.on('shardReady', (shardId) => {
    console.log(`✅ Shard ${shardId} listo`);
});

client.on('shardDisconnect', (event, shardId) => {
    console.log(`🔌 Shard ${shardId} desconectado:`, event);
});

client.on('shardReconnecting', (shardId) => {
    console.log(`🔄 Shard ${shardId} reconectando...`);
});

// Puerto para hosting (solo si es web service)
// En modo worker no necesitamos HTTP server
if (process.env.RENDER_SERVICE_TYPE === 'web') {
    const PORT = process.env.PORT || 3000;
    const http = require('http');
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`Plug Market Tickets Bot is running!\nBot Status: ${client.isReady() ? 'Online' : 'Connecting...'}\nUptime: ${Math.floor(client.uptime / 1000)}s`);
    });

    server.listen(PORT, () => {
        console.log(`🌐 HTTP Server running on port ${PORT}`);
    });
} else {
    console.log('🔧 Modo worker - Sin servidor HTTP');
}

// Iniciar el bot
console.log('🔐 Iniciando sesión en Discord...');
console.log('🔑 Token presente:', config.token ? `Sí (${config.token.substring(0, 20)}...)` : 'NO');
console.log('📋 Variables de entorno:', {
    NODE_ENV: process.env.NODE_ENV,
    DISCORD_TOKEN_EXISTS: !!process.env.DISCORD_TOKEN,
    CLIENT_ID_EXISTS: !!process.env.CLIENT_ID,
    GUILD_ID_EXISTS: !!process.env.GUILD_ID
});

// Agregar timeout para detectar si login se cuelga
const loginTimeout = setTimeout(() => {
    console.error('❌ TIMEOUT: Login tardó más de 60 segundos');
    console.error('❌ El bot no pudo conectarse a Discord desde Render');
    console.error('🔄 Reiniciando para reintentar...');
    // En lugar de exit(1), intentar reconectar
    process.exit(0); // Exit 0 para que Render no marque como error
}, 60000);

client.login(config.token)
    .then(() => {
        clearTimeout(loginTimeout);
        console.log('✅ Login exitoso - Esperando evento ready...');
    })
    .catch(error => {
        clearTimeout(loginTimeout);
        console.error('❌ Error al hacer login:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        if (error.code === 'TokenInvalid') {
            console.error('❌ El token de Discord es inválido o ha sido regenerado');
        }
        process.exit(1);
    });