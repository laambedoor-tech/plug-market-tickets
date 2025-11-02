const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Log de interacciones para debugging
        if (interaction.isChatInputCommand()) {
            console.log(`🔧 Comando ejecutado: /${interaction.commandName} por ${interaction.user.tag} en ${interaction.guild?.name || 'DM'}`);
        } else if (interaction.isButton()) {
            console.log(`🔘 Botón presionado: ${interaction.customId} por ${interaction.user.tag}`);
        } else if (interaction.isStringSelectMenu()) {
            console.log(`📋 Menú usado: ${interaction.customId} (${interaction.values[0]}) por ${interaction.user.tag}`);
        }
    },
};