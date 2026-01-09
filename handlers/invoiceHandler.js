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

            if (!Array.isArray(items) || items.length === 0) {
                return interaction.editReply({ content: `❌ No hay items en esta orden.` });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📦 Order Items • ${orderId}`)
                .setColor(config.colors.primary)
                .setFooter({ text: 'Plug Market', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            items.forEach((it, idx) => {
                let name, email, password;
                
                if (typeof it === 'string') {
                    try {
                        const parsed = JSON.parse(it);
                        name = parsed.plan ?? parsed.name ?? parsed.pid ?? `Item ${idx + 1}`;
                        // Buscar en credentials primero
                        if (parsed.credentials && typeof parsed.credentials === 'object') {
                            email = parsed.credentials.email ?? '—';
                            password = parsed.credentials.password ?? '—';
                        } else {
                            email = parsed.email ?? parsed.account_email ?? '—';
                            password = parsed.password ?? parsed.account_password ?? '—';
                        }
                    } catch {
                        name = it;
                        email = '—';
                        password = '—';
                    }
                } else {
                    // Construir nombre del producto
                    if (it?.pid && it?.plan) {
                        name = `${it.pid.charAt(0).toUpperCase() + it.pid.slice(1)} ${it.plan}`;
                    } else {
                        name = it?.name ?? it?.title ?? it?.plan ?? `Item ${idx + 1}`;
                    }
                    
                    // Buscar credenciales en it.credentials primero
                    if (it?.credentials && typeof it.credentials === 'object') {
                        email = it.credentials.email ?? '—';
                        password = it.credentials.password ?? '—';
                    } else {
                        email = it?.email ?? it?.account_email ?? '—';
                        password = it?.password ?? it?.account_password ?? '—';
                    }
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
}

module.exports = InvoiceHandler;
