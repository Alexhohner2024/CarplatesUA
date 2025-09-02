const puppeteer = require('puppeteer');
const fs = require('fs');

async function getAuthToken() {
  console.log('Запуск браузера...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Настройка перехвата сетевых запросов
    let authToken = null;
    
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      // Проверяем запросы к API
      if (request.url().includes('api.carplates.app/summary')) {
        const headers = request.headers();
        if (headers.authorization) {
          authToken = headers.authorization;
          console.log('Токен найден!');
        }
      }
      request.continue();
    });

    // Открываем сайт
    console.log('Открываем сайт...');
    await page.goto('https://ua.carplates.app/', {
      waitUntil: 'networkidle0'
    });

    // Ждем загрузки и пытаемся найти поле поиска
    await page.waitForTimeout(3000);
    
    // Ищем поле ввода VIN
    const searchInput = await page.$('input[type="text"], input[placeholder*="VIN"], input[placeholder*="номер"]');
    
    if (searchInput) {
      console.log('Вводим тестовый VIN...');
      await searchInput.type('WDB9036621R859021');
      
      // Ищем кнопку поиска
      const searchButton = await page.$('button[type="submit"], button:contains("Поиск"), [role="button"]');
      
      if (searchButton) {
        await searchButton.click();
        console.log('Нажали поиск, ожидаем запрос...');
        
        // Ждем появления токена (максимум 10 секунд)
        for (let i = 0; i < 10; i++) {
          if (authToken) break;
          await page.waitForTimeout(1000);
        }
      }
    }

    if (authToken) {
      console.log('Токен успешно получен');
      // Экспортируем токен как переменную окружения для следующего шага
      console.log(`::set-output name=token::${authToken}`);
      
      // Также устанавливаем переменную для использования в workflow
      fs.appendFileSync(process.env.GITHUB_ENV || '/tmp/github_env', `NEW_AUTH_TOKEN=${authToken}\n`);
      
      process.exit(0);
    } else {
      console.error('Токен не найден');
      process.exit(1);
    }

  } catch (error) {
    console.error('Ошибка:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Запуск скрипта
getAuthToken();
