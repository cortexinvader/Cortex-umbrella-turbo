const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = {
    name: 'lyrics',
    desc: 'Fetches song lyrics',
    aliases: ['lyric', 'song'],
    category: 'Music',
    cooldown: 5,
    permission: 0,
    dmUser: true,
    run: async ({ sock, m, args }) => {
        try {
            if (!args.length) {
                return m.reply("╭────❒ ❌ Error ❒\n├⬡ Please provide a song title\n├⬡ Example: !lyrics NF motto\n╰────────────❒");
            }
            
            const songTitle = args.join(" ");
            
            const processingMsg = await m.reply(`╭────❒ 🎵 Finding Lyrics ❒\n├⬡ Song: ${songTitle}\n├⬡ Please wait...\n╰────────────❒`);
            
            const apiUrl = `https://kaiz-apis.gleeze.com/api/lyrics?title=${encodeURIComponent(songTitle)}`;
            const response = await axios.get(apiUrl);
            const data = response.data;
            
            if (!data || !data.lyrics || !data.title) {
                await sock.sendMessage(m.chat, { delete: processingMsg.key });
                return m.reply(`╭────❒ ❌ Error ❒\n├⬡ No lyrics found for "${songTitle}"\n├⬡ Please check spelling and try again\n╰────────────❒`);
            }
            
            await sock.sendMessage(m.chat, { delete: processingMsg.key });
            
            await sock.sendMessage(m.chat, {
                image: { url: data.thumbnail || 'https://i.imgur.com/SLzfIil.jpg' },
                caption: `╭────❒ 🎵 Lyrics Found ❒\n├⬡ *${data.title}*\n╰────────────❒\n\n${data.lyrics}\n\n> EF-PRIME-MD V2`,
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
            console.error('Error in lyrics command:', err);
            await m.reply(
                '╭────❒ ❌ Error ❒\n' +
                '├⬡ Failed to fetch lyrics\n' +
                '├⬡ Please try again later\n' +
                '╰────────────❒'
            );
        }
    }
};