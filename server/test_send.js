const axios = require('axios');
require('dotenv').config();

const url = process.env.EVOLUTION_URL;
const apikey = process.env.EVOLUTION_API_KEY;

const client = axios.create({
  baseURL: url,
  headers: {
    'Content-Type': 'application/json',
    'apikey': apikey
  }
});

const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png";

async function testKey(keyName, payloadValue) {
  console.log(`\n--- Testando chave: ${keyName} ---`);
  try {
    const payload = {
      number: "5533987140460",
      url: imageUrl,
      caption: `Teste com ${keyName}`
    };
    payload[keyName] = payloadValue;

    const res = await client.post('/send/media', payload);
    console.log(`Sucesso com ${keyName}:`, res.data);
    return true;
  } catch (err) {
    console.error(`Erro com ${keyName}:`, err.response?.status, err.response?.data || err.message);
    return false;
  }
}

async function run() {
  await testKey("mediatype", "image");
  await testKey("mediaType", "image");
  await testKey("media_type", "image");
  await testKey("type", "image");
}

run();
