const UAZAPI_URL = "https://scaleyia.uazapi.com";
const UAZAPI_TOKEN = "ace7fbbf-ba56-41df-89f4-fd1e2c92765d";
const fs = require('fs');

async function inspect() {
  const output = [];
  const log = (s) => { output.push(s); };

  // 1. Chats
  const chatsRes = await fetch(`${UAZAPI_URL}/chat/find`, {
    method: 'POST',
    headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const chatsData = await chatsRes.json();
  const chatsList = Array.isArray(chatsData.chats) ? chatsData.chats : (Array.isArray(chatsData) ? chatsData : []);
  
  log(`Total chats: ${chatsList.length}`);
  chatsList.slice(0, 4).forEach((chat, i) => {
    log(`\nChat ${i}: id=${chat.id} | wa_chatid=${chat.wa_chatid} | wa_name=${chat.wa_name} | name=${chat.name}`);
    log(`  keys: ${Object.keys(chat).join(', ')}`);
  });

  // 2. Messages sem filtro  
  const msgsRes = await fetch(`${UAZAPI_URL}/message/find`, {
    method: 'POST',
    headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ where: {} })
  });
  const msgsData = await msgsRes.json();
  log(`\n\nResponse keys: ${Object.keys(msgsData).join(', ')}`);
  
  const rawMsgs = Array.isArray(msgsData.messages) ? msgsData.messages : (Array.isArray(msgsData) ? msgsData : []);
  log(`Total messages (no filter): ${rawMsgs.length}`);
  if (msgsData.hasMore !== undefined) log(`hasMore: ${msgsData.hasMore}`);
  if (msgsData.limit !== undefined) log(`limit: ${msgsData.limit}`);
  
  rawMsgs.slice(0, 8).forEach((msg, i) => {
    log(`\nMsg ${i}:`);
    log(`  keys: ${Object.keys(msg).join(', ')}`);
    log(`  chatId: ${msg.chatId}`);
    log(`  remoteJid: ${msg.remoteJid}`);
    log(`  fromMe: ${msg.fromMe}`);
    log(`  senderName: ${msg.senderName}`);
    log(`  type: ${msg.type}`);
    if (msg.key) log(`  key: ${JSON.stringify(msg.key)}`);
    const txt = typeof msg.content === 'string' ? msg.content.substring(0,60) : 
      (msg.content?.text?.substring?.(0,60) || msg.body?.substring?.(0,60) || JSON.stringify(msg.content)?.substring(0,80));
    log(`  content: ${txt}`);
  });

  // 3. Messages com filtro de JID específico
  if (chatsList.length >= 2) {
    const c1 = chatsList[0];  
    const c2 = chatsList[1];
    
    const jid1 = c1.wa_chatid || c1.id;
    log(`\n\n=== FILTRO POR CHAT 1: ${c1.wa_name} (jid=${jid1}, id=${c1.id}) ===`);
    const r1 = await fetch(`${UAZAPI_URL}/message/find`, {
      method: 'POST',
      headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ where: { chatId: jid1 } })
    });
    const d1 = await r1.json();
    const m1 = Array.isArray(d1.messages) ? d1.messages : (Array.isArray(d1) ? d1 : []);
    log(`Messages with JID filter: ${m1.length}`);

    const jid2 = c2.wa_chatid || c2.id;
    log(`\n=== FILTRO POR CHAT 2: ${c2.wa_name} (jid=${jid2}, id=${c2.id}) ===`);
    const r2 = await fetch(`${UAZAPI_URL}/message/find`, {
      method: 'POST',
      headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ where: { chatId: jid2 } })
    });
    const d2 = await r2.json();
    const m2 = Array.isArray(d2.messages) ? d2.messages : (Array.isArray(d2) ? d2 : []);
    log(`Messages with JID filter: ${m2.length}`);
  }
  
  fs.writeFileSync('debug_output.txt', output.join('\n'), 'utf8');
  console.log('Output saved to debug_output.txt');
}

inspect().catch(err => console.error("ERRO:", err));
