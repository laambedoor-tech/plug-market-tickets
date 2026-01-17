const { SlashCommandBuilder } = require('discord.js');
const { buildMinecraftEmbed } = require('../handlers/productHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('minecraft')
        .setDescription('🟩 Publish the Minecraft Lifetime product page')
        .addChannelOption(opt =>
            opt
                .setName('channel')
                .setDescription('Channel to publish (optional, defaults to current)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        // Minimal permission check: ensure channel is text-based
        if (!targetChannel.isTextBased()) {
            return interaction.reply({ content: '❌ The selected channel must be text-based.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const { embed, row } = await buildMinecraftEmbed(interaction);
            await targetChannel.send({ embeds: [embed], components: [row] });
            await interaction.editReply({ content: `✅ Product page published in ${targetChannel}` });
        } catch (e) {
            console.error('[minecraft] execute error:', e);
            await interaction.editReply({ content: `❌ Could not publish the product page: ${e.message}` });
        }
    }
};
