import puppeteer from 'puppeteer';

async function testUndaSite() {
  console.log('🚀 Starting Unda.com.ua investigation...');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser' || '/usr/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920x1080'
    ]
  });

  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('📖 Opening unda.com.ua...');
    await page.goto('http://www.unda.com.ua/proverka-gosnomer-UA/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('✅ Page loaded successfully');

    // Take screenshot for debugging
    await page.screenshot({ path: 'unda-page.png', fullPage: true });
    console.log('📸 Screenshot saved as unda-page.png');

    // Get page title
    const title = await page.title();
    console.log('📄 Page title:', title);

    // Find all input fields
    console.log('\n🔍 Looking for input fields...');
    const inputs = await page.evaluate(() => {
      const inputElements = Array.from(document.querySelectorAll('input'));
      return inputElements.map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        className: input.className
      }));
    });
    console.log('Found inputs:', JSON.stringify(inputs, null, 2));

    // Find all buttons
    console.log('\n🔍 Looking for buttons...');
    const buttons = await page.evaluate(() => {
      const buttonElements = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      return buttonElements.map(button => ({
        tagName: button.tagName,
        type: button.type,
        text: button.textContent?.trim(),
        id: button.id,
        className: button.className
      }));
    });
    console.log('Found buttons:', JSON.stringify(buttons, null, 2));

    // Find all forms
    console.log('\n🔍 Looking for forms...');
    const forms = await page.evaluate(() => {
      const formElements = Array.from(document.querySelectorAll('form'));
      return formElements.map(form => ({
        action: form.action,
        method: form.method,
        id: form.id,
        className: form.className
      }));
    });
    console.log('Found forms:', JSON.stringify(forms, null, 2));

    // Try to find the main input field by common selectors
    console.log('\n🔍 Trying to locate car plate input field...');
    let inputSelector = null;
    const possibleSelectors = [
      'input[type="text"]',
      'input[name*="number"]',
      'input[name*="plate"]',
      'input[name*="номер"]',
      'input[placeholder*="номер"]',
      'input#carNumber',
      'input#plateNumber',
      '#search input',
      '.search input'
    ];

    for (const selector of possibleSelectors) {
      const exists = await page.$(selector);
      if (exists) {
        console.log(`✅ Found input with selector: ${selector}`);
        inputSelector = selector;
        break;
      }
    }

    if (inputSelector) {
      // Test with a sample plate number
      const testPlate = 'AA1234BB'; // Example plate
      console.log(`\n📝 Testing with plate number: ${testPlate}`);

      await page.type(inputSelector, testPlate);
      console.log('✅ Typed plate number into input field');

      // Take screenshot after typing
      await page.screenshot({ path: 'unda-typed.png' });
      console.log('📸 Screenshot saved as unda-typed.png');

      // Find and click submit button
      const submitButton = await page.$('button[type="submit"], input[type="submit"], button');
      if (submitButton) {
        console.log('🖱️  Clicking submit button...');

        // Wait for navigation or response
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => console.log('No navigation occurred')),
          submitButton.click()
        ]);

        console.log('✅ Submitted form');

        // Wait a bit for results to load
        await page.waitForTimeout(3000);

        // Take screenshot of results
        await page.screenshot({ path: 'unda-results.png', fullPage: true });
        console.log('📸 Results screenshot saved as unda-results.png');

        // Try to extract VIN from results page
        console.log('\n🔍 Looking for VIN code in results...');
        const vinData = await page.evaluate(() => {
          // Look for VIN in various ways
          const bodyText = document.body.innerText;

          // Try to find VIN pattern (17 characters)
          const vinPattern = /VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i;
          const vinMatch = bodyText.match(vinPattern);

          // Also look for any 17-character alphanumeric string
          const generalVinPattern = /\b([A-HJ-NPR-Z0-9]{17})\b/g;
          const allVins = bodyText.match(generalVinPattern);

          return {
            vinFromPattern: vinMatch ? vinMatch[1] : null,
            allPossibleVins: allVins,
            pageText: bodyText.substring(0, 1000) // First 1000 chars for debugging
          };
        });

        console.log('VIN search results:', JSON.stringify(vinData, null, 2));

      } else {
        console.log('❌ Submit button not found');
      }
    } else {
      console.log('❌ Could not find input field for car plate number');
    }

    // Get all text content to analyze
    console.log('\n📄 Getting page content...');
    const pageContent = await page.evaluate(() => document.body.innerText);
    console.log('First 500 characters of page:', pageContent.substring(0, 500));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

// Run the test
testUndaSite().catch(console.error);
