const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('BROWSER CONSOLE ERROR:', msg.text());
      }
    });
    
    page.on('pageerror', err => {
      console.log('BROWSER PAGE ERROR:', err.toString());
    });
    
    // Go to the page and wait until DOM is loaded (not network idle, to avoid hanging on long polls)
    await page.goto('https://claudeclone-pi.vercel.app/chat', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Wait for 3 seconds to let React render and crash if it's going to
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Finished waiting');
  } catch (err) {
    console.error('Puppeteer Script Error:', err);
  } finally {
    await browser.close();
  }
})();
