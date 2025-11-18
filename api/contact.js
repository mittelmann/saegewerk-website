export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message, 'g-recaptcha-response': recaptchaToken } = req.body;

  // Validierung
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
  }

  if (!recaptchaToken) {
    return res.status(400).json({ error: 'reCAPTCHA ist erforderlich' });
  }

  try {
    // reCAPTCHA verifizieren
    const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
    });

    const recaptchaData = await recaptchaResponse.json();

    if (!recaptchaData.success) {
      return res.status(400).json({ error: 'reCAPTCHA-Verifizierung fehlgeschlagen' });
    }

    // E-Mail mit Resend senden
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Kontaktformular <onboarding@resend.dev>', // Später ändern zu: 'Kontaktformular <noreply@deine-domain.de>'
        to: 'matthiasramm@gmx.de',
        reply_to: email, // Antworten gehen direkt an den Absender
        subject: `Neue Anfrage von ${name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4a5f7a; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
              .field { margin-bottom: 15px; }
              .label { font-weight: bold; color: #4a5f7a; }
              .value { margin-top: 5px; padding: 10px; background: white; border-left: 3px solid #c17940; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2 style="margin: 0;">🪵 Neue Kontaktanfrage</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Sägenhaft - Mobiles Sägewerk</p>
              </div>
              <div class="content">
                <div class="field">
                  <div class="label">👤 Name:</div>
                  <div class="value">${name}</div>
                </div>
                <div class="field">
                  <div class="label">📧 E-Mail:</div>
                  <div class="value"><a href="mailto:${email}">${email}</a></div>
                </div>
                <div class="field">
                  <div class="label">💬 Nachricht:</div>
                  <div class="value">${message.replace(/\n/g, '<br>')}</div>
                </div>
              </div>
              <div class="footer">
                <p>Diese Nachricht wurde über das Kontaktformular auf saegenhaft-mobiles-saegewerk.de gesendet.</p>
              </div>
            </div>
          </body>
          </html>
        `
      })
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Resend Error:', emailData);
      throw new Error(emailData.message || 'E-Mail konnte nicht gesendet werden');
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Nachricht erfolgreich gesendet!',
      id: emailData.id 
    });

  } catch (error) {
    console.error('Fehler beim Senden:', error);
    return res.status(500).json({ 
      error: 'Serverfehler beim Senden der Nachricht. Bitte versuchen Sie es später erneut oder kontaktieren Sie uns direkt per Telefon.' 
    });
  }
}