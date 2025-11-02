const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('🎫 Sistema de tickets de Plug Market')
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Crear el panel principal de tickets')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Cerrar el ticket actual')
                .addStringOption(option =>
                    option
                        .setName('reason')
                        .setDescription('Razón para cerrar el ticket')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Añadir un usuario al ticket')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Usuario a añadir')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remover un usuario del ticket')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Usuario a remover')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'panel':
                await this.createTicketPanel(interaction);
                break;
            case 'close':
                await this.closeTicket(interaction);
                break;
            case 'add':
                await this.addUser(interaction);
                break;
            case 'remove':
                await this.removeUser(interaction);
                break;
        }
    },

    async createTicketPanel(interaction) {
        // Verificar permisos
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: '❌ You do not have permissions to create the ticket panel.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Plug Market - Ticket System')
            .setDescription('**Welcome to Plug Market!**\n\nHere begins the support channel.\n\nIf you need help, click on the option corresponding to the type of ticket you want to open.\n\n**Response time may vary due to many factors, so please be patient.**')
            .setColor(config.colors.primary)
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({
                text: 'Plug Market Support System',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_category')
            .setPlaceholder('Select a ticket category...')
            .addOptions([
                {
                    label: 'Purchases',
                    description: 'To purchase products',
                    value: 'purchases',
                    emoji: config.emojis.purchases
                },
                {
                    label: 'Product not received',
                    description: 'Support for products not received',
                    value: 'not_received',
                    emoji: config.emojis.notReceived
                },
                {
                    label: 'Replace',
                    description: 'Request product replacement',
                    value: 'replace',
                    emoji: config.emojis.replace
                },
                {
                    label: 'Support',
                    description: 'Receive support from the staff team',
                    value: 'support',
                    emoji: config.emojis.support
                }
            ]);

        const row = new ActionRowBuilder()
            .addComponents(selectMenu);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },

    async closeTicket(interaction) {
        const channel = interaction.channel;
        
        // Verificar si es un canal de ticket
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ Este comando solo puede usarse en canales de tickets.',
                ephemeral: true
            });
        }

        // Verificar permisos
        const member = interaction.member;
        const hasStaffRole = member.roles.cache.has(config.supportRole) || member.roles.cache.has(config.adminRole);
        const isTicketOwner = channel.topic && channel.topic.includes(interaction.user.id);

        if (!hasStaffRole && !isTicketOwner && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: '❌ No tienes permisos para cerrar este ticket.',
                ephemeral: true
            });
        }

        const reason = interaction.options.getString('reason') || 'Sin razón especificada';

        const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Cerrado')
            .setDescription(`Este ticket ha sido cerrado por ${interaction.user}.\\n\\n**Razón:** ${reason}`)
            .setColor(config.colors.error)
            .setTimestamp();

        const closeButton = new ButtonBuilder()
            .setCustomId('confirm_close')
            .setLabel('Confirmar Cierre')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_close')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌');

        const row = new ActionRowBuilder()
            .addComponents(closeButton, cancelButton);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    },

    async addUser(interaction) {
        const channel = interaction.channel;
        const user = interaction.options.getUser('user');

        // Verificar si es un canal de ticket
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ Este comando solo puede usarse en canales de tickets.',
                ephemeral: true
            });
        }

        // Verificar permisos
        const member = interaction.member;
        const hasStaffRole = member.roles.cache.has(config.supportRole) || member.roles.cache.has(config.adminRole);

        if (!hasStaffRole && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: '❌ No tienes permisos para añadir usuarios a este ticket.',
                ephemeral: true
            });
        }

        try {
            await channel.permissionOverwrites.edit(user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            const embed = new EmbedBuilder()
                .setDescription(`✅ ${user} ha sido añadido al ticket por ${interaction.user}.`)
                .setColor(config.colors.success);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error añadiendo usuario:', error);
            await interaction.reply({
                content: '❌ Hubo un error al añadir el usuario.',
                ephemeral: true
            });
        }
    },

    async removeUser(interaction) {
        const channel = interaction.channel;
        const user = interaction.options.getUser('user');

        // Verificar si es un canal de ticket
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ Este comando solo puede usarse en canales de tickets.',
                ephemeral: true
            });
        }

        // Verificar permisos
        const member = interaction.member;
        const hasStaffRole = member.roles.cache.has(config.supportRole) || member.roles.cache.has(config.adminRole);

        if (!hasStaffRole && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return interaction.reply({
                content: '❌ No tienes permisos para remover usuarios de este ticket.',
                ephemeral: true
            });
        }

        try {
            await channel.permissionOverwrites.delete(user.id);

            const embed = new EmbedBuilder()
                .setDescription(`✅ ${user} ha sido removido del ticket por ${interaction.user}.`)
                .setColor(config.colors.warning);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error removiendo usuario:', error);
            await interaction.reply({
                content: '❌ Hubo un error al remover el usuario.',
                ephemeral: true
            });
        }
    }
};