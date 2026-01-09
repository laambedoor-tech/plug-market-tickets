const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../config.json');

class InvoiceHandler {
    static async handleInteraction(interaction) {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('invoice_items:')) {
                await this.showItems(interaction);
            } else if (interaction.customId.startsWith('invoice_replace:')) {
                await this.showReplaceModal(interaction);
            } else if (interaction.customId === 'invoice_help') {
                await this.showHelp(interaction);
            } else if (interaction.customId === 'invoice_review') {
                await this.showReview(interaction);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('replace_account_modal:')) {
                await this.handleReplaceSubmit(interaction);
            }
        }
    }

    static async showItems(interaction) {
        const invoiceId = interaction.customId.split(':')[1];
        const user = interaction.user;

        const embed = new EmbedBuilder()
            .setTitle('📦 Order Items')
            .setDescription(`Invoice: ${invoiceId}`)
            .setColor(config.colors.primary)
            .setFooter({ text: 'Plug Market', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }

    static async showReplaceModal(interaction) {
        const invoiceId = interaction.customId.split(':')[1];

        const modal = new ModalBuilder()
            .setCustomId(`replace_account_modal:${invoiceId}:${interaction.user.id}`)
            .setTitle('🔄 Mark as Replacement');

        const accountInput = new TextInputBuilder()
            .setCustomId('account_field')
            .setLabel('Cuenta / Credenciales a enviar')
            .setPlaceholder('Ej: usuario@gmail.com | contraseña')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500);

        const row = new ActionRowBuilder().addComponents(accountInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }

    static async handleReplaceSubmit(interaction) {
        const [, invoiceId, userId] = interaction.customId.split(':');
        const account = interaction.fields.getTextInputValue('account_field');

        // Obtener usuario original
        const targetUser = await interaction.client.users.fetch(userId).catch(() => null);

        if (!targetUser) {
            return interaction.reply({
                content: '❌ No se pudo encontrar al usuario.',
                ephemeral: true
            });
        }

        // Enviar al usuario
        const userEmbed = new EmbedBuilder()
            .setTitle('🔄 Replacement Ready')
            .setDescription(`Your replacement is ready. Use the account below to view and download it.`)
            .setColor(config.colors.success)
            .addFields(
                { name: '🆔 Order ID', value: invoiceId, inline: true },
                { name: '👤 Staff', value: interaction.user.toString(), inline: true },
                { name: '📝 Account / Credentials', value: `\`\`\`\n${account}\n\`\`\``, inline: false }
            )
            .setFooter({ text: 'Plug Market • Replacement System', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        try {
            await targetUser.send({ embeds: [userEmbed] });
            await interaction.reply({
                content: `✅ Replacement enviado a ${targetUser.tag}`,
                ephemeral: true
            });
        } catch (err) {
            console.error('Error sending replacement:', err);
            await interaction.reply({
                content: `❌ Error enviando el mensaje al usuario. ¿Tiene los DMs abiertos?`,
                ephemeral: true
            });
        }
    }

    static async showHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('❓ Still Need Help?')
            .setDescription('Create a support ticket to get help from our team.')
            .setColor(config.colors.secondary)
            .addFields(
                { name: 'Contact Support', value: 'Use `/ticket` to create a support ticket', inline: false }
            )
            .setFooter({ text: 'Plug Market Support', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }

    static async showReview(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('⭐ Review Us')
            .setDescription('Help us improve by sharing your feedback!')
            .setColor(config.colors.primary)
            .addFields(
                { name: 'Feedback', value: 'Your review helps us serve you better', inline: false }
            )
            .setFooter({ text: 'Plug Market', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
}

module.exports = InvoiceHandler;
