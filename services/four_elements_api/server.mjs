import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { pathToFileURL } from 'node:url';
import { buildAiEvidence, validateGeneratedAiReport as validateAiReport, aiReportVersion } from '../../src/lib/four-elements-ai.ts';
import { SYSTEM_PROMPT } from './prompt.mjs';
import * as sevenTraits from '../../src/lib/seven-traits-ai.ts';
import { SYSTEM_PROMPT as SEVEN_TRAITS_PROMPT } from './seven-traits-prompt.mjs';

const questionnaires = {
  'four-elements': { buildAiEvidence, validateAiReport, aiReportVersion, prompt: SYSTEM_PROMPT, maxTokens: 9000, maxLength: 40000 },
  'seven-traits': { ...sevenTraits, prompt: SEVEN_TRAITS_PROMPT, maxTokens: 14000, maxLength: 60000 },
};

export function createReportServer({ env = process.env, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const origins = new Set((env.FOUR_ELEMENTS_ORIGINS || 'http://localhost:4322,http://127.0.0.1:4322,http://localhost:4321,http://127.0.0.1:4321').split(',').map(s => s.trim()));
  const model = env.DEEPSEEK_MODEL || 'deepseek-flash';
  const limit = (name, fallback) => Math.max(1, Math.min(10000, Number(env[name]) || fallback));
  const ipLimit = limit('FOUR_ELEMENTS_HOURLY_LIMIT', 5), dailyLimit = limit('FOUR_ELEMENTS_DAILY_LIMIT', 100);
  const usage = new Map(), pending = new Map();
  let day = '', dayCount = 0, active = 0;
  const reply = (res, status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(payload));
  };
  return createServer(async (req, res) => {
    const path = req.url?.split('?')[0];
    const match = /^\/api\/v1\/(four-elements|seven-traits)\/(health|report)$/.exec(path || '');
    if (!match) return reply(res, 404, { error: '接口不存在。' });
    const questionnaire = questionnaires[match[1]];
    if (req.method === 'GET' && match[2] === 'health') return reply(res, 200, { configured: Boolean(env.DEEPSEEK_API_KEY), model, version: questionnaire.aiReportVersion });
    if (match[2] !== 'report') return reply(res, 404, { error: '接口不存在。' });
    if (req.method !== 'POST') return reply(res, 405, { error: '请使用 POST 请求。' });
    if (!origins.has(req.headers.origin)) return reply(res, 403, { error: '请求来源不受支持。' });
    if (!req.headers['content-type']?.startsWith('application/json')) return reply(res, 415, { error: '请求格式不正确。' });
    if (!env.DEEPSEEK_API_KEY) return reply(res, 503, { error: 'AI 解读服务尚未配置。本次作答已保留，请稍后重试。' });
    let payload;
    try {
      if (Number(req.headers['content-length']) > 4096) return reply(res, 413, { error: '请求内容过大。' });
      const body = await new Promise((resolve, reject) => {
        const chunks = []; let length = 0, failed = false;
        req.on('data', chunk => { length += chunk.length; if (length > 4096) { if (!failed) reject(new Error('large')); failed = true; chunks.length = 0; } else if (!failed) chunks.push(chunk); });
        req.on('end', () => { if (!failed) resolve(Buffer.concat(chunks).toString('utf8')); });
        req.on('error', reject);
      });
      payload = JSON.parse(body);
      if (!payload || payload.consent !== true || !Array.isArray(payload.answers) || Object.keys(payload).some(key => !['answers', 'consent'].includes(key))) throw new Error('input');
      questionnaire.buildAiEvidence(payload.answers);
    } catch (error) { return reply(res, error.message === 'large' ? 413 : 400, { error: '请完成全部题目并确认发送作答后重试。' }); }
    const tick = now(), stamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(tick));
    if (stamp !== day) { day = stamp; dayCount = 0; }
    let ip = req.socket.remoteAddress || 'local';
    if (env.FOUR_ELEMENTS_TRUST_PROXY === 'true' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) && isIP(req.headers['x-real-ip'] || '')) ip = req.headers['x-real-ip'];
    for (const [key, value] of usage) if (value.reset <= tick) usage.delete(key);
    const hash = createHash('sha256').update(match[1] + ':' + JSON.stringify(payload.answers)).digest('hex');
    // Coalesced requests also count toward admission limits.
    const bucket = usage.get(ip) || { count: 0, reset: tick + 3600000 };
    if (bucket.count >= ipLimit || usage.size >= 10000 && !usage.has(ip)) return reply(res, 429, { error: '本小时请求较多，请稍后再试。' });
    bucket.count++; usage.set(ip, bucket);
    if (pending.has(hash)) { try { return reply(res, 200, await pending.get(hash)); } catch { return reply(res, 502, { error: 'AI 解读暂未生成成功，请稍后重试。' }); } }
    if (active >= 2 || dayCount >= dailyLimit) return reply(res, 429, { error: 'AI 服务繁忙或已达到今日额度，请稍后再试。' });
    active++; dayCount++;
    const upstreamStarted = Date.now();
    let upstreamStage = 'request';
    const job = (async () => {
      const response = await fetchImpl('https://api.deepseek.com/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(90000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model, stream: false, thinking: { type: 'disabled' }, temperature: .7, max_tokens: questionnaire.maxTokens,
          response_format: { type: 'json_object' }, messages: [{ role: 'system', content: questionnaire.prompt }, { role: 'user', content: JSON.stringify(questionnaire.buildAiEvidence(payload.answers)) }] }),
      });
      if (!response.ok) throw Object.assign(new Error('provider'), { providerStatus: response.status });
      upstreamStage = 'response-body';
      const content = await response.json();
      if (content.choices?.[0]?.finish_reason !== 'stop') throw Object.assign(new Error('incomplete'), { finishReason: content.choices?.[0]?.finish_reason });
      const text = content.choices[0].message?.content;
      if (typeof text !== 'string' || text.length > questionnaire.maxLength) throw new Error('content');
      upstreamStage = 'report-validation';
      return { report: questionnaire.validateAiReport(JSON.parse(text), payload.answers), model, generatedAt: new Date(now()).toISOString() };
    })();
    pending.set(hash, job);
    try {
      const value = await job;
      reply(res, 200, value);
    } catch (error) {
      // Only structural diagnostics: never log answers, generated prose, keys or upstream bodies.
      console.warn(JSON.stringify({ event: 'report_failed', questionnaire: match[1], code: error.cause?.code || error.name,
        stage: ['provider', 'incomplete', 'content'].includes(error.message) ? error.message : upstreamStage,
        elapsedMs: Date.now() - upstreamStarted,
        providerStatus: error.providerStatus, finishReason: error.finishReason,
        field: error.cause?.field, reason: error.cause?.reason, length: error.cause?.length, min: error.cause?.min, max: error.cause?.max }));
      reply(res, 502, { error: error.name === 'TimeoutError' ? '生成用时较长，请稍后重试。本次作答已保留。'
        : ['UND_ERR_SOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(error.cause?.code) ? '与 AI 服务的连接中断，请检查网络后重试。本次作答已保留。'
        : error.cause?.code === 'invalid-report' ? '解读内容未完整生成，请重试。本次作答已保留。'
        : 'AI 解读暂未生成成功，请稍后重试。本次作答已保留。' });
    }
    finally { active--; pending.delete(hash); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createReportServer();
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(Number(process.env.FOUR_ELEMENTS_PORT) || 8101, '127.0.0.1', () => console.log('Four elements API listening on 127.0.0.1:8101'));
}
