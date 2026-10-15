async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  let payload;
  try { payload = JSON.parse(body.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid image payload' }); }
  if (!payload.image || !/^data:image\//.test(payload.image)) return res.status(400).json({ error: 'Image is missing' });
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: '识别这张日本商店照片中的商品。优先找半价/半額/50% OFF。只返回简短中文总结，说明识别到多少件、半价商品和推荐排序；不要编造看不清的价格或销量。' },
        { type: 'input_image', image_url: payload.image }
      ] }]
    })
  });
  const data = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Vision request failed' });
  const summary = data.output?.flatMap(x => x.content || []).find(x => x.type === 'output_text')?.text || '已完成识别';
  return res.status(200).json({ summary });
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
