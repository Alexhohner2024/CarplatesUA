import TelegramBot from 'node-telegram-bot-api';
import http from 'http';

const token = '7499296381:AAEL8pi2TBPQS__EomvcvmtBwgpsgKRiYN8';
const bot = new TelegramBot(token, { polling: true });
const API_URL = 'https://carplates-ua.vercel.app/api/car';

function transliterateUkrainianPlate(text) {
  const translitMap = {
    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'І': 'I', 'К': 'K', 'М': 'M',
    'О': 'O', 'Р': 'P', 'Т': 'T', 'У': 'Y', 'Х': 'X', 'З': 'Z',
    'а': 'A', 'в': 'B', 'с': 'C', 'е': 'E', 'н': 'H', 'і': 'I', 'к': 'K', 'м': 'M',
    'о': 'O', 'р': 'P', 'т': 'T', 'у': 'Y', 'х': 'X', 'з': 'Z'
  };
  return text.split('').map(char => translitMap[char] || char).join('');
}

function formatCarInfo(data) {
  let message = `🚗 <b>Информация об автомобиле</b>\n\n`;
  if (data.brand && data.model) message += `🏷️ <b>Марка:</b> <code>${data.brand} ${data.model}</code>\n`;
  if (data.year) message += `📅 <b>Год:</b> <code>${data.year}</code>\n`;
  if (data.plate) message += `🚘 <b>Номер:</b> <code>${data.plate}</code>\n`;
  if (data.vin) message += `🔢 <b>VIN:</b> <code>${data.vin}</code>\n`;
  if (data.color) message += `🎨 <b>Цвет:</b> <code>${data.color}</code>\n`;
  if (data.engine) message += `⚙️ <b>Двигатель:</b> <code>${data.engine}</code>\n`;
  if (data.fuel) message += `⛽ <b>Топливо:</b> <code>${data.fuel}</code>\n`;
  if (data.type) message += `🚛 <b>Тип:</b> <code>${data.type}</code>\n`;
  if (data.mass) message += `⚖️ <b>Масса:</b> <code>${data.mass}</code>\n`;
  if (data.max_mass) message += `🏋️ <b>Полная масса:</b> <code>${data.max_mass}</code>\n`;
  if (data.category) message += `📦 <b>Категория/Кузов:</b> <code>${data.category}</code>\n`;
  if (data.region) message += `🌍 <b>Регион:</b> <code>${data.region}</code>\n`;
  if (data.settlement) message += `🏙️ <b>Населенный пункт:</b> <code>${data.settlement}</code>\n`;
  return message;
}

function isValidInput(input) {
  const transliterated = transliterateUkrainianPlate(input);
  const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/i;
  const platePattern = /^[A-Z]{2}\d{4}[A-Z]{2}$|^[A-Z]{3}\d{4}$|^\d{4}[A-Z]{2}$|^\d{5}[A-Z]{2}$/i;
  return vinPattern.test(input) || platePattern.test(transliterated);
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
👋 Добро пожаловать в CarPlates UA Bot!

🔍 Отправьте мне VIN-код или госномер автомобиля и я найду всю доступную информацию из украинских баз данных.

📝 Примеры:
• VIN: WDB9036621R859021
• Номер: AA1234BB или АА1234ВВ

💡 VIN-код должен содержать 17 символов, номер можно писать кириллицей или латиницей.
  `;
  bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
ℹ️ <b>Помощь по использованию бота</b>

🔍 <b>Как использовать:</b>
1. Отправьте VIN-код (17 символов) или госномер
2. Получите полную информацию об авто

📋 <b>Доступные команды:</b>
/start - Начать работу с ботом
/help - Показать это сообщение

❓ <b>Поддерживаемые форматы:</b>
• VIN-код: 17 символов (буквы и цифры)
• Госномер: украинский формат кириллицей или латиницей (например, АА1234ВВ или AA1234BB)

🔗 <b>Источник данных:</b>
Информация предоставляется из официальных баз МВС Украины.
  `;
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;
  if (text && text.startsWith('/')) return;
  if (!isValidInput(text)) {
    bot.sendMessage(chatId, `
❌ <b>Неверный формат</b>

Поддерживаемые форматы:
• VIN-код: 17 символов (буквы и цифры)
• Госномер: украинский формат кириллицей или латиницей (например, АА1234ВВ или AA1234BB)

📝 <b>Примеры:</b>
• WDB9036621R859021
• АА1234ВВ или AA1234BB

Попробуйте ещё раз.
    `, { parse_mode: 'HTML' });
    return;
  }

  const searchMessage = await bot.sendMessage(chatId, `
🔍 <b>Поиск информации...</b>

Запрос: <code>${text}</code>

⏳ Это может занять несколько секунд.
  `, { parse_mode: 'HTML' });

  try {
    const requestText = transliterateUkrainianPlate(text.toUpperCase());

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'SID=g.a0002Ah0M1_eEngpcqhYUKr5IdeYHAc6FM4TJB71L5DIvPuwtm2znV4o81CqWsd2t88QJa1vDgACgYKARsSARESFQHGX2Mia7ghZS73qWho9mFOps23WBoVAUF8yKrA49JHTythre6aTh-GBRpm0076; SIDCC=AKEyXzUzw0TCBtjyOwlTiUPY2v3UOdScE8gfMV4nA1B_8inEQuwr2QdrAdLhxi1pUfq2PxwkiA; SSID=ALM7ZkKsdm0xPWi9b; _Secure-1PAPISID=bYoSfHGCqAkyJwVD9rpGMq-UGt355a-PDLKOYoPwl8yWOcBDA7NS3Yx6mlu43Ej4Ya6HueKGmL3xTb5czqZLxjFcS-8804NmwcPycLGv-49DZuL09YEM-Kd4jwSGnSUFnF8StP1aRY6Uf7ULTj8stXxgq3m2dlpWgcskAn5AxLHmrBDb5MnkRElyRculIJ6I_Y8-SrzrHSTz6YQqb2zop4Svnh4GzZFKWsFr_SeuPAWST0sw7iaXtv5NbKGDGPZCm5osGultyoYLMTHfdH_6WUcka9SUf54rsJpjPZoFQqLfuJGc6nrx99_FzC1ARSNUuIDU0oA9iqRJk_9rD4HfHsF8Nmjoj2-Cm8LAWUp2G7DXRw; _Secure-1PSSIDCC=AKEyXzXzPdrsdK2UtGHJL74cMrJ19tcnGsSquNb3z-bnkOAyqFzNIwSpEZdPOzgrR5HBN33yIHJ5g4qiZb32hStU7kZIJE8GkXqbSloHmN3Knk9zmQuvUg7ISBGuPiHSzxqjxZSoI3QUdu2hsYWAR_0s0VcTmVHsQkAKxDvVMr7BTgc_Lc1YATD9eoDi04KcU; _Secure-3PAPISID=bYoSfHGCqAkyJwVD9rpGMq-UGt355a-PDLKOYoPwl8yWOcBDA7NS3Yx6mlu43Ej4Ya6HueKGmL3xTb5czqZLxjFcS-8804NmwcPycLGv-49DZuL09YEM-Kd4jwSGnSUFnF8StP1aRY6Uf7ULTj8stXxgq3m2dlpWgcskAn5AxLHmrBDb5MnkRElyRculIJ6I_Y8-SrzrHSTz6YQqb2zop4Svnh4GzZFKWsFr_SeuPAWST0sw7iaXtv5NbKGDGPZCm5osGultyoYLMTHfdH_6WUcka9SUf54rsJpjPZoFQqLfuJGc6nrx99_FzC1ARSNUuIDU0oA9iqRJk_9rD4HfHsF8Nmjoj2-Cm8LAWUp2G7DXRw; _Secure-3PSIDCC=AKEyXzXzPdrsdK2UtGHJL74cMrJ19tcnGsSquNb3z-bnkOAyqFzNIwSpEZdPOzgrR5HBN33yIHJ5g4qiZb32hStU7kZIJE8GkXqbSloHmN3Knk9zmQuvUg7ISBGuPiHSzxqjxZSoI3QUdu2hsYWAR_0s0VcTmVHsQkAKxDvVMr7BTgc_Lc1YATD9eoDi04KcU; _Secure-3PSID=bYoSfHGCqAkyJwVD9rpGMq-UGt355a-PDLKOYoPwl8yWOcBDA7NS3Yx6mlu43Ej4Ya6HueKGmL3xTb5czqZLxjFcS-8804NmwcPycLGv-49DZuL09YEM-Kd4jwSGnSUFnF8StP1aRY6Uf7ULTj8stXxgq3m2dlpWgcskAn5AxLHmrBDb5MnkRElyRculIJ6I_Y8-SrzrHSTz6YQqb2zop4Svnh4GzZFKWsFr_SeuPAWST0sw7iaXtv5NbKGDGPZCm5osGultyoYLMTHfdH_6WUcka9SUf54rsJpjPZoFQqLfuJGc6nrx99_FzC1ARSNUuIDU0oA9iqRJk_9rD4HfHsF8Nmjoj2-Cm8LAWUp2G7DXRw; _Secure-ENID=28.SE~S4q201G..; AEC=AaJma5uLTk6w..; APISID=0s4Bw4CJWWF..; HSID=A25SnyHmm0Pt..; NID=525~Am6pX0n..; SAPISID=bYoSfHGCqAkyJwVD9rpGMq-UGt355a-PDLK; SEARCH_SAMESITE=CgQIk658; SID=g.a0002Ah0M1_eEngpcqhYUKr5IdeYHAc6FM4TJB71L5DIvPuwtm2znV4o81CqWsd2t88QJa1vDgACgYKARsSARESFQHGX2Mia7ghZS73qWho9mFOps23WBoVAUF8yKrA49JHTythre6aTh-GBRpm0076'
    },
    body: JSON.stringify({ vin: requestText })
  });

  const data = await response.json();

  bot.deleteMessage(chatId, searchMessage.message_id);

  if (!data.success) {
    bot.sendMessage(chatId, `
❌ <b>Информация не найдена</b>

Запрос: <code>${text}</code>

${data.message || 'Возможные причины:'}
• Автомобиль не зарегистрирован в Украине
• Неверный VIN-код или номер
• Временные проблемы с базой данных

Попробуйте позже или проверьте правильность данных.
    `, { parse_mode: 'HTML' });
    return;
  }

  const formattedMessage = formatCarInfo(data);
  bot.sendMessage(chatId, formattedMessage, { parse_mode: 'HTML' });

} catch (error) {
  console.error('Bot error:', error);

  bot.deleteMessage(chatId, searchMessage.message_id);

  bot.sendMessage(chatId, `
❌ <b>Произошла ошибка</b>

Не удалось получить информацию об автомобиле.

Попробуйте позже или обратитесь к администратору.
  `, { parse_mode: 'HTML' });
}
});

console.log('Bot started...');

// Minimal HTTP server to keep Fly.io machine active and pass health checks
const healthPort = process.env.PORT ? Number(process.env.PORT) : 8080;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});
server.listen(healthPort, () => {
  console.log(`Health server listening on port ${healthPort}`);
});
