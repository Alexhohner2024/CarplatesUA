const puppeteer = require('puppeteer');

async function getAuthToken() {
  console.log('Запуск браузера...');
  const browser = await puppeteer.launch({ 
    headless: "new",
    executablePath: '/usr/bin/chromium-browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('Переход на страницу...');
    await page.goto('https://carplates.app/demo/ua', { waitUntil: 'networkidle0' });
    
    console.log('Получение токена...');
    const token = await page.evaluate(() => {
      return localStorage.getItem('AuthToken');
    });
    
    if (token) {
      console.log('Токен получен успешно');
      await updateVercelEnv(token);
    } else {
      console.log('Токен не найден');
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await browser.close();
  }
}

async function updateVercelEnv(token) {
  const fetch = require('node-fetch');
  
  try {
    const response = await fetch(`https://api.vercel.com/v9/projects/${process.env.VERCEL_PROJECT_ID}/env`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'AUTH_TOKEN',
        value: token,
        type: 'encrypted',
        target: ['production', 'preview', 'development']
      })
    });
    
    if (response.ok) {
      console.log('Токен обновлен в Vercel');
    } else {
      console.log('Ошибка обновления:', await response.text());
    }
  } catch (error) {
    console.error('Ошибка API:', error);
  }
}

getAuthToken();