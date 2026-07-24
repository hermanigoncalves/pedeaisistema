const UAZAPI_URL = "https://scaleyia.uazapi.com";
const UAZAPI_TOKEN = "ace7fbbf-ba56-41df-89f4-fd1e2c92765d";
import { writeFileSync } from 'node:fs';

async function inspect() {
  const output = [];
  const log = (s) => { output.push(s); };

  // Buscar mensagens e mostrar TODOS os campos relevantes
  const msgsRes = await fetch(`${UAZAPI_URL}/message/find`, {
    method: 'POST',
    headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ where: {} })
  });
  const msgsData = await msgsRes.json();
  const rawMsgs = msgsData.messages || msgsData || [];
  
  log(`Total: ${rawMsgs.length}`);
  
  rawMsgs.slice(0, 15).forEach((msg, i) => {
    log(`\n--- Msg ${i} ---`);
    log(`  chatid (lower): ${msg.chatid}`);
    log(`  chatId (camel): ${msg.chatId}`);  
    log(`  sender: ${msg.sender}`);
    log(`  senderName: ${msg.senderName}`);
    log(`  messageid: ${msg.messageid}`);
    log(`  id: ${msg.id}`);
    log(`  owner: ${msg.owner}`);
    log(`  fromMe: ${msg.fromMe}`);
    log(`  isGroup: ${msg.isGroup}`);
    log(`  messageType: ${msg.messageType}`);
    log(`  messageTimestamp: ${msg.messageTimestamp}`);
    log(`  source: ${msg.source}`);
    log(`  text: ${typeof msg.text === 'string' ? msg.text.substring(0,60) : JSON.stringify(msg.text)?.substring(0,60)}`);
    log(`  content: ${typeof msg.content === 'string' ? msg.content.substring(0,60) : JSON.stringify(msg.content)?.substring(0,60)}`);
  });
  
  // Testar filtro com chatid (minúsculo)
  log(`\n\n=== TESTE FILTRO chatid MINUSCULO ===`);
  const r1 = await fetch(`${UAZAPI_URL}/message/find`, {
    method: 'POST',
    headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ where: { chatid: "553398688577@s.whatsapp.net" } }) // Saymithon
  });
  const d1 = await r1.json();
  const m1 = d1.messages || d1 || [];
  log(`Messages filtro chatid (Saymithon): ${m1.length}`);
  if (m1[0]) {
    log(`  Primeiro: sender=${m1[0].sender} chatid=${m1[0].chatid} senderName=${m1[0].senderName}`);
  }
  
  const r2 = await fetch(`${UAZAPI_URL}/message/find`, {
    method: 'POST',
    headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ where: { chatid: "553384280306@s.whatsapp.net" } }) // Isaque
  });
  const d2 = await r2.json();
  const m2 = d2.messages || d2 || [];
  log(`Messages filtro chatid (Isaque): ${m2.length}`);
  if (m2[0]) {
    log(`  Primeiro: sender=${m2[0].sender} chatid=${m2[0].chatid} senderName=${m2[0].senderName}`);
  }

  // Testar filtro com sender
  log(`\n=== TESTE FILTRO por sender ===`);
  const r3 = await fetch(`${UAZAPI_URL}/message/find`, {
    method: 'POST',
    headers: { 'token': UAZAPI_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ where: { sender: "553398688577@s.whatsapp.net" } })
  });
  const d3 = await r3.json();
  const m3 = d3.messages || d3 || [];
  log(`Messages filtro sender (Saymithon): ${m3.length}`);
  
  writeFileSync('debug_output2.txt', output.join('\n'), 'utf8');
  console.log('Saved to debug_output2.txt');
}

inspect().catch(err => console.error("ERRO:", err));
