const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎁 Create a giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addStringOption(option =>
            option
                .setName('prize')
                .setDescription('Prize name (e.g: 50€ LTC/PP)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('duration')
                .setDescription('Giveaway duration (e.g: 1h, 30m, 2d, 1w)')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Verificar permisos
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)) {
            return interaction.reply({
                content: '❌ You don\'t have permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const premio = interaction.options.getString('prize');
            const duracionStr = interaction.options.getString('duration');

            // Parsear duración
            const duracionMs = parseDuracion(duracionStr);
            if (!duracionMs) {
                return interaction.editReply({
                    content: '❌ Invalid duration format. Use: 1h, 30m, 2d, 1w (minutes=m, hours=h, days=d, weeks=w)'
                });
            }

            // Calcular fecha de finalización
            const finalizaEn = Date.now() + duracionMs;
            const finalizaDate = new Date(finalizaEn);

            // Crear embed del giveaway
            const embed = new EmbedBuilder()
                .setTitle(`🎁 ${premio}`)
                .setDescription(
                    `🎉 **Ends:** hace ${formatDuracion(duracionMs)} | 👑 **Host:** ${interaction.user}\n` +
                    `📊 **Entries:** 0 | 🏆 **Count:** 1\n\n` +
                    `*Click the button below to secure your entry!*`
                )
                .setColor('#9d4edd')
                .setTimestamp(finalizaDate)
                .setFooter({ text: `Finaliza` });

            // Crear botón de participación
            const button = new ButtonBuilder()
                .setCustomId(`giveaway_join_${Date.now()}`)
                .setLabel('Participate!')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎉');

            const row = new ActionRowBuilder().addComponents(button);

            // Enviar mensaje del giveaway
            const giveawayMessage = await interaction.channel.send({
                content: '@everyone',
                embeds: [embed],
                components: [row]
            });

            // Guardar datos del giveaway
            const giveawayData = {
                messageId: giveawayMessage.id,
                channelId: interaction.channel.id,
                guildId: interaction.guild.id,
                premio: premio,
                hostId: interaction.user.id,
                finaliza: finalizaEn,
                participantes: [],
                ganadores: 1,
                activo: true
            };

            // Guardar en memoria (puedes implementar persistencia con base de datos)
            if (!interaction.client.giveaways) {
                interaction.client.giveaways = new Map();
            }
            interaction.client.giveaways.set(giveawayMessage.id, giveawayData);

            // Programar finalización del giveaway
            setTimeout(async () => {
                await finalizarGiveaway(interaction.client, giveawayData);
            }, duracionMs);

            await interaction.editReply({
                content: `✅ Giveaway created successfully in ${interaction.channel}`
            });

        } catch (error) {
            console.error('Error creating giveaway:', error);
            await interaction.editReply({
                content: '❌ There was an error creating the giveaway.'
            });
        }
    }
};

// Función para parsear duración
function parseDuracion(str) {
    const regex = /^(\d+)(m|h|d|w)$/i;
    const match = str.match(regex);
    
    if (!match) return null;
    
    const valor = parseInt(match[1]);
    const unidad = match[2].toLowerCase();
    
    const multiplicadores = {
        'm': 60 * 1000,           // minutos
        'h': 60 * 60 * 1000,      // horas
        'd': 24 * 60 * 60 * 1000, // días
        'w': 7 * 24 * 60 * 60 * 1000 // semanas
    };
    
    return valor * multiplicadores[unidad];
}

// Función para formatear duración
function formatDuracion(ms) {
    const dias = Math.floor(ms / (24 * 60 * 60 * 1000));
    const horas = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutos = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    if (dias > 0) return `${dias} day${dias !== 1 ? 's' : ''}`;
    if (horas > 0) return `${horas} hour${horas !== 1 ? 's' : ''}`;
    return `${minutos} minute${minutos !== 1 ? 's' : ''}`;
}

// Función para finalizar el giveaway
async function finalizarGiveaway(client, giveawayData) {
    try {
        const channel = await client.channels.fetch(giveawayData.channelId);
        const message = await channel.messages.fetch(giveawayData.messageId);
        
        // Obtener participantes
        const participantes = giveawayData.participantes || [];
        
        let descripcion;
        let ganador = null;
        
        if (participantes.length === 0) {
            descripcion = '❌ No participants in this giveaway.';
        } else {
            // Seleccionar ganador aleatorio
            ganador = participantes[Math.floor(Math.random() * participantes.length)];
            descripcion = `🎉 **Winner:** <@${ganador}>\n\nCongratulations! You won **${giveawayData.premio}**`;
        }
        
        // Actualizar embed
        const embedFinalizado = new EmbedBuilder()
            .setTitle(`🎁 ${giveawayData.premio}`)
            .setDescription(descripcion)
            .setColor(ganador ? '#00ff00' : '#ff0000')
            .setTimestamp()
            .setFooter({ text: 'Giveaway ended' });
        
        // Deshabilitar botón
        const buttonDisabled = new ButtonBuilder()
            .setCustomId('giveaway_ended')
            .setLabel('Ended')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏁')
            .setDisabled(true);
        
        const row = new ActionRowBuilder().addComponents(buttonDisabled);
        
        await message.edit({
            embeds: [embedFinalizado],
            components: [row]
        });
        
        // Anunciar ganador
        if (ganador) {
            await channel.send({
                content: `🎊 Congratulations <@${ganador}>! You won **${giveawayData.premio}**\n\nPlease open a ticket in <#1434536298143813773> to claim your prize!`
            });
        }
        
        // Marcar como inactivo
        giveawayData.activo = false;
        
    } catch (error) {
        console.error('Error finalizing giveaway:', error);
    }
}

// Exportar funciones auxiliares
module.exports.handleGiveawayButton = async function(interaction) {
    const messageId = interaction.message.id;
    const userId = interaction.user.id;
    
    // Obtener datos del giveaway
    const giveawayData = interaction.client.giveaways?.get(messageId);
    
    if (!giveawayData || !giveawayData.activo) {
        return interaction.reply({
            content: '❌ This giveaway is no longer active.',
            ephemeral: true
        });
    }
    
    // Verificar si ya está participando
    if (giveawayData.participantes.includes(userId)) {
        return interaction.reply({
            content: '⚠️ You are already participating in this giveaway.',
            ephemeral: true
        });
    }
    
    // Agregar participante
    giveawayData.participantes.push(userId);
    
    // Actualizar embed (sin mostrar lista de participantes)
    const embed = interaction.message.embeds[0];
    const duracionRestante = giveawayData.finaliza - Date.now();
    
    const embedActualizado = EmbedBuilder.from(embed)
        .setDescription(
            `🎉 **Ends:** hace ${formatDuracion(duracionRestante)} | 👑 **Host:** <@${giveawayData.hostId}>\n` +
            `📊 **Entries:** ${giveawayData.participantes.length} | 🏆 **Count:** 1\n\n` +
            `*Click the button below to secure your entry!*`
        );
    
    await interaction.message.edit({ embeds: [embedActualizado] });
    
    await interaction.reply({
        content: '✅ You have successfully entered the giveaway!',
        ephemeral: true
    });
};
