import TelegramBot from 'node-telegram-bot-api';

// Токен бота из переменной окружения
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// URL вашего Vercel API
const API_URL = 'https://carplates-ua.vercel.app/api/car';

// Функция для форматирования ответа
function formatCarInfo(data) {
  let message = `🚗 <b>Информация об автомобиле</b>\n\n`;
  
  if (data.brand && data.model) {
    message += `<b>Марка:</b> ${data.brand} ${data.model}\n`;
  }
  
  if (data.year) {
    message += `<b>Год:</b> ${data.year}\n`;
  }
  
  if (data.plate) {
    message += `<b>Номер:</b> ${data.plate}\n`;
  }
  
  if (data.vin) {
    message += `<b>VIN:</b> <code>${data.vin}</code>\n`;
  }
  
  if (data.color) {
    message += `<b>Цвет:</b> ${data.color}\n`;
  }
  
  if (data.engine) {
    message += `<b>Двигатель:</b> ${data.engine} см³\n`;
  }
  
  if (data.fuel) {
    message += `<b>Топливо:</b> ${data.fuel}\n`;
  }
  
  if (data.mass) {
    message += `<b>Масса:</b> ${data.mass} кг\n`;
  }
  
  if (data.region) {
    message += `<b>Регион:</b> ${data.region}\n`;
  }
  
  if (data.registration_date) {
    message += `<b>Дата регистрации:</b> ${data.registration_date}\n`;
  }
  
  return message;
}

// Проверка VIN кода
function isValidVIN(vin) {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
}

// Стартовое сообщение
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
👋 Добро пожаловать в CarPlates UA Bot!

🔍 Отправьте мне VIN-код автомобиля и я найду всю доступную информацию из украинских баз данных.

📝 Пример VIN: WDB9036621R859021

💡 VIN-код должен содержать 17 символов (буквы и цифры).
  `;
  
  bot.sendMessage(chatId, welcomeMessage);
});

// Команда помощи
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
ℹ️ <b>Помощь по использованию бота</b>

🔍 <b>Как использовать:</b>
1. Отправьте VIN-код автомобиля (17 символов)
2. Получите полную информацию об авто

📋 <b>Доступные команды:</b>
/start - Начать работу с ботом
/help - Показать это сообщение

❓ <b>Что такое VIN:</b>
VIN (Vehicle Identification Number) - уникальный идентификационный номер транспортного средства из 17 символов.

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

  // Проверяем формат VIN
  if (!isValidVIN(text)) {
    bot.sendMessage(chatId, `
❌ <b>Неверный формат VIN-кода</b>

VIN-код должен содержать ровно 17 символов (буквы латинского алфавита и цифры).

📝 <b>Пример:</b> WDB9036621R859021

Попробуйте ещё раз.
    `, { parse_mode: 'HTML' });
    return;
  }

  // Отправляем сообщение о поиске
  const searchMessage = await bot.sendMessage(chatId, `
🔍 <b>Поиск информации...</b>

VIN: <code>${text}</code>

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

    if (!response.ok || data.error) {
      bot.sendMessage(chatId, `
❌ <b>Информация не найдена</b>

VIN: <code>${text}</code>

Возможные причины:
• Автомобиль не зарегистрирован в Украине
• Неверный VIN-код
• Временные проблемы с базой данных

Попробуйте позже или проверьте правильность VIN-кода.
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