const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const SUGGESTION_CHANNEL_ID = '1462515571110313985'; // Canal donde se envían las sugerencias

module.exports = {
    async handleButton(interaction) {
        // Crear modal para la sugerencia
        const modal = new ModalBuilder()
            .setCustomId('suggestion_modal')
            .setTitle('Please fill this out');

        // Campo de texto para la sugerencia
        const suggestionInput = new TextInputBuilder()
            .setCustomId('suggestion_text')
            .setLabel('Which Product Should be Restock or Add')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Add (product name) / restock (which product)')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(200);

        const actionRow = new ActionRowBuilder().addComponents(suggestionInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        const suggestionText = interaction.fields.getTextInputValue('suggestion_text');

        // Obtener el canal de sugerencias
        const suggestionChannel = await interaction.client.channels.fetch(SUGGESTION_CHANNEL_ID);

        if (!suggestionChannel) {
            return interaction.reply({
                content: '❌ Could not find the suggestions channel.',
                flags: 64
            });
        }

        // Crear el embed de la sugerencia
        const suggestionEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({
                name: interaction.user.tag,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setDescription(suggestionText)
            .setTimestamp();

        // Enviar al canal de sugerencias
        await suggestionChannel.send({ embeds: [suggestionEmbed] });

        // Responder al usuario (mensaje efímero)
        await interaction.reply({
            content: '✅ We have received your suggestion.',
            flags: 64
        });
    }
};
