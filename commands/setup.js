const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('🔧 Configurar el bot de tickets de sloWmo')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Mostrar información de configuración actual')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Probar la configuración del bot')
        ),

    async execute(interaction) {
        // Verificar permisos de administrador
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Solo los administradores pueden usar este comando.',
                flags: 64
            });
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'info':
                await this.showInfo(interaction);
                break;
            case 'test':
                await this.testConfig(interaction);
                break;
        }
    },

    async showInfo(interaction) {
        const guild = interaction.guild;
        
        // Verificar configuración
        const ticketCategory = guild.channels.cache.get(config.ticketsCategory);
        const supportRole = guild.roles.cache.get(config.supportRole);
        const adminRole = guild.roles.cache.get(config.adminRole);
        const logChannel = guild.channels.cache.get(config.logChannel);

        const embed = new EmbedBuilder()
            .setTitle('🔧 Configuración de sloWmo Tickets')
            .setDescription('Estado actual de la configuración del bot:')
            .addFields([
                {
                    name: '📁 Categoría de Tickets',
                    value: ticketCategory ? `✅ ${ticketCategory.name} (${ticketCategory.id})` : '❌ No configurada',
                    inline: false
                },
                {
                    name: '👮 Rol de Soporte',
                    value: supportRole ? `✅ ${supportRole.name} (${supportRole.id})` : '❌ No configurado',
                    inline: true
                },
                {
                    name: '👑 Rol de Admin',
                    value: adminRole ? `✅ ${adminRole.name} (${adminRole.id})` : '❌ No configurado',
                    inline: true
                },
                {
                    name: '📊 Canal de Logs',
                    value: logChannel ? `✅ ${logChannel.name} (${logChannel.id})` : '❌ No configurado',
                    inline: false
                },
                {
                    name: '🎨 Color Principal',
                    value: config.colors.primary,
                    inline: true
                },
                {
                    name: '🤖 Bot Usuario',
                    value: `${interaction.client.user.tag}`,
                    inline: true
                }
            ])
            .setColor(config.colors.primary)
            .setFooter({
                text: 'Para cambiar la configuración, edita el archivo config.json',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async testConfig(interaction) {
        await interaction.deferReply();

        const guild = interaction.guild;
        const issues = [];
        
        // Verificar categoría de tickets
        const ticketCategory = guild.channels.cache.get(config.ticketsCategory);
        if (!ticketCategory) {
            issues.push('❌ Categoría de tickets no encontrada');
        } else if (ticketCategory.type !== 4) { // CategoryChannel
            issues.push('❌ El ID de categoría de tickets no corresponde a una categoría');
        }

        // Verificar rol de soporte
        const supportRole = guild.roles.cache.get(config.supportRole);
        if (!supportRole) {
            issues.push('❌ Rol de soporte no encontrado');
        }

        // Verificar rol de admin
        const adminRole = guild.roles.cache.get(config.adminRole);
        if (!adminRole) {
            issues.push('❌ Rol de administrador no encontrado');
        }

        // Verificar canal de logs
        const logChannel = guild.channels.cache.get(config.logChannel);
        if (!logChannel) {
            issues.push('⚠️ Canal de logs no configurado (opcional)');
        } else if (!logChannel.isTextBased()) {
            issues.push('❌ El canal de logs debe ser un canal de texto');
        }

        // Verificar permisos del bot
        const botMember = guild.members.cache.get(interaction.client.user.id);
        const requiredPermissions = [
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory
        ];

        const missingPermissions = requiredPermissions.filter(perm => 
            !botMember.permissions.has(perm)
        );

        if (missingPermissions.length > 0) {
            issues.push(`❌ Permisos faltantes del bot: ${missingPermissions.length} permisos`);
        }

        // Crear embed de resultado
        const embed = new EmbedBuilder()
            .setTitle('🧪 Prueba de Configuración')
            .setColor(issues.length === 0 ? config.colors.success : config.colors.warning)
            .setTimestamp();

        if (issues.length === 0) {
            embed.setDescription('✅ **¡Configuración perfecta!**\\n\\nTodo está configurado correctamente. El bot está listo para usar.');
        } else {
            embed.setDescription('⚠️ **Se encontraron algunos problemas:**\\n\\n' + issues.join('\\n'));
        }

        embed.addFields([
            {
                name: '📊 Resumen',
                value: `**Total de problemas:** ${issues.length}\\n**Estado:** ${issues.length === 0 ? '🟢 Listo' : '🟡 Necesita atención'}`,
                inline: false
            }
        ]);

        await interaction.editReply({ embeds: [embed] });
    }
};