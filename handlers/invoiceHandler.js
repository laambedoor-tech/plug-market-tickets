const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../config.json');

async function fetchInvoiceByOrderId(orderId) {
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_KEY;
    const supabaseTable = config.supabaseTable || process.env.SUPABASE_TABLE || 'orders';

    if (supabaseUrl && supabaseKey) {
        const headers = {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json'
        };

        let url = `${supabaseUrl}/rest/v1/${supabaseTable}?short_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`;
        let res = await fetch(url, { headers });
        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows) && rows[0]) return rows[0];
        }

        if (orderId.includes('-')) {
            url = `${supabaseUrl}/rest/v1/${supabaseTable}?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`;
            res = await fetch(url, { headers });
            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows) && rows[0]) return rows[0];
            }
        }
    }
    return null;
}

class InvoiceHandler {
    static async handleInteraction(interaction) {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('invoice_items:')) {
                await this.showItems(interaction);
            } else if (interaction.customId.startsWith('invoice_replace:')) {
                await this.showReplaceModal(interaction);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('replace_account_modal:')) {
                await this.handleReplaceSubmit(interaction);
            }
        }
    }

    static async showItems(interaction) {
        const orderId = interaction.customId.split(':')[1];

        await interaction.deferReply({ ephemeral: true });

        try {
            const invoice = await fetchInvoiceByOrderId(orderId);
            
            if (!invoice) {
                return interaction.editReply({ content: `❌ No se encontró la orden.` });
            }

            let items = invoice?.items ?? invoice?.products ?? [];
            if (typeof items === 'string') {
                try { items = JSON.parse(items); } catch (_) { items = []; }
            }

            // Log para depurar
            console.log('[invoice_items] Raw items:', JSON.stringify(items, null, 2));

            if (!Array.isArray(items) || items.length === 0) {
                return interaction.editReply({ content: `❌ No hay items en esta orden.` });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📦 Order Items • ${orderId}`)
                .setColor(config.colors.primary)
                .setFooter({ text: 'Plug Market', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            items.forEach((it, idx) => {
                console.log(`[invoice_items] Item ${idx}:`, typeof it, JSON.stringify(it));
                
                let name, email, password;
                
                // Si es un string, parsearlo primero
                let itemObj = it;
                if (typeof it === 'string') {
                    try {
                        itemObj = JSON.parse(it);
                        console.log(`[invoice_items] Parsed item ${idx}:`, JSON.stringify(itemObj));
                    } catch (e) {
                        console.error(`[invoice_items] Failed to parse item ${idx}:`, e);
                        itemObj = { name: it };
                    }
                }
                
                // Construir nombre del producto
                if (itemObj?.pid && itemObj?.plan) {
                    name = `${itemObj.pid.charAt(0).toUpperCase() + itemObj.pid.slice(1)} ${itemObj.plan}`;
                } else {
                    name = itemObj?.name ?? itemObj?.title ?? itemObj?.plan ?? `Item ${idx + 1}`;
                }
                
                // Buscar credenciales en itemObj.credentials primero
                if (itemObj?.credentials && typeof itemObj.credentials === 'object') {
                    email = itemObj.credentials.email ?? '—';
                    password = itemObj.credentials.password ?? '—';
                    console.log(`[invoice_items] Found credentials in object:`, email, password);
                } else if (typeof itemObj?.credentials === 'string') {
                    // Si credentials es un string JSON, parsearlo
                    try {
                        const creds = JSON.parse(itemObj.credentials);
                        email = creds.email ?? '—';
                        password = creds.password ?? '—';
                        console.log(`[invoice_items] Parsed credentials from string:`, email, password);
                    } catch {
                        email = '—';
                        password = '—';
                    }
                } else {
                    email = itemObj?.email ?? itemObj?.account_email ?? '—';
                    password = itemObj?.password ?? itemObj?.account_password ?? '—';
                    console.log(`[invoice_items] Using fallback credentials:`, email, password);
                }

                embed.addFields({
                    name: `${idx + 1}. ${name}`,
                    value: `📧 Email: \`${email}\`\n🔑 Password: \`${password}\``,
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Error fetching items:', err);
            await interaction.editReply({ content: `❌ Error obteniendo los items: ${err.message}` });
        }
    }

    static async showReplaceModal(interaction) {
        const invoiceId = interaction.customId.split(':')[1];

        const modal = new ModalBuilder()
            .setCustomId(`replace_account_modal:${invoiceId}`)
            .setTitle('🔄 Mark as Replacement');

        const userIdInput = new TextInputBuilder()
            .setCustomId('user_id_field')
            .setLabel('Discord User ID del cliente')
            .setPlaceholder('Click derecho en el usuario → Copiar ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(17)
            .setMaxLength(20);

        const accountInput = new TextInputBuilder()
            .setCustomId('account_field')
            .setLabel('Cuenta / Credenciales a enviar')
            .setPlaceholder('Ej: usuario@gmail.com | contraseña')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(500);

        const row1 = new ActionRowBuilder().addComponents(userIdInput);
        const row2 = new ActionRowBuilder().addComponents(accountInput);
        modal.addComponents(row1, row2);

        await interaction.showModal(modal);
    }

    static async handleReplaceSubmit(interaction) {
        const [, invoiceId] = interaction.customId.split(':');
        const userId = interaction.fields.getTextInputValue('user_id_field');
        const account = interaction.fields.getTextInputValue('account_field');

        // Obtener usuario por ID
        const targetUser = await interaction.client.users.fetch(userId).catch(() => null);

        if (!targetUser) {
            return interaction.reply({
                content: '❌ No se pudo encontrar al usuario. Verifica que el ID sea correcto.',
                ephemeral: true
            });
        }

        // Enviar al usuario
        const userEmbed = new EmbedBuilder()
            .setTitle('🔄 Replacement Ready')
            .setDescription(`Your replacement is ready. Use the account below to access your product.`)
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
                content: `✅ Replacement enviado a ${targetUser.tag} (${targetUser.id})`,
                ephemeral: true
            });
        } catch (err) {
            console.error('Error sending replacement:', err);
            await interaction.reply({
                content: `❌ Error enviando el mensaje a ${targetUser.tag}. ¿Tiene los DMs cerrados?`,
                ephemeral: true
            });
        }
    }
}

module.exports = InvoiceHandler;
