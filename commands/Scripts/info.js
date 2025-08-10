module.exports = {
    name: 'info',
    desc: 'Display bot information',
    aliases: ['botinfo', 'about'],
    category: 'Info',
    cooldown: 5,
    permission: 0,
    category: 'info',
    dmUser: true,
    run: async ({ sock, m, args, config }) => {
        try {
            let baileysVersion = "Unknown";
            try {
                const baileys = require('@whiskeysockets/baileys');
                baileysVersion = baileys.version || "Unknown";
            } catch (error) {
                console.log("Baileys version error:", error);
            }
            
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const configVersion = config && config.version ? config.version : '1.0.0';
            const ownerName = config && config.ownerName ? config.ownerName : 'Frank Dev';
            const prefix = config && config.prefix ? config.prefix : '/';
            const features = config && config.features ? config.features : 'Groups Management, Fun, Tools, and more!';
            const creator = config && config.creator ? config.creator : 'Frank Dev';
            
            let infoText = `╭────❒ 🤖 Bot Info ❒
├⬡ *Bot Name:* ${sock.user ? (sock.user.name || 'EFPrime MD') : 'EFPrime MD'}
├⬡ *Version:* ${configVersion}
├⬡ *Owner:* ${ownerName}
├⬡ *Prefix:* ${prefix}
├⬡ *Baileys:* v${baileysVersion}
├⬡ *WhatsApp:* wa.me/${botNumber.split('@')[0]}
├⬡ *Features:* ${features}
├⬡ *Created By:* ${creator}
├⬡ *Special Thanks:* God almighty ❤️
╰────────────❒`;

            await m.reply(infoText);
            
        } catch (err) {
            console.error('Info error:', err);
            await m.reply(
                '╭────❒ ❌ Error ❒\n' +
                '├⬡ Failed to fetch bot info\n' +
                '├⬡ Please try again later\n' +
                '╰────────────❒'
            );
        }
    }
};