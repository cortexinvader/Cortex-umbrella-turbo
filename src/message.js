require('../settings');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');
const chalk = require('chalk');
const crypto = require('crypto');
const FileType = require('file-type');
const PhoneNumber = require('awesome-phonenumber');

const { checkStatus } = require('./database');
const { imageToWebp, videoToWebp, writeExif, gifToWebp } = require('../lib/exif');
const { isUrl, getGroupAdmins, generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep, getTypeUrlMedia } = require('../lib/function');
const { jidNormalizedUser, proto, getBinaryNodeChildren, getBinaryNodeChild, generateMessageIDV2, jidEncode, encodeSignedDeviceIdentity, generateWAMessageContent, generateForwardMessageContent, prepareWAMessageMedia, delay, areJidsSameUser, extractMessageContent, generateMessageID, downloadContentFromMessage, generateWAMessageFromContent, jidDecode, generateWAMessage, toBuffer, getContentType, WAMessageStubType, getDevice } = require('baileys');

const logSystem = {
    colors: {
        timestamp: chalk.hex('#00ff88'),
        system: chalk.hex('#ff6b35'),
        message: chalk.hex('#4cc9f0'),
        user: chalk.hex('#f72585'),
        group: chalk.hex('#b5179e'),
        admin: chalk.hex('#ffd23f'),
        error: chalk.hex('#ff0054'),
        success: chalk.hex('#06ffa5'),
        warning: chalk.hex('#ffb700'),
        bot: chalk.hex('#7209b7')
    },
    
    getTimestamp() {
        const now = new Date();
        return now.toISOString().replace('T', ' ').slice(0, 19) + ' GMT+0000';
    },
    
    formatJid(jid) {
        return jid ? jid.replace('@s.whatsapp.net', '').replace('@g.us', '') : 'Unknown';
    },
    
    log(type, from, message, messageId = '', chatType = 'PRIVATE') {
        const timestamp = this.getTimestamp();
        const formattedFrom = this.formatJid(from);
        const typeColor = this.colors[type] || this.colors.system;
        
        console.log(
            `${this.colors.timestamp(`[EF-PRIME-MD ULTRA]`)} ${this.colors.timestamp(timestamp)} ` +
            `${typeColor(`[${type.toUpperCase()}]`)} ` +
            `${this.colors.user(`FROM: ${formattedFrom}`)} ` +
            `${chatType === 'GROUP' ? this.colors.group(`[GROUP]`) : this.colors.message(`[PRIVATE]`)} ` +
            `${this.colors.message(message)} ` +
            `${messageId ? this.colors.admin(`ID: ${messageId.slice(0, 16)}...`) : ''}`
        );
    }
};

async function GroupUpdate(qasim, m, store) {
	if (!m.messageStubType || !m.isGroup) return
	
	logSystem.log('system', m.sender, `Group update event: ${WAMessageStubType[m.messageStubType] || m.messageStubType}`, m.key?.id, 'GROUP');
	
	if (global.db?.groups?.[m.chat]?.setinfo && qasim.public) {
		const admin = `@${m.sender.split`@`[0]}`
const messages = {
    1: 'reset the group link!',
    21: `changed the Group Subject to:\n*${m.messageStubParameters[0]}*`,
    22: 'changed the group icon.',
    23: 'reset the group link!',
    24: `changed the group description.\n\n${m.messageStubParameters[0]}`,
    25: `set so that *${m.messageStubParameters[0] == 'on' ? 'only admins' : 'all participants'}* can edit group info.`,
    26: `has *${m.messageStubParameters[0] == 'on' ? 'closed' : 'opened'}* the group!\nNow ${m.messageStubParameters[0] == 'on' ? 'only admins' : 'all participants'} can send messages.`,
    29: `made @${m.messageStubParameters[0].split`@`[0]} an admin.`,
    30: `removed @${m.messageStubParameters[0].split`@`[0]} from admin.`,
    72: `changed the disappearing message duration to *@${m.messageStubParameters[0]}*`,
    123: 'disabled disappearing messages.',
    132: 'reset the group link!',
}
		if (messages[m.messageStubType]) {
			logSystem.log('admin', m.sender, `Admin action: ${messages[m.messageStubType]}`, m.key?.id, 'GROUP');
			await qasim.sendMessage(m.chat, { text: `${admin} ${messages[m.messageStubType]}`, mentions: [m.sender, ...(m.messageStubParameters[0]?.includes('@') ? [`${m.messageStubParameters[0]}`] : [])]}, { ephemeralExpiration: m.expiration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		} else {
			logSystem.log('warning', m.sender, `Unhandled message stub type: ${m.messageStubType}`, m.key?.id, 'GROUP');
			console.log({
				messageStubType: m.messageStubType,
				messageStubParameters: m.messageStubParameters,
				type: WAMessageStubType[m.messageStubType],
			})
		}
	}
}

async function GroupParticipantsUpdate(qasim, { id, participants, author, action }, store, groupCache) {
	try {
		logSystem.log('group', author || 'System', `Participants ${action}: ${participants.length} user(s)`, '', 'GROUP');
		
		function updateAdminStatus(participants, metadataParticipants, status) {
			for (const participant of metadataParticipants) {
				let id = jidNormalizedUser(participant.id);
				if (participants.includes(id)) {
					participant.admin = status;
				}
			}
		}
		if (global.db?.groups?.[id] && store?.groupMetadata?.[id]) {
			const metadata = store.groupMetadata[id];
			for (let n of participants) {
				let profile;
				try {
					profile = await qasim.profilePictureUrl(n, 'image');
				} catch {
					profile = 'https://telegra.ph/file/95670d63378f7f4210f03.png';
				}
				let messageText;
				if (action === 'add') {
					if (db.groups[id].welcome) messageText = db.groups[id]?.text?.setwelcome || `Welcome to ${metadata.subject}\n@`;
					metadata.participants.push({ id: jidNormalizedUser(n), admin: null });
					logSystem.log('success', n, `User joined group: ${metadata.subject}`, '', 'GROUP');
				} else if (action === 'remove') {
					if (db.groups[id].leave) messageText = db.groups[id]?.text?.setleave || `@\nLeaving From ${metadata.subject}`;
					metadata.participants = metadata.participants.filter(p => !participants.includes(jidNormalizedUser(p.id)));
					logSystem.log('warning', n, `User left group: ${metadata.subject}`, '', 'GROUP');
				} else if (action === 'promote') {
					if (db.groups[id].promote) messageText = db.groups[id]?.text?.setpromote || `@\nPromote From ${metadata.subject}\nBy @admin`;
					updateAdminStatus(participants, metadata.participants, 'admin');
					logSystem.log('admin', n, `User promoted to admin in: ${metadata.subject}`, '', 'GROUP');
				} else if (action === 'demote') {
					if (db.groups[id].demote) messageText = db.groups[id]?.text?.setdemote || `@\nDemote From ${metadata.subject}\nBy @admin`;
					updateAdminStatus(participants, metadata.participants, null);
					logSystem.log('admin', n, `User demoted from admin in: ${metadata.subject}`, '', 'GROUP');
				}
				groupCache.set(id, metadata);
				if (messageText && qasim.public) {
					await qasim.sendMessage(id, {
						text: messageText.replace('@subject', author ? `${metadata.subject}` : '@subject').replace('@admin', author ? `@${author.split('@')[0]}` : '@admin').replace(/(?<=\s|^)@(?!\w)/g, `@${n.split('@')[0]}`),
						contextInfo: {
							mentionedJid: [n, author],
							externalAdReply: {
								title: action == 'add' ? 'Welcome' : action == 'remove' ? 'Leaving' : action.charAt(0).toUpperCase() + action.slice(1),
								mediaType: 1,
								previewType: 0,
								thumbnailUrl: profile,
								renderLargerThumbnail: true,
								sourceUrl: global.my.gh
							}
						}
					}, { ephemeralExpiration: store?.messages[id]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
					
					logSystem.log('bot', 'EF-PRIME-MD', `Sent ${action} notification message`, '', 'GROUP');
				}
			}
		}
	} catch (e) {
		logSystem.log('error', 'System', `GroupParticipantsUpdate error: ${e.message}`, '', 'GROUP');
		throw e;
	}
}

async function LoadDataBase(qasim, m) {
	try {
		logSystem.log('system', m.sender, `Loading database for user`, '', m.isGroup ? 'GROUP' : 'PRIVATE');
		
		const botNumber = await qasim.decodeJid(qasim.user.id);
		let game = global.db.game || {};
		let premium = global.db.premium || [];
		let user = global.db.users[m.sender] || {};
		let setBot = global.db.set[botNumber] || {};
		
		global.db.game = game;
		global.db.users[m.sender] = user;
		global.db.set[botNumber] = setBot;
		
		const defaultSetBot = {
			lang: 'id',
			limit: 0,
			money: 0,
			status: 0,
			join: false,
			public: true,
			anticall: true,
			original: true,
			readsw: false,
			autobio: false,
			autoread: true,
			antispam: false,
			autotyping: true,
			grouponly: true,
			multiprefix: false,
			privateonly: true,
			autobackup: false,
			template: 'documentMessage',
		};
		for (let key in defaultSetBot) {
			if (!(key in setBot)) setBot[key] = defaultSetBot[key];
		}
		
		const limitUser = user.vip ? global.limit.vip : checkStatus(m.sender, premium) ? global.limit.premium : global.limit.free;
		const moneyUser = user.vip ? global.money.vip : checkStatus(m.sender, premium) ? global.money.premium : global.money.free;
		
		const defaultUser = {
			vip: false,
			ban: false,
			afkTime: -1,
			afkReason: '',
			register: false,
			limit: limitUser,
			money: moneyUser,
			lastclaim: Date.now(),
			lastbegal: Date.now(),
			lastrampok: Date.now(),
		};
		for (let key in defaultUser) {
			if (!(key in user)) user[key] = defaultUser[key];
		}
		
		if (m.isGroup) {
			let group = global.db.groups[m.chat] || {};
			global.db.groups[m.chat] = group;
			
			const defaultGroup = {
				url: '',
				text: {},
				warn: {},
				tagsw: {},
				nsfw: false,
				mute: false,
				leave: false,
				setinfo: false,
				antilink: false,
				demote: false,
				antitoxic: false,
				promote: false,
				welcome: false,
				antivirtex: false,
				antitagsw: false,
				antidelete: false,
				antihidetag: false,
				waktusholat: false,
			};
			for (let key in defaultGroup) {
				if (!(key in group)) group[key] = defaultGroup[key];
			}
		}
		
		const defaultGame = {
			suit: {},
			chess: {},
			chat_ai: {},
			menfes: {},
			tekateki: {},
			akinator: {},
			tictactoe: {},
			tebaklirik: {},
			kuismath: {},
			blackjack: {},
			tebaklagu: {},
			tebakkata: {},
			family100: {},
			susunkata: {},
			tebakbom: {},
			ulartangga: {},
			tebakkimia: {},
			caklontong: {},
			tebakangka: {},
			tebaknegara: {},
			tebakgambar: {},
			tebakbendera: {},
		};
		for (let key in defaultGame) {
			if (!(key in game)) game[key] = defaultGame[key];
		}
		
		logSystem.log('success', m.sender, `Database loaded successfully`, '', m.isGroup ? 'GROUP' : 'PRIVATE');
		
	} catch (e) {
		logSystem.log('error', m.sender, `Database loading error: ${e.message}`, '', m.isGroup ? 'GROUP' : 'PRIVATE');
		throw e
	}
}

async function MessagesUpsert(qasim, message, store, groupCache) {
	try {
		let botNumber = await qasim.decodeJid(qasim.user.id);
		const msg = message.messages[0];
		const remoteJid = msg.key.remoteJid;
		
		const messageType = msg.message ? (getContentType(msg.message) || Object.keys(msg.message)[0]) : '';
		const isGroup = remoteJid.endsWith('@g.us');
		const sender = msg.key.participant || msg.key.remoteJid;
		
		logSystem.log('message', sender, `Incoming ${messageType || 'message'}`, msg.key.id, isGroup ? 'GROUP' : 'PRIVATE');
		
		store.messages[remoteJid] ??= {};
		store.messages[remoteJid].array ??= [];
		store.messages[remoteJid].keyId ??= new Set();
		if (!(store.messages[remoteJid].keyId instanceof Set)) {
			store.messages[remoteJid].keyId = new Set(store.messages[remoteJid].array.map(m => m.key.id));
		}
		if (store.messages[remoteJid].keyId.has(msg.key.id)) return;
		store.messages[remoteJid].array.push(msg);
		store.messages[remoteJid].keyId.add(msg.key.id);
		if (store.messages[remoteJid].array.length > (global.chatLength || 250)) {
			const removed = store.messages[remoteJid].array.shift();
			store.messages[remoteJid].keyId.delete(removed.key.id);
		}
		if (!store.groupMetadata || Object.keys(store.groupMetadata).length === 0) store.groupMetadata ??= await qasim.groupFetchAllParticipating().catch(e => ({}));
		const type = msg.message ? (getContentType(msg.message) || Object.keys(msg.message)[0]) : '';
		const m = await Serialize(qasim, msg, store, groupCache)
		
		logSystem.log('bot', 'EF-PRIME-MD', `Processing message from ${logSystem.formatJid(sender)}`, msg.key.id, isGroup ? 'GROUP' : 'PRIVATE');
		
		require('../main')(qasim, m, msg, store, groupCache);
		if (db?.set?.[botNumber]?.readsw && msg.key.remoteJid === 'status@broadcast') {
			await qasim.readMessages([msg.key]);
			logSystem.log('success', msg.key.participant, `Status viewed and read`, msg.key.id, 'STATUS');
			
			if (/protocolMessage/i.test(type)) {
				await qasim.sendFromOwner(global.owner, 'Status dari @' + msg.key.participant.split('@')[0] + ' Telah dihapus', msg, { mentions: [msg.key.participant] });
				logSystem.log('warning', msg.key.participant, `Status deleted - notification sent to owner`, msg.key.id, 'STATUS');
			}
			if (/(audioMessage|imageMessage|videoMessage|extendedTextMessage)/i.test(type)) {
				let keke = (type == 'extendedTextMessage') 
    ? `Story Text Contains: ${msg.message.extendedTextMessage.text ? msg.message.extendedTextMessage.text : ''}` 
    : (type == 'imageMessage') 
        ? `Story Image ${msg.message.imageMessage.caption ? 'with Caption: ' + msg.message.imageMessage.caption : ''}` 
        : (type == 'videoMessage') 
            ? `Story Video ${msg.message.videoMessage.caption ? 'with Caption: ' + msg.message.videoMessage.caption : ''}` 
            : (type == 'audioMessage') 
                ? 'Story Audio' 
                : '\nUnknown, please check directly';

await qasim.sendFromOwner(global.owner, `Viewing story from @${msg.key.participant.split('@')[0]}\n${keke}`, msg, { mentions: [msg.key.participant] });
				logSystem.log('success', msg.key.participant, `Status forwarded to owner: ${type}`, msg.key.id, 'STATUS');
			}
		}
	} catch (e) {
		logSystem.log('error', 'System', `MessagesUpsert error: ${e.message}`, '', 'SYSTEM');
		throw e;
	}
}

async function Solving(qasim, store) {
	logSystem.log('bot', 'EF-PRIME-MD', `Initializing bot functions...`, '', 'SYSTEM');
	
	qasim.serializeM = (m) => MessagesUpsert(qasim, m, store)
	
	qasim.decodeJid = (jid) => {
		if (!jid) return jid
		if (/:\d+@/gi.test(jid)) {
			let decode = jidDecode(jid) || {}
			return decode.user && decode.server && decode.user + '@' + decode.server || jid
		} else return jid
	}
	
	qasim.getName = (jid, withoutContact  = false) => {
		const id = qasim.decodeJid(jid);
		if (id.endsWith('@g.us')) {
			const groupInfo = store.contacts[id] || (store.groupMetadata[id] ? store.groupMetadata[id] : (store.groupMetadata[id] = qasim.groupMetadata(id))) || {};
			return Promise.resolve(groupInfo.name || groupInfo.subject || PhoneNumber('+' + id.replace('@g.us', '')).getNumber('international'));
		} else {
			if (id === '0@s.whatsapp.net') {
				return 'WhatsApp';
			}
		const contactInfo = store.contacts[id] || {};
		return withoutContact ? '' : contactInfo.name || contactInfo.subject || contactInfo.verifiedName || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international');
		}
	}
	
	qasim.sendContact = async (jid, kon, quoted = '', opts = {}) => {
		let list = []
		for (let i of kon) {
			list.push({
				displayName: await qasim.getName(i + '@s.whatsapp.net'),
				vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await qasim.getName(i + '@s.whatsapp.net')}\nFN:${await qasim.getName(i + '@s.whatsapp.net')}\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Ponsel\nitem2.ADR:;;Indonesia;;;;\nitem2.X-ABLabel:Region\nEND:VCARD`
			})
		}
		qasim.sendMessage(jid, { contacts: { displayName: `${list.length} Kontak`, contacts: list }, ...opts }, { quoted, ephemeralExpiration: quoted?.expiration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
	}
	
	qasim.profilePictureUrl = async (jid, type = 'image', timeoutMs) => {
		const result = await qasim.query({
			tag: 'iq',
			attrs: {
				target: jidNormalizedUser(jid),
				to: '@s.whatsapp.net',
				type: 'get',
				xmlns: 'w:profile:picture'
			},
			content: [{
				tag: 'picture',
				attrs: {
					type, query: 'url'
				},
			}]
		}, timeoutMs);
		const child = getBinaryNodeChild(result, 'picture');
		return child?.attrs?.url;
	}
	
	qasim.setStatus = (status) => {
		qasim.query({
			tag: 'iq',
			attrs: {
				to: '@s.whatsapp.net',
				type: 'set',
				xmlns: 'status',
			},
			content: [{
				tag: 'status',
				attrs: {},
				content: Buffer.from(status, 'utf-8')
			}]
		})
		return status
	}
	
	qasim.sendPoll = (jid, name = '', values = [], quoted, selectableCount = 1) => {
		return qasim.sendMessage(jid, { poll: { name, values, selectableCount }}, { quoted, ephemeralExpiration: quoted?.expiration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
	}
	
	qasim.sendFileUrl = async (jid, url, caption, quoted, options = {}) => {
		const quotedOptions = { quoted, ephemeralExpiration: quoted?.expiration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 }
		async function getFileUrl(res, mime) {
			if (mime && mime.includes('gif')) {
				return qasim.sendMessage(jid, { video: res.data, caption: caption, gifPlayback: true, ...options }, quotedOptions);
			} else if (mime && mime === 'application/pdf') {
				return qasim.sendMessage(jid, { document: res.data, mimetype: 'application/pdf', caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('image')) {
				return qasim.sendMessage(jid, { image: res.data, caption: caption, ...options }, quotedOptions);
			} else if (mime && mime.includes('video')) {
				return qasim.sendMessage(jid, { video: res.data, caption: caption, mimetype: 'video/mp4', ...options }, quotedOptions);
			} else if (mime && mime.includes('webp') && !/.jpg|.jpeg|.png/.test(url)) {
				return qasim.sendAsSticker(jid, res.data, quoted, options);
			} else if (mime && mime.includes('audio')) {
				return qasim.sendMessage(jid, { audio: res.data, mimetype: 'audio/mpeg', ...options }, quotedOptions);
			}
		}
		const axioss = axios.create({
			httpsAgent: new https.Agent({ rejectUnauthorized: false }),
		});
		const res = await axioss.get(url, { responseType: 'arraybuffer' });
		let mime = res.headers['content-type'];
		if (!mime || mime.includes('octet-stream')) {
			const fileType = await FileType.fromBuffer(res.data);
			mime = fileType ? fileType.mime : null;
		}
		const hasil = await getFileUrl(res, mime);
		return hasil
	}
	
	qasim.sendGroupInvite = async (jid, participant, inviteCode, inviteExpiration, groupName = 'Unknown Subject', caption = 'Invitation to join my WhatsApp group', jpegThumbnail = null, options = {}) => {
		const msg = proto.Message.fromObject({
			groupInviteMessage: {
				inviteCode,
				inviteExpiration: parseInt(inviteExpiration) || + new Date(new Date + (3 * 86400000)),
				groupJid: jid,
				groupName,
				jpegThumbnail: Buffer.isBuffer(jpegThumbnail) ? jpegThumbnail : null,
				caption,
				contextInfo: {
					mentionedJid: options.mentions || []
				}
			}
		});
		const message = generateWAMessageFromContent(participant, msg, options);
		const invite = await qasim.relayMessage(participant, message.message, { messageId: message.key.id })
		return invite
	}
	
	qasim.sendFromOwner = async (jid, text, quoted, options = {}) => {
		for (const a of jid) {
			await qasim.sendMessage(a.replace(/[^0-9]/g, '') + '@s.whatsapp.net', { text, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
		}
	}
	
	qasim.sendText = async (jid, text, quoted, options = {}) => qasim.sendMessage(jid, { text: text, mentions: [...text.matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net'), ...options }, { quoted, ephemeralExpiration: quoted?.expiration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 })
	
	qasim.sendAsSticker = async (jid, path, quoted, options = {}) => {
		const buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
		const result = await writeExif(buff, options);
		return qasim.sendMessage(jid, { sticker: { url: result }, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0 });
	}
	
	qasim.downloadMediaMessage = async (message) => {
		const msg = message.msg || message;
		const mime = msg.mimetype || '';
		const messageType = (message.type || mime.split('/')[0]).replace(/Message/gi, '');
		const stream = await downloadContentFromMessage(msg, messageType);
		let buffer = Buffer.from([]);
		for await (const chunk of stream) {
			buffer = Buffer.concat([buffer, chunk]);
		}
		return buffer
	}
	
	qasim.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
		const buffer = await qasim.downloadMediaMessage(message);
		const type = await FileType.fromBuffer(buffer);
		const trueFileName = attachExtension ? `./database/sampah/${filename ? filename : Date.now()}.${type.ext}` : filename;
		await fs.promises.writeFile(trueFileName, buffer);
		return trueFileName;
	}
	
	qasim.getFile = async (PATH, save) => {
		let res;
		let filename;
		let data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await getBuffer(PATH)) : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
		let type = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: '.bin' }
		filename = path.join(__dirname, '../database/sampah/' + new Date * 1 + '.' + type.ext)
		if (data && save) fs.promises.writeFile(filename, data)
		return {
			res,
			filename,
			size: await getSizeMedia(data),
			...type,
			data
		}
	}
	
	qasim.appendResponseMessage = async (m, text) => {
		let apb = await generateWAMessage(m.chat, { text, mentions: m.mentionedJid }, { userJid: qasim.user.id, quoted: m.quoted });
		apb.key = m.key
		apb.key.fromMe = areJidsSameUser(m.sender, qasim.user.id);
		if (m.isGroup) apb.participant = m.sender;
		qasim.ev.emit('messages.upsert', {
			...m,
			messages: [proto.WebMessageInfo.fromObject(apb)],
			type: 'append'
		});
	}
	
	qasim.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
		const { mime, data, filename } = await qasim.getFile(path, true);
		const isWebpSticker = options.asSticker || /webp/.test(mime);
		let type = 'document', mimetype = mime, pathFile = filename;
		if (isWebpSticker) {
			pathFile = await writeExif(data, {
				packname: options.packname || global.packname,
				author: options.author || global.author,
				categories: options.categories || [],
			})
			await fs.unlinkSync(filename);
			type = 'sticker';
			mimetype = 'image/webp';
		} else if (/image|video|audio/.test(mime)) {
			type = mime.split('/')[0];
			mimetype = type == 'video' ? 'video/mp4' : type == 'audio' ? 'audio/mpeg' : mime
		}
		let anu = await qasim.sendMessage(jid, { [type]: { url: pathFile }, caption, mimetype, fileName, ...options }, { quoted, ephemeralExpiration: quoted?.expiration || store?.messages[jid]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, ...options });
		await fs.unlinkSync(pathFile);
		return anu;
	}
	
	qasim.sendListMsg = async (jid, content = {}, options = {}) => {
		const { text, caption, footer = '', title, subtitle, ai, contextInfo = {}, buttons = [], mentions = [], ...media } = content;
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2,
					},
					interactiveMessage: proto.Message.InteractiveMessage.create({
						body: proto.Message.InteractiveMessage.Body.create({ text: text || caption || '' }),
						footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
						header: proto.Message.InteractiveMessage.Header.fromObject({
							title,
							subtitle,
							hasMediaAttachment: Object.keys(media).length > 0,
							...(media && typeof media === 'object' && Object.keys(media).length > 0 ? await generateWAMessageContent(media, {
								upload: qasim.waUploadToServer
							}) : {})
						}),
						nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
							buttons: buttons.map(a => {
								return {
									name: a.name,
									buttonParamsJson: JSON.stringify(a.buttonParamsJson ? (typeof a.buttonParamsJson === 'string' ? JSON.parse(a.buttonParamsJson) : a.buttonParamsJson) : '')
								}
							})
						}),
						contextInfo: {
							...contextInfo,
							...options.contextInfo,
							mentionedJid: options.mentions || mentions,
							...(options.quoted ? {
								stanzaId: options.quoted.key.id,
								remoteJid: options.quoted.key.remoteJid,
								participant: options.quoted.key.participant || options.quoted.key.remoteJid,
								fromMe: options.quoted.key.fromMe,
								quotedMessage: options.quoted.message
							} : {})
						}
					})
				}
			}
		}, {});
		const hasil = await qasim.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [{
				tag: 'biz',
				attrs: {},
				content: [{
					tag: 'interactive',
					attrs: {
						type: 'native_flow',
						v: '1'
					},
					content: [{
						tag: 'native_flow',
						attrs: {
							name: 'quick_reply'
						}
					}]
				}]
			}, ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])]
		})
		return hasil
	}
	
	qasim.sendButtonMsg = async (jid, content = {}, options = {}) => {
		const { text, caption, footer = '', headerType = 1, ai, contextInfo = {}, buttons = [], mentions = [], ...media } = content;
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2,
					},
					buttonsMessage: {
						...(media && typeof media === 'object' && Object.keys(media).length > 0 ? await generateWAMessageContent(media, {
							upload: qasim.waUploadToServer
						}) : {}),
						contentText: text || caption || '',
						footerText: footer,
						buttons,
						headerType: media && Object.keys(media).length > 0 ? Math.max(...Object.keys(media).map((a) => ({ document: 3, image: 4, video: 5, location: 6 })[a] || headerType)) : headerType,
						contextInfo: {
							...contextInfo,
							...options.contextInfo,
							mentionedJid: options.mentions || mentions,
							...(options.quoted ? {
								stanzaId: options.quoted.key.id,
								remoteJid: options.quoted.key.remoteJid,
								participant: options.quoted.key.participant || options.quoted.key.remoteJid,
								fromMe: options.quoted.key.fromMe,
								quotedMessage: options.quoted.message
							} : {})
						}
					}
				}
			}
		}, {});
		const hasil = await qasim.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [{
				tag: 'biz',
				attrs: {},
				content: [{
					tag: 'interactive',
					attrs: {
						type: 'native_flow',
						v: '1'
					},
					content: [{
						tag: 'native_flow',
						attrs: {
							name: 'quick_reply'
						}
					}]
				}]
			}, ...(ai ? [{ attrs: { biz_bot: '1' }, tag: 'bot' }] : [])]
		})
		return hasil
	}
	
	qasim.newsletterMsg = async (key, content = {}, timeout = 5000) => {
		const { type: rawType = 'INFO', name, description = '', picture = null, react, id, newsletter_id = key, ...media } = content;
		const type = rawType.toUpperCase();
		if (react) {
			if (!(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) throw [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			if (!id) throw [{ message: 'Use Id Newsletter Message', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			const hasil = await qasim.query({
				tag: 'message',
				attrs: {
					to: key,
					type: 'reaction',
					'server_id': id,
					id: generateMessageID()
				},
				content: [{
					tag: 'reaction',
					attrs: {
						code: react
					}
				}]
			});
			return hasil
		} else if (media && typeof media === 'object' && Object.keys(media).length > 0) {
			const msg = await generateWAMessageContent(media, { upload: qasim.waUploadToServer });
			const anu = await qasim.query({
				tag: 'message',
				attrs: { to: newsletter_id, type: 'text' in media ? 'text' : 'media' },
				content: [{
					tag: 'plaintext',
					attrs: /image|video|audio|sticker|poll/.test(Object.keys(media).join('|')) ? { mediatype: Object.keys(media).find(key => ['image', 'video', 'audio', 'sticker','poll'].includes(key)) || null } : {},
					content: proto.Message.encode(msg).finish()
				}]
			})
			return anu
		} else {
			if ((/(FOLLOW|UNFOLLOW|DELETE)/.test(type)) && !(newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id))) return [{ message: 'Use Id Newsletter', extensions: { error_code: 204, severity: 'CRITICAL', is_retryable: false }}]
			const _query = await qasim.query({
				tag: 'iq',
				attrs: {
					to: 's.whatsapp.net',
					type: 'get',
					xmlns: 'w:mex'
				},
				content: [{
					tag: 'query',
					attrs: {
						query_id: type == 'FOLLOW' ? '9926858900719341' : type == 'UNFOLLOW' ? '7238632346214362' : type == 'CREATE' ? '6234210096708695' : type == 'DELETE' ? '8316537688363079' : '6563316087068696'
					},
					content: new TextEncoder().encode(JSON.stringify({
						variables: /(FOLLOW|UNFOLLOW|DELETE)/.test(type) ? { newsletter_id } : type == 'CREATE' ? { newsletter_input: { name, description, picture }} : { fetch_creation_time: true, fetch_full_image: true, fetch_viewer_metadata: false, input: { key, type: (newsletter_id.endsWith('@newsletter') || !isNaN(newsletter_id)) ? 'JID' : 'INVITE' }}
					}))
				}]
			}, timeout);
			const res = JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_join_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_leave_v2 || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_create || JSON.parse(_query.content[0].content)?.data?.xwa2_newsletter_delete_v2 || JSON.parse(_query.content[0].content)?.errors || JSON.parse(_query.content[0].content)
			res.thread_metadata ? (res.thread_metadata.host = 'https://mmg.whatsapp.net') : null
			return res
		}
	}
	
	qasim.sendCarouselMsg = async (jid, body = '', footer = '', cards = [], options = {}) => {
		async function getImageMsg(url) {
			const { imageMessage } = await generateWAMessageContent({ image: { url } }, { upload: qasim.waUploadToServer });
			return imageMessage;
		}
		const cardPromises = cards.map(async (a) => {
			const imageMessage = await getImageMsg(a.url);
			return {
				header: {
					imageMessage: imageMessage,
					hasMediaAttachment: true
				},
				body: { text: a.body },
				footer: { text: a.footer },
				nativeFlowMessage: {
					buttons: a.buttons.map(b => ({
						name: b.name,
						buttonParamsJson: JSON.stringify(b.buttonParamsJson ? JSON.parse(b.buttonParamsJson) : '')
					}))
				}
			};
		});
		
		const cardResults = await Promise.all(cardPromises);
		const msg = await generateWAMessageFromContent(jid, {
			viewOnceMessage: {
				message: {
					messageContextInfo: {
						deviceListMetadata: {},
						deviceListMetadataVersion: 2
					},
					interactiveMessage: proto.Message.InteractiveMessage.create({
						body: proto.Message.InteractiveMessage.Body.create({ text: body }),
						footer: proto.Message.InteractiveMessage.Footer.create({ text: footer }),
						carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
							cards: cardResults,
							messageVersion: 1
						})
					})
				}
			}
		}, {});
		const hasil = await qasim.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
		return hasil
	}
	
	if (qasim.user && qasim.user.id) {
		const botNumber = qasim.decodeJid(qasim.user.id);
		if (global.db?.set[botNumber]) {
			qasim.public = global.db.set[botNumber].public
		} else qasim.public = true
	} else qasim.public = true

	logSystem.log('success', 'EF-PRIME-MD', `Bot functions initialized successfully`, '', 'SYSTEM');
	return qasim
}

async function Serialize(qasim, msg, store, groupCache) {
	const botLid = qasim.decodeJid(qasim.user.lid);
	const botNumber = qasim.decodeJid(qasim.user.id);
	const m = { ...msg };
	if (!m) return m
	if (m.key) {
		m.id = m.key.id
		m.chat = m.key.remoteJid
		m.fromMe = m.key.fromMe
		m.isBot = ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(a => m.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]/.test(m.id) || false
		m.isGroup = m.chat.endsWith('@g.us')
		m.sender = qasim.decodeJid(m.fromMe && qasim.user.id || m.participant || m.key.participant || m.chat || '')
		if (m.isGroup) {
			if (!store.groupMetadata) store.groupMetadata = await qasim.groupFetchAllParticipating().catch(e => ({}));
			let metadata = store.groupMetadata[m.chat] ? store.groupMetadata[m.chat] : (store.groupMetadata[m.chat] = groupCache.get(m.chat))
			if (!metadata) {
				metadata = await qasim.groupMetadata(m.chat).catch(e => ({}))
				store.groupMetadata[m.chat] = metadata
				if (metadata) groupCache.set(m.chat, metadata)
			}
			m.metadata = metadata
			m.admins = m.metadata.participants ? (m.metadata.participants.reduce((a, b) => (b.admin ? a.push({ id: b.id, admin: b.admin }) : [...a]) && a, [])) : []
			m.isAdmin = m.admins?.some((b) => b.id === m.sender) || false
			m.participant = m.key.participant
			m.isBotAdmin = !!m.admins?.find((member) => [botNumber, botLid].includes(member.id)) || false
		}
	}
	if (m.message) {
		m.type = getContentType(m.message) || Object.keys(m.message)[0]
		m.msg = (/viewOnceMessage/i.test(m.type) ? m.message[m.type].message[getContentType(m.message[m.type].message)] : (extractMessageContent(m.message[m.type]) || m.message[m.type]))
		m.body = m.message?.conversation || m.msg?.text || m.msg?.conversation || m.msg?.caption || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || m.msg?.selectedId || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || m.msg?.name || ''
		m.mentionedJid = m.msg?.contextInfo?.mentionedJid || []
		m.text = m.msg?.text || m.msg?.caption || m.message?.conversation || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || '';
		m.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.body) ? m.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : /[\uD800-\uDBFF][\uDC00-\uDFFF]/gi.test(m.body) ? m.body.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gi)[0] : ''
		m.command = m.body && m.body.replace(m.prefix, '').trim().split(/ +/).shift()
		m.args = m.body?.trim().replace(new RegExp("^" + m.prefix?.replace(/[.*=+:\-?^${}()|[\]\\]|\s/g, '\\	qasim.sendMedia = async (jid, path, fileName = '', caption = '', quoted = '', options = {}) => {
		const { mime, data, filename } = await qasim.getFile(path, true);
		const isWebpSticker = options.asSticker || /webp/.test(mime);
		let type = 'document', mimetype = mime, pathFile = filename;
		if (isWebpSticker) {
			pathFile = await writeExif(data, {
				packname: options.packname || global.packname,
				author'), 'i'), '').replace(m.command, '').split(/ +/).filter(a => a) || []
		m.device = getDevice(m.id)
		m.expiration = m.msg?.contextInfo?.expiration || 0
		m.timestamp = (typeof m.messageTimestamp === "number" ? m.messageTimestamp : m.messageTimestamp.low ? m.messageTimestamp.low : m.messageTimestamp.high) || m.msg.timestampMs * 1000
		m.isMedia = !!m.msg?.mimetype || !!m.msg?.thumbnailDirectPath
		if (m.isMedia) {
			m.mime = m.msg?.mimetype
			m.size = m.msg?.fileLength
			m.height = m.msg?.height || ''
			m.width = m.msg?.width || ''
			if (/webp/i.test(m.mime)) {
				m.isAnimated = m.msg?.isAnimated
			}
		}
		m.quoted = m.msg?.contextInfo?.quotedMessage || null
		if (m.quoted) {
			m.quoted.message = extractMessageContent(m.msg?.contextInfo?.quotedMessage)
			m.quoted.type = getContentType(m.quoted.message) || Object.keys(m.quoted.message)[0]
			m.quoted.id = m.msg.contextInfo.stanzaId
			m.quoted.device = getDevice(m.quoted.id)
			m.quoted.chat = m.msg.contextInfo.remoteJid || m.chat
			m.quoted.isBot = m.quoted.id ? ['HSK', 'BAE', 'B1E', '3EB0', 'B24E', 'WA'].some(a => m.quoted.id.startsWith(a) && [12, 16, 20, 22, 40].includes(m.quoted.id.length)) || /(.)\1{5,}|[^a-zA-Z0-9]/.test(m.quoted.id) : false
			m.quoted.sender = qasim.decodeJid(m.msg.contextInfo.participant)
			m.quoted.fromMe = m.quoted.sender === qasim.decodeJid(qasim.user.id)
			m.quoted.text = m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || ''
			m.quoted.msg = extractMessageContent(m.quoted.message[m.quoted.type]) || m.quoted.message[m.quoted.type]
			m.quoted.mentionedJid = m.quoted?.msg?.contextInfo?.mentionedJid || []
			m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ''
			m.getQuotedObj = async () => {
				if (!m.quoted.id) return false
				let q = await store.loadMessage(m.chat, m.quoted.id, qasim)
				return await Serialize(qasim, q, store, groupCache)
			}
			m.quoted.key = {
				remoteJid: m.msg?.contextInfo?.remoteJid || m.chat,
				participant: m.quoted.sender,
				fromMe: areJidsSameUser(qasim.decodeJid(m.msg?.contextInfo?.participant), qasim.decodeJid(qasim?.user?.id)),
				id: m.msg?.contextInfo?.stanzaId
			}
			m.quoted.isGroup = m.quoted.chat.endsWith('@g.us')
			m.quoted.mentions = m.quoted.msg?.contextInfo?.mentionedJid || []
			m.quoted.body = m.quoted.msg?.text || m.quoted.msg?.caption || m.quoted?.message?.conversation || m.quoted.msg?.selectedButtonId || m.quoted.msg?.singleSelectReply?.selectedRowId || m.quoted.msg?.selectedId || m.quoted.msg?.contentText || m.quoted.msg?.selectedDisplayText || m.quoted.msg?.title || m.quoted?.msg?.name || ''
			m.quoted.prefix = /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(m.quoted.body) ? m.quoted.body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : /[\uD800-\uDBFF][\uDC00-\uDFFF]/gi.test(m.quoted.body) ? m.quoted.body.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gi)[0] : ''
			m.quoted.command = m.quoted.body && m.quoted.body.replace(m.quoted.prefix, '').trim().split(/ +/).shift()
			m.quoted.isMedia = !!m.quoted.msg?.mimetype || !!m.quoted.msg?.thumbnailDirectPath
			if (m.quoted.isMedia) {
				m.quoted.mime = m.quoted.msg?.mimetype
				m.quoted.size = m.quoted.msg?.fileLength
				m.quoted.height = m.quoted.msg?.height || ''
				m.quoted.width = m.quoted.msg?.width || ''
				if (/webp/i.test(m.quoted.mime)) {
					m.quoted.isAnimated = m?.quoted?.msg?.isAnimated || false
				}
			}
			m.quoted.fakeObj = proto.WebMessageInfo.fromObject({
				key: {
					remoteJid: m.quoted.chat,
					fromMe: m.quoted.fromMe,
					id: m.quoted.id
				},
				message: m.quoted,
				...(m.isGroup ? { participant: m.quoted.sender } : {})
			})
			m.quoted.download = () => qasim.downloadMediaMessage(m.quoted)
			m.quoted.delete = () => {
				qasim.sendMessage(m.quoted.chat, {
					delete: {
						remoteJid: m.quoted.chat,
						fromMe: m.isBotAdmins ? false : true,
						id: m.quoted.id,
						participant: m.quoted.sender
					}
				})
			}
		}
	}
	
	m.download = () => qasim.downloadMediaMessage(m)
	
	m.copy = () => Serialize(qasim, proto.WebMessageInfo.fromObject(proto.WebMessageInfo.toObject(m)))
	
	m.react = (u) => qasim.sendMessage(m.chat, { react: { text: u, key: m.key }})
	
	m.reply = async (content, options = {}) => {
		const { quoted = m, chat = m.chat, caption = '', ephemeralExpiration = m.expiration || store?.messages[m.chat]?.array?.slice(-1)[0]?.metadata?.ephemeralDuration || 0, mentions = (typeof content === 'string' || typeof content.text === 'string' || typeof content.caption === 'string') ? [...(content.text || content.caption || content).matchAll(/@(\d{0,16})/g)].map(v => v[1] + '@s.whatsapp.net') : [], ...validate } = options;
		if (typeof content === 'object') {
			return qasim.sendMessage(chat, content, { ...options, quoted, ephemeralExpiration })
		} else if (typeof content === 'string') {
			try {
				if (/^https?:\/\//.test(content)) {
					const data = await axios.get(content, { responseType: 'arraybuffer' });
					const mime = data.headers['content-type'] || (await FileType.fromBuffer(data.data)).mime
					if (/gif|image|video|audio|pdf|stream/i.test(mime)) {
						return qasim.sendMedia(chat, data.data, '', caption, quoted, content)
					} else {
						return qasim.sendMessage(chat, { text: content, mentions, ...options }, { quoted, ephemeralExpiration })
					}
				} else {
					return qasim.sendMessage(chat, { text: content, mentions, ...options }, { quoted, ephemeralExpiration })
				}
			} catch (e) {
				return qasim.sendMessage(chat, { text: content, mentions, ...options }, { quoted, ephemeralExpiration })
			}
		}
	}

	return m
}

module.exports = { GroupUpdate, GroupParticipantsUpdate, LoadDataBase, MessagesUpsert, Solving }

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`Update ${__filename}`))
	delete require.cache[file]
	require(file)
});