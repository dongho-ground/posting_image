import { chromium } from 'playwright';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_CSV_URL = process.env.SPREADSHEET_CSV_URL || 'https://docs.google.com/spreadsheets/d/1FdAi652-z0_EZMXOrN0tNZWAcpdpN4CdVIxvWdSG8SQ/export?format=csv&gid=0';
const NAVER_ID = process.env.NAVER_ID || '';
const NAVER_PW = process.env.NAVER_PW || '';
const NAVER_COOKIES_JSON = process.env.NAVER_COOKIES || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TARGET_POST_ID = process.env.TARGET_POST_ID?.trim() || '';
const RESULT_PATH = path.resolve('publish_result.json');

function parseNaverCookies(raw) {
  // GitHub Secrets can accidentally contain line breaks or tabs inserted while
  // copying a cookie value. Cookie JSON never needs control characters, so
  // remove them before parsing instead of silently continuing unauthenticated.
  const normalized = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  const cookies = JSON.parse(normalized);
  if (!Array.isArray(cookies) || cookies.length === 0) {
    throw new Error('NAVER_COOKIES must be a non-empty JSON array');
  }
  return cookies;
}

function writeResult(result) {
  fs.writeFileSync(RESULT_PATH, JSON.stringify({
    ...result,
    generated_at: new Date().toISOString()
  }, null, 2));
}

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

async function recoverNaverLogin(page) {
  if (!/nid\.naver\.com\/nidlogin\.login/i.test(page.url())) return false;
  if (!NAVER_ID || !NAVER_PW) {
    throw new Error('Naver cookies were rejected and NAVER_ID/NAVER_PW fallback credentials are missing');
  }

  console.log('[AUTH] Session cookies were rejected. Attempting credential fallback login...');
  const idInput = page.locator('#id, input[name="id"]').first();
  const pwInput = page.locator('#pw, input[name="pw"]').first();
  if (await idInput.count() === 0 || await pwInput.count() === 0) {
    throw new Error(`Naver login form was not found (${page.url()})`);
  }

  await idInput.fill(NAVER_ID);
  await pwInput.fill(NAVER_PW);
  const loginButton = page.locator(
    '[id="log.login"], button.btn_login, button[type="submit"], input[type="submit"], button:has-text("로그인")'
  ).first();
  if (await loginButton.count() === 0) throw new Error('Naver login submit button was not found');
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    loginButton.click()
  ]);
  await page.waitForTimeout(5000);

  if (/nid\.naver\.com/i.test(page.url())) {
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const challenge = /보안|인증|captcha|자동입력|새로운 환경|2단계/i.test(bodyText);
    throw new Error(challenge
      ? `Naver security challenge blocked cloud login (${page.url()})`
      : `Naver credential fallback login failed (${page.url()})`);
  }

  console.log('[AUTH] Credential fallback login succeeded. Returning to SmartEditor...');
  await page.goto(`https://blog.naver.com/${NAVER_ID}?Redirect=Write`, { timeout: 30000 });
  await page.waitForTimeout(6000);
  return true;
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

  const isPublishable = (r) =>
    r[7]?.trim() === 'Approved' &&
    Boolean(r[41]?.trim()) &&
    !r[42]?.trim() &&
    !r[8]?.trim();

  let targetRow = TARGET_POST_ID
    ? rows.slice(1).find((r) => r[0]?.trim() === TARGET_POST_ID && isPublishable(r))
    : rows.slice(1).find((r) => r[6]?.trim() === today && isPublishable(r));

  if (!targetRow && !TARGET_POST_ID) {
    targetRow = rows.slice(1).find(isPublishable);
  }

  if (!targetRow) {
    const reason = TARGET_POST_ID
      ? `Requested post ${TARGET_POST_ID} is missing or not publishable`
      : 'No Approved post satisfies approval/review/URL gates';
    writeResult({ success: false, published: false, reason, target_post_id: TARGET_POST_ID });
    throw new Error(reason);
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
      const cookies = parseNaverCookies(NAVER_COOKIES_JSON);
      await context.addCookies(cookies);
      console.log(`[*] Injected ${cookies.length} Naver session cookies!`);
    } catch (e) {
      await browser.close();
      throw new Error(`Failed to parse NAVER_COOKIES: ${e.message}`);
    }
  }

  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    console.log(`[*] Navigating to SmartEditor ONE for ${NAVER_ID}...`);
    await page.goto(`https://blog.naver.com/${NAVER_ID}?Redirect=Write`, { timeout: 30000 });
    await page.waitForTimeout(6000);
    await recoverNaverLogin(page);

    let frame = page;
    const mainFrameEl = await page.$('#mainFrame');
    if (mainFrameEl) {
      frame = await mainFrameEl.contentFrame();
    }

    const editorUrl = frame?.url?.() || page.url();
    const editorTitle = await page.title().catch(() => '');
    console.log(`[*] Browser URL: ${page.url()}`);
    console.log(`[*] Editor frame URL: ${editorUrl}`);
    console.log(`[*] Page title: ${editorTitle}`);

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
    const titleArea = await frame.$('.se-documentTitle, .se-section-documentTitle');
    if (!titleArea) {
      await page.screenshot({ path: path.resolve('github_actions_published_proof.png'), fullPage: true });
      const authBlocked = /nid\.naver\.com|nidlogin|login/i.test(`${page.url()} ${editorUrl}`);
      throw new Error(authBlocked
        ? `Naver session cookies were rejected; login page reached (${editorUrl})`
        : `SmartEditor title field was not found (${editorUrl})`);
    }
    await titleArea.click();
    await page.keyboard.type(title, { delay: 10 });
    await page.waitForTimeout(500);

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
    if (await bodyP.count() === 0) throw new Error('SmartEditor body field was not found');
    await bodyP.click({ force: true });

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
    const publishButton = frame.locator('button[data-click-area="tpb.publish"], button[class*="publish_btn"]').first();
    if (await publishButton.count() === 0) throw new Error('Publish button was not found');
    await publishButton.click();
    await page.waitForTimeout(2500);

    const confirmButton = frame.locator('button[data-click-area="ptb.confirm"], button[class*="confirm_btn"]').first();
    if (await confirmButton.count() === 0) throw new Error('Publish confirmation button was not found');
    await confirmButton.click();

    console.log('[*] Waiting 8s for publication to finalize on Naver...');
    await page.waitForTimeout(8000);

    const proofPath = path.resolve('github_actions_published_proof.png');
    await page.screenshot({ path: proofPath, fullPage: true });
    console.log(`[✓] Proof screenshot saved: ${proofPath}`);

    const verifyPage = await context.newPage();
    await verifyPage.goto(`https://blog.naver.com/${NAVER_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await verifyPage.waitForTimeout(4000);
    const verifyFrame = (await verifyPage.$('#mainFrame'))
      ? await (await verifyPage.$('#mainFrame')).contentFrame()
      : verifyPage;
    const exactTitle = verifyFrame.getByText(title, { exact: true }).first();
    if (await exactTitle.count() === 0) {
      throw new Error(`Published post verification failed: exact title not found (${title})`);
    }
    const titleLink = exactTitle.locator('xpath=ancestor-or-self::a[1]');
    const href = await titleLink.getAttribute('href');
    if (!href) throw new Error('Published post verification failed: post URL not found');
    const publishedUrl = new URL(href, `https://blog.naver.com/${NAVER_ID}`).toString();
    writeResult({ success: true, published: true, post_id: postId, title, published_url: publishedUrl });
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
    writeResult({ success: false, published: false, post_id: postId, title, reason: err.message });
    await sendTelegram(`🚨 [GitHub Actions 에러 알림]\n\n네이버 블로그 무인 발행 중 에러 발생:\n${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
}

run();
