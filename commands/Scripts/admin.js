const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'admin',
    desc: 'Manage bot admins (add, remove, list)',
    category: 'admin',
    cooldown: 3,
    permission: 2, 
    dmUser: true,
    run: async ({ sock, m, args }) => {
        try {
            const action = args[0]?.toLowerCase();
            let target = args[1];
            
            const configPath = path.join(__dirname, '../config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
             
            if (!Array.isArray(config.owner)) config.owner = [];
              
            if (config.admins) delete config.admins;

            if (!action) {
                return m.reply(
                    '╭────❒ *🤖 Admin Help*❒\n' +
                    '├⬡ *Usage:*\n' +
                    '├⬡ !admin add <number/@mention>\n' +
                    '├⬡ !admin remove <number/@mention>\n' +
                    '├⬡ !admin list\n' +
                    '╰────────────❒\n\n' +
                    '*Note:*\n' +
                    '• You can use number or @mention\n' +
                    '• Number should include country code (e.g., 8801703956986)\n' +
                    '• All admins have the same permissions'
                );
            }
           
            if (target && target.startsWith('@')) {
                
                if (!m.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
                    return m.reply(
                        '╭────❒ ❌ Error ❒\n' +
                        '├⬡ Invalid mention\n' +
                        '├⬡ Please mention a valid user\n' +
                        '╰────────────❒'
                    );
                }
             
                const mentionedJid = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
                if (!mentionedJid) {
                    return m.reply(
                        '╭────❒ ❌ Error ❒\n' +
                        '├⬡ No user mentioned\n' +
                        '├⬡ Please mention a valid user\n' +
                        '╰────────────❒'
                    );
                }
                target = mentionedJid.split('@')[0];
            }
           
            const validateNumber = (number) => {
                if (!number.match(/^\d{10,}$/)) return false;
                if (!number.match(/^[1-9]\d{9,}$/)) return false;
                return true;
            };
           
            const formatNumber = (number) => number + '@s.whatsapp.net';

            async function getContactName(jid) {
                try {
                    const contact = await sock.getContactById(jid);
                    return contact?.name || contact?.notify || contact?.vname || jid.split('@')[0];
                } catch (err) {
                    const numberOnly = jid.split('@')[0];
                    return numberOnly;
                }
            }

            switch (action) {
                case 'add':
                    if (!target) return m.reply('Please provide a number or mention a user to add.');
                    if (!validateNumber(target)) {
                        return m.reply(
                            '╭────❒ ❌ Invalid Number ❒\n' +
                            '├⬡ Number must:\n' +
                            '├⬡ Start with country code\n' +
                            '├⬡ Be at least 10 digits\n' +
                            '├⬡ Contain only numbers\n' +
                            '╰────────────❒\n\n' +
                            'Example: 292937373829\n' +
                            'Or use: !admin add @user'
                        );
                    }
                    const newAdmin = formatNumber(target);
                    if (config.owner.includes(newAdmin)) {
                        return m.reply(
                            '╭────❒ ❌ Error ❒\n' +
                            '├⬡ This number is already an admin\n' +
                            '╰────────────❒'
                        );
                    }
                    config.owner.push(newAdmin);
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    global.owner = config.owner;

                    
                    const addedName = await getContactName(newAdmin);
                    
                    await m.reply(
                        '╭────❒ ✅ Success ❒\n' +
                        `├⬡ Added ${addedName} as admin\n` +
                        '╰────────────❒'
                    );
                    break;
                case 'remove':
                    if (!target) return m.reply('Please provide a number or mention a user to remove.');
                    if (!validateNumber(target)) {
                        return m.reply(
                            '╭────❒ ❌ Invalid Number ❒\n' +
                            '├⬡ Number must:\n' +
                            '├⬡ Start with country code\n' +
                            '├⬡ Be at least 10 digits\n' +
                            '├⬡ Contain only numbers\n' +
                            '╰────────────❒\n\n' +
                            'Example: 8801703956986\n' +
                            'Or use: !admin remove @user'
                        );
                    }
                    const removeAdmin = formatNumber(target);
                    if (!config.owner.includes(removeAdmin)) {
                        return m.reply(
                            '╭────❒ ❌ Error ❒\n' +
                            '├⬡ This number is not an admin\n' +
                            '╰────────────❒'
                        );
                    }
                   
                    if (config.owner.length <= 1) {
                        return m.reply(
                            '╭────❒ ❌ Error ❒\n' +
                            '├⬡ Cannot remove the last admin\n' +
                            '╰────────────❒'
                        );
                    }

                    
                    const removedName = await getContactName(removeAdmin);
                    
                    config.owner = config.owner.filter(admin => admin !== removeAdmin);
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                    global.owner = config.owner;
                    
                    await m.reply(
                        '╭────❒ ✅ Success ❒\n' +
                        `├⬡ Removed ${removedName} from admin list\n` +
                        '╰────────────❒'
                    );
                    break;
                case 'list':
                    let adminList = '╭────❒ *👑 Admin List* ❒\n';
                    
                    if (config.owner.length === 0) {
                        adminList += '├⬡ No admins found\n';
                    } else {
                        
                        const adminNames = await Promise.all(config.owner.map(async (admin) => {
                            return await getContactName(admin);
                        }));
                        
                        
                        adminNames.forEach((name, index) => {
                            const isLast = index === adminNames.length - 1;
                            const prefix = isLast ? '╰' : '├';
                            adminList += `${prefix}⬡ ${name}\n`;
                        });
                    }
                    
                    if (config.owner.length > 0) {
                        adminList += '╰────────────❒\n\n';
                        adminList += `Total Admins: ${config.owner.length}`;
                    } else {
                        adminList += '╰────────────❒';
                    }
                    
                    await sock.sendMessage(m.chat, {  
                        text: adminList,
                        contextInfo: {  
                            externalAdReply: {  
                                title: 'ＥＦ－ＰＲＩＭＥ－ＭＤ Ｖ２',  
                                body: '👑 Bot Admin Management',  
                                thumbnailUrl: 'https://files.catbox.moe/oifwcm.jpg',  
                                sourceUrl: 'EF-prime-v2.com',  
                                mediaType: 1,
                                renderLargerThumbnail: true,
                                showAdAttribution: false
                            }  
                        }  
                    });
                    break;
                default:
                    await m.reply(
                        '╭────❒ ❌ Invalid Action ❒\n' +
                        '├⬡ Available actions:\n' +
                        '├⬡ add - Add new admin\n' +
                        '├⬡ remove - Remove admin\n' +
                        '├⬡ list - List all admins\n' +
                        '╰────────────❒'
                    );
            }
        } catch (err) {
            console.error('Error in admin command:', err);
            await m.reply(
                '╭────❒ ❌ Error ❒\n' +
                '├⬡ An error occurred while processing the command\n' +
                '╰────────────❒'
            );
        }
    }
};