const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const config = require('../config.json');

const ALLOWED_CLOSE_ROLES = new Set((config.allowedCloseRoles || []).map(String));

class TicketHandler {
    static async handleInteraction(interaction) {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_category') {
                await this.createTicket(interaction);
                return;
            }

            if (interaction.customId.startsWith('ticket_review:')) {
                await this.handleReviewSubmission(interaction);
                return;
            }
        }

        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'confirm_close':
                    if (!TicketHandler.hasClosePermission(interaction.member)) {
                        await interaction.reply({ content: '❌ No tienes permiso para cerrar tickets.', flags: 64 });
                        return;
                    }
                    await this.confirmClose(interaction);
                    break;
                case 'cancel_close':
                    if (!TicketHandler.hasClosePermission(interaction.member)) {
                        await interaction.reply({ content: '❌ No tienes permiso para gestionar el cierre del ticket.', flags: 64 });
                        return;
                    }
                    await this.cancelClose(interaction);
                    break;
                case 'delete_ticket':
                    if (!TicketHandler.hasClosePermission(interaction.member)) {
                        await interaction.reply({ content: '❌ No tienes permiso para eliminar tickets.', flags: 64 });
                        return;
                    }
                    await this.deleteTicket(interaction);
                    break;
            }
        }
    }

    static hasClosePermission(member) {
        if (!member) return false;
        return member.roles.cache.some(r => ALLOWED_CLOSE_ROLES.has(String(r.id)));
    }

    static async createTicket(interaction) {
        // DEFER IMMEDIATELY to prevent timeout
        await interaction.deferReply({ flags: 64 });
        
        const category = interaction.values[0];
        const user = interaction.user;
        const guild = interaction.guild;
        
        // Sanitize username for channel name (Discord channel names cannot contain '.')
        const slug = this.slugify(user.username);
        const channelName = `ticket-${slug || user.id.slice(-4)}`;

        // Preflight: ensure the bot has the permissions it needs
        const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
        const missingPerms = [];
        if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
            missingPerms.push('Manage Channels');
        }
        if (!me || !me.permissions.has(PermissionFlagsBits.ViewChannel)) {
            missingPerms.push('View Channels');
        }
        if (missingPerms.length) {
            return interaction.editReply({
                content: `❌ I need the following permissions to create ticket channels: ${missingPerms.join(', ')}. Please grant these to my highest role and try again.`
            });
        }

        // Verificar si el usuario ya tiene un ticket abierto
        const existingTicket = guild.channels.cache.find(
            channel => channel.name === channelName && channel.type === ChannelType.GuildText
        );

        if (existingTicket) {
            return interaction.editReply({
                content: `❌ You already have an open ticket in ${existingTicket}. Please use it or close it before creating a new one.`
            });
        }

        try {
            // Obtener la categoría de tickets
            const ticketCategory = guild.channels.cache.get(config.ticketsCategory);
            const permsInParent = ticketCategory ? me?.permissionsIn(ticketCategory) : null;
            
            // Si no es una categoría válida, crear canal sin categoría
            const channelOptions = {
                name: channelName,
                type: ChannelType.GuildText,
                topic: `Ticket by ${user.tag} (${user.id}) - Category: ${category}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles
                        ]
                    }
                ]
            };

            // Añadir overwrite para el rol de soporte solo si existe
            const supportRole = guild.roles.cache.get(config.supportRole);
            if (supportRole) {
                channelOptions.permissionOverwrites.push({
                    id: supportRole.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.ManageMessages
                    ]
                });
            } else {
                console.warn('config.supportRole no encontrado en el servidor; creando ticket sin overwrite de soporte.');
            }

            // Solo añadir parent si es una categoría válida
            if (ticketCategory && ticketCategory.type === 4) { // 4 = CategoryChannel
                // Verificar permisos dentro de la categoría
                if (permsInParent?.has(PermissionFlagsBits.ManageChannels) && permsInParent?.has(PermissionFlagsBits.ViewChannel)) {
                    channelOptions.parent = ticketCategory;
                } else {
                    console.warn('El bot no tiene permisos suficientes en la categoría de tickets; se creará el canal sin categoría.');
                }
            }

            // Crear el canal del ticket
            const ticketChannel = await guild.channels.create(channelOptions);

            // Crear embed del ticket
            const ticketEmbed = await this.createTicketEmbed(category, user);
            
            // Crear botones del ticket
            const ticketButtons = this.createTicketButtons();

            // Enviar mensaje en el ticket
            await ticketChannel.send({
                content: `${user} | <@&${config.supportRole}>`,
                embeds: [ticketEmbed],
                components: [ticketButtons]
            });

            // Confirmar creación
            await interaction.editReply({
                content: `✅ Your ticket has been successfully created in ${ticketChannel}.`
            });

            // Enviar log si está configurado
            if (config.logChannel) {
                await this.sendTicketLog(guild, user, ticketChannel, category, 'created');
            }

        } catch (error) {
            console.error('Error creando ticket:', error);
            await interaction.editReply({
                content: `❌ There was an error creating your ticket. ${error?.code === 50013 ? 'Missing Permissions: make sure my role has Manage Channels and is above the category.' : ''}`
            });
        }
    }

    static async createTicketEmbed(category, user) {
        const categoryInfo = this.getCategoryInfo(category);
        
        const embed = new EmbedBuilder()
            .setTitle(`🎫 ${categoryInfo.name} Ticket`)
            .setDescription(
                `Hello ${user}! Thank you for contacting **Plug Market**.\n\n` +
                `**Category:** ${categoryInfo.name}\n` +
                `**Description:** ${categoryInfo.description}\n\n` +
                `A member of the support team will assist you soon. Meanwhile, you can provide more details about your inquiry.\n\n` +
                `**What information should you include?**\n` +
                categoryInfo.requirements.map(req => `• ${req}`).join('\n') + '\n\n' +
                `*Response time may vary. Please be patient.*`
            )
            .setColor(config.colors.primary)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields([
                {
                    name: '📋 Ticket Status',
                    value: '🟢 **Open**',
                    inline: true
                },
                {
                    name: '👤 User',
                    value: user.toString(),
                    inline: true
                },
                {
                    name: '📅 Creation Date',
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                    inline: true
                }
            ])
            .setFooter({
                text: 'Plug Market Support System',
                iconURL: 'https://cdn.discordapp.com/attachments/1234567890123456789/1234567890123456789/plug-market-icon.png'
            })
            .setTimestamp();

        return embed;
    }

    static createTicketButtons() {
        const closeButton = new ButtonBuilder()
            .setCustomId('confirm_close')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        return new ActionRowBuilder().addComponents(closeButton);
    }

    static getCategoryInfo(category) {
        const categories = {
            purchases: {
                name: 'Purchases',
                description: 'To purchase products from our store',
                requirements: [
                    'Product you want to purchase',
                    'Preferred payment method',
                    'Any specific questions about the product'
                ]
            },
            not_received: {
                name: 'Product not received',
                description: 'Support for products you have not received after purchase',
                requirements: [
                    'Transaction or purchase ID',
                    'Approximate date of purchase',
                    'Payment method used',
                    'Payment screenshots (if you have them)'
                ]
            },
            replace: {
                name: 'Replace product',
                description: 'Request replacement of a defective or incorrect product',
                requirements: [
                    'Product you need to replace',
                    'Reason for replacement',
                    'Original transaction ID',
                    'Evidence of the problem (screenshots, etc.)'
                ]
            },
            support: {
                name: 'General Support',
                description: 'Receive general help and support from the staff team',
                requirements: [
                    'Detailed description of your inquiry',
                    'Any relevant information',
                    'Screenshots if necessary'
                ]
            }
        };

        return categories[category] || categories.support;
    }

    static async confirmClose(interaction) {
        const channel = interaction.channel;
        
        await interaction.deferUpdate();

        // Close confirmation embed
        const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Closed')
            .setDescription(
                `This ticket has been closed by ${interaction.user}.\\n\\n` +
                `**Status:** Closed\\n` +
                `**Closed by:** ${interaction.user}\\n` +
                `**Date:** <t:${Math.floor(Date.now() / 1000)}:F>\\n\\n` +
                `This channel will be deleted in **10 seconds**. Please save any important information now.`
            )
            .setColor(config.colors.error)
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            components: []
        });

        // Intentar enviar solicitud de review al creador del ticket
        const userId = channel.topic?.match(/\((\d+)\)/)?.[1];
        const ticketOwner = userId ? await interaction.client.users.fetch(userId).catch(() => null) : null;
        const categoryFromTopic = channel.topic?.match(/Category:\s([^)]*)$/)?.[1]?.trim() || 'Unknown';

        if (ticketOwner) {
            await this.sendReviewRequest({
                user: ticketOwner,
                closer: interaction.user,
                ticketChannel: channel,
                category: categoryFromTopic
            });
        }

        // Send log if configured
        if (config.logChannel) {
            const userId = channel.topic?.match(/\((\d+)\)/)?.[1];
            if (userId) {
                const user = await interaction.client.users.fetch(userId).catch(() => null);
                await this.sendTicketLog(interaction.guild, user, channel, 'unknown', 'closed', interaction.user);
            }
        }

        // Delete the channel after 10 seconds
        setTimeout(async () => {
            try {
                await channel.delete('Ticket closed');
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 10000);
    }

    static async cancelClose(interaction) {
        const embed = new EmbedBuilder()
            .setDescription('✅ Ticket closing has been canceled.')
            .setColor(config.colors.success);

        await interaction.update({
            embeds: [embed],
            components: []
        });
    }

    static slugify(name) {
        if (!name) return '';
        return name
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    static async sendTicketLog(guild, user, channel, category, action, staff = null) {
        const logChannel = guild.channels.cache.get(config.logChannel);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle(`📊 Ticket ${action === 'created' ? 'Created' : 'Closed'}`)
            .addFields([
                {
                    name: '👤 User',
                    value: user ? `${user.tag} (${user.id})` : 'Unknown user',
                    inline: true
                },
                {
                    name: '📁 Channel',
                    value: channel.toString(),
                    inline: true
                },
                {
                    name: '📂 Category',
                    value: this.getCategoryInfo(category).name,
                    inline: true
                }
            ])
            .setColor(action === 'created' ? config.colors.success : config.colors.error)
            .setTimestamp();

        if (staff) {
            embed.addFields([
                {
                    name: '👮 Staff',
                    value: `${staff.tag} (${staff.id})`,
                    inline: true
                }
            ]);
        }

        if (user) {
            embed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
        }

        try {
            await logChannel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error sending log:', error);
        }
    }

    static async sendReviewRequest({ user, closer, ticketChannel, category }) {
        const selectId = `ticket_review:${ticketChannel.id}:${user.id}:${closer.id}`;
        const starOptions = [1, 2, 3, 4, 5].map(value => ({
            label: `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`,
            description: `Rating ${value} out of 5`,
            value: String(value)
        }));

        const selectRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(selectId)
                .setPlaceholder('Choose a rating 1-5')
                .addOptions(starOptions)
        );

        const embed = new EmbedBuilder()
            .setTitle('⭐ Rate Your Support Experience')
            .setDescription(
                `Thank you for contacting **Plug Market Support**!\n\n` +
                `Your ticket has been closed. We'd love to hear your feedback!\n` +
                `Please rate the support you received from **${closer ? closer.username : 'our team'}**.`
            )
            .addFields([
                { name: '🎫 Ticket', value: `\`${ticketChannel.name}\``, inline: true },
                { name: '📂 Category', value: category, inline: true },
                { name: '👤 Staff', value: closer ? closer.toString() : 'Unknown', inline: true }
            ])
            .setColor(config.colors.primary)
            .setThumbnail(closer ? closer.displayAvatarURL({ dynamic: true }) : null)
            .setFooter({ text: 'Plug Market • Feedback System' })
            .setTimestamp();

        try {
            // Send review request
            await user.send({ embeds: [embed], components: [selectRow] });

            // Generate and send transcript
            const transcript = await this.generateTranscript(ticketChannel);
            await user.send({
                content: '📄 **Ticket Transcript**\nHere is the complete conversation from your ticket:',
                files: [{
                    attachment: Buffer.from(transcript, 'utf-8'),
                    name: `ticket-${ticketChannel.name}-${Date.now()}.txt`
                }]
            });
        } catch (error) {
            console.warn('Could not send the review request DM to the user:', error.message);
        }
    }

    static async generateTranscript(channel) {
        try {
            const messages = [];
            let lastMessageId;

            // Fetch all messages in the channel
            while (true) {
                const options = { limit: 100 };
                if (lastMessageId) {
                    options.before = lastMessageId;
                }

                const fetchedMessages = await channel.messages.fetch(options);
                if (fetchedMessages.size === 0) break;

                messages.push(...fetchedMessages.values());
                lastMessageId = fetchedMessages.last().id;

                if (fetchedMessages.size < 100) break;
            }

            // Sort messages by timestamp (oldest first)
            messages.reverse();

            // Format transcript
            let transcript = `Ticket transcript #${channel.name}\n`;
            transcript += `Server: ${channel.guild.name} | ${channel.guild.id}\n`;
            transcript += `Channel: ${channel.id}\n`;
            transcript += `Creator: <@${channel.topic?.match(/\((\d+)\)/)?.[1] || 'Unknown'}> (${channel.topic?.match(/\((\d+)\)/)?.[1] || 'Unknown'})\n`;
            transcript += `Closed: ${new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}\n`;
            transcript += '\n';

            for (const message of messages) {
                const timestamp = message.createdAt.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                const author = message.author.tag;
                
                transcript += `[${timestamp}] ${author}: ${message.content}\n`;

                // Include attachments if any
                if (message.attachments.size > 0) {
                    message.attachments.forEach(attachment => {
                        transcript += `[${timestamp}] ${author}: [Adjuntos: ${attachment.url}]\n`;
                    });
                }

                // Include embeds if any
                if (message.embeds.length > 0) {
                    message.embeds.forEach(embed => {
                        if (embed.title) {
                            transcript += `[${timestamp}] ${author}: [Embed - ${embed.title}]\n`;
                        }
                    });
                }
            }

            return transcript;
        } catch (error) {
            console.error('Error generating transcript:', error);
            return `Error generating transcript: ${error.message}`;
        }
    }

    static async handleReviewSubmission(interaction) {
        const [ , ticketId, userId, closerId ] = interaction.customId.split(':');
        const rating = parseInt(interaction.values[0], 10);

        // Confirm to the user in DM
        const stars = '⭐'.repeat(rating);
        const thanksEmbed = new EmbedBuilder()
            .setTitle('✅ Review Submitted!')
            .setDescription(
                `Thank you for your feedback!\n\n` +
                `**Your Rating:** ${stars} (${rating}/5)\n\n` +
                `Your review helps us improve our service quality.`
            )
            .setColor(config.colors.success)
            .setFooter({ text: 'Plug Market • We appreciate your feedback!' })
            .setTimestamp();

        await interaction.update({ embeds: [thanksEmbed], components: [] });

        const reviewChannelId = config.reviewChannel;
        if (!reviewChannelId) return;

        const reviewChannel = await interaction.client.channels.fetch(reviewChannelId).catch(() => null);
        if (!reviewChannel || !reviewChannel.isTextBased()) {
            console.warn('Review channel is invalid or not text-based.');
            return;
        }

        const closerMention = closerId ? `<@${closerId}>` : 'Unknown';
        const userMention = userId ? `<@${userId}>` : interaction.user.toString();
        const starsDisplay = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);

        const reviewEmbed = new EmbedBuilder()
            .setTitle('New feedback received!')
            .setDescription(`Rating: ${starsDisplay} (${rating}/5)`)
            .addFields([
                { name: 'Ticket', value: ticketId ? `#${ticketId}` : 'Unknown', inline: true },
                { name: 'Customer', value: userMention, inline: true },
                { name: 'Staff', value: closerMention, inline: true }
            ])
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setColor(config.colors.error)
            .setFooter({ text: 'wezkoo' })
            .setTimestamp();

        try {
            await reviewChannel.send({ embeds: [reviewEmbed] });
        } catch (error) {
            console.error('Error sending the review to the configured channel:', error);
        }
    }
}

module.exports = TicketHandler;