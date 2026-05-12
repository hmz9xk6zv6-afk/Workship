const SUPA_URL = 'https://hyhufujgxcvcttfxhwbd.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aHVmdWpneGN2Y3R0Znhod2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzcwNzgsImV4cCI6MjA5NDE1MzA3OH0.ssIvQZAvwi5SLYUMmiMHUBkMvRcSLmMVMU_OylwswVA';
const TO_EMAIL = 'peter.kriszt@locktelltd.co.uk';

module.exports = async function handler(req, res) {
  const RESEND_KEY = process.env.RESEND_API_KEY;

  try {
    const motRes = await fetch(`${SUPA_URL}/rest/v1/mot_data?select=*`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
    });
    const motData = await motRes.json();

    const vehRes = await fetch(`${SUPA_URL}/rest/v1/vehicles?select=*&active=eq.true`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
    });
    const vehicles = await vehRes.json();

    const today = new Date();
    today.setHours(0,0,0,0);

    const alerts = { critical: [], warning: [], upcoming: [] };

    for (const v of vehicles) {
      const mot = motData.find(m => m.reg === v.reg);
      if (!mot || !mot.expiry) continue;
      const expiry = new Date(mot.expiry);
      expiry.setHours(0,0,0,0);
      const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      if (diff <= 10) alerts.critical.push({ ...v, expiry: mot.expiry, diff });
      else if (diff <= 30) alerts.warning.push({ ...v, expiry: mot.expiry, diff });
      else if (diff <= 50) alerts.upcoming.push({ ...v, expiry: mot.expiry, diff });
    }

    const allAlerts = [...alerts.critical, ...alerts.warning, ...alerts.upcoming];

    if (allAlerts.length === 0) {
      return res.status(200).json({ message: 'No alerts today', checked: vehicles.length });
    }

    const buildRow = (v, color, label) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8">
          <span style="font-weight:900;font-size:16px;color:${color};font-family:Arial Black,Arial">${v.reg}</span>
          <span style="color:#8a8278;font-size:13px;margin-left:8px">${v.make} ${v.model}</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8">
          <span style="background:${color};color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">${label}</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8;color:#1e1c1b;font-weight:600">${v.expiry}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0ede8;color:#8a8278;font-size:12px">${v.owner || '—'}</td>
      </tr>`;

    const rows = [
      ...alerts.critical.map(v => buildRow(v, '#dc2626', `\u26a0 ${v.diff} DAYS — CRITICAL`)),
      ...alerts.warning.map(v => buildRow(v, '#d97706', `${v.diff} days — Warning`)),
      ...alerts.upcoming.map(v => buildRow(v, '#2563eb', `${v.diff} days — Upcoming`)),
    ].join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1e1c1b;padding:24px 32px">
      <div style="font-size:24px;font-weight:900;color:#fff;font-family:Arial Black,Arial;text-transform:uppercase">
        WORK<span style="color:#e8a020">SHIP</span>
      </div>
      <div style="font-size:11px;color:#8a8278;letter-spacing:1px;text-transform:uppercase;margin-top:4px">MOT Alert &mdash; ${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div style="padding:24px 32px">
      <p style="font-size:15px;color:#1e1c1b;margin-bottom:20px">The following vehicles have MOT expiry dates coming up. Please arrange inspections as soon as possible.</p>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f5f0e8">
            <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a8278">Vehicle</th>
            <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a8278">Alert</th>
            <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a8278">Expiry date</th>
            <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a8278">Owner</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:16px 32px;background:#f5f0e8;font-size:11px;color:#8a8278">
      Automated notification from Workship. <a href="https://workship-nine.vercel.app" style="color:#e8a020">Open Workship</a>
    </div>
  </div>
</body></html>`;

    const subject = alerts.critical.length > 0
      ? `\u26a0 CRITICAL MOT Alert — ${alerts.critical.length} vehicle(s) expiring soon`
      : alerts.warning.length > 0
      ? `MOT Warning — ${alerts.warning.length} vehicle(s) due within 30 days`
      : `MOT Reminder — ${alerts.upcoming.length} vehicle(s) due within 50 days`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Workship <onboarding@resend.dev>', to: TO_EMAIL, subject, html })
    });

    const emailData = await emailRes.json();
    res.status(200).json({ sent: true, alerts: allAlerts.length, critical: alerts.critical.length, warning: alerts.warning.length, upcoming: alerts.upcoming.length, emailId: emailData.id });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
