import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const RELAY_KEY = process.env.RELAY_KEY || '';
const REPO_OWNER = process.env.REPO_OWNER || 'dongho-ground';
const REPO_NAME = process.env.REPO_NAME || 'posting_image';

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function authorized(req) {
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!RELAY_KEY || !supplied) return false;
  const expected = Buffer.from(RELAY_KEY);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('Request body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${path}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${GITHUB_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'naver-publishing-render-relay',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${data.message || text}`);
  return { status: response.status, data };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { ok: true, service: 'naver-publishing-relay' });
    }
    if (!authorized(req)) return json(res, 401, { ok: false, error: 'Unauthorized' });
    if (!GITHUB_TOKEN) return json(res, 503, { ok: false, error: 'GITHUB_TOKEN is not configured' });

    if (req.method === 'POST' && req.url === '/dispatch') {
      const body = await readJson(req);
      const postId = String(body.post_id || '').trim();
      if (!postId) return json(res, 400, { ok: false, error: 'post_id is required' });
      await github('/dispatches', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event_type: 'naver_post',
          client_payload: {
            post_id: postId,
            source_row: String(body.source_row || ''),
            title: String(body.title || ''),
            category: String(body.category || ''),
            approved_at: String(body.approved_at || ''),
            request_id: String(body.request_id || '')
          }
        })
      });
      return json(res, 202, { ok: true, accepted: true, post_id: postId });
    }

    if (req.method === 'GET' && req.url?.startsWith('/runs/latest')) {
      const result = await github('/actions/runs?per_page=1');
      return json(res, 200, result.data);
    }

    return json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    console.error(error.message);
    return json(res, 502, { ok: false, error: 'Upstream request failed' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Relay listening on ${PORT}`);
});
