const SUPA_URL = 'https://hyhufujgxcvcttfxhwbd.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aHVmdWpneGN2Y3R0Znhod2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NzcwNzgsImV4cCI6MjA5NDE1MzA3OH0.ssIvQZAvwi5SLYUMmiMHUBkMvRcSLmMVMU_OylwswVA';
const TO_EMAIL = 'peter.kriszt@notonlyvans.com';

module.exports = async function handler(req, res) {
  const RESEND_KEY = process.env.RESEND_API_KEY;

  try {
    const motRes = await fetch(`${SUPA_URL}/rest/v1/mot_data?select=*`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
    });
    const motData = await motRes.json();

    const taxRes = await fetch(`${SUPA_URL}/rest/v1/tax_data?select=*`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
    });
    const taxData = await taxRes.json();

    const vehRes = await fetch(`${SUPA_URL}/rest/v1/vehicles?select=*&active=eq.true`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
    });
    const vehicles = await vehRes.json();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay(); // 0=Sun, 1=Mon, 6=Sat

    const isWeekend = (d) => d === 0 || d === 6;

    const motAlerts = { critical: [], warning: [], upcoming: [] };
    const taxAlerts = { critical: [], warning: [], upcoming: [] };

    if (!isWeekend(dow)) {
      for (const v of vehicles) {

        // --- MOT ---
        const mot = motData.find(m => m.reg === v.reg);
        if (mot && mot.expiry) {
          const expiry = new Date(mot.expiry);
          expiry.setHours(0, 0, 0, 0);
          const diff = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

          if (diff <= 14)                   motAlerts.critical.push({ ...v, expiry: mot.expiry, diff, type: 'MOT' });
          else if (dow === 1 && diff <= 30) motAlerts.warning.push({ ...v, expiry: mot.expiry, diff, type: 'MOT' });
          else if (dow === 1 && diff <= 50) motAlerts.upcoming.push({ ...v, expiry: mot.expiry, diff, type: 'MOT' });
        }

        // --- Road Tax ---
        const tax = taxData.find(t => t.reg === v.reg);
        if (tax && tax.due_date) {
          const due = new Date(tax.due_date);
          due.setHours(0, 0, 0, 0);
          const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

          if (diff <= 14)                   taxAlerts.critical.push({ ...v, expiry: tax.due_date, diff, type: 'Road Tax' });
          else if (dow === 1 && diff <= 30) taxAlerts.warning.push({ ...v, expiry: tax.due_date, diff, type: 'Road Tax' });
          else if (dow === 1 && diff <= 50) taxAlerts.upcoming.push({ ...v, expiry: tax.due_date, diff, type: 'Road Tax' });
        }
      }
    }

    const allMOT = [...motAlerts.critical, ...motAlerts.warning, ...motAlerts.upcoming];
    const allTax = [...taxAlerts.critical, ...taxAlerts.warning, ...taxAlerts.upcoming];
    const allAlerts = [...allMOT, ...allTax];

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

    const buildSection = (title, alerts) => {
      const rows = [
        ...alerts.critical.map(v => buildRow(v, '#dc2626', `⚠ ${v.diff}d — CRITICAL`)),
        ...alerts.warning.map(v => buildRow(v, '#d97706', `${v.diff}d — Warning`)),
        ...alerts.upcoming.map(v => buildRow(v, '#2563eb', `${v.diff}d — Upcoming`)),
      ].join('');

      if (!rows) return '';

      return `
        <div style="margin-bottom:4px;padding:6px 16px;background:#f5f0e8;border-radius:4px">
          <span style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8a8278">${title}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead>
            <tr style="background:#f5f0e8">
              <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a8278">Vehicle</th>
              <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a8278">Alert</th>
              <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a8278">Expiry date</th>
              <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#8a8278">Owner</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    };

    const criticalCount = motAlerts.critical.length + taxAlerts.critical.length;
    const warningCount = motAlerts.warning.length + taxAlerts.warning.length;
    const isMonday = dow === 1;

    const subject = criticalCount > 0
      ? `⚠ CRITICAL — ${criticalCount} vehicle(s) expiring within 14 days`
      : isMonday && warningCount > 0
      ? `Weekly summary — ${allAlerts.length} vehicle(s) need attention`
      : `Weekly summary — ${allAlerts.length} vehicle(s) coming up`;

    const introText = criticalCount > 0 && !isMonday
      ? 'The following vehicles are expiring within 14 days and require immediate attention.'
      : 'Weekly fleet summary. Here is everything coming up in the next 50 days.';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:680px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1e1c1b;padding:24px 32px">
      <div style="font-size:24px;font-weight:900;color:#fff;font-family:Arial Black,Arial;text-transform:uppercase">
        WORK<span style="color:#e8a020">SHIP</span>
      </div>
      <div style="font-size:11px;color:#8a8278;letter-spacing:1px;text-transform:uppercase;margin-top:4px">
        ${isMonday ? 'Weekly Summary' : 'Critical Alert'} &mdash; ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
    <div style="padding:24px 32px">
      <p style="font-size:15px;color:#1e1c1b;margin-bottom:20px">${introText}</p>
      ${buildSection('MOT', motAlerts)}
      ${buildSection('Road Tax', taxAlerts)}
    </div>
    <div style="padding:16px 32px;background:#f5f0e8;font-size:11px;color:#8a8278">
      Automated notification from Workship. <a href="https://workship-nine.vercel.app" style="color:#e8a020">Open Workship</a>
    </div>
  </div>
</body></html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Workship <workship@notonlyvans.com>', to: TO_EMAIL, subject, html })
    });

    const emailData = await emailRes.json();
    res.status(200).json({
      sent: true,
      mot_alerts: allMOT.length,
      tax_alerts: allTax.length,
      critical: criticalCount,
      warning: warningCount,
      emailId: emailData.id
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
