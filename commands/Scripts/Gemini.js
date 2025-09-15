const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const cacheFolder = path.resolve(__dirname, './cache');

if (!require('fs').existsSync(cacheFolder)) {
    require('fs').mkdirSync(cacheFolder);
}

async function uploadToCatbox(imagePath) {
    try {
        const formData = new FormData();
        formData.append('fileToUpload', require('fs').createReadStream(imagePath));
        const response = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });
        return response.data.url;
    } catch (error) {
        console.error('Error uploading to Catbox:', error);
        return null;
    }
}

module.exports = {
    name: 'gemini',
    desc: 'Interacts with the Gemini Flash 2.0 model or analyzes an image.',
    aliases: ['ai', 'googleai'],
    category: 'AI',
    cooldown: 10,
    permission: 0,
    dmUser: true,
    run: async ({ sock, m, args }) => {
        const isImageAnalysis = m.hasQuotedImage || (m.type === 'imageMessage' && m.msg.url);

        if (!args[0] && !isImageAnalysis) {
            return m.reply(
                '╭───❒ ERROR ❒───╮\n' +
                '├ ⬡ Please provide a question or quote an image.\n' +
                '├ ⬡ Usage (Text): !gemini [your question]\n' +
                '├ ⬡ Usage (Image): Reply with !gemini [optional question]\n' +
                '╰───────────────❒'
            );
        }

        const question = args.join(' ');
        let imageUrl = null;

        if (isImageAnalysis) {
            const processingImageMsg = await m.reply(
                '╭───❒ IMAGE PROCESS ❒───╮\n' +
                '├ ⬡ Downloading & preparing image...\n' +
                '├ ⬡ Please wait a moment...\n' +
                '╰───────────────❒'
            );

            try {
                const media = await sock.downloadAndSaveMediaMessage(
                    m.hasQuotedImage ? m.quoted : m,
                    path.join(cacheFolder, crypto.randomBytes(16).toString('hex'))
                );
                const catboxUrl = await uploadToCatbox(media);
                await fs.unlink(media);
                if (catboxUrl) {
                    imageUrl = catboxUrl;
                    await sock.sendMessage(m.chat, { delete: processingImageMsg.key });
                } else {
                    await sock.sendMessage(m.chat, { delete: processingImageMsg.key });
                    return m.reply(
                        '╭───❒ UPLOAD ERROR ❒───╮\n' +
                        '├ ⬡ Failed to upload image for analysis.\n' +
                        '├ ⬡ Try again later.\n' +
                        '╰───────────────❒'
                    );
                }
            } catch (error) {
                console.error('Error processing image:', error);
                await sock.sendMessage(m.chat, { delete: processingImageMsg.key });
                return m.reply(
                    '╭───❒ IMAGE ERROR ❒───╮\n' +
                    '├ ⬡ Something went wrong while handling the image.\n' +
                    '├ ⬡ Please try again later.\n' +
                    '╰───────────────❒'
                );
            }
        }

        const processingMsg = await m.reply(
            `╭───❒ THINKING ❒───╮\n├ ⬡ Querying Gemini Flash 2.0${imageUrl ? ' (with image)' : ''}...\n├ ⬡ ${question || 'Analyzing image...'}\n╰───────────────❒`
        );

        try {
            const apiUrl = `https://kaiz-apis.gleeze.com/api/gemini-flash-2.0?q=${encodeURIComponent(question || 'Describe this image.')}&uid=${encodeURIComponent(m.sender.split('@')[0])}&imageUrl=${encodeURIComponent(imageUrl || '')}`;
            const response = await axios.get(apiUrl);
            const geminiData = response.data;

            if (geminiData && geminiData.response) {
                await sock.sendMessage(
                    m.chat,
                    { text: `╭───❒ GEMINI FLASH ❒───╮\n\n${geminiData.response}\n\n╰───────────────❒` },
                    { quoted: m }
                );
                await sock.sendMessage(m.chat, { delete: processingMsg.key });
            } else {
                await sock.sendMessage(m.chat, { delete: processingMsg.key });
                return m.reply(
                    '╭───❒ NO RESPONSE ❒───╮\n' +
                    '├ ⬡ Gemini Flash 2.0 gave no output.\n' +
                    '├ ⬡ Try again later.\n' +
                    '╰───────────────❒'
                );
            }
        } catch (error) {
            console.error('Error querying Gemini:', error);
            await sock.sendMessage(m.chat, { delete: processingMsg.key });
            return m.reply(
                '╭───❒ COMM ERROR ❒───╮\n' +
                '├ ⬡ Failed to connect with Gemini Flash 2.0.\n' +
                '├ ⬡ Try again later.\n' +
                '╰───────────────❒'
            );
        }
    },
};
