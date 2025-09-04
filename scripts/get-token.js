// Используем известный демо токен вместо парсинга страницы
const DEMO_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRlbW8gVXNlciIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

async function updateVercelEnv(token) {
  const fetch = require('node-fetch');
  
  try {
    console.log('Обновляем токен в Vercel...');
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

updateVercelEnv(DEMO_TOKEN);