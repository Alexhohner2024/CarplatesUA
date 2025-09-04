import TelegramBot from 'node-telegram-bot-api';

// Токен бота от @BotFather
const token = '7499296381:AAEL8pi2TBPQS__EomvcvmtBwgpsgKRiYN8';
const bot = new TelegramBot(token, { polling: true });

// URL вашего Vercel API
const API_URL = 'https://carplates-ua.vercel.app/api/car';

// Функция для форматирования ответа
function formatCarInfo(data) {
  let message = `🚗 <b>Информация об автомобиле</b>\n\n`;
  
  if (data.brand && data.model) {
    message += `🏷️ <b>Марка:</b> <code>${data.brand} ${data.model}</code>\n`;
  }
  
  if (data.year) {
    message += `📅 <b>Год:</b> <code>${data.year}</code>\n`;
  }
  
  if (data.plate) {
    message += `🚘 <b>Номер:</b> <code>${data.plate}</code>\n`;
  }
  
  if (data.vin) {
    message += `🔢 <b>VIN:</b> <code>${data.vin}</code>\n`;
  }
  
  if (data.color) {
    message += `🎨 <b>Цвет:</b> <code>${data.color}</code>\n`;
  }
  
  if (data.engine) {
    message += `⚙️ <b>Двигатель:</b> <code>${data.engine}</code>\n`;
  }
  
  if (data.fuel) {
    message += `⛽ <b>Топливо:</b> <code>${data.fuel}</code>\n`;
  }
  
  if (data.mass) {
    message += `⚖️ <b>Масса:</b> <code>${data.mass}</code>\n`;
  }
  
  if (data.region) {
    message += `🌍 <b>Регион:</b> <code>${data.region}</code>\n`;
  }
  
  if (data.settlement) {
    message += `🏙️ <b>Населенный пункт:</b> <code>${data.settlement}</code>\n`;
  }
  
  if (data.registration_date) {
    message += `📋 <b>Дата регистрации:</b> <code>${data.registration_date}</code>\n`;
  }
  
  return message;
}

// Проверка VIN кода или госномера
function isValidInput(input) {
  // VIN код (17 символов)
  const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/i;
  // Украинский номер (различные форматы)
  const platePattern = /^[A-Z]{2}\d{4}[A-Z]{2}$|^[A-Z]{3}\d{4}$|^\d{4}[A-Z]{2}$/i;
  
  return vinPattern.test(input) || platePattern.test(input);
}

// Стартовое сообщение
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
👋 Добро пожаловать в CarPlates UA Bot!

🔍 Отправьте мне VIN-код или госномер автомобиля и я найду всю доступную информацию из украинских баз данных.

📝 Примеры:
• VIN: WDB9036621R859021
• Номер: АА1234ВВ

💡 VIN-код должен содержать 17 символов, номер - стандартный украинский формат.
  `;
  
  bot.sendMessage(chatId, welcomeMessage);
});

// Команда помощи
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
• Госномер: стандартные украинские форматы

🔗 <b>Источник данных:</b>
Информация предоставляется из официальных баз МВС Украины.
  `;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
});

// Обработка текстовых сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Пропускаем команды
  if (text.startsWith('/')) {
    return;
  }

  // Проверяем формат ввода
  if (!isValidInput(text)) {
    bot.sendMessage(chatId, `
❌ <b>Неверный формат</b>

Поддерживаемые форматы:
• VIN-код: 17 символов (буквы и цифры)
• Госномер: украинский формат (например, АА1234ВВ)

📝 <b>Примеры:</b>
• WDB9036621R859021
• АА1234ВВ

Попробуйте ещё раз.
    `, { parse_mode: 'HTML' });
    return;
  }

  // Отправляем сообщение о поиске
  const searchMessage = await bot.sendMessage(chatId, `
🔍 <b>Поиск информации...</b>

Запрос: <code>${text}</code>

⏳ Это может занять несколько секунд.
  `, { parse_mode: 'HTML' });

  try {
    // Запрос к нашему API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ vin: text.toUpperCase() })
    });

    const data = await response.json();

    // Удаляем сообщение о поиске
    bot.deleteMessage(chatId, searchMessage.message_id);

    // Проверяем новый формат ответа
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

    // Форматируем и отправляем результат
    const formattedMessage = formatCarInfo(data);
    bot.sendMessage(chatId, formattedMessage, { parse_mode: 'HTML' });

  } catch (error) {
    console.error('Bot error:', error);
    
    // Удаляем сообщение о поиске
    bot.deleteMessage(chatId, searchMessage.message_id);
    
    bot.sendMessage(chatId, `
❌ <b>Произошла ошибка</b>

Не удалось получить информацию об автомобиле.

Попробуйте позже или обратитесь к администратору.
    `, { parse_mode: 'HTML' });
  }
});

console.log('Bot started...');