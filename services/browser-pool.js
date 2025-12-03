import puppeteer from 'puppeteer';

/**
 * Browser Pool для переиспользования браузера
 * Экономит память и время запуска при работе с Puppeteer
 */
class BrowserPool {
  constructor() {
    this.browser = null;
    this.isInitializing = false;
    this.initPromise = null;
  }

  /**
   * Получить или создать браузер
   * @returns {Promise<puppeteer.Browser>}
   */
  async getBrowser() {
    // Если браузер уже существует и подключен
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // Если идет инициализация, ждем её завершения
    if (this.isInitializing && this.initPromise) {
      return await this.initPromise;
    }

    // Запускаем инициализацию
    this.isInitializing = true;
    this.initPromise = this._launchBrowser();

    try {
      this.browser = await this.initPromise;
      return this.browser;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  /**
   * Запустить браузер с оптимизированными настройками для минимального потребления памяти
   * @returns {Promise<puppeteer.Browser>}
   */
  async _launchBrowser() {
    console.log('[BrowserPool] Launching browser with memory-optimized settings...');

    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Использовать /tmp вместо /dev/shm
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-component-extensions-with-background-pages',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=800,600', // Уменьшенный размер окна для экономии памяти
        '--memory-pressure-off', // Отключить проверки памяти (может помочь при нехватке RAM)
        '--max-old-space-size=200', // Ограничить память для Node.js процесса
        '--disable-web-security', // Отключить некоторые проверки безопасности (для экономии памяти)
        '--disable-site-isolation-trials', // Отключить изоляцию сайтов (экономия памяти)
        '--disable-features=VizDisplayCompositor' // Отключить композитор дисплея
      ]
    });

    console.log('[BrowserPool] Browser launched successfully');

    // Обработка неожиданного закрытия браузера
    browser.on('disconnected', () => {
      console.log('[BrowserPool] Browser disconnected, will recreate on next request');
      this.browser = null;
    });

    return browser;
  }

  /**
   * Создать новую страницу
   * @returns {Promise<puppeteer.Page>}
   */
  async newPage() {
    const browser = await this.getBrowser();
    return await browser.newPage();
  }

  /**
   * Закрыть браузер
   */
  async close() {
    if (this.browser) {
      console.log('[BrowserPool] Closing browser...');
      try {
        await this.browser.close();
      } catch (error) {
        console.error('[BrowserPool] Error closing browser:', error);
      }
      this.browser = null;
    }
    this.isInitializing = false;
    this.initPromise = null;
  }

  /**
   * Проверить, активен ли браузер
   * @returns {boolean}
   */
  isActive() {
    return this.browser !== null && this.browser.isConnected();
  }
}

// Создаем singleton instance
const browserPool = new BrowserPool();

// Graceful shutdown - закрываем браузер при завершении процесса
process.on('SIGINT', async () => {
  console.log('[BrowserPool] SIGINT received, closing browser...');
  await browserPool.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[BrowserPool] SIGTERM received, closing browser...');
  await browserPool.close();
  process.exit(0);
});

export default browserPool;

