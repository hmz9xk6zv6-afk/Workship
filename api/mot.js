export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { reg } = req.query;
  if (!reg) { res.status(400).json({ error: 'No registration provided' }); return; }

  const clientId = process.env.DVSA_CLIENT_ID;
  const clientSecret = process.env.DVSA_CLIENT_SECRET;
  const apiKey = process.env.DVSA_API_KEY;

  try {
    // Step 1: Get OAuth token
    const tokenRes = await fetch(
      'https://login.microsoftonline.com/a455b827-244f-4c97-b5b4-ce5d13b4d00c/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://tapi.dvsa.gov.uk/.default'
        })
      }
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      res.status(500).json({ error: 'Token error', detail: err });
      return;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Step 2: Call new DVSA MOT History API
    const cleanReg = reg.toUpperCase().replace(/\s/g, '');
    const motRes = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${cleanReg}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-API-Key': apiKey,
          'Accept': 'application/json'
        }
      }
    );

    if (!motRes.ok) {
      res.status(motRes.status).json({ error: `DVSA error ${motRes.status}` });
      return;
    }

    const vehicle = await motRes.json();

    // New API returns a single vehicle object with motTests array
    // Normalise to match what our app expects
    const motTests = vehicle.motTests || [];
    const latest = motTests[0];

    const normalised = [{
      make: vehicle.make || '',
      model: vehicle.model || '',
      motTests: latest ? [{
        expiryDate: latest.expiryDate,
        testResult: latest.testResult || 'PASSED',
        odometerValue: latest.odometerValue || '?',
        odometerUnit: latest.odometerUnit || 'mi'
      }] : []
    }];

    res.status(200).json(normalised);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
