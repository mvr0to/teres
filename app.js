const makeWaSocket = require('@adiwajshing/baileys').default
const { DisconnectReason, makeWALegacySocket, fetchLatestBaileysVersion, useSingleFileAuthState } = require('@adiwajshing/baileys')
const { existsSync, mkdirSync, readFileSync } = require('fs')
const P = require('pino')
const { unlink } = require('fs')
const express = require('express')
const http = require('http')
const port = process.env.PORT || 8000
const app = express()
const qrcode = require("qrcode")
const socketIO = require("socket.io")
const server = http.createServer(app)
const io = socketIO(server)
const fs = require('fs')
const request = require('request')
const ZDGPath = './ZDGSessions/'
const ZDGAuth = 'auth_info.json'
const retries = new Map()

app.use("/assets", express.static(__dirname + "/assets"))
app.use(express.json())
app.use(express.urlencoded({
  extended: true
}))

app.get('/', (req, res) => {
    res.sendFile('index.html', {
      root: __dirname
    });
  });

const ZDGGroupCheck = (jid) => {
   const regexp = new RegExp(/^\d{18}@g.us$/)
   return regexp.test(jid)
}

io.on("connection", async socket => {
   socket.emit('message', '© NETVIDEO - Aguarde a conexão...');
   socket.emit("check", "./assets/off.svg")

   const shouldReconnect = (sessionId) => {
      let maxRetries = parseInt(2 ?? 0)
      let attempts = retries.get(sessionId) ?? 0
      maxRetries = maxRetries < 1 ? 1 : maxRetries
      if (attempts < maxRetries) {
          ++attempts
          console.log('Reconectando...', { attempts, sessionId })
          retries.set(sessionId, attempts)
          return true
      }
      return false
  }

const ZDGUpdate = (ZDGsock) => {
   ZDGsock.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        const ZDGReconnect = lastDisconnect?.error?.output?.statusCode
         if (qr){
            console.log('© NETVIDEO - Qrcode: ', qr);
            qrcode.toDataURL(qr, (err, url) => {
               socket.emit("qr", url)
               socket.emit("message", "© NETVIDEO - Qrcode recebido.")
            })
            
         };
         if (connection === 'close') {
            if (ZDGReconnect === DisconnectReason.loggedOut || !shouldReconnect(ZDGPath + ZDGAuth)) {
               return;
            }
           setTimeout(
               () => {
                  ZDGConnection()
                  console.log('© NETVIDEO - CONECTADO')
                  socket.emit('message', '© NETVIDEO - WhatsApp conectado!');
                  socket.emit("check", "./assets/check.svg")
               },
               ZDGReconnect === DisconnectReason.restartRequired ? 0 : parseInt(5000 ?? 0)
            )

            if (ZDGReconnect === DisconnectReason.connectionClosed) {
               socket.emit('message', '© NETVIDEO - WhatsApp desconectado!');
               socket.emit("check", "./assets/off.svg")
            }
         }
         if (connection === 'open'){
            console.log('© NETVIDEO - CONECTADO')
            socket.emit('message', '© NETVIDEO - WhatsApp conectado!');
            socket.emit("check", "./assets/check.svg")
         }
      })
   }

const ZDGConnection = async () => {

   const { version } = await fetchLatestBaileysVersion()

   if (!existsSync(ZDGPath)) {
      mkdirSync(ZDGPath, { recursive: true });
   }

   const { saveState, state } = useSingleFileAuthState(ZDGPath + ZDGAuth)
   
   const config = {
      auth: state,
      logger: P({ level: 'error' }),
      printQRInTerminal: true,
      defaultQueryTimeoutMs: undefined,
      version,
      connectTimeoutMs: 60_000,
      async getMessage(key) {
         return { conversation: 'zdg' };
      },
   }
   const ZDGsock = makeWaSocket(config, { auth: state });
   ZDGUpdate(ZDGsock.ev);
   ZDGsock.ev.on('creds.update', saveState);

   ZDGsock.ev.on('messages.upsert', async ({ messages, type }) => {
      const msg = messages[0]
      const jid = msg.key.remoteJid
   
         if (!msg.key.fromMe && jid !== 'status@broadcast' && !ZDGGroupCheck(jid)) {
            const options = {
               'method': 'POST',
               'url': 'https://netfrix-clone.bubbleapps.io/api/1.1/wf/wpp-connect',
               'headers': {
                 'Content-Type': 'application/json'
               },
               json: msg
             };
       
             request(options, function (error, response) {
               if (error) {
                 throw new Error(error);
               }
               else {
                 console.log(response.body);
               }
             });	

         }
      })

   // Send message
   app.post('/net-message', async (req, res) => {

      const jid = req.body.jid;
      const message = req.body.message;

      ZDGsock.sendMessage(jid, { text: message }).then(response => {
         res.status(200).json({
            status: true,
            response: response
         });
         }).catch(err => {
         res.status(500).json({
            status: false,
            response: err
         });
         });
   });

   // Send button3
   app.post('/net-button3', async (req, res) => {

         const jid = req.body.jid;
         const text = req.body.text;
         const footer = req.body.footer;
         const id1 = req.body.id1;
         const id2 = req.body.id2;
         const id3 = req.body.id3;
         const displaytext1 = req.body.displaytext1;
         const displaytext2 = req.body.displaytext2;
         const displaytext3 = req.body.displaytext3;
         const buttons = [
            { buttonId: id1, buttonText: { displayText: displaytext1 }, type: 1 },
            { buttonId: id2, buttonText: { displayText: displaytext2 }, type: 1 },
            { buttonId: id3, buttonText: { displayText: displaytext3 }, type: 1 },
         ]
         const buttonsMessage = {
            text: text,
            footer: footer,
            buttons: buttons,
            headerType: 1
         }
   
         ZDGsock.sendMessage(jid, buttonsMessage).then(response => {
               res.status(200).json({
                  status: true,
                  response: response
               });
               }).catch(err => {
               res.status(500).json({
                  status: false,
                  response: err
               });
               });
   
   });

   // Send button2
   app.post('/net-button2', async (req, res) => {

         const jid = req.body.jid;
         const text = req.body.text;
         const footer = req.body.footer;
         const id1 = req.body.id1;
         const id2 = req.body.id2;
         const displaytext1 = req.body.displaytext1;
         const displaytext2 = req.body.displaytext2;
         const buttons = [
            { buttonId: id1, buttonText: { displayText: displaytext1 }, type: 1 },
            { buttonId: id2, buttonText: { displayText: displaytext2 }, type: 1 },
         ]
         const buttonsMessage = {
            text: text,
            footer: footer,
            buttons: buttons,
            headerType: 1
         }
   
         ZDGsock.sendMessage(jid, buttonsMessage).then(response => {
               res.status(200).json({
                  status: true,
                  response: response
               });
               }).catch(err => {
               res.status(500).json({
                  status: false,
                  response: err
               });
               });
   
   });

   // Send button1
   app.post('/net-button1', async (req, res) => {

         const jid = req.body.jid;
         const text = req.body.text;
         const footer = req.body.footer;
         const id1 = req.body.id1;
         const displaytext1 = req.body.displaytext1;

         const buttons = [
            { buttonId: id1, buttonText: { displayText: displaytext1 }, type: 1 },
         ]
         const buttonsMessage = {
            text: text,
            footer: footer,
            buttons: buttons,
            headerType: 1
         }
   
         ZDGsock.sendMessage(jid, buttonsMessage).then(response => {
               res.status(200).json({
                  status: true,
                  response: response
               });
               }).catch(err => {
               res.status(500).json({
                  status: false,
                  response: err
               });
               });
   
   });

   // Send link
   app.post('/net-link', async (req, res) => {

         const jid = req.body.jid;
         const url = req.body.url;
         const title = req.body.title;
         const description = req.body.description;
         const link = {
            forward: {
               key: { fromMe: true },
               message: {
                  extendedTextMessage: {
                     text: url,
                     matchedText: url,
                     canonicalUrl: url,
                     title: title,
                     description: description,
                     // optional
                     jpegThumbnail: readFileSync('./assets/icone.png')
                  }
               }
            }
         };

         ZDGsock.sendMessage(jid, link).then(response => {
               res.status(200).json({
                  status: true,
                  response: response
               });
               }).catch(err => {
               res.status(500).json({
                  status: false,
                  response: err
               });
               });
   });   

   // Send list
   app.post('/net-list', async (req, res) => {

      const jid = req.body.jid;
      const title = req.body.title;
      const text = req.body.text;
      const buttonText = req.body.buttonText;
      const footer = req.body.footer;
      const sections = req.body.sections

      const sendList = {
         title: title,
         text: text,
         buttonText: buttonText,
         footer: footer,
         sections: sections
      }

      ZDGsock.sendMessage(jid, sendList).then(response => {
            res.status(200).json({
               status: true,
               response: response
            });
            }).catch(err => {
            res.status(500).json({
               status: false,
               response: err
            });
            });

   });

   // Send list
   app.post('/net-imagem', async (req, res) => {

         const jid = req.body.jid;
         const caption = req.body.caption;
         const url = req.body.url;

         const Imagem = {
            caption: caption,
            image: {
               url: url,
            }
         }
         ZDGsock.sendMessage(jid, Imagem).then(response => {
               res.status(200).json({
                  status: true,
                  response: response
               });
               }).catch(err => {
               res.status(500).json({
                  status: false,
                  response: err
               });
               });
   
   });

   socket.on('delete-session', async function() {
      await ZDGsock.logout()
         .then(fs.rmSync(ZDGPath + ZDGAuth, { recursive: true, force: true }))
         .catch(function() {
           console.log('© BOT-ZDG - Sessão removida');
      });
    });

   }

ZDGConnection()

})

server.listen(port, function() {
   console.log('© NETVIDEO - Servidor rodando na porta: ' + port);
 });