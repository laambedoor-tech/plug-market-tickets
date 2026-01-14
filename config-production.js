const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,
    ticketsCategory: process.env.TICKETS_CATEGORY,
    supportRole: process.env.SUPPORT_ROLE,
    adminRole: process.env.ADMIN_ROLE,
    logChannel: process.env.LOG_CHANNEL || "",
    ticketPanelChannel: process.env.TICKET_PANEL_CHANNEL,
    reviewChannel: process.env.REVIEW_CHANNEL,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
    supabaseTable: process.env.SUPABASE_TABLE || "orders",
    credentialsTable: process.env.CREDENTIALS_TABLE || "credentials",
    invoicesApiUrl: process.env.INVOICES_API_URL || "",
    colors: {
        primary: "#9d4edd",
        secondary: "#c77dff",
        success: "#06d6a0",
        error: "#ef476f",
        warning: "#ffd166"
    },
    emojis: {
        ticket: "🎫",
        purchases: "🛒",
        support: "💬",
        replace: "🔄",
        notReceived: "📦",
        close: "🔒",
        delete: "🗑️",
        add: "➕",
        remove: "➖"
    }
};

module.exports = config;