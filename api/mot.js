export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { reg } = req.query;
  if (!reg) { res.status(400).json({ error: 'No registration provided' }); return; }

  try {
    const response = await fetch(
      `https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${reg.toUpperCase().replace(/\s/g,'')}`,
      {
        headers: {
          'Accept': 'application/json+v6',
          'x-api-key': 'RuyVVTyKgo4pTfVYGms0u3wnubM4D2aH1LVbGnYK'
        }
      }
    );
    if (!response.ok) {
      res.status(response.status).json({ error: `DVSA error ${response.status}` });
      return;
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
