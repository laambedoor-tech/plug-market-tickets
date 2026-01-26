const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../config.json');
const ALLOWED_CLOSE_ROLES = new Set((config.allowedCloseRoles || []).map(String));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Rename the ticket channel with status'),

    async execute(interaction) {
        const channel = interaction.channel;

        // Check if this is a ticket channel (by name or topic)
        const isTicket = channel.name.startsWith('ticket-') || (channel.topic && channel.topic.includes('Ticket by'));
        if (!isTicket) {
            return interaction.reply({
                content: '❌ This command can only be used in ticket channels.',
                flags: 64
            });
        }

        // Permission check (only allow specific roles)
        const member = interaction.member;
        const hasAllowedRole = member.roles.cache.some(r => ALLOWED_CLOSE_ROLES.has(String(r.id)));
        if (!hasAllowedRole) {
            return interaction.reply({ 
                content: '❌ You do not have permission to rename tickets.', 
                flags: 64 
            });
        }

        // Create select menu with status options
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`rename_status:${interaction.user.id}`)
            .setPlaceholder('Select the ticket status...')
            .addOptions([
                {
                    label: 'Replace Done',
                    description: 'Replacement completed successfully',
                    value: 'replace-done',
                    emoji: '✅'
                },
                {
                    label: 'Waiting Proofs',
                    description: 'Waiting for proof from user',
                    value: 'waiting-proofs',
                    emoji: '⏳'
                },
                {
                    label: 'Pending Replace',
                    description: 'Replacement is pending',
                    value: 'pending-replace',
                    emoji: '⌛'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '🎫 Select the new status for this ticket:',
            components: [row],
            flags: 64
        });
    }
};
