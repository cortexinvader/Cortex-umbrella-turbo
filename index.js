require('dotenv').config();
require('./settings');

const fs = require('fs');
const pino = require('pino');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const readline = require('readline');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const NodeCache = require('node-cache');
const { toBuffer, toDataURL } = require('qrcode');
const { exec, spawn, execSync } = require('child_process');
const { parsePhoneNumber } = require('awesome-phonenumber');
const { default: WAConnection, useMultiFileAuthState, Browsers, DisconnectReason, makeInMemoryStore, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, proto, getAggregateVotesInPollMessage } = require('baileys');

const { dataBase } = require('./src/database');
const { app, server, PORT } = require('./src/server');

const pairingCode = process.argv.includes('--qr') ? false : process.argv.includes('--pairing-code') || global.pairing_code;
const question = (text) => new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(text, (answer) => {
        rl.close();
        resolve(answer);
    });
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.fetchApi = async (path = '/', query = {}, options) => {
	const urlnya = (options?.name || options ? ((options?.name || options) in global.APIs ? global.APIs[(options?.name || options)] : (options?.name || options)) : global.APIs['hitori'] ? global.APIs['hitori'] : (options?.name || options)) + path + (query ? '?' + decodeURIComponent(new URLSearchParams(Object.entries({ ...query }))) : '')
	const { data } = await axios.get(urlnya, { ...((options?.name || options) ? {} : { headers: { 'accept': 'application/json', 'x-api-key': global.APIKeys[global.APIs['hitori']]}})})
	return data
}

const storeDB = dataBase(global.tempatStore);
const database = dataBase(global.tempatDB);
const msgRetryCounterCache = new NodeCache();
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });

server.listen(PORT, () => {
	console.log(chalk.magenta('🚀 EF-PRIME-MD ULTRA Server Active on Port'), chalk.yellow(PORT));
});

const { GroupParticipantsUpdate, MessagesUpsert, Solving } = require('./src/message');
const { isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep: libSleep } = require('./lib/function');

const downloadCredentials = async (sessionId, retryCount = 3) => {
    const sessionDir = './frankultradev/';
    try {
        if (!sessionId || !sessionId.startsWith('EF-PRIME-MD_')) {
            return false;
        }

        const pasteId = sessionId.replace('EF-PRIME-MD_', '');
        const pasteUrl = `https://pastebin.com/raw/${pasteId}`;
        
        console.log(chalk.cyan('🔐 EF-PRIME Authentication'));
        console.log(chalk.magenta('✓ Connecting to FrankDevs Database...'));

        return new Promise((resolve, reject) => {
            const handleRequest = (attempt) => {
                axios.get(pasteUrl, {
                    headers: {
                        'User-Agent': 'EF-PRIME-MD-ULTRA/3.0.1 (FrankDevs-Database)',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                }).then(({ data }) => {
                    try {
                        if (typeof data !== 'object') {
                           console.log(chalk.red('⚠️  Invalid session data detected from FrankDevs Database'));
                           return resolve(false);
                        }

                        if (!fs.existsSync(sessionDir)) {
                            fs.mkdirSync(sessionDir, { recursive: true });
                        }

                        fs.writeFileSync(path.join(sessionDir, 'creds.json'), JSON.stringify(data, null, 2));
                        console.log(chalk.green('✅ Connected to FrankDevs Database'));
                        console.log(chalk.yellow('🔑 Session loaded successfully'));
                        resolve(true);
                    } catch (error) {
                        console.log(chalk.red('❌ Failed to process FrankDevs Database response'), error.message);
                        resolve(false);
                    }
                }).catch(err => {
                    if (attempt < retryCount) {
                        console.log(chalk.yellow(`🔄 Retrying FrankDevs Database connection... (${attempt + 1}/${retryCount})`));
                        setTimeout(() => handleRequest(attempt + 1), 2000);
                    } else {
                        console.log(chalk.red('❌ Failed to connect to FrankDevs Database after multiple attempts'));
                        resolve(false);
                    }
                });
            };
            handleRequest(0);
        });
    } catch (error) {
        console.log(chalk.red('💥 Critical error in FrankDevs Database connection'), error.message);
        return false;
    }
};

async function startQasimBot() {
    console.log(chalk.magenta('╔═════════════════╗'));
    console.log(chalk.magenta('║       🚀 EF-PRIME-MD ULTRA 🚀         ║'));
    console.log(chalk.magenta('║         BY FRANKKAUMBA DEV             ║'));
    console.log(chalk.magenta('║        FROM AFRICA/MALAWI 🇲🇼          ║'));
    console.log(chalk.magenta('╚═══════════════════╝'));
    
    const sessionId = process.env.SESSION_ID;
    if (sessionId) {
        await downloadCredentials(sessionId);
    }

	const { state, saveCreds } = await useMultiFileAuthState('frankultradev');
	const { version, isLatest } = await fetchLatestBaileysVersion();
	const level = pino({ level: 'silent' });

	try {
		console.log(chalk.cyan('📊 Loading EF-PRIME database...'));
		const loadData = await database.read()
		const storeLoadData = await storeDB.read()

		if (!loadData || Object.keys(loadData).length === 0) {
            console.log(chalk.yellow('📊 Initializing database schema...'));
			global.db = {
				hit: {},
				set: {},
				list: {},
				store: {},
				users: {},
				game: {},
				groups: {},
				database: {},
				premium: [],
				sewa: [],
				...(loadData || {}),
			}
			await database.write(global.db)
		} else {
			global.db = loadData
		}

		if (!storeLoadData || Object.keys(storeLoadData).length === 0) {
            console.log(chalk.yellow('💾 Setting up message store...'));
			global.store = {
				contacts: {},
				presences: {},
				messages: {},
				groupMetadata: {},
				...(storeLoadData || {}),
			}
			await storeDB.write(global.store)
		} else {
			global.store = storeLoadData
		}

		console.log(chalk.green('✅ Database systems online!'));
		
		setInterval(async () => {
			if (global.db) await database.write(global.db)
			if (global.store) await storeDB.write(global.store)
		}, 30 * 1000)
	} catch (e) {
		console.log(chalk.red('💥 Critical database error:'), e)
		process.exit(1)
	}

	store.loadMessage = function (remoteJid, id) {
		const messages = store.messages?.[remoteJid]?.array;
		if (!messages) return null;
		return messages.find(msg => msg?.key?.id === id) || null;
	}

	const getMessage = async (key) => {
		if (store) {
			const msg = await store.loadMessage(key.remoteJid, key.id);
			return msg?.message || ''
		}
		return {
			conversation: 'EF-PRIME-MD ULTRA by FrankKaumba Dev'
		}
	}

    console.log(chalk.cyan('🔧 Starting WhatsApp Client...'));

	const qasim = WAConnection({
		logger: level,
		getMessage,
		syncFullHistory: true,
		maxMsgRetryCount: 15,
		msgRetryCounterCache,
		retryRequestDelayMs: 10,
		defaultQueryTimeoutMs: 0,
		connectTimeoutMs: 60000,
		browser: Browsers.windows('EF-PRIME-MD-ULTRA'),
		generateHighQualityLinkPreview: true,
		cachedGroupMetadata: async (jid) => groupCache.get(jid),
		shouldSyncHistoryMessage: msg => {
			const progress = msg.progress || 0;
			if (progress % 10 === 0 || progress === 100) {
				console.log(`${chalk.magenta('📥')} Loading Chat: ${chalk.yellow(`${progress}%`)}`);
			}
			return !!msg.syncType;
		},
		transactionOpts: {
			maxCommitRetries: 10,
			delayBetweenTriesMs: 10,
		},
		appStateMacVerification: {
			patch: true,
			snapshot: true,
		},
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, level),
		},
	})

    if (pairingCode && !qasim.authState.creds.registered) {
        console.log(chalk.cyan('🔐 Device Pairing Required'));
        const phoneNumber = await question(chalk.green("📱 Enter WhatsApp number: "));
        try {
            console.log(chalk.cyan('🔄 Generating pairing code...'));
            const code = await qasim.requestPairingCode(phoneNumber.replace(/\s/g, ''));
            console.log(chalk.green.bold(`🔑 Pairing Code: ${code.match(/.{1,4}/g).join('-')}`));
        } catch (e) {
            console.log(chalk.red("❌ Failed to generate pairing code"));
            process.exit(1);
        }
    }

	await Solving(qasim, store)
	qasim.ev.on('creds.update', saveCreds)

	qasim.ev.on('connection.update', async (update) => {
		const { qr, connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update

		if (connection === 'close') {
			const reason = new Boom(lastDisconnect?.error)?.output.statusCode

			if (reason === DisconnectReason.connectionLost) {
				console.log(chalk.yellow('🔄 EF-PRIME connection lost, reconnecting to servers...'));
				startQasimBot()
			} else if (reason === DisconnectReason.connectionClosed) {
				console.log(chalk.yellow('🔄 EF-PRIME connection closed, establishing new session...'));
				startQasimBot()
			} else if (reason === DisconnectReason.restartRequired) {
				console.log(chalk.cyan('🔄 EF-PRIME restart required, rebooting system...'));
				startQasimBot()
			} else if (reason === DisconnectReason.timedOut) {
				console.log(chalk.yellow('⏱️ EF-PRIME connection timeout, reconnecting...'));
				startQasimBot()
			} else if (reason === DisconnectReason.badSession) {
				console.log(chalk.red('❌ EF-PRIME session corrupted, delete "frankultradev" folder and re-pair device.'));
                exec('rm -rf ./frankultradev/*')
				process.exit(1);
			} else if (reason === DisconnectReason.connectionReplaced) {
				console.log(chalk.red('⚠️ EF-PRIME session replaced by another device. Closing current session.'));
                process.exit(1);
			} else if (reason === DisconnectReason.loggedOut) {
				console.log(chalk.red('🚪 EF-PRIME device logged out, delete "frankultradev" and re-pair.'));
				exec('rm -rf ./frankultradev/*')
				process.exit(1)
			} else if (reason === DisconnectReason.forbidden) {
				console.log(chalk.red('🚫 EF-PRIME connection forbidden, re-scan QR and restart.'));
				exec('rm -rf ./frankultradev/*')
				process.exit(1)
			} else if (reason === DisconnectReason.multideviceMismatch) {
				console.log(chalk.red('📱 EF-PRIME multi-device mismatch, scan QR again.'));
				exec('rm -rf ./frankultradev/*')
				process.exit(0)
			} else {
				qasim.end(`EF-PRIME Unknown DisconnectReason : ${reason}|${connection}`)
			}
		}

		if (connection == 'open') {
            console.log(chalk.green('🎉 EF-PRIME-MD ULTRA Connected!'));
			console.log(chalk.magenta('🤖 Bot:'), chalk.white(qasim.user.name || 'EF-PRIME Bot'));
            console.log(chalk.green('✅ Ready to serve!'));

			let botNumber = await qasim.decodeJid(qasim.user.id);

			if (global.db?.set[botNumber] && !global.db?.set[botNumber]?.join) {
				if (my.ch.length > 0 && my.ch.includes('@newsletter')) {
					if (my.ch) await qasim.newsletterMsg(my.ch, { type: 'follow' }).catch(e => {})
					db.set[botNumber].join = true
				}
			}
		}

		if (qr && !pairingCode) {
            console.log(chalk.cyan('📱 QR Code Generated'));
			qrcode.generate(qr, { small: true })
			app.use('/qr', async (req, res) => {
				res.setHeader('content-type', 'image/png')
				res.end(await toBuffer(qr))
			});
		}

		if (isNewLogin) console.log(chalk.green('🔐 New device detected'))

		if (receivedPendingNotifications == 'true') {
			console.log(chalk.yellow('⏳ Processing notifications...'))
			qasim.ev.flush()
		}
	});

	qasim.ev.on('contacts.update', (update) => {
		for (let contact of update) {
			let id = qasim.decodeJid(contact.id)
			if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
		}
	});

	qasim.ev.on('call', async (call) => {
		let botNumber = await qasim.decodeJid(qasim.user.id);
		if (global.db?.set[botNumber]?.anticall) {
			for (let id of call) {
				if (id.status === 'offer') {
					let msg = await qasim.sendMessage(id.from, { 
  text: `🚫 EF-PRIME-MD ULTRA Call Protection Active\n\nCurrently unable to accept ${id.isVideo ? 'Video' : 'Voice'} calls.\nIf @${id.from.split('@')[0]} needs assistance, please contact FrankKaumba Dev :)`, 
  mentions: [id.from] 
});
					await qasim.sendContact(id.from, global.owner, msg);
					await qasim.rejectCall(id.id, id.from)
				}
			}
		}
	});

	qasim.ev.on('messages.upsert', async (message) => {
		await MessagesUpsert(qasim, message, store, groupCache);
	});

	qasim.ev.on('group-participants.update', async (update) => {
		await GroupParticipantsUpdate(qasim, update, store, groupCache);
	});

	qasim.ev.on('groups.update', (update) => {
		for (const n of update) {
			if (store.groupMetadata[n.id]) {
				groupCache.set(n.id, n);
				Object.assign(store.groupMetadata[n.id], n);
			}
		}
	});

	qasim.ev.on('presence.update', ({ id, presences: update }) => {
		store.presences[id] = store.presences?.[id] || {};
		Object.assign(store.presences[id], update);
	});

	setInterval(async () => {
		if (qasim?.user?.id) await qasim.sendPresenceUpdate('available', qasim.decodeJid(qasim.user.id)).catch(e => {})
	}, 10 * 60 * 1000);

	return qasim
}

startQasimBot()

const cleanup = async (signal) => {
	console.log(chalk.yellow(`🔄 EF-PRIME received ${signal}. Saving database...`))
	if (global.db) await database.write(global.db)
	if (global.store) await storeDB.write(global.store)
	server.close(() => {
		console.log(chalk.green('🛑 EF-PRIME-MD ULTRA Server closed. Exiting...'))
		process.exit(0)
	})
}

process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGTERM', () => cleanup('SIGTERM'))
process.on('exit', () => cleanup('exit'))

server.on('error', (error) => {
	if (error.code === 'EADDRINUSE') {
		console.log(chalk.red(`❌ EF-PRIME Port ${PORT} is busy. Please retry when available!`));
		server.close();
	} else console.log(chalk.red('💥 EF-PRIME Server error:'), error);
});

setInterval(() => {}, 1000 * 60 * 10);

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.magenta(`🔄 EF-PRIME-MD ULTRA Updated: ${__filename}`))
	delete require.cache[file]
	require(file)
});