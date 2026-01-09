const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config.json');

function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(t));
}

async function fetchInvoiceByOrderId(orderId) {
    // Prefer Supabase REST if configured
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_KEY;
    const supabaseTable = config.supabaseTable || process.env.SUPABASE_TABLE || 'invoices';
    const invoicesApiUrl = config.invoicesApiUrl || process.env.INVOICES_API_URL;

    if (supabaseUrl && supabaseKey) {
        const headers = {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json'
        };

        // Buscar por short_id (primeros 8 caracteres del UUID)
        let url = `${supabaseUrl}/rest/v1/${supabaseTable}?short_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`;
        console.log(`[invoice] Query short_id=${orderId}`);
        
        let res = await fetchWithTimeout(url, { headers });
        if (res.ok) {
            const rows = await res.json();
            console.log(`[invoice] Found ${rows.length || 0} rows`);
            if (Array.isArray(rows) && rows[0]) {
                console.log(`[invoice] Found order: ${rows[0]?.id}`);
                return rows[0];
            }
        } else {
            console.log(`[invoice] short_id query failed (${res.status}), fallback...`);
        }

        // Fallback: buscar por UUID completo (si el user pasa el UUID entero)
        if (orderId.includes('-')) {
            url = `${supabaseUrl}/rest/v1/${supabaseTable}?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`;
            console.log(`[invoice] Query by full UUID`);
            res = await fetchWithTimeout(url, { headers });
            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows) && rows[0]) {
                    return rows[0];
                }
            }
        }

        console.log(`[invoice] No order found for ${orderId}`);
        return null;
    }

    if (invoicesApiUrl) {
        const url = `${invoicesApiUrl}?order_id=${encodeURIComponent(orderId)}`;
        const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`API error (${res.status})`);
        const data = await res.json();
        // Support either { invoice: {...} } or direct object
        return data?.invoice ?? data;
    }

    throw new Error('No billing backend configured. Set supabaseUrl/supabaseKey or invoicesApiUrl.');
}

function buildInvoiceEmbed(invoice, interaction) {
    const invoiceId = invoice?.id ?? invoice?.order_id ?? 'Unknown';
    const shortId = invoiceId.substring(0, 8);
    
    const e = new EmbedBuilder()
        .setTitle(`🧾 Invoice • ${shortId}`)
        .setColor(config.colors.primary)
        .setTimestamp();

    // Status, ID, Completed
    const status = invoice?.status ?? invoice?.state ?? 'Unknown';
    const isCompleted = String(status).toLowerCase().includes('completed') ? 'Yes' : 'No';
    const replace = invoice?.replace ?? 'No';

    e.addFields(
        { name: '🔖 Status', value: String(status), inline: true },
        { name: '🆔 ID', value: shortId, inline: true },
        { name: '✅ Completed', value: isCompleted, inline: true }
    );

    e.addFields(
        { name: '🔄 Replace', value: String(replace), inline: true },
        { name: '💳 Gateway', value: invoice?.gateway ?? invoice?.payment_gateway ?? 'Unknown', inline: true },
        { name: '📧 Email', value: invoice?.email ?? invoice?.buyer_email ?? invoice?.customer_email ?? 'Unknown', inline: true }
    );

    // Amounts
    const totalPrice = (invoice?.total_price ?? invoice?.total ?? invoice?.amount ?? (typeof invoice?.total_cents === 'number' ? invoice.total_cents / 100 : null));
    const totalPaid = invoice?.total_paid ?? invoice?.paid ?? null;
    const fmt = v => typeof v === 'number' ? `${v.toFixed(2)} €` : String(v);
    
    e.addFields({
        name: '💰 Amounts',
        value: `Total Price: ${totalPrice !== null ? fmt(totalPrice) : '—'}\nTotal Paid: ${totalPaid !== null ? fmt(totalPaid) : '—'}`,
        inline: false
    });

    // Payment Info
    const txid = invoice?.txid ?? invoice?.transaction_id ?? invoice?.payment_txid ?? invoice?.payment_intent_id ?? null;
    const note = invoice?.note ?? invoice?.description ?? null;
    const payerEmail = invoice?.payer_email ?? invoice?.paypal_email ?? null;
    
    if (txid || note || payerEmail) {
        let paymentText = '';
        if (payerEmail) paymentText += `Email: ${payerEmail}\n`;
        if (txid) paymentText += `TxID: ${txid}\n`;
        if (note) paymentText += `Note: ${String(note)}`;
        
        e.addFields({
            name: '🏦 PayPal Info',
            value: paymentText.trim() || '—',
            inline: false
        });
    }


    // Items
    let items = invoice?.items ?? invoice?.products ?? null;
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (_) {}
    }
    if (Array.isArray(items) && items.length) {
        const lines = items.map((it, idx) => {
            const name = it?.name ?? it?.title ?? `Item ${idx + 1}`;
            const qty = it?.quantity ?? it?.qty ?? 1;
            const price = it?.price ?? it?.unit_price ?? null;
            const priceStr = price !== null ? `• ${Number(price).toFixed(2)} €` : '';
            return `${idx + 1}. ${name} x${qty} ${priceStr}`;
        }).join('\n');
        e.addFields({ name: '📦 Items', value: lines, inline: false });
    }

    // Dates
    const createdAt = invoice?.created_at ?? invoice?.createdAt ?? invoice?.created ?? null;
    const completedAt = invoice?.completed_at ?? invoice?.completedAt ?? null;
    
    if (createdAt || completedAt) {
        const toDiscordTs = ts => {
            const d = typeof ts === 'string' ? Date.parse(ts) : ts; 
            const s = Math.floor((typeof d === 'number' ? d : Date.now()) / 1000);
            return `<t:${s}:F>`;
        };
        
        if (createdAt && completedAt) {
            e.addFields(
                { name: '📅 Created', value: toDiscordTs(createdAt), inline: true },
                { name: '✔️ Completed', value: toDiscordTs(completedAt), inline: true }
            );
        } else if (createdAt) {
            e.addFields({ name: '📅 Created', value: toDiscordTs(createdAt), inline: false });
        } else if (completedAt) {
            e.addFields({ name: '✔️ Completed', value: toDiscordTs(completedAt), inline: false });
        }
    }

    e.setFooter({ text: 'Plug Market • Invoice Lookup', iconURL: interaction.client.user.displayAvatarURL() });
    
    // Botones de acción
    const seeItemsBtn = new ButtonBuilder()
        .setCustomId(`invoice_items:${invoiceId}`)
        .setLabel('See Items')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📦');
    
    const markReplaceBtn = new ButtonBuilder()
        .setCustomId(`invoice_replace:${invoiceId}`)
        .setLabel('Mark Replace')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔄');
    
    const helpBtn = new ButtonBuilder()
        .setCustomId('invoice_help')
        .setLabel('Still Need Help?')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓');
    
    const reviewBtn = new ButtonBuilder()
        .setCustomId('invoice_review')
        .setLabel('Review Us')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⭐');
    
    const buttonRow = new ActionRowBuilder()
        .addComponents(seeItemsBtn, markReplaceBtn, helpBtn, reviewBtn);
    
    return { embed: e, buttons: buttonRow };
            const d = typeof ts === 'string' ? Date.parse(ts) : ts; 
            const s = Math.floor((typeof d === 'number' ? d : Date.now()) / 1000);
            return `<t:${s}:F>`;
        };
        e.addFields({
            name: 'Dates',
            value: `${createdAt ? `Created: ${toDiscordTs(createdAt)}\n` : ''}${completedAt ? `Completed: ${toDiscordTs(completedAt)}` : ''}`.trim(),
            inline: false
        });
    }

    e.setFooter({ text: 'Plug Market • Invoice Lookup', iconURL: interaction.client.user.displayAvatarURL() });
    
    // Botones de acción
    const seeItemsBtn = new ButtonBuilder()
        .setCustomId(`invoice_items:${invoiceId}`)
        .setLabel('See Items')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📦');
    
    const markReplaceBtn = new ButtonBuilder()
        .setCustomId(`invoice_replace:${invoiceId}`)
        .setLabel('Mark Replace')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔄');
    
    const helpBtn = new ButtonBuilder()
        .setCustomId('invoice_help')
        .setLabel('Still Need Help?')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓');
    
    const reviewBtn = new ButtonBuilder()
        .setCustomId('invoice_review')
        .setLabel('Review Us')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⭐');
    
    const buttonRow = new ActionRowBuilder()
        .addComponents(seeItemsBtn, markReplaceBtn, helpBtn, reviewBtn);
    
    return { embed: e, buttons: buttonRow };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invoice')
        .setDescription('🔎 Consultar una factura/pedido por Order ID')
        .addStringOption(opt =>
            opt
                .setName('order_id')
                .setDescription('ID de la orden/factura')
                .setRequired(true)
        ),

    async execute(interaction) {
        const orderId = interaction.options.getString('order_id');
        
        // Responder INMEDIATAMENTE para evitar timeout de Discord (3s)
        await interaction.deferReply({ flags: 64 }); // 64 = ephemeral flag

        try {
            const invoice = await fetchInvoiceByOrderId(orderId);
            if (!invoice) {
                return interaction.editReply({ content: `❌ No se encontró información para Order ID: ${orderId}` });
            }

            const invoiceData = buildInvoiceEmbed(invoice, interaction);
            await interaction.editReply({ embeds: [invoiceData.embed], components: [invoiceData.buttons] });
        } catch (err) {
            console.error('Invoice lookup error:', err);
            const msg = err?.message?.includes('No billing backend configured')
                ? '❌ Backend de facturas no configurado. Agrega `supabaseUrl`/`supabaseKey` o `invoicesApiUrl` en config.json.'
                : `❌ Error consultando la orden: ${err.message}`;
            await interaction.editReply({ content: msg });
        }
    }
};
