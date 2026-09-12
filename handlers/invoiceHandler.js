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

        await interaction.deferReply({ flags: 64 });

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
                .setFooter({ text: 'sloWmo', iconURL: interaction.client.user.displayAvatarURL() })
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
            .setTitle('Mark as Replacement');

        const dataInput = new TextInputBuilder()
            .setCustomId('replacement_data')
            .setLabel('Línea 1: User ID | Línea 2+: Credenciales')
            .setPlaceholder('442385253525618699\nemail@gmail.com:password123')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(20)
            .setMaxLength(1000);

        const row = new ActionRowBuilder().addComponents(dataInput);
        modal.addComponents(row);

        return interaction.showModal(modal);
    }

    static async handleReplaceSubmit(interaction) {
        const [, invoiceId] = interaction.customId.split(':');
        const rawData = interaction.fields.getTextInputValue('replacement_data');
        
        // Separar primera línea (User ID) del resto (credenciales)
        const lines = rawData.trim().split('\n');
        const userId = lines[0].trim();
        const account = lines.slice(1).join('\n').trim() || 'No credentials provided';

        // Validar que el User ID tenga formato correcto
        if (!/^\d{17,20}$/.test(userId)) {
            return interaction.reply({
                content: '❌ El User ID debe estar en la primera línea y tener 17-20 dígitos.',
                flags: 64
            });
        }

        // Obtener usuario por ID
        const targetUser = await interaction.client.users.fetch(userId).catch(() => null);

        if (!targetUser) {
            return interaction.reply({
                content: '❌ No se pudo encontrar al usuario. Verifica que el ID sea correcto.',
                flags: 64
            });
        }

        // Enviar en el canal público (visible para todos)
        const replacementEmbed = new EmbedBuilder()
            .setTitle('🔄 Replacement Ready')
            .setDescription(`${targetUser.toString()}, your replacement is ready. Use the account below to access your product.`)
            .setColor(config.colors.success)
            .addFields(
                { name: '🆔 Order ID', value: invoiceId, inline: true },
                { name: '👤 Staff', value: interaction.user.toString(), inline: true },
                { name: '📝 Account / Credentials', value: `\`\`\`\n${account}\n\`\`\``, inline: false }
            )
            .setFooter({ text: 'sloWmo • Replacement System', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [replacementEmbed] });
    }
}

module.exports = InvoiceHandler;
