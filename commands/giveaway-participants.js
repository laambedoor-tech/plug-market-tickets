const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-participants')
        .setDescription('View participants of an active giveaway')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addStringOption(option =>
            option
                .setName('message_id')
                .setDescription('Giveaway message ID (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Defer immediately to prevent timeout
        await interaction.deferReply({ flags: 64 });
        
        const messageIdInput = interaction.options.getString('message_id');
        const giveaways = interaction.client.giveaways;

        if (!giveaways || giveaways.size === 0) {
            return interaction.editReply({ content: '⚠️ No tracked giveaways right now. If there is an active giveaway, the bot may have been restarted.' });
        }

        let giveawayData;

        if (messageIdInput) {
            giveawayData = giveaways.get(messageIdInput.trim());
            if (!giveawayData) {
                return interaction.editReply({ content: '❌ No giveaway found with that message ID.' });
            }
        } else {
            const activeInGuild = [...giveaways.values()].filter(g => g.guildId === interaction.guild.id && g.activo);
            if (activeInGuild.length === 0) {
                return interaction.editReply({ content: '⚠️ No active giveaways found in this server. Provide a message_id if it exists.' });
            }
            // Pick the one that ends soonest
            activeInGuild.sort((a, b) => a.finaliza - b.finaliza);
            giveawayData = activeInGuild[0];
        }

        if (giveawayData.guildId !== interaction.guild.id) {
            return interaction.editReply({ content: '❌ That giveaway does not belong to this server.' });
        }

        const participantes = giveawayData.participantes || [];
        const total = participantes.length;

        const maxToShow = 50;
        const shown = participantes.slice(0, maxToShow).map(id => `<@${id}>`).join(', ');
        const more = total > maxToShow ? `\n...and ${total - maxToShow} more` : '';

        const jumpLink = `https://discord.com/channels/${giveawayData.guildId}/${giveawayData.channelId}/${giveawayData.messageId}`;

        const embed = new EmbedBuilder()
            .setTitle(`🎁 Participants for ${giveawayData.premio}`)
            .setDescription(total === 0 ? 'No participants yet.' : shown + more)
            .addFields(
                { name: 'Total', value: String(total), inline: true },
                { name: 'Winners', value: String(giveawayData.ganadores || 1), inline: true },
                { name: 'Giveaway message', value: `[Jump to message](${jumpLink})` }
            )
            .setColor('#3a86ff');

        return interaction.editReply({ embeds: [embed] });
    }
};
