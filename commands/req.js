const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('requirements')
        .setDescription('📋 Send replacement requirements checklist')
        .addUserOption(opt =>
            opt
                .setName('user')
                .setDescription('User to mention (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const channel = interaction.channel;
        const targetUser = interaction.options.getUser('user');

        if (!channel || !channel.name || !channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: '❌ This command can only be used inside ticket channels.', flags: 64 });
        }

        const member = interaction.member;
        const hasStaffRole = member.roles.cache.has(config.supportRole) || member.roles.cache.has(config.adminRole);
        if (!hasStaffRole && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
        }

        const headerMention = targetUser ? `${targetUser}, ` : '';

        const embed = new EmbedBuilder()
            .setTitle('🔄 Replacement Requirements')
            .setDescription(
                `${headerMention}to process your replacement, please provide:\n\n` +
                `🎥 **Full screen recording**\nShow login and the issue (no cuts or edits)\n\n` +
                `🆔 **Order ID**\nYour order number (e.g., PM-1234)\n\n` +
                `<:user:1457824415839424683> **Email/Username**\nThe account credentials you used`
            )
            .setColor(config.colors.primary)
            .setFooter({ text: 'Plug Market • Replacement', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
