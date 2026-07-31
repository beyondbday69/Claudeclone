const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('https://claudeclone-pi.vercel.app/chat', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'crash-screenshot.png' });
  
  await browser.close();
})();
