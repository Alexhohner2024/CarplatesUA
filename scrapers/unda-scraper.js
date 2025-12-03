import browserPool from '../services/browser-pool.js';

/**
 * Scrapes VIN code from unda.com.ua by license plate number
 * Использует переиспользуемый браузер из browser pool для экономии памяти
 * @param {string} plateNumber - Ukrainian license plate (e.g., "AA1234BB")
 * @returns {Promise<Object>} - Object containing VIN code and other info
 */
export async function scrapeUndaVin(plateNumber, retryCount = 0) {
  const maxRetries = 2;
  console.log(`[Unda] Starting scrape for plate: ${plateNumber} (attempt ${retryCount + 1}/${maxRetries + 1})`);

  let page = null;
  
  try {
    // Используем переиспользуемый браузер из pool
    page = await browserPool.newPage();
  } catch (error) {
    console.error('[Unda] Error creating page:', error.message);
    
    // Если ошибка протокола и есть попытки, пересоздаем браузер и повторяем
    if (error.message && error.message.includes('timed out') && retryCount < maxRetries) {
      console.log('[Unda] Protocol timeout, forcing browser recreation and retrying...');
      // Принудительно пересоздаем браузер
      await browserPool.forceRecreate();
      // Небольшая задержка перед повторной попыткой
      await new Promise(resolve => setTimeout(resolve, 2000));
      return await scrapeUndaVin(plateNumber, retryCount + 1);
    }
    
    return {
      success: false,
      error: `Failed to create browser page: ${error.message}`,
      message: 'Не удалось инициализировать браузер. Попробуйте позже.'
    };
  }

  try {
    // Set optimized viewport (меньший размер для экономии памяти)
    await page.setViewport({ width: 800, height: 600 });
    
    // Отключаем загрузку изображений и других ресурсов для ускорения
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      // Блокируем изображения, стили, шрифты, медиа - оставляем только HTML и скрипты
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    console.log('[Unda] Navigating to unda.com.ua...');

    // Navigate to the page with faster loading strategy
    await page.goto('http://www.unda.com.ua/proverka-gosnomer-UA/', {
      waitUntil: 'domcontentloaded', // Быстрее чем networkidle2
      timeout: 15000 // Уменьшен с 30 до 15 секунд
    });

    console.log('[Unda] Page loaded, looking for input field...');

    // Try to find the input field for car plate (с таймаутом для ожидания)
    // Common selectors that might work
    const possibleInputSelectors = [
      'input[name="n_reg_new"]',  // Exact match for unda.com.ua
      'input[type="search"]',     // Search type input
      'input[type="text"]',
      'input[name*="number"]',
      'input[name*="nomer"]',
      'input[name*="номер"]',
      'input[placeholder*="номер"]',
      'input[placeholder*="number"]',
      'input[placeholder*="ГОСНОМЕР"]',
      '#carNumber',
      '#plateNumber',
      '#search',
      '.search-input',
      'form input[type="text"]',
      'form input[type="search"]'
    ];

    let inputField = null;
    let inputSelector = null;

    // Пытаемся найти поле ввода с таймаутом
    for (const selector of possibleInputSelectors) {
      try {
        // Используем waitForSelector с коротким таймаутом вместо простого $
        inputField = await page.waitForSelector(selector, { timeout: 1000 }).catch(() => null);
        if (inputField) {
          inputSelector = selector;
          console.log(`[Unda] Found input field with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!inputField) {
      // If we can't find input, log the page structure
      const pageStructure = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const forms = Array.from(document.querySelectorAll('form'));
        return {
          inputs: inputs.map(i => ({
            type: i.type,
            name: i.name,
            id: i.id,
            placeholder: i.placeholder
          })),
          forms: forms.map(f => ({
            action: f.action,
            method: f.method
          })),
          bodyPreview: document.body.innerText.substring(0, 500)
        };
      });
      console.log('[Unda] Page structure:', JSON.stringify(pageStructure, null, 2));
      throw new Error('Could not find input field for plate number');
    }

    // Type the plate number (быстрее, без задержки)
    console.log(`[Unda] Typing plate number: ${plateNumber}`);
    await page.type(inputSelector, plateNumber, { delay: 0 }); // Убрана задержка

    // Минимальное ожидание после ввода
    await page.waitForTimeout(200); // Уменьшено с 500 до 200мс

    // Find and click the submit button
    const possibleButtonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:not([type="button"])',
      'form button',
      '.submit-btn',
      '.search-btn',
      '[type="submit"]'
    ];

    let submitButton = null;
    for (const selector of possibleButtonSelectors) {
      try {
        // Используем waitForSelector с коротким таймаутом
        submitButton = await page.waitForSelector(selector, { timeout: 500 }).catch(() => null);
        if (submitButton) {
          console.log(`[Unda] Found submit button: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!submitButton) {
      // Try to press Enter instead
      console.log('[Unda] No submit button found, trying Enter key...');
      await page.keyboard.press('Enter');
    } else {
      console.log('[Unda] Clicking submit button...');
      await submitButton.click();
    }

    // Wait for results to load
    console.log('[Unda] Waiting for results...');

    // Wait for navigation or dynamic content with faster strategy
    try {
      await page.waitForNavigation({
        waitUntil: 'domcontentloaded', // Быстрее чем networkidle2
        timeout: 8000 // Уменьшен с 10 до 8 секунд
      });
    } catch (e) {
      // Navigation might not happen, content might load dynamically
      console.log('[Unda] No navigation, waiting for dynamic content...');
      await page.waitForTimeout(1500); // Уменьшено с 3000 до 1500мс
    }

    // Extract VIN and other information from the page
    console.log('[Unda] Extracting data from results...');

    const extractedData = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const bodyHTML = document.body.innerHTML;

      // Try to find VIN (17 characters, no I, O, Q)
      const vinPattern = /VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i;
      const vinMatch = bodyText.match(vinPattern);

      // Also try to find any 17-character sequence that looks like VIN
      const generalVinPattern = /\b([A-HJ-NPR-Z0-9]{17})\b/g;
      const allPossibleVins = bodyText.match(generalVinPattern);

      // Try to find VIN in table rows or divs
      const vinElements = Array.from(document.querySelectorAll('td, div, span, p'))
        .filter(el => {
          const text = el.innerText || el.textContent;
          return text && (
            text.toLowerCase().includes('vin') ||
            /[A-HJ-NPR-Z0-9]{17}/.test(text)
          );
        })
        .map(el => ({
          text: el.innerText || el.textContent,
          html: el.innerHTML
        }));

      // Extract any tables that might contain vehicle info
      const tables = Array.from(document.querySelectorAll('table'));
      const tableData = tables.map(table => {
        const rows = Array.from(table.querySelectorAll('tr'));
        return rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          return cells.map(cell => cell.innerText || cell.textContent);
        });
      });

      return {
        vin: vinMatch ? vinMatch[1] : null,
        allPossibleVins: allPossibleVins,
        vinElements: vinElements.slice(0, 5), // First 5 elements
        tableData: tableData,
        bodyPreview: bodyText.substring(0, 1000),
        htmlPreview: bodyHTML.substring(0, 1000)
      };
    });

    console.log('[Unda] Extraction complete:', JSON.stringify(extractedData, null, 2));

    // Determine the VIN code
    let vin = extractedData.vin;

    // If we didn't find VIN with the pattern, try the first possible VIN
    if (!vin && extractedData.allPossibleVins && extractedData.allPossibleVins.length > 0) {
      vin = extractedData.allPossibleVins[0];
      console.log(`[Unda] Using first possible VIN: ${vin}`);
    }

    // If still no VIN, try to extract from vinElements
    if (!vin && extractedData.vinElements && extractedData.vinElements.length > 0) {
      for (const elem of extractedData.vinElements) {
        const match = elem.text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
        if (match) {
          vin = match[1];
          console.log(`[Unda] Extracted VIN from element: ${vin}`);
          break;
        }
      }
    }

    if (!vin) {
      console.log('[Unda] No VIN found in results');
      return {
        success: false,
        error: 'VIN not found in results',
        debug: extractedData
      };
    }

    console.log(`[Unda] Successfully extracted VIN: ${vin}`);

    return {
      success: true,
      vin: vin,
      plateNumber: plateNumber,
      source: 'unda.com.ua',
      extractedData: extractedData // Include for debugging
    };
  } catch (error) {
    console.error('[Unda] Error during scraping:', error);
    
    // Если ошибка протокола и есть попытки, пересоздаем браузер и повторяем
    if (error.message && (
      error.message.includes('timed out') || 
      error.message.includes('Network.enable') ||
      error.message.includes('Protocol error')
    ) && retryCount < maxRetries) {
      console.log('[Unda] Protocol error detected, forcing browser recreation and retrying...');
      
      // Закрываем страницу если она существует
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error('[Unda] Error closing page before retry:', e);
        }
      }
      
      // Принудительно пересоздаем браузер
      await browserPool.forceRecreate();
      
      // Небольшая задержка перед повторной попыткой
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return await scrapeUndaVin(plateNumber, retryCount + 1);
    }
    
    return {
      success: false,
      error: error.message,
      message: error.message.includes('timed out') 
        ? 'Превышено время ожидания ответа от сервера. Попробуйте позже.'
        : 'Произошла ошибка при получении данных. Попробуйте позже.',
      stack: error.stack
    };
  } finally {
    // Закрываем только страницу, браузер остается открытым для переиспользования
    if (page) {
      try {
        await page.close();
        console.log('[Unda] Page closed, browser remains active for reuse');
      } catch (error) {
        console.error('[Unda] Error closing page:', error);
      }
    }
  }
}

/**
 * Test function to verify scraper works
 */
export async function testUndaScraper() {
  const testPlate = 'AA1234BB'; // Replace with a real plate for testing
  console.log(`Testing Unda scraper with plate: ${testPlate}`);

  const result = await scrapeUndaVin(testPlate);
  console.log('Test result:', JSON.stringify(result, null, 2));

  return result;
}
