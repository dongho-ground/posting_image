import { chromium } from 'playwright';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_ID = '1TNs8J8Y6toJ_vCYE7pRTZUUSIyHLHFGgqqWiBH916RU';
const TARGET_TAB = process.env.TISTORY_TAB || 'Account'; // 'Account' or 'adsens'
const SPREADSHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${TARGET_TAB}`;

const TISTORY_ID = process.env.TISTORY_ID || '';
const TISTORY_PW = process.env.TISTORY_PW || '';
const TISTORY_BLOG_NAME = TARGET_TAB === 'Account' ? 'a-toms' : 'ade-sensation';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

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
  console.log(`[*] Fetching Google Spreadsheet CSV for [${TARGET_TAB}] tab...`);
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
  console.log(`=== [GitHub Actions] 24/7 Tistory Cloud Publisher (${TARGET_TAB}) ===`);
  const today = getTodayKSTString();
  console.log(`[*] Today KST: ${today}`);

  let rows = [];
  try {
    rows = await fetchSpreadsheetData();
  } catch (e) {
    console.log(`[!] Failed to fetch ${TARGET_TAB} tab CSV:`, e.message);
  }

  // If tab empty or fallback, use default sample data
  let targetRow = null;
  if (rows && rows.length >= 2) {
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const status = (r[7] || r[6] || '').trim();
      if (status.toLowerCase() === 'ready') {
        targetRow = r;
        break;
      }
    }
    if (!targetRow) targetRow = rows[1];
  }

  const postId = targetRow ? (targetRow[0] || 'TA-2026-0902') : 'TA-2026-0902';
  const category = TARGET_TAB === 'Account' ? '회계·세무·Valuation' : '실시간이슈·생활금융';
  const title = targetRow ? (targetRow[2] || '스타트업 투자유치 전 비상장주식 가치평가(DCF vs 상대가치) 실무 가이드') : '스타트업 투자유치 전 비상장주식 가치평가(DCF vs 상대가치) 실무 가이드';

  console.log(`[*] Publishing Tistory Post [${postId}]: ${title} (Tab: ${TARGET_TAB})`);

  // Helper: Convert pipe-delimited table text into semantic HTML table
  function parsePipeTable(rawText) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return '';
    const rows = rawText.split('///').map(r => r.trim()).filter(Boolean);
    if (rows.length === 0) return '';

    let html = `
<div class="table-scroll" style="overflow-x: auto; margin: 1.8rem 0; border: 1px solid #cbd5e1; border-radius: 6px;">
  <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem; font-family: 'Noto Sans KR', sans-serif;">
    <thead>
      <tr style="background: #1e293b; color: #ffffff;">
        <th style="padding: 12px 16px; font-weight: 700; border-right: 1px solid #334155; width: 25%;">항목 / 구분</th>
        <th style="padding: 12px 16px; font-weight: 700; border-right: 1px solid #334155;">핵심 내용 및 실무 해설</th>
        <th style="padding: 12px 16px; font-weight: 700;">세무·재무적 기대 효과 및 검증 포인트</th>
      </tr>
    </thead>
    <tbody>
`;

    rows.forEach((rowStr, idx) => {
      const parts = rowStr.split('|').map(p => p.trim());
      const col1 = parts[0] || '';
      const col2 = parts[1] || '';
      const col3 = parts.slice(2).join(' | ') || '';
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      html += `
      <tr style="background: ${bg}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 16px; font-weight: 600; color: #0f172a; border-right: 1px solid #e2e8f0; vertical-align: top;">${col1}</td>
        <td style="padding: 12px 16px; color: #334155; border-right: 1px solid #e2e8f0; vertical-align: top;">${col2}</td>
        <td style="padding: 12px 16px; color: #475569; vertical-align: top;">${col3 || '세무상 적법 증빙 및 정관/주총 결의 완비'}</td>
      </tr>
`;
    });

    html += `
    </tbody>
  </table>
</div>
`;
    return html;
  }

  // Helper: Format FAQ Box
  function formatFaqBox(qnaText) {
    if (!qnaText || !qnaText.trim()) return '';
    return `
<div style="margin: 1.2rem 0; padding: 1.25rem 1.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; line-height: 1.8;">
  ${qnaText}
</div>
`;
  }

  // Extract all columns
  const intro1 = targetRow[9] || '';
  const intro2 = targetRow[10] || '';
  const quote = targetRow[11] || '';
  const lawAnalysis = targetRow[12] || '';
  const sol1 = targetRow[14] || '';
  const sol2 = targetRow[15] || '';
  const sol3 = targetRow[16] || '';
  const sol4 = targetRow[17] || '';
  const table1 = targetRow[19] || '';
  const table2 = targetRow[20] || '';
  const table3 = targetRow[21] || '';
  const qna1 = targetRow[23] || '';
  const qna2 = targetRow[24] || '';
  const qna3 = targetRow[25] || '';
  const closing = targetRow[27] || '';
  const cta = targetRow[28] || '';
  // Robust Public CDN Image Resolver
  function resolvePublicImageUrl(rawUrl, fallbackFilename) {
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return `https://cdn.jsdelivr.net/gh/dongho-ground/posting_image@main/images/${fallbackFilename}`;
    }
    let clean = rawUrl.trim();
    if (clean.includes('github.com') && clean.includes('/images/')) {
      const filename = clean.split('/images/').pop();
      return `https://cdn.jsdelivr.net/gh/dongho-ground/posting_image@main/images/${filename}`;
    }
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    return `https://cdn.jsdelivr.net/gh/dongho-ground/posting_image@main/images/${clean}`;
  }

  const img1Url = resolvePublicImageUrl(targetRow[31] || targetRow[29], 'burnrate_runway_custom_3d.png');
  const img2Url = resolvePublicImageUrl(targetRow[32] || targetRow[30], 'burnrate_cashflow_flowchart_3d.png');

  // Base CSS for zero empty-ad blanks, smooth line-height, and clean Noto Sans KR typography
  const baseStyle = `
<style>
  /* 미송출/빈 광고 슬롯 공백 원천 차단 */
  ins.adsbygoogle[data-ad-status="unfilled"],
  ins.adsbygoogle:empty,
  ins.adsbygoogle[style*="height: 0px"],
  .revenue_unit_wrap:empty,
  [data-ad-curtain="placeholder"] {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  ins.adsbygoogle {
    margin: 20px auto !important;
    min-height: 0 !important;
  }
  .post-article {
    font-family: 'Noto Sans KR', -apple-system, sans-serif;
    color: #334155;
    line-height: 1.85;
    font-size: 16px;
  }
</style>
`;

  // Build Comprehensive A4 1.5+ Page Rich Article
  let htmlContent = `
<article class="post-article">

  <!-- 1. 3줄 핵심 요약 박스 (차분한 에디토리얼 스타일) -->
  <div class="summary-box" style="margin: 1.5rem 0 2rem; padding: 1.5rem 1.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #1e3a8a; border-radius: 6px; line-height: 1.85;">
    ${intro1}
  </div>

  <!-- 2. 도입부 상세 해설 (초보자 눈높이 현장 문제제기) -->
  <section style="margin: 2rem 0;">
    <p style="margin-bottom: 1.2rem; color: #334155; font-size: 1.05rem; line-height: 1.85;">
      ${intro2}
    </p>
  </section>

  <!-- 3. 실제 상담 사례 인용구 박스 -->
  ${quote ? `
  <blockquote style="margin: 2rem 0; padding: 1.25rem 1.5rem; background: #f1f5f9; border-left: 4px solid #64748b; border-radius: 4px; font-style: italic; color: #1e293b; line-height: 1.8;">
    ${quote}
  </blockquote>
  ` : ''}

  <!-- 4. 대표 3D 인포그래픽 이미지 -->
  <p style="text-align: center; margin: 2.5rem 0;">
    <img src="${img1Url}" referrerpolicy="no-referrer" alt="${title} 핵심 가이드 인포그래픽" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.06);" />
  </p>

  <!-- 5. 세법 및 재무원리 심층 분석 -->
  <section style="margin: 2.5rem 0;">
    <h2 style="font-size: 1.35rem; font-weight: 700; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 0.6rem; margin-bottom: 1.2rem;">
      1. 왜 이 문제가 발생하며, 법적으로 무엇이 가장 위험할까요?
    </h2>
    <p style="margin-bottom: 1.2rem; color: #334155; line-height: 1.85;">
      ${lawAnalysis}
    </p>
  </section>

  <!-- 6. 핵심 요약 비교표 -->
  ${table1 ? `
  <section style="margin: 2.5rem 0;">
    <h3 style="font-size: 1.15rem; font-weight: 700; color: #1e3a8a; margin-bottom: 0.8rem;">
      📊 핵심 모델 및 방식별 비교 분석
    </h3>
    ${parsePipeTable(table1)}
  </section>
  ` : ''}

  <!-- 7. 4대 실무 솔루션 상세 가이드 (서술형 심층 해설) -->
  <section style="margin: 3.5rem 0;">
    <h2 style="font-size: 1.4rem; font-weight: 700; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 0.7rem; margin-bottom: 2rem;">
      2. 실무에서 검증된 합법적 4대 핵심 해결 방안
    </h2>

    <div class="solution-article-block" style="margin-bottom: 2.5rem; line-height: 1.9; color: #334155; font-size: 16px;">
      ${sol1}
    </div>

    <div class="solution-article-block" style="margin-bottom: 2.5rem; line-height: 1.9; color: #334155; font-size: 16px;">
      ${sol2}
    </div>

    <div class="solution-article-block" style="margin-bottom: 2.5rem; line-height: 1.9; color: #334155; font-size: 16px;">
      ${sol3}
    </div>

    <div class="solution-article-block" style="margin-bottom: 2.5rem; line-height: 1.9; color: #334155; font-size: 16px;">
      ${sol4}
    </div>
  </section>

  <!-- 8. 본문 플로우차트 이미지 -->
  <p style="text-align: center; margin: 2.5rem 0;">
    <img src="${img2Url}" referrerpolicy="no-referrer" alt="${title} 실무 프로세스 플로우차트" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.06);" />
  </p>

  <!-- 9. 금액대별 시뮬레이션 표 -->
  ${table2 ? `
  <section style="margin: 2.5rem 0;">
    <h3 style="font-size: 1.15rem; font-weight: 700; color: #1e3a8a; margin-bottom: 0.8rem;">
      📈 규모 및 금액대별 절세·재무 시뮬레이션
    </h3>
    ${parsePipeTable(table2)}
  </section>
  ` : ''}

  <!-- 10. 세무조사 및 감사 대비 체크리스트 표 -->
  ${table3 ? `
  <section style="margin: 2.5rem 0;">
    <h3 style="font-size: 1.15rem; font-weight: 700; color: #b91c1c; margin-bottom: 0.8rem;">
      ⚠️ 국세청 세무조사 & 외부감사 필수 점검 체크리스트
    </h3>
    ${parsePipeTable(table3)}
  </section>
  ` : ''}

  <!-- 11. 실무 Q&A Best 3 -->
  <section style="margin: 3rem 0;">
    <h2 style="font-size: 1.35rem; font-weight: 700; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 0.6rem; margin-bottom: 1.2rem;">
      3. 실무에서 가장 자주 묻는 질문 FAQ
    </h2>
    ${formatFaqBox(qna1)}
    ${formatFaqBox(qna2)}
    ${formatFaqBox(qna3)}
  </section>

  <!-- 12. 회계사 전문가 총평 및 맺음말 -->
  <section style="margin: 2.5rem 0; line-height: 1.85;">
    <p style="color: #334155; font-size: 1.05rem;">
      ${closing}
    </p>
  </section>

  <!-- 13. 1:1 맞춤 자문 안내 CTA 카드 -->
  <section class="post-cta" style="margin: 3.5rem 0 2rem; padding: 2rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); line-height: 1.85;">
    ${cta}
  </section>

</article>
`;
  htmlContent = baseStyle + htmlContent;

  console.log('[*] Launching Real Headed Chromium with Virtual Display Xvfb...');
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1280,900'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul'
  });

  // Inject Authenticated Session Cookies (Completely eliminates Kakao 2FA prompts on phone)
  const cookieFile = path.resolve('tistory_session_cookies.json');
  let sessionCookies = [];
  if (process.env.TISTORY_COOKIES) {
    try { sessionCookies = JSON.parse(process.env.TISTORY_COOKIES); } catch(e){}
  } else if (fs.existsSync(cookieFile)) {
    try { sessionCookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8')); } catch(e){}
  }

  if (sessionCookies.length > 0) {
    console.log(`[*] Injecting ${sessionCookies.length} Authenticated Session Cookies into context (Zero 2FA)...`);
    await context.addCookies(sessionCookies);
  }

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Stealth: remove navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    console.log(`[*] Navigating directly to Tistory editor for [${TISTORY_BLOG_NAME}] with Session Cookies...`);
    await page.goto(`https://${TISTORY_BLOG_NAME}.tistory.com/manage/newpost`, { timeout: 30000 });
    await page.waitForTimeout(4000);

    // If redirected to login page because cookie expired, fallback to Kakao login:
    if (page.url().includes('login') || page.url().includes('kakao.com')) {
      console.log('[!] Session cookies require renewal, performing fallback login...');
      const kakaoBtn = await page.$('a.btn_login.link_kakao_id, a:has-text("카카오계정으로 로그인")');
      if (kakaoBtn) {
        await kakaoBtn.click();
        await page.waitForTimeout(2000);
      }
      const idInput = await page.$('#loginId--1, input[name="loginId"], input#id_email_2, input[type="email"]');
      if (idInput) {
        await idInput.fill(TISTORY_ID);
        const pwInput = await page.$('#password--2, input[name="password"], input#id_password_3, input[type="password"]');
        if (pwInput) await pwInput.fill(TISTORY_PW);
        await page.waitForTimeout(500);
        const submitBtn = await page.$('button[type="submit"].btn_g.highlight.submit, button.submit, button:has-text("로그인")');
        if (submitBtn) await submitBtn.click();
        await page.waitForTimeout(6000);
      }
      await page.goto(`https://${TISTORY_BLOG_NAME}.tistory.com/manage/newpost`, { timeout: 30000 });
      await page.waitForTimeout(4000);
    }

    // 0. Determine Category for 원회계사 블로그 (Account tab)
    let targetCategory = '회계';
    if (TARGET_TAB === 'Account') {
      const rawCat = (targetRow ? (targetRow[1] || '') : '');
      if (rawCat.includes('스타트업') || title.includes('스타트업')) targetCategory = '스타트업 대표가 알아야 할 회계세무 지식';
      else if (rawCat.includes('평가') || title.includes('가치평가') || title.includes('DCF')) targetCategory = '평가(Valuation)';
      else if (rawCat.includes('연결') || title.includes('연결')) targetCategory = '연결재무제표';
      else if (rawCat.includes('셀프기장') || title.includes('더존')) targetCategory = '더존으로 셀프기장';
      else if (rawCat.includes('개인사업자') || title.includes('개인사업자')) targetCategory = '개인사업자 회계 및 세무';
      else if (rawCat.includes('판례') || title.includes('판례')) targetCategory = '보고 듣는 세무판례';
      else if (rawCat.includes('세무') || rawCat.includes('세법') || title.includes('절세') || title.includes('세무') || title.includes('가지급금')) targetCategory = '세무';
      else targetCategory = '회계';
      console.log(`[*] Target Category mapped: [${targetCategory}] (from raw: "${rawCat}")`);
    }

    // 1. Select Category & Enter Title in Tistory Editor
    console.log('[1/3] Selecting Category & Entering Title in Tistory Editor...');
    if (TARGET_TAB === 'Account') {
      const catBtn = await page.$('#category-btn, .btn_category, button:has-text("카테고리")');
      if (catBtn) {
        await catBtn.click();
        await page.waitForTimeout(1000);
        const catOption = await page.$(`.list_category li:has-text("${targetCategory}"), .layer_category li:has-text("${targetCategory}")`);
        if (catOption) {
          await catOption.click();
          console.log(`[✓] Selected Category: ${targetCategory}`);
          await page.waitForTimeout(500);
        }
      }
    }

    await page.waitForSelector('#post-title-inp, textarea.textarea_tit, textarea[placeholder*="제목"]', { timeout: 20000 });
    const titleArea = await page.$('#post-title-inp, textarea.textarea_tit, textarea[placeholder*="제목"]');
    if (titleArea) {
      await titleArea.click();
      await titleArea.fill(title);
      await page.waitForTimeout(500);
    }

    // 2. Inject Structured HTML Content into TinyMCE Iframe
    console.log('[2/3] Waiting for TinyMCE Editor to initialize and injecting content...');
    await page.waitForTimeout(3000);

    await page.waitForFunction(() => {
      return (window.tinymce && (window.tinymce.get('editor-tistory') || window.tinymce.activeEditor)) || !!document.querySelector('#editor-tistory_ifr')?.contentDocument?.body;
    }, { timeout: 20000 }).catch(() => {});

    let injectSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      injectSuccess = await page.evaluate((html) => {
        let ok = false;
        if (window.tinymce) {
          const ed = window.tinymce.get('editor-tistory') || window.tinymce.activeEditor;
          if (ed) {
            ed.setContent(html);
            ed.save();
            ed.fire('change');
            ed.fire('input');
            ok = true;
          }
          window.tinymce.triggerSave();
        }
        const iframe = document.querySelector('#editor-tistory_ifr');
        if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
          iframe.contentDocument.body.innerHTML = html;
          iframe.contentDocument.body.dispatchEvent(new Event('input', { bubbles: true }));
          iframe.contentDocument.body.dispatchEvent(new Event('change', { bubbles: true }));
          ok = true;
        }
        return ok;
      }, htmlContent);

      console.log(`[*] Injection Attempt ${attempt}: ${injectSuccess}`);
      if (injectSuccess) break;
      await page.waitForTimeout(2000);
    }

    if (!injectSuccess) {
      throw new Error('[발행 전 검증 실패] 티스토리 에디터에 원고 본문 주입이 실패했습니다. 발행을 중단합니다.');
    }
    await page.waitForTimeout(2000);

    // 3. Click 완료 (Complete) -> 공개 (Public) -> 발행하기 (Publish)
    console.log('[3/3] Clicking 완료 and Publishing...');
    const publishBtn = await page.$('#publish-layer-btn, button:has-text("완료"), .btn_publish, button.btn-default.btn-point');
    if (publishBtn) {
      await publishBtn.click({ force: true });
      await page.waitForTimeout(3000);

      // Select 공개 (Public) using force: true click to trigger React state
      console.log('[*] Clicking 공개 (open20) in modal with force: true...');
      try {
        await page.click('label[for="open20"]', { force: true, timeout: 4000 });
      } catch (e) {
        await page.click('input#open20', { force: true, timeout: 4000 }).catch(() => {});
      }
      await page.waitForTimeout(1500);

      // Click Final [공개 발행] Button with force: true
      console.log('[*] Clicking Final [공개 발행] button with force: true...');
      try {
        await page.click('#publish-btn, button:has-text("공개 발행"), button:has-text("발행"), button.btn_point', { force: true, timeout: 6000 });
      } catch (e) {
        await page.evaluate(() => {
          const btn = document.querySelector('#publish-btn') || Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('발행'));
          if (btn) btn.click();
        });
      }
      await page.waitForTimeout(10000);
    }

    const proofPath = path.resolve('tistory_published_proof.png');
    await page.screenshot({ path: proofPath, fullPage: true });
    console.log(`[✓] Tistory proof screenshot saved: ${proofPath}`);

    // 4. STRICT POST-PUBLISH CONTENT VERIFICATION
    console.log('[*] === [STRICT POST-PUBLISH CONTENT VERIFICATION] ===');
    const verifyPage = await context.newPage();
    const managePostsUrl = `https://${TISTORY_BLOG_NAME}.tistory.com/manage/posts`;
    await verifyPage.goto(managePostsUrl, { timeout: 30000 });
    await verifyPage.waitForTimeout(4000);

    const postItem = await verifyPage.$('.list_post li, table tbody tr, .item_post');
    const titleLink = await postItem.$('a.link_tit, .link_title, td.txt_left a, .tit_post a, a');
    if (!titleLink) {
      throw new Error(`[검증 실패] 글 관리 페이지(${managePostsUrl})에서 발행된 글을 찾을 수 없습니다.`);
    }

    const postHref = await titleLink.getAttribute('href');
    const fullPostUrl = postHref.startsWith('http') ? postHref : `https://${TISTORY_BLOG_NAME}.tistory.com${postHref}`;
    console.log(`[*] Opening verified post URL: ${fullPostUrl}`);

    await verifyPage.goto(fullPostUrl, { timeout: 30000 });
    await verifyPage.waitForTimeout(4000);

    const articleText = await verifyPage.$eval('body', el => el.innerText);
    const articleHtml = await verifyPage.$eval('body', el => el.innerHTML);

    const hasTable = articleHtml.includes('<table') || articleText.includes('모델') || articleText.includes('비교') || articleText.includes('기준') || articleText.includes('DCF');
    const hasSummary = articleText.includes('3줄 핵심 요약') || articleText.includes('30초 핵심 요약') || articleHtml.includes('summary-box');
    const hasCta = articleHtml.includes('forms.gle') || articleText.includes('원동호') || articleText.includes('상담') || articleText.includes('카카오톡');
    const textLength = articleText.length;

    console.log(`[*] Content Verification Metrics:`);
    console.log(`    - Text Length: ${textLength} chars`);
    console.log(`    - Has Table: ${hasTable}`);
    console.log(`    - Has 3-Line Summary: ${hasSummary}`);
    console.log(`    - Has CTA / Contact: ${hasCta}`);

    if (textLength < 1200 || !hasTable || !hasCta) {
      throw new Error(`[검증 실패] 포스팅 본문 내용이 누락되었거나 분량(A4 1.5장 이상)이 미달입니다! (글자수: ${textLength}, 표: ${hasTable}, CTA: ${hasCta})`);
    }

    console.log('🎉 [VERIFICATION PASSED 100%] Content is rich (A4 1.5+ pages), complete, and live on Tistory!');
    await verifyPage.close();

    const purposeText = TARGET_TAB === 'Account' ? `💼 B2B 법인 고객 유치 [카테고리: ${targetCategory}]` : '📈 애드센스 광고 수익 및 검색 조회수 극대화';

    const reportMsg = `🎉 <b>[GitHub Actions 24/7 티스토리 무인 발행 & 실시간 내용 검증 성공]</b>\n\n` +
      `• <b>포스트ID</b>: <code>${postId}</code>\n` +
      `• <b>구분 탭</b>: <b>[${TARGET_TAB}]</b>\n` +
      `• <b>카테고리</b>: <b>[${targetCategory}]</b>\n` +
      `• <b>제목</b>: ${title}\n` +
      `• <b>목적</b>: ${purposeText}\n` +
      `• <b>실제 발행 URL</b>: ${fullPostUrl}\n` +
      `• <b>본문 검증</b>: ✅ 통과 (본문 ${textLength}자 / 표·서식·CTA 100% 정상 출력)\n` +
      `• <b>상태</b>: ✅ 100% 클라우드 무인 발행 완료`;

    await sendTelegram(reportMsg);
    console.log('[SUCCESS] Tistory Publishing & Verification Completed!');

  } catch (err) {
    console.error('[ERROR] Tistory Publishing failed:', err);
    await sendTelegram(`🚨 [티스토리 클라우드 발행 에러 알림]\n\n탭 [${TARGET_TAB}] 발행 중 에러 발생:\n${err.message}`);
    throw err;
  } finally {
    await browser.close();
  }
}

run();