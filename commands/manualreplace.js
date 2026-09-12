const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manualreplace')
        .setDescription('🔄 Enviar replacement manual de una orden al cliente')
        .addStringOption(opt =>
            opt
                .setName('order_id')
                .setDescription('ID de la orden')
                .setRequired(true)
        )
        .addUserOption(opt =>
            opt
                .setName('user')
                .setDescription('Usuario que recibirá el replacement')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName('credentials')
                .setDescription('Cuenta / Credenciales (ej: email@gmail.com:password123)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const orderId = interaction.options.getString('order_id');
        const targetUser = interaction.options.getUser('user');
        const credentials = interaction.options.getString('credentials');

        // Crear embed de replacement
        const replacementEmbed = new EmbedBuilder()
            .setTitle('🔄 Replacement Ready')
            .setDescription(`${targetUser.toString()}, your replacement is ready. Use the account below to access your product.`)
            .setColor(config.colors.success || '#00ff00')
            .addFields(
                { name: '🆔 Order ID', value: orderId, inline: true },
                { name: '👤 Staff', value: interaction.user.toString(), inline: true },
                { name: '📝 Account / Credentials', value: `\`\`\`\n${credentials}\n\`\`\``, inline: false }
            )
            .setFooter({ text: 'sloWmo • Replacement System', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        // Enviar en el canal público (visible para todos)
        await interaction.reply({ embeds: [replacementEmbed] });
    }
};
