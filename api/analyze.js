export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' });
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const contentType = req.headers['content-type'] || '';
  const match = contentType.match(/boundary=([^;]+)/i);
  if (!match) return res.status(400).json({ error: 'Expected multipart image upload' });
  const boundary = Buffer.from(`--${match[1].replace(/"/g, '')}`);
  const parts = body.toString('binary').split(boundary.toString('binary'));
  const imagePart = parts.find(p => /name="image"/.test(p));
  if (!imagePart) return res.status(400).json({ error: 'Image is missing' });
  const separator = '\r\n\r\n';
  const start = imagePart.indexOf(separator);
  const raw = imagePart.slice(start + separator.length).replace(/\r\n--$/, '');
  const imageBase64 = Buffer.from(raw, 'binary').toString('base64');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: '识别这张日本商店照片中的商品。优先找半价/半額/50% OFF。只返回简短中文总结，说明识别到多少件、半价商品和推荐排序；不要编造看不清的价格或销量。' },
        { type: 'input_image', image_url: `data:image/jpeg;base64,${imageBase64}` }
      ] }]
    })
  });
  const data = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: 'Vision request failed' });
  const summary = data.output?.flatMap(x => x.content || []).find(x => x.type === 'output_text')?.text || '已完成识别';
  return res.status(200).json({ summary });
}
