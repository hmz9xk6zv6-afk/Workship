module.exports = async function handler(req, res) {
  const reg = (req.query.reg || '').toUpperCase().replace(/\s/g, '');
  if (!reg) return res.status(400).json({ error: 'Missing reg' });

  const API_KEY = process.env.DVLA_VES_API_KEY;

  try {
    const response = await fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ registrationNumber: reg })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
