const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const SUGGESTION_CHANNEL_ID = '1462515571110313985';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggestion')
        .setDescription('💡 Enviar una sugerencia'),

    async execute(interaction) {
        // Crear modal para la sugerencia
        const modal = new ModalBuilder()
            .setCustomId('suggestion_modal')
            .setTitle('Enviar Sugerencia');

        // Campo de texto para la sugerencia
        const suggestionInput = new TextInputBuilder()
            .setCustomId('suggestion_text')
            .setLabel('Tu sugerencia')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Escribe tu sugerencia aquí...')
            .setRequired(true)
            .setMinLength(10)
            .setMaxLength(1000);

        const actionRow = new ActionRowBuilder().addComponents(suggestionInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);

        // Esperar a que el usuario envíe el modal
        try {
            const modalSubmit = await interaction.awaitModalSubmit({
                filter: i => i.customId === 'suggestion_modal' && i.user.id === interaction.user.id,
                time: 300000 // 5 minutos
            });

            const suggestionText = modalSubmit.fields.getTextInputValue('suggestion_text');

            // Obtener el canal de sugerencias
            const suggestionChannel = await interaction.client.channels.fetch(SUGGESTION_CHANNEL_ID);

            if (!suggestionChannel) {
                return modalSubmit.reply({
                    content: '❌ No se pudo encontrar el canal de sugerencias.',
                    flags: 64
                });
            }

            // Crear el embed de la sugerencia
            const suggestionEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setAuthor({
                    name: `${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setDescription(suggestionText)
                .setTimestamp()
                .setFooter({ text: 'Sugerencia' });

            // Enviar al canal de sugerencias
            await suggestionChannel.send({ embeds: [suggestionEmbed] });

            // Responder al usuario (mensaje efímero para que no se vea el comando)
            await modalSubmit.reply({
                content: '✅ Tu sugerencia ha sido enviada correctamente.',
                flags: 64
            });

        } catch (error) {
            console.error('Error al procesar la sugerencia:', error);
            // Si el modal expira o hay un error, no hacer nada (el usuario puede intentar de nuevo)
        }
    }
};
