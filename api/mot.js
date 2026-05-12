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
      return res.status(200).json({ debug: 'token_failed', status: tokenRes.status, detail: err });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return res.status(200).json({ debug: 'no_token', tokenData });
    }

    // Step 2: Call DVSA MOT History API
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

    const rawText = await motRes.text();

    if (!motRes.ok) {
      return res.status(200).json({ debug: 'mot_failed', status: motRes.status, body: rawText });
    }

    const vehicle = JSON.parse(rawText);
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
    res.status(200).json({ debug: 'exception', error: err.message });
  }
}
