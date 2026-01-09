const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
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
        // Primero intentamos por columna dedicada 'short_id' si existe
        const headers = {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Accept: 'application/json'
        };

        // 1) short_id = orderId
        let url = `${supabaseUrl}/rest/v1/${supabaseTable}?short_id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`;
        console.log(`[invoice] Query short_id for ${orderId}`);
        let res = await fetchWithTimeout(url, { headers });
        if (!res.ok) throw new Error(`Supabase error (${res.status})`);
        let rows = await res.json();
        if (Array.isArray(rows) && rows[0]) return rows[0];

        // 2) fallback: order_id empieza por orderId (primeros 8 dígitos)
        // Usamos operador LIKE con sufijo % para prefijo
        url = `${supabaseUrl}/rest/v1/${supabaseTable}?order_id=like.${encodeURIComponent(orderId)}%25&select=*&limit=1`;
        console.log(`[invoice] Query order_id prefix for ${orderId}`);
        res = await fetchWithTimeout(url, { headers });
        if (!res.ok) throw new Error(`Supabase error (${res.status})`);
        rows = await res.json();
        if (Array.isArray(rows) && rows[0]) return rows[0];

        // 2b) fallback alternativo: columna 'id' empieza por esos 8 dígitos
        url = `${supabaseUrl}/rest/v1/${supabaseTable}?id=like.${encodeURIComponent(orderId)}%25&select=*&limit=1`;
        console.log(`[invoice] Query id prefix for ${orderId}`);
        res = await fetchWithTimeout(url, { headers });
        if (!res.ok) throw new Error(`Supabase error (${res.status})`);
        rows = await res.json();
        if (Array.isArray(rows) && rows[0]) return rows[0];

        // 3) otro fallback: id numérico exacto
        if (/^\d+$/.test(orderId)) {
            url = `${supabaseUrl}/rest/v1/${supabaseTable}?id=eq.${orderId}&select=*&limit=1`;
            console.log(`[invoice] Query id exact for ${orderId}`);
            res = await fetchWithTimeout(url, { headers });
            if (!res.ok) throw new Error(`Supabase error (${res.status})`);
            rows = await res.json();
            if (Array.isArray(rows) && rows[0]) return rows[0];
        }

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
    const e = new EmbedBuilder()
        .setTitle(`🧾 Invoice • ${invoice?.order_id ?? invoice?.id ?? 'Unknown'}`)
        .setColor(config.colors.primary)
        .setTimestamp();

    // General info
    const status = invoice?.status ?? invoice?.state ?? 'Unknown';
    const gateway = invoice?.gateway ?? invoice?.payment_gateway ?? 'Unknown';
    const email = invoice?.email ?? invoice?.buyer_email ?? invoice?.customer_email ?? 'Unknown';
    const createdAt = invoice?.created_at ?? invoice?.createdAt ?? invoice?.created ?? null;
    const completedAt = invoice?.completed_at ?? invoice?.completedAt ?? null;

    e.addFields(
        { name: 'Status', value: String(status), inline: true },
        { name: 'Gateway', value: String(gateway), inline: true },
        { name: 'Email', value: String(email), inline: true }
    );

    // Amounts
    // total_cents -> euros
    const totalPrice = (invoice?.total_price ?? invoice?.total ?? invoice?.amount ?? (typeof invoice?.total_cents === 'number' ? invoice.total_cents / 100 : null));
    const totalPaid = invoice?.total_paid ?? invoice?.paid ?? null;
    if (totalPrice !== null || totalPaid !== null) {
        const fmt = v => typeof v === 'number' ? `${v.toFixed(2)} €` : String(v);
        e.addFields({
            name: 'Amounts',
            value: `Total Price: ${totalPrice !== null ? fmt(totalPrice) : '—'}\nTotal Paid: ${totalPaid !== null ? fmt(totalPaid) : '—'}`,
            inline: false
        });
    }

    // PayPal or payment info
    const txid = invoice?.txid ?? invoice?.transaction_id ?? invoice?.payment_txid ?? invoice?.payment_intent_id ?? null;
    const note = invoice?.note ?? invoice?.description ?? null;
    const payerEmail = invoice?.payer_email ?? invoice?.paypal_email ?? null;
    if (txid || note || payerEmail) {
        e.addFields({
            name: 'Payment Info',
            value: `${payerEmail ? `Email: ${payerEmail}\n` : ''}${txid ? `TxID: ${txid}\n` : ''}${note ? `Note: ${String(note)}` : ''}`.trim() || '—',
            inline: false
        });
    }

    // Items
    // Admite items como array o JSON string
    let items = invoice?.items ?? invoice?.products ?? null;
    if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (_) {}
    }
    if (Array.isArray(items) && items.length) {
        const lines = items.map((it, idx) => {
            const name = it?.name ?? it?.title ?? `Item ${idx + 1}`;
            const qty = it?.quantity ?? it?.qty ?? 1;
            const price = it?.price ?? it?.unit_price ?? null;
            const priceStr = price !== null ? `${Number(price).toFixed(2)} €` : '';
            return `${idx + 1}. ${name}${qty ? ` x${qty}` : ''}${priceStr ? ` • ${priceStr}` : ''}`;
        }).join('\n');
        e.addFields({ name: 'Items', value: lines, inline: false });
    }

    // Timestamps
    if (createdAt || completedAt) {
        const toDiscordTs = ts => {
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
    return e;
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
        await interaction.deferReply({ ephemeral: true });

        try {
            const invoice = await fetchInvoiceByOrderId(orderId);
            if (!invoice) {
                return interaction.editReply({ content: `❌ No se encontró información para Order ID: ${orderId}` });
            }

            const embed = buildInvoiceEmbed(invoice, interaction);
            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('Invoice lookup error:', err);
            const msg = err?.message?.includes('No billing backend configured')
                ? '❌ Backend de facturas no configurado. Agrega `supabaseUrl`/`supabaseKey` o `invoicesApiUrl` en config.json.'
                : `❌ Error consultando la orden: ${err.message}`;
            await interaction.editReply({ content: msg });
        }
    }
};
