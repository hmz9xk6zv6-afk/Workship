export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { reg, debug } = req.query;
  if (!reg) { res.status(400).json({ error: 'No registration provided' }); return; }

  const clientId = process.env.DVSA_CLIENT_ID;
  const clientSecret = process.env.DVSA_CLIENT_SECRET;
  const apiKey = process.env.DVSA_API_KEY;

  try {
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
      return res.status(500).json({ error: 'Token error', detail: err });
    }

    const { access_token } = await tokenRes.json();
    const cleanReg = reg.toUpperCase().replace(/\s/g, '');

    const motRes = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${cleanReg}`,
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'X-API-Key': apiKey,
          'Accept': 'application/json'
        }
      }
    );

    if (!motRes.ok) {
      return res.status(motRes.status).json({ error: `DVSA error ${motRes.status}` });
    }

    const vehicle = await motRes.json();

    // If debug mode, return full raw response
    if (debug) {
      return res.status(200).json({ raw: vehicle });
    }

    const motTests = vehicle.motTests || [];
    const latest = motTests[0];

    // For new vehicles with no MOT yet, use firstUsedDate + 3 years
    let expiryDate = latest?.expiryDate || null;
    let isDue = false;

    if (!expiryDate && vehicle.firstUsedDate) {
      const firstUsed = new Date(vehicle.firstUsedDate);
      firstUsed.setFullYear(firstUsed.getFullYear() + 3);
      expiryDate = firstUsed.toISOString().split('T')[0];
      isDue = true;
    }

    const normalised = [{
      make: vehicle.make || '',
      model: vehicle.model || '',
      firstUsedDate: vehicle.firstUsedDate || null,
      isDue,
      motTests: expiryDate ? [{
        expiryDate,
        testResult: isDue ? 'DUE' : (latest?.testResult || 'PASSED'),
        odometerValue: latest?.odometerValue || '?',
        odometerUnit: latest?.odometerUnit || 'mi'
      }] : []
    }];

    res.status(200).json(normalised);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
