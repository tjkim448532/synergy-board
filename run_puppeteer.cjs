const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

async function run() {
  console.log('Starting dev server...');
  const server = spawn('npx', ['vite', '--port', '5173'], { shell: true });
  
  server.stdout.on('data', (d) => console.log('SERVER:', d.toString()));
  server.stderr.on('data', (d) => console.log('SERVER ERR:', d.toString()));
  
  await new Promise(resolve => setTimeout(resolve, 10000)); // wait 10s

  console.log('Launching puppeteer...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  console.log('Navigating to http://localhost:5173 ...');
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('Page loaded. Waiting 10 seconds for React data fetch and render...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Take a screenshot
    const screenshotPath = 'C:\\Users\\RESOLVE_01\\.gemini\\antigravity\\brain\\33a0c06e-1f74-48f4-8ea3-67ae7c35e4ed\\v5_dashboard_test.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);
    
    // Get page text to verify
    const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' ').substring(0, 1000));
    console.log('PAGE TEXT PREVIEW:', text);
    
  } catch(e) {
    console.error('Failed to load page:', e);
  }

  await browser.close();
  server.kill();
  process.exit(0);
}

run();
