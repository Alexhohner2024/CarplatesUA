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
      protocolTimeout: 120000, // 2 минуты для протокола DevTools (увеличено с дефолтных 180000)
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
   * Создать новую страницу с обработкой ошибок
   * @returns {Promise<puppeteer.Page>}
   */
  async newPage() {
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      
      // Устанавливаем таймауты для страницы
      page.setDefaultNavigationTimeout(20000); // 20 секунд
      page.setDefaultTimeout(15000); // 15 секунд
      
      return page;
    } catch (error) {
      // Если ошибка связана с протоколом, пересоздаем браузер
      if (error.message && error.message.includes('timed out')) {
        console.error('[BrowserPool] Protocol timeout, recreating browser...');
        this.browser = null;
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(20000);
        page.setDefaultTimeout(15000);
        return page;
      }
      throw error;
    }
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
   * Принудительно пересоздать браузер (для обработки ошибок)
   */
  async forceRecreate() {
    console.log('[BrowserPool] Force recreating browser...');
    await this.close();
    // Небольшая задержка перед пересозданием
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await this.getBrowser();
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

