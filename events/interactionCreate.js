const { Events, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Log de interacciones para debugging
        if (interaction.isChatInputCommand()) {
            console.log(`🔧 Comando ejecutado: /${interaction.commandName} por ${interaction.user.tag} en ${interaction.guild?.name || 'DM'}`);
            
            // Ejecutar el comando
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`❌ No se encontró el comando ${interaction.commandName}.`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`❌ Error ejecutando ${interaction.commandName}:`, error);
                
                const errorMessage = {
                    content: '❌ Hubo un error al ejecutar este comando.',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        } else if (interaction.isButton()) {
            console.log(`🔘 Botón presionado: ${interaction.customId} por ${interaction.user.tag}`);
            await handleButton(interaction);
        } else if (interaction.isStringSelectMenu()) {
            console.log(`📋 Menú usado: ${interaction.customId} (${interaction.values[0]}) por ${interaction.user.tag}`);
            await handleSelectMenu(interaction);
        }
    },
};

// Manejar botones
async function handleButton(interaction) {
    const { customId } = interaction;

    if (customId === 'confirm_close') {
        await interaction.deferUpdate();
        
        const channel = interaction.channel;
        
        // Enviar mensaje final
        const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Cerrado')
            .setDescription('Este ticket se eliminará en 5 segundos...')
            .setColor(config.colors.error)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [] });

        // Log del cierre
        const logChannel = interaction.guild.channels.cache.get(config.logChannel);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('📊 Ticket Cerrado')
                .addFields([
                    { name: 'Canal', value: channel.name, inline: true },
                    { name: 'Cerrado por', value: `${interaction.user}`, inline: true },
                    { name: 'ID del canal', value: channel.id, inline: true }
                ])
                .setColor(config.colors.error)
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
        }

        // Eliminar canal después de 5 segundos
        setTimeout(() => {
            channel.delete().catch(console.error);
        }, 5000);
    } else if (customId === 'cancel_close') {
        await interaction.update({
            content: '✅ Cierre del ticket cancelado.',
            embeds: [],
            components: []
        });
    }
}

// Manejar menús de selección
async function handleSelectMenu(interaction) {
    const { customId, values } = interaction;

    if (customId === 'ticket_category') {
        await interaction.deferReply({ ephemeral: true });

        const category = values[0];
        const user = interaction.user;
        const guild = interaction.guild;

        // Verificar si el usuario ya tiene un ticket abierto
        const existingTicket = guild.channels.cache.find(
            ch => ch.name === `ticket-${user.username.toLowerCase()}` && ch.parentId === config.ticketsCategory
        );

        if (existingTicket) {
            return interaction.editReply({
                content: `❌ Ya tienes un ticket abierto: ${existingTicket}`
            });
        }

        try {
            // Obtener el emoji según la categoría
            const categoryEmojis = {
                purchases: config.emojis.purchases,
                not_received: config.emojis.notReceived,
                replace: config.emojis.replace,
                support: config.emojis.support
            };

            const categoryNames = {
                purchases: 'Purchases',
                not_received: 'Product not received',
                replace: 'Replace',
                support: 'Support'
            };

            // Crear el canal del ticket
            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username.toLowerCase()}`,
                parent: config.ticketsCategory,
                topic: `Ticket de ${user.tag} (${user.id}) - ${categoryNames[category]}`,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: config.supportRole,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: config.adminRole,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels
                        ]
                    }
                ]
            });

            // Mensaje de bienvenida en el ticket
            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`${categoryEmojis[category]} ${categoryNames[category]}`)
                .setDescription(`Welcome ${user}!\\n\\nA member of our support team will assist you shortly.\\n\\nPlease describe your issue in detail.`)
                .addFields([
                    {
                        name: '📋 Category',
                        value: categoryNames[category],
                        inline: true
                    },
                    {
                        name: '⏰ Created',
                        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                        inline: true
                    }
                ])
                .setColor(config.colors.primary)
                .setFooter({
                    text: 'To close this ticket, use /ticket close',
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            await ticketChannel.send({
                content: `${user} <@&${config.supportRole}>`,
                embeds: [welcomeEmbed]
            });

            // Responder al usuario
            await interaction.editReply({
                content: `✅ Your ticket has been created: ${ticketChannel}`
            });

            // Log de creación
            const logChannel = guild.channels.cache.get(config.logChannel);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📊 Nuevo Ticket Creado')
                    .addFields([
                        { name: 'Usuario', value: `${user}`, inline: true },
                        { name: 'Categoría', value: categoryNames[category], inline: true },
                        { name: 'Canal', value: `${ticketChannel}`, inline: true }
                    ])
                    .setColor(config.colors.success)
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (error) {
            console.error('Error creando ticket:', error);
            await interaction.editReply({
                content: '❌ Hubo un error al crear tu ticket. Por favor, contacta con un administrador.'
            });
        }
    }
}