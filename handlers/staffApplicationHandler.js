const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const config = require('../config.json');

const STAFF_APPLICATION_PANEL_CHANNEL_ID = '1485378847716147262';
const STAFF_APPLICATION_CATEGORY_ID = '1485380098059276340';
const STAFF_MENTION_ROLE_ID = '1434657889284390964';
const STAFF_APPLY_BUTTON_ID = 'staff_apply_open_modal';
const STAFF_APPLY_MODAL_ID = 'staff_apply_modal';

class StaffApplicationHandler {
    /**
     * Sends the staff-application panel embed to the configured channel
     * if the bot hasn't already posted one there.
     */
    static async sendPanelIfMissing(client) {
        // Resolve the guild first, then fetch the channel from it.
        const guild = client.guilds.cache.get(config.guildId)
            ?? await client.guilds.fetch(config.guildId).catch(() => null);

        if (!guild) {
            console.warn('Staff Applications: Guild not available – skipping panel.');
            return;
        }

        let channel = null;
        try {
            channel = await guild.channels.fetch(STAFF_APPLICATION_PANEL_CHANNEL_ID);
        } catch (err) {
            console.warn(
                `Staff Applications: Could not fetch channel ${STAFF_APPLICATION_PANEL_CHANNEL_ID} – ${err?.message || 'unknown'}`
            );
            return;
        }

        if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
            console.warn(
                `Staff Applications: Channel ${STAFF_APPLICATION_PANEL_CHANNEL_ID} is not a sendable text channel (type ${channel?.type}).`
            );
            return;
        }

        // Avoid duplicate panels
        const recent = await channel.messages.fetch({ limit: 30 }).catch(() => null);
        const alreadyPosted = recent?.some(msg =>
            msg.author?.id === client.user?.id &&
            msg.components?.some(row =>
                row.components?.some(c => c.customId === STAFF_APPLY_BUTTON_ID)
            )
        );
        if (alreadyPosted) return;

        // Build and send the panel
        const panelEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('📋  Staff Applications')
            .setDescription(
                '> **Interested in joining the staff team?**\n\n' +
                'We are looking for dedicated and responsible members to help us grow and maintain a great community.\n\n' +
                '**Requirements**\n' +
                '• Be active in the server\n' +
                '• Have a clean moderation history\n' +
                '• Be respectful and professional\n\n' +
                'Click the button below to fill out your application. A private ticket will be created with your answers for the team to review.'
            )
            .setFooter({ text: 'sloWmo  •  Staff Recruitment' })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId(STAFF_APPLY_BUTTON_ID)
            .setLabel('Apply for Staff')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('📝');

        const row = new ActionRowBuilder().addComponents(button);
        await channel.send({ embeds: [panelEmbed], components: [row] });
        console.log('✅ Staff application panel sent automatically.');
    }

    // ── Interaction router ──────────────────────────────────────────────
    static async handleInteraction(interaction) {
        if (interaction.isButton() && interaction.customId === STAFF_APPLY_BUTTON_ID) {
            return this.showModal(interaction);
        }
        if (interaction.isModalSubmit() && interaction.customId === STAFF_APPLY_MODAL_ID) {
            return this.createApplicationTicket(interaction);
        }
    }

    // ── Modal ───────────────────────────────────────────────────────────
    static async showModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId(STAFF_APPLY_MODAL_ID)
            .setTitle('Staff Application');

        const fields = [
            new TextInputBuilder()
                .setCustomId('staff_app_why')
                .setLabel('Why do you want to be staff?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000),
            new TextInputBuilder()
                .setCustomId('staff_app_age')
                .setLabel('How old are you?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(20),
            new TextInputBuilder()
                .setCustomId('staff_app_experience')
                .setLabel('What staff experience do you have?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000),
            new TextInputBuilder()
                .setCustomId('staff_app_schedule')
                .setLabel('What is your availability / timezone?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000),
            new TextInputBuilder()
                .setCustomId('staff_app_extra')
                .setLabel('Anything else you want us to know?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setMaxLength(1000)
        ];

        modal.addComponents(fields.map(f => new ActionRowBuilder().addComponents(f)));
        await interaction.showModal(modal);
    }

    // ── Ticket creation ─────────────────────────────────────────────────
    static async createApplicationTicket(interaction) {
        await interaction.deferReply({ flags: 64 });

        const guild = interaction.guild;
        const user  = interaction.user;

        // Permission pre-check
        const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
        if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.editReply({
                content: '❌ I cannot create your application ticket right now (missing Manage Channels permission).'
            });
        }

        // Prevent duplicates
        const existing = guild.channels.cache.find(ch =>
            ch.type === ChannelType.GuildText &&
            ch.parentId === STAFF_APPLICATION_CATEGORY_ID &&
            ch.topic?.includes(`Staff Application by ${user.id}`)
        );
        if (existing) {
            return interaction.editReply({
                content: `❌ You already have an open staff application in ${existing}.`
            });
        }

        // Gather answers
        const why        = interaction.fields.getTextInputValue('staff_app_why');
        const age        = interaction.fields.getTextInputValue('staff_app_age');
        const experience = interaction.fields.getTextInputValue('staff_app_experience');
        const schedule   = interaction.fields.getTextInputValue('staff_app_schedule');
        const extra      = interaction.fields.getTextInputValue('staff_app_extra') || 'None.';

        const slug = this.slugify(user.username);
        const channelName = `staff-app-${slug || user.id.slice(-5)}`;

        // Permission overwrites
        const overwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles
                ]
            }
        ];

        // Give the mention role access to the ticket
        const staffRole = guild.roles.cache.get(STAFF_MENTION_ROLE_ID);
        if (staffRole) {
            overwrites.push({
                id: staffRole.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles
                ]
            });
        }

        // Also give admin role access
        const adminRoleId = '1434537186140754043';
        const adminRole = guild.roles.cache.get(adminRoleId);
        if (adminRole) {
            overwrites.push({
                id: adminRole.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages,
                    PermissionFlagsBits.AttachFiles
                ]
            });
        }

        try {
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: STAFF_APPLICATION_CATEGORY_ID,
                topic: `Staff Application by ${user.id} (${user.tag})`,
                permissionOverwrites: overwrites
            });

            // ── Ticket embed ────────────────────────────────────────────
            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setAuthor({ name: `${user.username}'s Staff Application`, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setDescription(
                    `A new staff application has been submitted.\n` +
                    `Please review the answers below and discuss with the team.`
                )
                .addFields(
                    { name: '❓  Why do you want to be staff?', value: this.limitField(why) },
                    { name: '🎂  Age',                          value: this.limitField(age), inline: true },
                    { name: '🕐  Availability / Timezone',      value: this.limitField(schedule), inline: true },
                    { name: '💼  Experience',                    value: this.limitField(experience) },
                    { name: '📎  Extra Information',             value: this.limitField(extra) }
                )
                .addFields(
                    { name: '👤  Applicant', value: `${user} (\`${user.id}\`)`, inline: true },
                    { name: '📅  Submitted',  value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setFooter({ text: 'sloWmo  •  Staff Applications' })
                .setTimestamp();

            const closeButton = new ButtonBuilder()
                .setCustomId('confirm_close')
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');
            const buttonRow = new ActionRowBuilder().addComponents(closeButton);

            const mention = staffRole ? `<@&${STAFF_MENTION_ROLE_ID}>` : '';
            await channel.send({
                content: `${mention} — New application from ${user}`,
                embeds: [embed],
                components: [buttonRow]
            });

            await interaction.editReply({
                content: `✅ Your staff application has been submitted in ${channel}.`
            });
        } catch (error) {
            console.error('Error creating staff application ticket:', error);
            await interaction.editReply({
                content: '❌ There was an error creating your staff application ticket. Please contact an administrator.'
            });
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────
    static slugify(name) {
        if (!name) return '';
        return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }

    static limitField(value) {
        const text = String(value || 'Not provided.');
        return text.length > 1024 ? `${text.slice(0, 1021)}...` : text;
    }
}

module.exports = StaffApplicationHandler;