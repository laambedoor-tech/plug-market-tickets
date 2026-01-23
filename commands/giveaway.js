const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Funciones auxiliares
function parseDuracion(str) {
    const regex = /^(\d+)(m|h|d|w)$/i;
    const match = str.match(regex);
    if (!match) return null;
    const valor = parseInt(match[1]);
    const unidad = match[2].toLowerCase();
    const multiplicadores = {
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000
    };
    return valor * multiplicadores[unidad];
}

function formatDuracion(ms) {
    const dias = Math.floor(ms / (24 * 60 * 60 * 1000));
    const horas = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutos = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    if (dias > 0) return `${dias} day${dias !== 1 ? 's' : ''}`;
    if (horas > 0) return `${horas} hour${horas !== 1 ? 's' : ''}`;
    return `${minutos} minute${minutos !== 1 ? 's' : ''}`;
}

function saveGiveaways(giveawaysMap) {
    try {
        const filePath = path.join(__dirname, '..', 'giveaways.json');
        const data = Array.from(giveawaysMap.entries());
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving giveaways:', error);
    }
}

function loadGiveaways() {
    try {
        const filePath = path.join(__dirname, '..', 'giveaways.json');
        if (!fs.existsSync(filePath)) return new Map();
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return new Map(data);
    } catch (error) {
        console.error('Error loading giveaways:', error);
        return new Map();
    }
}

async function finalizarGiveaway(client, giveawayData) {
    try {
        const channel = await client.channels.fetch(giveawayData.channelId);
        const message = await channel.messages.fetch(giveawayData.messageId);
        
        const participantes = giveawayData.participantes || [];
        const cantidadGanadores = giveawayData.ganadores || 1;
        let descripcion;
        let ganadores = [];
        
        if (participantes.length === 0) {
            descripcion = '❌ No participants in this giveaway.';
        } else {
            // Seleccionar múltiples ganadores únicos
            const participantesCopia = [...participantes];
            const numGanadores = Math.min(cantidadGanadores, participantesCopia.length);
            
            for (let i = 0; i < numGanadores; i++) {
                const randomIndex = Math.floor(Math.random() * participantesCopia.length);
                ganadores.push(participantesCopia[randomIndex]);
                participantesCopia.splice(randomIndex, 1);
            }
            
            if (ganadores.length === 1) {
                descripcion = `🎉 **Winner:** <@${ganadores[0]}>\n\nCongratulations! You won **${giveawayData.premio}**`;
            } else {
                const ganadoresMention = ganadores.map(id => `<@${id}>`).join('\n');
                descripcion = `🎉 **Winners:**\n${ganadoresMention}\n\nCongratulations! You won **${giveawayData.premio}**`;
            }
        }
        
        const embedFinalizado = new EmbedBuilder()
            .setTitle(`🎁 ${giveawayData.premio}`)
            .setDescription(descripcion)
            .setColor(ganadores.length > 0 ? '#00ff00' : '#ff0000')
            .setTimestamp()
            .setFooter({ text: 'Giveaway ended' });
        
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
        
        if (ganadores.length > 0) {
            const ganadoresContent = ganadores.map(id => `<@${id}>`).join(', ');
            await channel.send({
                content: `🎊 Congratulations ${ganadoresContent}! You won **${giveawayData.premio}**\n\nPlease open a ticket in <#1434536298143813773> to claim your prize!`
            });
        }
        
        giveawayData.activo = false;
        saveGiveaways(client.giveaways);
    } catch (error) {
        console.error('Error finalizing giveaway:', error);
    }
}

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
        )
        .addIntegerOption(option =>
            option
                .setName('winners')
                .setDescription('Number of winners (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20)
        ),

    async execute(interaction) {
        // Defer immediately
        await interaction.deferReply();

        // Check perms
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageEvents)) {
            return interaction.editReply({
                content: '❌ You don\'t have permission to use this command.'
            });
        }

        try {
            const premio = interaction.options.getString('prize');
            const duracionStr = interaction.options.getString('duration');
            const cantidadGanadores = interaction.options.getInteger('winners') || 1;

            const duracionMs = parseDuracion(duracionStr);
            if (!duracionMs) {
                return interaction.editReply({
                    content: '❌ Invalid duration format. Use: 1h, 30m, 2d, 1w'
                });
            }

            const finalizaEn = Date.now() + duracionMs;
            const finalizaDate = new Date(finalizaEn);

            const embed = new EmbedBuilder()
                .setTitle(`🎁 ${premio}`)
                .setDescription(
                    `🎉 **Ends:** in ${formatDuracion(duracionMs)} | 👑 **Host:** ${interaction.user}\n` +
                    `🏆 **Winners:** ${cantidadGanadores}\n\n` +
                    `*Click the button below to secure your entry!*`
                )
                .setColor('#9d4edd')
                .setTimestamp(finalizaDate)
                .setFooter({ text: `Finaliza` });

            const button = new ButtonBuilder()
                .setCustomId(`giveaway_join_${Date.now()}`)
                .setLabel('Participate!')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎉');

            const row = new ActionRowBuilder().addComponents(button);

            const giveawayMessage = await interaction.channel.send({
                embeds: [embed],
                components: [row]
            });

            const giveawayData = {
                messageId: giveawayMessage.id,
                channelId: interaction.channel.id,
                guildId: interaction.guild.id,
                premio: premio,
                hostId: interaction.user.id,
                finaliza: finalizaEn,
                participantes: [],
                ganadores: cantidadGanadores,
                activo: true
            };

            if (!interaction.client.giveaways) {
                interaction.client.giveaways = new Map();
            }
            interaction.client.giveaways.set(giveawayMessage.id, giveawayData);
            saveGiveaways(interaction.client.giveaways);

            setTimeout(async () => {
                await finalizarGiveaway(interaction.client, giveawayData);
            }, duracionMs);

            await interaction.editReply({
                content: `✅ Giveaway created successfully in ${interaction.channel}`
            });

        } catch (error) {
            console.error('Error creating giveaway:', error);
            await interaction.editReply({
                content: '❌ Error creating giveaway'
            }).catch(() => {});
        }
    },

    async handleGiveawayButton(interaction) {
        try {
            // Defer immediately to prevent timeout
            await interaction.deferReply({ flags: 64 });
            
            const messageId = interaction.message.id;
            const userId = interaction.user.id;
            const giveawayData = interaction.client.giveaways?.get(messageId);

            if (!giveawayData || !giveawayData.activo) {
                return interaction.editReply({
                    content: '❌ This giveaway is no longer active.'
                });
            }

            if (giveawayData.participantes.includes(userId)) {
                return interaction.editReply({
                    content: '⚠️ You are already participating in this giveaway.'
                });
            }

            giveawayData.participantes.push(userId);
            saveGiveaways(interaction.client.giveaways);

            const embed = interaction.message.embeds[0];
            const duracionRestante = giveawayData.finaliza - Date.now();

            const embedActualizado = EmbedBuilder.from(embed)
                .setDescription(
                    `🎉 **Ends:** in ${formatDuracion(duracionRestante)} | 👑 **Host:** <@${giveawayData.hostId}>\n` +
                    `🏆 **Winners:** ${giveawayData.ganadores}\n\n` +
                    `*Click the button below to secure your entry!*`
                );

            await interaction.message.edit({ embeds: [embedActualizado] });

            await interaction.editReply({
                content: '✅ You have successfully entered the giveaway!'
            });

        } catch (error) {
            console.error('Error in handleGiveawayButton:', error);
            await interaction.editReply({
                content: '❌ Error joining giveaway'
            }).catch(() => {});
        }
    }
};

// Exports
module.exports.loadGiveaways = loadGiveaways;
module.exports.saveGiveaways = saveGiveaways;
module.exports.finalizarGiveaway = finalizarGiveaway;
