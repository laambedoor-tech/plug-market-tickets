const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

class TicketHandler {
    static async handleInteraction(interaction) {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_category') {
                await this.createTicket(interaction);
            }
        }

        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'confirm_close':
                    await this.confirmClose(interaction);
                    break;
                case 'cancel_close':
                    await this.cancelClose(interaction);
                    break;
                case 'delete_ticket':
                    await this.deleteTicket(interaction);
                    break;
            }
        }
    }

    static async createTicket(interaction) {
        const category = interaction.values[0];
        const user = interaction.user;
        const guild = interaction.guild;
        
        // Sanitize username for channel name (Discord channel names cannot contain '.')
        const slug = this.slugify(user.username);
        const channelName = `ticket-${slug || user.id.slice(-4)}`;

        // Verificar si el usuario ya tiene un ticket abierto
        const existingTicket = guild.channels.cache.find(
            channel => channel.name === channelName && channel.type === ChannelType.GuildText
        );

        if (existingTicket) {
            return interaction.reply({
                content: `❌ You already have an open ticket in ${existingTicket}. Please use it or close it before creating a new one.`,
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Obtener la categoría de tickets
            const ticketCategory = guild.channels.cache.get(config.ticketsCategory);
            
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
                    },
                    {
                        id: config.supportRole,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ManageMessages
                        ]
                    }
                ]
            };

            // Solo añadir parent si es una categoría válida
            if (ticketCategory && ticketCategory.type === 4) { // 4 = CategoryChannel
                channelOptions.parent = ticketCategory;
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
                content: '❌ There was an error creating your ticket. Please contact an administrator.'
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

        // Crear embed de confirmación de cierre
        const embed = new EmbedBuilder()
            .setTitle('🔒 Ticket Cerrado')
            .setDescription(
                `Este ticket ha sido cerrado por ${interaction.user}.\\n\\n` +
                `**Estado:** Cerrado\\n` +
                `**Cerrado por:** ${interaction.user}\\n` +
                `**Fecha:** <t:${Math.floor(Date.now() / 1000)}:F>\\n\\n` +
                `Este canal será eliminado en **10 segundos**. Si necesitas guardar alguna información, hazlo ahora.`
            )
            .setColor(config.colors.error)
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            components: []
        });

        // Enviar log si está configurado
        if (config.logChannel) {
            const userId = channel.topic?.match(/\\((\\d+)\\)/)?.[1];
            if (userId) {
                const user = await interaction.client.users.fetch(userId).catch(() => null);
                await this.sendTicketLog(interaction.guild, user, channel, 'unknown', 'closed', interaction.user);
            }
        }

        // Eliminar el canal después de 10 segundos
        setTimeout(async () => {
            try {
                await channel.delete('Ticket cerrado');
            } catch (error) {
                console.error('Error eliminando canal de ticket:', error);
            }
        }, 10000);
    }

    static async cancelClose(interaction) {
        const embed = new EmbedBuilder()
            .setDescription('✅ El cierre del ticket ha sido cancelado.')
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
            .setTitle(`📊 Ticket ${action === 'created' ? 'Creado' : 'Cerrado'}`)
            .addFields([
                {
                    name: '👤 Usuario',
                    value: user ? `${user.tag} (${user.id})` : 'Usuario desconocido',
                    inline: true
                },
                {
                    name: '📁 Canal',
                    value: channel.toString(),
                    inline: true
                },
                {
                    name: '📂 Categoría',
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
            console.error('Error enviando log:', error);
        }
    }
}

module.exports = TicketHandler;