const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'poli',
    desc: 'Generate poli art images',
    aliases: ['poliart', 'poligen'],
    category: 'AI',
    cooldown: 10,
    permission: 0,
    dmUser: true,
    run: async ({ sock, m, args }) => {
        try {
            const prompt = args.join(" ");
            
            if (!prompt) {
                return m.reply("╭────❒ ❌ Error ❒\n├⬡ Please provide a prompt\n├⬡ Example: !poli beautiful landscape\n╰────────────❒");
            }
            
            m.reply("╭────❒ 🖼️ Generating Poli Art ❒\n├⬡ Prompt: " + prompt + "\n├⬡ Please wait...\n╰────────────❒");
            
            const apiUrl = `https://kaiz-apis.gleeze.com/api/poli?prompt=${encodeURIComponent(prompt)}`;
            
            await sock.sendMessage(m.chat, {
                image: { url: apiUrl },
                caption: `╭────❒ 🖼️ Poli Art Generator ❒\n├⬡ Prompt: ${prompt}\n╰────────────❒\n\n> EF-PRIME-MD V2`,
                contextInfo: {
                    mentionedJid: [m.sender],
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363419090892208@newsletter',
                        newsletterName: "EF-PRIME",
                        serverMessageId: 143
                    }
                }
            }, {
                quoted: m
            });
            
        } catch (err) {
            console.error('Error in poli command:', err);
            await m.reply(
                '╭────❒ ❌ Error ❒\n' +
                '├⬡ Failed to generate image\n' +
                '├⬡ Please try again later\n' +
                '╰────────────❒'
            );
        }
    }
};