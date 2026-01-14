const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

// ========================================
// OPCIÓN 1: Credenciales guardadas localmente
// ========================================
// Puedes definir las credenciales directamente aquí
const LOCAL_CREDENTIALS = {
    'netflix': [
        { email: 'netflix1@example.com', password: 'password123' },
        { email: 'netflix2@example.com', password: 'password456' },
        { email: 'netflix3@example.com', password: 'password789' }
    ],
    'disney': [
        { email: 'disney1@example.com', password: 'disney123' },
        { email: 'disney2@example.com', password: 'disney456' }
    ],
    'spotify': [
        { email: 'spotify1@example.com', password: 'spotify123' },
        { email: 'spotify2@example.com', password: 'spotify456' }
    ],
    'hbo': [
        { email: 'hbo1@example.com', password: 'hbo123' },
        { email: 'hbo2@example.com', password: 'hbo456' }
    ],
    'prime': [
        { email: 'prime1@example.com', password: 'prime123' },
        { email: 'prime2@example.com', password: 'prime456' }
    ]
};

// ========================================
// OPCIÓN 2: Obtener credenciales desde Supabase
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
        console.error('[autocredentials] Error fetching from Supabase:', error);
    }

    return null;
}

// Función auxiliar para marcar credencial como usada en Supabase
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
        console.error('[autocredentials] Error marking credential as used:', error);
    }
}

// ========================================
// Función principal para obtener credenciales
// ========================================
async function getCredentials(productName, useSupabase = false) {
    if (useSupabase) {
        // Usar Supabase
        const supabaseCredentials = await fetchCredentialsFromSupabase(productName);
        if (supabaseCredentials && supabaseCredentials.length > 0) {
            // Seleccionar la primera credencial disponible
            const selected = supabaseCredentials[0];
            return {
                email: selected.email || selected.account,
                password: selected.password,
                id: selected.id,
                fromSupabase: true
            };
        }
        return null;
    } else {
        // Usar credenciales locales
        const productKey = productName.toLowerCase();
        const credentialsList = LOCAL_CREDENTIALS[productKey];
        
        if (!credentialsList || credentialsList.length === 0) {
            return null;
        }

        // Seleccionar una credencial aleatoria
        const randomIndex = Math.floor(Math.random() * credentialsList.length);
        return {
            email: credentialsList[randomIndex].email,
            password: credentialsList[randomIndex].password,
            fromSupabase: false
        };
    }
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
                .setDescription('ID de la orden (opcional)')
                .setRequired(false)
        )
        .addBooleanOption(opt =>
            opt
                .setName('use_supabase')
                .setDescription('Usar credenciales de Supabase (default: false = usar locales)')
                .setRequired(false)
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
        const useSupabase = interaction.options.getBoolean('use_supabase') || false;

        // Defer reply para tener más tiempo
        await interaction.deferReply();

        try {
            // Obtener credenciales
            const credentials = await getCredentials(productName, useSupabase);

            if (!credentials) {
                return interaction.editReply({
                    content: `❌ No hay credenciales disponibles para **${productName}**.\n` +
                             `${useSupabase ? 'Intenta con credenciales locales o agrega más en Supabase.' : 'Configura las credenciales en el archivo del comando.'}`,
                    ephemeral: true
                });
            }

            // Formatear credenciales
            const credentialText = `${credentials.email}:${credentials.password}`;

            // Crear embed
            const embed = new EmbedBuilder()
                .setTitle('🤖 Credenciales Automáticas')
                .setDescription(`${targetUser.toString()}, aquí están tus credenciales para **${productName}**`)
                .setColor(config.colors.success || '#00ff00')
                .addFields(
                    { name: '📦 Producto', value: productName.toUpperCase(), inline: true },
                    { name: '👤 Staff', value: interaction.user.toString(), inline: true }
                );

            // Agregar Order ID si existe
            if (orderId) {
                embed.addFields({ name: '🆔 Order ID', value: orderId, inline: true });
            }

            embed.addFields(
                { 
                    name: '🔑 Credenciales', 
                    value: `\`\`\`\n${credentialText}\n\`\`\``, 
                    inline: false 
                }
            );

            embed.setFooter({ 
                text: `Plug Market • Sistema Automático ${credentials.fromSupabase ? '(Supabase)' : '(Local)'}`, 
                iconURL: interaction.client.user.displayAvatarURL() 
            });
            embed.setTimestamp();

            // Si es de Supabase, marcar como usada
            if (credentials.fromSupabase && credentials.id) {
                await markCredentialAsUsed(credentials.id);
            }

            // Enviar embed
            await interaction.editReply({ embeds: [embed] });

            // Log en consola
            console.log(`[autocredentials] ${interaction.user.tag} envió credenciales de ${productName} a ${targetUser.tag}`);

        } catch (error) {
            console.error('[autocredentials] Error:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al obtener las credenciales. Intenta de nuevo.',
                ephemeral: true
            });
        }
    }
};
