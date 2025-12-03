import browserPool from '../services/browser-pool.js';

/**
 * Scrapes VIN code from unda.com.ua by license plate number
 * Использует переиспользуемый браузер из browser pool для экономии памяти
 * @param {string} plateNumber - Ukrainian license plate (e.g., "AA1234BB")
 * @returns {Promise<Object>} - Object containing VIN code and other info
 */
export async function scrapeUndaVin(plateNumber) {
  console.log(`[Unda] Starting scrape for plate: ${plateNumber}`);

  // Используем переиспользуемый браузер из pool
  const page = await browserPool.newPage();

  try {
    // Set optimized viewport (меньший размер для экономии памяти)
    await page.setViewport({ width: 800, height: 600 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    console.log('[Unda] Navigating to unda.com.ua...');

    // Navigate to the page
    await page.goto('http://www.unda.com.ua/proverka-gosnomer-UA/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('[Unda] Page loaded, looking for input field...');

    // Wait for page to be fully loaded
    await page.waitForTimeout(2000);

    // Try to find the input field for car plate
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

    for (const selector of possibleInputSelectors) {
      try {
        inputField = await page.$(selector);
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

    // Type the plate number
    console.log(`[Unda] Typing plate number: ${plateNumber}`);
    await page.type(inputSelector, plateNumber, { delay: 100 });

    // Wait a bit after typing
    await page.waitForTimeout(500);

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
        submitButton = await page.$(selector);
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

    // Wait for navigation or dynamic content
    try {
      await page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 10000
      });
    } catch (e) {
      // Navigation might not happen, content might load dynamically
      console.log('[Unda] No navigation, waiting for dynamic content...');
      await page.waitForTimeout(3000);
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
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  } finally {
    // Закрываем только страницу, браузер остается открытым для переиспользования
    try {
      await page.close();
      console.log('[Unda] Page closed, browser remains active for reuse');
    } catch (error) {
      console.error('[Unda] Error closing page:', error);
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
