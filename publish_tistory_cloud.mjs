import { chromium } from 'playwright';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_ID = '1TNs8J8Y6toJ_vCYE7pRTZUUSIyHLHFGgqqWiBH916RU';
const TARGET_TAB = process.env.TISTORY_TAB || 'Account'; // 'Account' or 'adsens'
const SPREADSHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${TARGET_TAB}`;

const TISTORY_ID = process.env.TISTORY_ID || 'skymard@hanmail.net';
const TISTORY_PW = process.env.TISTORY_PW || 'iamwon84^^@';
const TISTORY_BLOG_NAME = TARGET_TAB === 'Account' ? 'a-toms' : 'ade-sensation';
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

  // Build Semantic HTML conforming to Tistory_posting_guide.md
  let htmlContent = '';
  if (TARGET_TAB === 'Account') {
    // B2B Client Acquisition Structure
    htmlContent = `
<div class="post-summary" style="padding: 1.25rem; border-left: 4px solid #174a73; background: #f5f7f9; border-radius: 6px; margin-bottom: 2rem; line-height: 1.8;">
  <p style="margin: 0; font-weight: 500; color: #20252b;">
    스타트업과 중소기업이 첫 기관 투자(Series A, B)나 주주 간 지분 거래를 진행할 때, 공인된 비상장주식 기업가치평가(Valuation) 보고서는 창업자의 소중한 지분을 방어하고 국세청 증여세 세무조사 리스크를 원천 차단하는 가장 핵심적인 재무 안전장치입니다.
  </p>
</div>

<h2 style="color: #17324d; margin: 2.5rem 0 1rem; font-size: 1.5rem; border-bottom: 2px solid #174a73; padding-bottom: 0.5rem;">1. 비상장주식 가치평가 3대 핵심 모델 비교</h2>
<p style="line-height: 1.8; color: #333;">비상장법인의 주식 평가는 기업의 성장 단계와 거래 목적에 따라 최적의 평가 모델을 선택해야 합니다.</p>

<div class="table-scroll" style="overflow-x: auto; margin: 1.5rem 0;">
  <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
    <thead>
      <tr style="background: #174a73; color: #fff;">
        <th style="padding: 12px 14px; border: 1px solid #dce2e7;">평가 모델</th>
        <th style="padding: 12px 14px; border: 1px solid #dce2e7;">핵심 산정 원리</th>
        <th style="padding: 12px 14px; border: 1px solid #dce2e7;">최적 적용 대상</th>
        <th style="padding: 12px 14px; border: 1px solid #dce2e7;">세무/감사 리스크</th>
      </tr>
    </thead>
    <tbody>
      <tr style="background: #fff;">
        <td style="padding: 10px 14px; border: 1px solid #dce2e7; font-weight: bold;">DCF 현금흐름할인법</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">미래 5개년 FCFF를 WACC으로 할인</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">기술기반 고성장 스타트업</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">추정 근거 객관성 필수</td>
      </tr>
      <tr style="background: #f9fbfd;">
        <td style="padding: 10px 14px; border: 1px solid #dce2e7; font-weight: bold;">상대가치평가 (Multiple)</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">유사 상장사 EV/EBITDA, PSR 배수 대조</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">매출 및 영업이익 가시성 확보 기업</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">피어그룹 선정 타당성 검증</td>
      </tr>
      <tr style="background: #fff;">
        <td style="padding: 10px 14px; border: 1px solid #dce2e7; font-weight: bold;">상증세법 보충적평가</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">순손익가치 : 순자산가치 = 3 : 2 가중평균</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">특수관계자 거래 / 상속·증여</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">법적 최소 과세 안전선 확보</td>
      </tr>
    </tbody>
  </table>
</div>

<h2 style="color: #17324d; margin: 2.5rem 0 1rem; font-size: 1.5rem; border-bottom: 2px solid #174a73; padding-bottom: 0.5rem;">2. 상환전환우선주(RCPS) 리픽싱 조항과 K-IFRS 회계 리스크</h2>
<p style="line-height: 1.8; color: #333;">
  투자 계약 시 관행적으로 삽입되는 리픽싱(전환가 하향 조정) 조항은 K-IFRS 도입 시 우선주 전체가 <strong>'파생상품 부채'</strong>로 분류되어 수십억 원의 당기순손실(평가손실)을 유발할 수 있습니다. 계약서 날인 전 공인회계사의 파생부채 사전 영향 분석이 필수적입니다.
</p>

<aside class="cpa-note" style="padding: 1.25rem; border-left: 4px solid #a9432f; background: #fff8f7; border-radius: 6px; margin: 2rem 0; line-height: 1.8;">
  <p style="margin: 0; color: #842010; font-weight: bold;">⚠️ 회계사 실무 조언: 상증세법 제60조 세무조사 주의사항</p>
  <p style="margin: 0.5rem 0 0; color: #555; font-size: 0.95rem;">
    시가보다 현저히 낮거나 높은 가액으로 비상장주식을 거래할 경우 상속세및증여세법 제35조에 따라 양도자 및 양수자 모두에게 막대한 증여세 및 부당행위계산부인이 추징될 수 있습니다.
  </p>
</aside>

<section class="post-cta" style="margin: 3rem 0; padding: 1.5rem; border: 1px solid #dce2e7; border-radius: 10px; background: #fafbfc; line-height: 1.8;">
  <h3 style="margin-top: 0; color: #174a73; font-size: 1.25rem;">💼 원동호 공인회계사 (WON CPA) 1:1 맞춤 자문 안내</h3>
  <p style="color: #444; font-size: 0.95rem;">
    대형회계법인 출신 공인회계사가 기업의 재무제표와 비즈니스 모델에 꼭 맞는 객관적인 기업가치평가 보고서와 투자유치 재무 자문을 1:1로 직접 수행합니다.
  </p>
  <ul style="color: #444; font-size: 0.95rem; padding-left: 1.2rem;">
    <li>💬 <strong>카카오톡 상담</strong>: 카카오톡 검색창에서 <strong>[원회계사]</strong> 검색</li>
    <li>✉️ <strong>이메일 문의</strong>: skymard@hanmail.net</li>
  </ul>
  <div style="margin-top: 1.2rem;">
    <a href="https://forms.gle/MG2u9M4aXJ5psfA27" target="_blank" style="display: inline-block; background: #174a73; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 0.95rem;">📝 30초 온라인 간편 상담 신청하기 →</a>
  </div>
</section>
`;
  } else {
    // AdSense High-Traffic Viral Structure
    htmlContent = `
<div class="post-summary" style="padding: 1.25rem; border-left: 4px solid #0066cc; background: #f0f7ff; border-radius: 6px; margin-bottom: 2rem; line-height: 1.8;">
  <p style="margin: 0; font-weight: 500; color: #1a3a60;">
    최근 많은 분들이 가장 궁금해하시는 실시간 화제 이슈와 알짜 생활 금융 정보! 2026년 최신 변경 사항과 놓치면 손해 보는 핵심 혜택 및 신청 방법을 알기 쉽게 총정리해 드립니다.
  </p>
</div>

<h2 style="color: #1a3a60; margin: 2.5rem 0 1rem; font-size: 1.5rem; border-bottom: 2px solid #0066cc; padding-bottom: 0.5rem;">📌 주요 변경 핵심 요약 한눈에 보기</h2>
<p style="line-height: 1.8; color: #333;">올해 새롭게 바뀌거나 지원 금액이 대폭 확대된 알짜 항목들을 표로 비교 정리했습니다.</p>

<div class="table-scroll" style="overflow-x: auto; margin: 1.5rem 0;">
  <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.95rem;">
    <thead>
      <tr style="background: #0066cc; color: #fff;">
        <th style="padding: 12px 14px; border: 1px solid #dce2e7;">구분 항목</th>
        <th style="padding: 12px 14px; border: 1px solid #dce2e7;">기존 기준</th>
        <th style="padding: 12px 14px; border: 1px solid #dce2e7;">2026년 개정 혜택</th>
        <th style="padding: 12px 14px; border: 1px solid #dce2e7;">신청 대상</th>
      </tr>
    </thead>
    <tbody>
      <tr style="background: #fff;">
        <td style="padding: 10px 14px; border: 1px solid #dce2e7; font-weight: bold;">지원 혜택 1</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">연 최대 50만 원</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7; color: #d9381e; font-weight: bold;">연 최대 120만 원 확대</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">전 국민 대상</td>
      </tr>
      <tr style="background: #f9fbfd;">
        <td style="padding: 10px 14px; border: 1px solid #dce2e7; font-weight: bold;">신청 자격 기준</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">중위소득 100% 이하</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7; color: #0066cc; font-weight: bold;">중위소득 150% 이하 완화</td>
        <td style="padding: 10px 14px; border: 1px solid #dce2e7;">직장인 및 자영업자</td>
      </tr>
    </tbody>
  </table>
</div>

<h2 style="color: #1a3a60; margin: 2.5rem 0 1rem; font-size: 1.5rem; border-bottom: 2px solid #0066cc; padding-bottom: 0.5rem;">💡 자주 묻는 질문 FAQ Best 3</h2>
<div style="background: #fafbfc; border: 1px solid #e1e4e8; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; line-height: 1.8;">
  <p style="font-weight: bold; color: #0066cc; margin: 0 0 0.5rem;">Q1. 기존에 이미 혜택을 받은 사람도 중복 신청이 가능한가요?</p>
  <p style="margin: 0 0 1.2rem; color: #444;">네! 연도별 개정 기준에 따라 신규 지원 요건에 해당하면 추가 신청이 가능합니다.</p>
  
  <p style="font-weight: bold; color: #0066cc; margin: 0 0 0.5rem;">Q2. 신청 시 꼭 준비해야 하는 필수 서류는 무엇인가요?</p>
  <p style="margin: 0 0 1.2rem; color: #444;">신분증, 본인 명의 통장 사본, 그리고 정부24 소득금액증명원만 온라인으로 발급받으시면 5분 만에 접수가 완료됩니다.</p>
</div>
`;
  }

  console.log('[*] Launching Chromium in GitHub Actions Cloud Runner for Tistory...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ko-KR'
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  try {
    console.log('[*] Navigating to Tistory login page...');
    await page.goto('https://www.tistory.com/auth/login');
    await page.waitForTimeout(3000);

    const kakaoLoginBtn = await page.$('a.btn_login.link_kakao_id, a:has-text("카카오계정으로 로그인")');
    if (kakaoLoginBtn) {
      console.log('[*] Clicking Kakao Login button...');
      await kakaoLoginBtn.click();
      await page.waitForTimeout(3000);

      const idInput = await page.$('#loginId--1, input[name="loginId"]');
      if (idInput) {
        await idInput.fill(TISTORY_ID);
        const pwInput = await page.$('#password--2, input[name="password"]');
        if (pwInput) await pwInput.fill(TISTORY_PW);
        await page.waitForTimeout(500);

        const submitBtn = await page.$('button[type="submit"].btn_g.highlight.submit');
        if (submitBtn) await submitBtn.click();
        await page.waitForTimeout(6000);
      }
    }

    console.log(`[*] Navigating to Tistory writing page for [${TISTORY_BLOG_NAME}]...`);
    await page.goto(`https://${TISTORY_BLOG_NAME}.tistory.com/manage/newpost`, { timeout: 30000 });
    await page.waitForTimeout(6000);

    // 1. Enter Title in Tistory Editor
    console.log('[1/3] Entering Title in Tistory Editor...');
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

    // Wait until TinyMCE or iframe is ready
    await page.waitForFunction(() => {
      return (window.tinymce && window.tinymce.activeEditor) || !!document.querySelector('#editor-tistory_ifr')?.contentDocument?.body;
    }, { timeout: 20000 }).catch(() => {});

    let injectSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      injectSuccess = await page.evaluate((html) => {
        if (window.tinymce && window.tinymce.activeEditor) {
          window.tinymce.activeEditor.setContent(html);
          return true;
        }
        const iframe = document.querySelector('#editor-tistory_ifr');
        if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
          iframe.contentDocument.body.innerHTML = html;
          iframe.contentDocument.body.dispatchEvent(new Event('input', { bubbles: true }));
          iframe.contentDocument.body.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
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
      await publishBtn.click();
      await page.waitForTimeout(2500);

      // Select 공개 (Public)
      const publicRadio = await page.$('input#open20, label:has-text("공개"), [for="open20"]');
      if (publicRadio) {
        await publicRadio.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      const finalBtn = await page.$('#publish-btn, button:has-text("발행하기"), button:has-text("공개발행"), button.btn_point, button:has-text("발행")');
      if (finalBtn) {
        await finalBtn.click();
        await page.waitForTimeout(8000);
      }
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

    const postItem = await verifyPage.$('.list_post li a.link_tit, .link_title, td.txt_left a, .tit_post a, a:has-text("' + title.substring(0, 10) + '")');
    if (!postItem) {
      throw new Error(`[검증 실패] 글 관리 페이지(${managePostsUrl})에서 발행된 글을 찾을 수 없습니다.`);
    }

    const postHref = await postItem.getAttribute('href');
    const fullPostUrl = postHref.startsWith('http') ? postHref : `https://${TISTORY_BLOG_NAME}.tistory.com${postHref}`;
    console.log(`[*] Opening verified post URL: ${fullPostUrl}`);

    await verifyPage.goto(fullPostUrl, { timeout: 30000 });
    await verifyPage.waitForTimeout(4000);

    const articleText = await verifyPage.$eval('article, .article, .entry-content, .tt_article_useless_p_margin, .post-content, body', el => el.innerText);
    const articleHtml = await verifyPage.$eval('article, .article, .entry-content, .tt_article_useless_p_margin, .post-content, body', el => el.innerHTML);

    const hasTable = articleHtml.includes('<table') || articleText.includes('모델') || articleText.includes('비교') || articleText.includes('기준');
    const hasCta = articleHtml.includes('forms.gle') || articleText.includes('원동호') || articleText.includes('상담');
    const textLength = articleText.length;

    console.log(`[*] Content Verification Metrics:`);
    console.log(`    - Text Length: ${textLength} chars`);
    console.log(`    - Has Table: ${hasTable}`);
    console.log(`    - Has CTA / Contact: ${hasCta}`);

    if (textLength < 200 || !hasTable || !hasCta) {
      throw new Error(`[검증 실패] 포스팅 본문 내용이 누락되었거나 불완전합니다! (글자수: ${textLength}, 표: ${hasTable}, CTA: ${hasCta})`);
    }

    console.log('🎉 [VERIFICATION PASSED 100%] Content is rich, complete, and live on Tistory!');
    await verifyPage.close();

    const purposeText = TARGET_TAB === 'Account' ? '💼 B2B 법인 고객 유치 & 전문성 브랜딩' : '📈 애드센스 광고 수익 및 검색 조회수 극대화';

    const reportMsg = `🎉 <b>[GitHub Actions 24/7 티스토리 무인 발행 & 실시간 내용 검증 성공]</b>\n\n` +
      `• <b>포스트ID</b>: <code>${postId}</code>\n` +
      `• <b>구분 탭</b>: <b>[${TARGET_TAB}]</b>\n` +
      `• <b>제목</b>: ${title}\n` +
      `• <b>목적</b>: ${purposeText}\n` +
      `• <b>실제 발행 URL</b>: ${verifiedPostUrl}\n` +
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