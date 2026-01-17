const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');

const PRODUCT_KEYS = {
    minecraft: {
        nfa: 'minecraft_nfa_lifetime',
        fa: 'minecraft_fa_lifetime'
    }
};

async function fetchStock(productKey) {
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_KEY;
    const credentialsTable = config.credentialsTable || 'credentials';

    if (!supabaseUrl || !supabaseKey) return 0;

    try {
        const headers = {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json',
            Prefer: 'count=exact'
        };

        const url = `${supabaseUrl}/rest/v1/${credentialsTable}?product=eq.${encodeURIComponent(productKey)}&available=eq.true&select=id`;
        const res = await fetch(url, { headers });
        if (!res.ok) return 0;

        // Try exact count from header; fallback to array length
        const range = res.headers.get('content-range');
        if (range && range.includes('/')) {
            const total = parseInt(range.split('/')[1], 10);
            if (!isNaN(total)) return total;
        }

        const rows = await res.json();
        return Array.isArray(rows) ? rows.length : 0;
    } catch (e) {
        console.error('[product] fetchStock error:', e);
        return 0;
    }
}

async function buildMinecraftEmbed(interaction) {
    const nfaKey = PRODUCT_KEYS.minecraft.nfa;
    const faKey = PRODUCT_KEYS.minecraft.fa;
    const [nfaStock, faStock] = await Promise.all([
        fetchStock(nfaKey),
        fetchStock(faKey)
    ]);

    const imageUrl = (config.productImages && config.productImages.minecraft) ||
        'https://i.imgur.com/0Z8lG7v.png'; // Placeholder; replace in config.productImages.minecraft

    const embed = new EmbedBuilder()
        .setTitle('🟩 Minecraft Lifetime')
        .setDescription(
            [
                '✅ Brand New Accounts — Completely fresh, never used before.',
                '✅ Guaranteed Full Access — Email, password, and customization.',
                '✅ Clean Status — No bans on any servers.',
                '✅ Instant Delivery — Receive your account immediately after purchase.',
                '✅ Full Profile Control — Change email, password, and skin anytime.',
                '✅ High Quality & Resell-Friendly — Ideal for personal use or resale.',
                '✅ Verified & Secure — Self-made accounts, 100% clean status.',
                '✅ Support & Replacement — Free replacement if any issue occurs.'
            ].join('\n')
        )
        .addFields(
            { name: '💶 Prices', value: `NFA • 1.00 €\nFA • 4.50 €`, inline: true },
            { name: '📦 Stock', value: `NFA: **${nfaStock}** available\nFA: **${faStock}** available`, inline: true }
        )
        .setColor(config.colors.primary)
        .setImage(imageUrl)
        .setFooter({ text: 'Plug Market • Minecraft', iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

    const buyNfa = new ButtonBuilder()
        .setCustomId('product:buy:minecraft:nfa')
        .setLabel('Buy NFA • 1.00€')
        .setStyle(ButtonStyle.Success);

    const buyFa = new ButtonBuilder()
        .setCustomId('product:buy:minecraft:fa')
        .setLabel('Buy FA • 4.50€')
        .setStyle(ButtonStyle.Primary);

    const refresh = new ButtonBuilder()
        .setCustomId('product:refresh:minecraft')
        .setLabel('Refresh Stock')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄');

    const row = new ActionRowBuilder().addComponents(buyNfa, buyFa, refresh);
    return { embed, row };
}

module.exports = {
    PRODUCT_KEYS,
    fetchStock,
    buildMinecraftEmbed,
    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;

        try {
            if (interaction.customId === 'product:refresh:minecraft') {
                await interaction.deferUpdate();
                const { embed, row } = await buildMinecraftEmbed(interaction);
                await interaction.message.edit({ embeds: [embed], components: [row] });
                return;
            }

            if (interaction.customId === 'product:buy:minecraft:nfa' || interaction.customId === 'product:buy:minecraft:fa') {
                const variant = interaction.customId.endsWith(':nfa') ? 'NFA' : 'FA';
                const price = variant === 'NFA' ? '1.00 €' : '4.50 €';
                const ticketHint = 'Use /ticket panel y elige Purchases para abrir un ticket.';

                await interaction.reply({
                    content: `🧾 Selected: **Minecraft Lifetime ${variant}** (${price}).\n${ticketHint}`,
                    ephemeral: true
                });
                return;
            }
        } catch (e) {
            console.error('[product] handleInteraction error:', e);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Error handling product action.', ephemeral: true }).catch(() => {});
            }
        }
    }
};
