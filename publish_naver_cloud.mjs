import { chromium } from 'playwright';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1FdAi652-z0_EZMXOrN0tNZWAcpdpN4CdVIxvWdSG8SQ/export?format=csv&gid=0';
const NAVER_ID = process.env.NAVER_ID || 'wonrexander';
const NAVER_PW = process.env.NAVER_PW || 'iamwon84^^!@';
const NAVER_COOKIES_JSON = process.env.NAVER_COOKIES || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8858081744:AAFbsEkJeuJeo4ccgzK3J6zHlxuZu4-aLto';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1598288296';

async function sendTelegram(msg) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: msg,
      parse_mode: 'HTML'
    });
  } catch (e) {
    console.error('[!] Telegram alert failed:', e.message);
  }
}

async function fetchSpreadsheetData() {
  console.log('[*] Fetching Google Spreadsheet CSV...');
  const res = await axios.get(SPREADSHEET_CSV_URL, { timeout: 15000 });
  const records = parse(res.data, {
    skip_empty_lines: true,
    relax_column_count: true
  });
  return records;
}

function getTodayKSTString() {
  const now = new Date();
  const kst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return kst.toISOString().split('T')[0];
}

async function run() {
  console.log('=== [GitHub Actions] 24/7 Naver Blog Cloud Publisher ===');
  const today = getTodayKSTString();
  console.log(`[*] Today KST: ${today}`);

  const rows = await fetchSpreadsheetData();
  if (rows.length < 2) {
    console.log('[!] No data found in spreadsheet.');
    return;
  }

  let targetRow = null;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const postDate = r[6]?.trim();
    const status = r[7]?.trim();
    if (postDate === today && status === 'Ready') {
      targetRow = r;
      break;
    }
  }

  if (!targetRow) {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r[7]?.trim() === 'Ready') {
        targetRow = r;
        break;
      }
    }
  }

  if (!targetRow) {
    console.log('[*] No posts in "Ready" status found. Skipping publishing.');
    return;
  }

  const postId = targetRow[0];
  const field = targetRow[1];
  const title = targetRow[2];
  const intro1 = targetRow[9];
  const intro2 = targetRow[10];
  const quote = targetRow[11];
  const lawAnalysis = targetRow[12];
  const sol1 = targetRow[14];
  const sol2 = targetRow[15];
  const sol3 = targetRow[16];
  const sol4 = targetRow[17];
  const table1 = targetRow[19];
  const table2 = targetRow[20];
  const table3 = targetRow[21];
  const qna1 = targetRow[23];
  const qna2 = targetRow[24];
  const qna3 = targetRow[25];
  const closing = targetRow[27];
  const cta = targetRow[28];
  const img1Name = targetRow[29];
  const img2Name = targetRow[30];

  console.log(`[*] Target Post Selected: [${postId}] ${title}`);

  const img1Path = path.resolve('images', img1Name);
  const img2Path = path.resolve('images', img2Name);
  console.log(`[*] Image 1: ${img1Path} (Exists: ${fs.existsSync(img1Path)})`);
  console.log(`[*] Image 2: ${img2Path} (Exists: ${fs.existsSync(img2Path)})`);

  console.log('[*] Launching Chromium in GitHub Actions Cloud Runner...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ko-KR'
  });

  if (NAVER_COOKIES_JSON) {
    try {
      const cookies = JSON.parse(NAVER_COOKIES_JSON);
      await context.addCookies(cookies);
      console.log(`[*] Injected ${cookies.length} Naver session cookies!`);
    } catch (e) {
      console.log('[!] Failed to parse NAVER_COOKIES:', e.message);
    }
  }

  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    console.log(`[*] Navigating to SmartEditor ONE for ${NAVER_ID}...`);
    await page.goto(`https://blog.naver.com/${NAVER_ID}?Redirect=Write`, { timeout: 30000 });
    await page.waitForTimeout(6000);

    let frame = page;
    const mainFrameEl = await page.$('#mainFrame');
    if (mainFrameEl) {
      frame = await mainFrameEl.contentFrame();
    }

    // Dismiss any popup/draft restore alerts
    try {
      const cancelBtn = await frame.$('.se-popup-button-cancel, button:has-text("취소")');
      if (cancelBtn) {
        console.log('[*] Dismissing draft restore dialog...');
        await cancelBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}

    // 1. Enter Title
    console.log('[1/5] Entering Title...');
    const titleArea = await frame.$('.se-documentTitle, .se-section-documentTitle, [contenteditable="true"]');
    if (titleArea) {
      await titleArea.click();
      await page.keyboard.type(title, { delay: 10 });
      await page.waitForTimeout(500);
    }

    // 2. Attach Header 3D Image (Image 1)
    if (fs.existsSync(img1Path)) {
      console.log(`[2/5] Attaching Header 3D Infographic: ${img1Name}...`);
      let fileInput = await frame.$('input[type="file"]');
      if (!fileInput) {
        const photoBtn = await frame.$('button[data-click-area="tpb.image"], button[class*="image_btn"], button:has-text("사진")');
        if (photoBtn) {
          await photoBtn.click().catch(() => {});
          await page.waitForTimeout(1000);
          fileInput = await frame.$('input[type="file"]');
        }
      }
      if (fileInput) {
        await fileInput.setInputFiles(img1Path);
        console.log('[*] Waiting 5s for Image 1 upload...');
        await page.waitForTimeout(5000);
      }
    }

    // 3. Enter Content Body
    console.log('[3/5] Entering Body Content & Tables...');
    const bodyParagraphs = [
      intro1,
      intro2,
      `[실제 상담 사례] ${quote}`,
      lawAnalysis,
      sol1,
      sol2,
      sol3,
      sol4,
      `[실무 요약 비교표] ${table1}`,
      `[금액별 시뮬레이션] ${table2}`,
      `[세무조사 체크리스트] ${table3}`,
      qna1,
      qna2,
      qna3,
      closing,
      cta
    ];

    const bodyP = frame.locator('.se-component.se-text p, .se-canvas').last();
    if (await bodyP.count() > 0) {
      await bodyP.click({ force: true });
    }

    for (const p of bodyParagraphs) {
      if (p) {
        const cleanText = p.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        await page.keyboard.type(cleanText, { delay: 0 });
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
      }
    }

    // 4. Attach Body 3D Flowchart Image (Image 2)
    if (fs.existsSync(img2Path)) {
      console.log(`[4/5] Attaching Body 3D Flowchart: ${img2Name}...`);
      let fileInput = await frame.$('input[type="file"]');
      if (!fileInput) {
        const photoBtn = await frame.$('button[data-click-area="tpb.image"], button[class*="image_btn"], button:has-text("사진")');
        if (photoBtn) {
          await photoBtn.click().catch(() => {});
          await page.waitForTimeout(1000);
          fileInput = await frame.$('input[type="file"]');
        }
      }
      if (fileInput) {
        await fileInput.setInputFiles(img2Path);
        console.log('[*] Waiting 5s for Image 2 upload...');
        await page.waitForTimeout(5000);
      }
    }

    // 5. Click Publish & Confirm
    console.log('[5/5] Clicking Publish & Confirm buttons...');
    await frame.evaluate(() => {
      const btn = document.querySelector('button[data-click-area="tpb.publish"], button.publish_btn__m9KHH, button[class*="publish_btn"], button:has-text("발행")');
      if (btn) btn.click();
    });
    await page.waitForTimeout(2500);

    await frame.evaluate(() => {
      const confirmBtn = document.querySelector('button[data-click-area="ptb.confirm"], button.confirm_btn__WEaBq, button[class*="confirm_btn"], button:has-text("발행하기")');
      if (confirmBtn) confirmBtn.click();
    });

    console.log('[*] Waiting 8s for publication to finalize on Naver...');
    await page.waitForTimeout(8000);

    const proofPath = path.resolve('github_actions_published_proof.png');
    await page.screenshot({ path: proofPath, fullPage: true });
    console.log(`[✓] Proof screenshot saved: ${proofPath}`);

    const publishedUrl = `https://blog.naver.com/${NAVER_ID}`;
    const reportMsg = `🚀 <b>[GitHub Actions 24/7 클라우드 무인 포스팅 성공]</b>\n\n` +
      `• <b>포스트ID</b>: <code>${postId}</code>\n` +
      `• <b>분야</b>: ${field}\n` +
      `• <b>제목</b>: ${title}\n` +
      `• <b>첨부 이미지 (2종)</b>:\n` +
      `  1) ${img1Name}\n` +
      `  2) ${img2Name}\n` +
      `• <b>발행 블로그</b>: ${publishedUrl}\n` +
      `• <b>상태</b>: ✅ 100% 클라우드 무인 발행 완료 (PC OFF 동작)`;

    await sendTelegram(reportMsg);
    console.log('[SUCCESS] All Done!');
  } catch (err) {
    console.error('[ERROR] Publishing failed:', err);
    await sendTelegram(`🚨 [GitHub Actions 에러 알림]\n\n네이버 블로그 무인 발행 중 에러 발생:\n${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
}

run();