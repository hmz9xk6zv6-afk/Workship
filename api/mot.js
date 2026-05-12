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
      res.status(500).json({ error: 'Token error: ' + err });
      return;
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Step 2: Call DVSA MOT History API
    const motRes = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg.toUpperCase().replace(/\s/g, '')}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Api-Key': apiKey,
          'Accept': 'application/json'
        }
      }
    );

    if (!motRes.ok) {
      // Fallback to beta API
      const betaRes = await fetch(
        `https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${reg.toUpperCase().replace(/\s/g, '')}`,
        {
          headers: {
            'Accept': 'application/json+v6',
            'x-api-key': apiKey
          }
        }
      );
      if (!betaRes.ok) {
        res.status(motRes.status).json({ error: `DVSA error ${motRes.status}` });
        return;
      }
      const betaData = await betaRes.json();
      res.status(200).json(betaData);
      return;
    }

    const motData = await motRes.json();

    // Normalise new API format
    const tests = [];
    if (motData.motTestExpiryDate) {
      tests.push({
        expiryDate: motData.motTestExpiryDate,
        testResult: 'PASSED',
        odometerValue: motData.odometerReadings?.[0]?.value || '?',
        odometerUnit: motData.odometerReadings?.[0]?.unit || ''
      });
    }

    const normalised = [{
      make: motData.make || '',
      model: motData.model || '',
      motTests: tests
    }];

    res.status(200).json(normalised);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
