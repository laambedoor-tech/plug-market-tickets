const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

// ========================================
// Obtener credenciales desde Supabase
// ========================================
async function fetchCredentialsFromSupabase(productName) {
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_KEY;
    const credentialsTable = config.credentialsTable || 'credentials'; // Nombre de la tabla

    if (!supabaseUrl || !supabaseKey) {
        return null;
    }

    try {
        const headers = {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
        };

        // Buscar credenciales disponibles para el producto
        const url = `${supabaseUrl}/rest/v1/${credentialsTable}?product=eq.${encodeURIComponent(productName.toLowerCase())}&available=eq.true&select=*&limit=50`;
        const res = await fetch(url, { headers });

        if (res.ok) {
            const credentials = await res.json();
            return credentials;
        }
    } catch (error) {
        console.error('[replace] Error fetching credentials:', error);
    }

    return null;
}

// ========================================
// Marcar credencial como usada
// ========================================
async function markCredentialAsUsed(credentialId) {
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_KEY;
    const credentialsTable = config.credentialsTable || 'credentials';

    if (!supabaseUrl || !supabaseKey) return;

    try {
        const headers = {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
        };

        const url = `${supabaseUrl}/rest/v1/${credentialsTable}?id=eq.${credentialId}`;
        await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ available: false, used_at: new Date().toISOString() })
        });
    } catch (error) {
        console.error('[replace] Error marking credential as used:', error);
    }
}

// ========================================
// Actualizar orden en Supabase
// ========================================
async function updateOrderReplaced(orderId) {
    const supabaseUrl = config.supabaseUrl || process.env.SUPABASE_URL;
    const supabaseKey = config.supabaseKey || process.env.SUPABASE_KEY;
    const ordersTable = config.supabaseTable || 'orders';

    if (!supabaseUrl || !supabaseKey) {
        console.warn('[replace] ❌ No Supabase credentials');
        return false;
    }

    try {
        const headers = {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        };

        console.log(`[replace] 🔍 Buscando orden: "${orderId}" en tabla: "${ordersTable}"`);

        let searchUrl;
        // Verificar si es un UUID (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
        
        if (isUUID) {
            // Si es UUID, buscar por id
            searchUrl = `${supabaseUrl}/rest/v1/${ordersTable}?id=eq.${encodeURIComponent(orderId)}&select=id,short_id,replaced`;
            console.log(`[replace] 📝 Buscando por UUID (id)`);
        } else {
            // Si no es UUID, buscar por short_id
            searchUrl = `${supabaseUrl}/rest/v1/${ordersTable}?short_id=eq.${encodeURIComponent(orderId)}&select=id,short_id,replaced`;
            console.log(`[replace] 📝 Buscando por short_id`);
        }
        
        console.log(`[replace] 🌐 URL: ${searchUrl}`);
        
        const searchRes = await fetch(searchUrl, { headers });
        
        if (!searchRes.ok) {
            const errorText = await searchRes.text();
            console.error(`[replace] ❌ Búsqueda falló: ${searchRes.status} - ${errorText}`);
            return false;
        }

        const orders = await searchRes.json();
        console.log(`[replace] 📦 Resultados: ${orders.length}`);

        if (orders.length === 0) {
            console.warn(`[replace] ❌ Orden NO encontrada: "${orderId}"`);
            return false;
        }

        const order = orders[0];
        console.log(`[replace] ✅ Orden encontrada - ID: ${order.id}, short_id: ${order.short_id}, replaced actual: ${order.replaced}`);

        // Actualizar con replaced = true
        const updateUrl = `${supabaseUrl}/rest/v1/${ordersTable}?id=eq.${encodeURIComponent(order.id)}`;
        console.log(`[replace] 🔄 Actualizando...`);
        
        const updateRes = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
                ...headers,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ replaced: true })
        });

        console.log(`[replace] 📡 Update status: ${updateRes.status}`);

        if (!updateRes.ok) {
            const errorText = await updateRes.text();
            console.error(`[replace] ❌ Update falló: ${updateRes.status} - ${errorText}`);
            return false;
        }

        const updated = await updateRes.json();
        console.log(`[replace] 🎉 ¡ÉXITO! replaced ahora es: true para orden ${orderId}`);
        return true;

    } catch (error) {
        console.error('[replace] 💥 Exception:', error.message);
        return false;
    }
}

// ========================================
// Obtener credenciales
// ========================================
async function getCredentials(productName) {
    const supabaseCredentials = await fetchCredentialsFromSupabase(productName);
    if (supabaseCredentials && supabaseCredentials.length > 0) {
        const selected = supabaseCredentials[0];
        return {
            email: selected.email || selected.account,
            password: selected.password,
            id: selected.id,
            fromSupabase: true
        };
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('replace')
        .setDescription('🔄 Enviar replacement automático con credenciales de Supabase')
        .addStringOption(opt =>
            opt
                .setName('product')
                .setDescription('Nombre del producto (Netflix, Disney, Spotify, HBO, Prime, etc.)')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addUserOption(opt =>
            opt
                .setName('user')
                .setDescription('Usuario que recibirá las credenciales')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName('order_id')
                .setDescription('ID de la orden')
                .setRequired(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        // Lista de productos disponibles
        const availableProducts = [
            'Netflix',
            'Disney',
            'Disney+',
            'Spotify',
            'HBO',
            'HBO Max',
            'Prime Video',
            'Amazon Prime',
            'Paramount+',
            'Apple TV+',
            'Crunchyroll',
            'YouTube Premium',
            'Canva',
            'VPN'
        ];

        const filtered = availableProducts
            .filter(product => product.toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(product => ({ name: product, value: product.toLowerCase() }))
        );
    },

    async execute(interaction) {
        const productName = interaction.options.getString('product');
        const targetUser = interaction.options.getUser('user');
        const orderId = interaction.options.getString('order_id');

        await interaction.deferReply();

        try {
            const credentials = await getCredentials(productName);

            if (!credentials) {
                return interaction.editReply({
                    content: `❌ No hay credenciales disponibles para **${productName}**.`,
                    ephemeral: true
                });
            }

            const credentialText = `${credentials.email}:${credentials.password}`;

            const embed = new EmbedBuilder()
                .setTitle('🔄 Replacement - Credenciales Automáticas')
                .setDescription(`${targetUser.toString()}, aquí están tus credenciales de replacement para **${productName}**`)
                .setColor(config.colors.success || '#06d6a0')
                .addFields(
                    { name: '🆔 Order ID', value: orderId, inline: true },
                    { name: '📦 Producto', value: productName.toUpperCase(), inline: true },
                    { name: '👤 Staff', value: interaction.user.toString(), inline: true },
                    { 
                        name: '🔑 Credenciales', 
                        value: `\`\`\`\n${credentialText}\n\`\`\``, 
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: `Plug Market • Sistema Automático`, 
                    iconURL: interaction.client.user.displayAvatarURL() 
                })
                .setTimestamp();

            if (credentials.id) {
                await markCredentialAsUsed(credentials.id);
            }

            const orderUpdated = await updateOrderReplaced(orderId);

            await interaction.editReply({ embeds: [embed] });
            console.log(`[replace] ${interaction.user.tag} sent credentials for order ${orderId}`);

        } catch (error) {
            console.error('[replace] Error:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error. Intenta de nuevo.',
                ephemeral: true
            });
        }
    }
};
