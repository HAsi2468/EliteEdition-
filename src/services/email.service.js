const fs = require('fs');
const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../config/logger');

const transport = nodemailer.createTransport(config.email.smtp);

if (config.env !== 'test') {
	transport
		.verify()
		.then(() => logger.info('Connected to email server'))
		.catch(() =>
			logger.warn(
				'Unable to connect to email server. Make sure you have configured the SMTP options in .env'
			)
		);
}

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @returns {Promise}
 */
const sendEmail = async (to, subject, text) => {
	const msg = { from: config.email.from, to, subject, text };
	await transport.sendMail(msg);
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendResetPasswordEmail = async (to, token) => {
	const subject = 'Reset password';
	// replace this url with the link to the reset password page of your front-end app
	const resetPasswordUrl = `http://link-to-app/reset-password?token=${token}`;
	const text = `Dear user,
    To reset your password, click on this link: ${resetPasswordUrl}
    If you did not request any password resets, then ignore this email. Your token will be expired in 24 hours.`;
	await sendEmail(to, subject, text);
};

/**
 * Send automated daily database & images backup report with attachment and cloud download links
 * @param {Object} options
 * @param {string[]|string} [options.recipients]
 * @param {string} options.fileName
 * @param {string} [options.filePath]
 * @param {string|number} [options.sizeMB]
 * @param {string} [options.publicUrl]
 * @param {string} [options.s3Uri]
 * @param {number} [options.collectionsCount]
 * @param {Object} [options.imagesBackup]
 * @returns {Promise<Object>}
 */
const sendBackupReportEmail = async ({
	recipients = ['parth6070@gmail.com', 'harshtsidapara2468@gmail.com'],
	fileName,
	filePath,
	sizeMB,
	publicUrl,
	s3Uri,
	collectionsCount,
	imagesBackup,
}) => {
	const toList = Array.isArray(recipients) ? recipients.join(', ') : recipients;
	const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

	const subject = `🛡️ [Elite Edition ERP] Automated Midnight Disaster Recovery Backup (DB & Images) — ${dateStr} IST`;

	const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px 28px; text-align: left;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">Elite Edition ERP Production</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #e0e7ff; opacity: 0.95;">Automated Daily Midnight Backup: Full Database + All Media &amp; Images</p>
      </div>

      <div style="padding: 28px;">
        <div style="background: #1e293b; border-left: 4px solid #10b981; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <div style="font-size: 15px; font-weight: 600; color: #34d399;">✅ Full System Backup Generated &amp; Synced Successfully</div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">Triggered at <strong>12:00 AM Midnight (IST)</strong> on Production Cluster (${dateStr})</div>
        </div>

        <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #93c5fd;">
          1. 🗄️ MongoDB Database Archive
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; background: #1e293b; border-radius: 8px; overflow: hidden;">
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 10px 14px; color: #94a3b8;">Database Archive:</td>
            <td style="padding: 10px 14px; font-family: monospace; font-weight: 600; color: #f1f5f9; text-align: right;">${fileName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 10px 14px; color: #94a3b8;">Archive Size:</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #38bdf8; text-align: right;">${sizeMB ? `${sizeMB} MB` : 'Compressed'}</td>
          </tr>
          ${collectionsCount ? `
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 10px 14px; color: #94a3b8;">Collections Included:</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #f1f5f9; text-align: right;">${collectionsCount} Collections (Full DB)</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 10px 14px; color: #94a3b8;">Storage Vaults:</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #a78bfa; text-align: right;">Local NVMe + AWS S3 Mumbai + Cloudflare R2</td>
          </tr>
        </table>

        ${imagesBackup ? `
        <h3 style="margin: 20px 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #fdba74;">
          2. 🖼️ All Media &amp; Uploaded Images Archive
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; background: #1e293b; border-radius: 8px; overflow: hidden;">
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 10px 14px; color: #94a3b8;">Images Archive:</td>
            <td style="padding: 10px 14px; font-family: monospace; font-weight: 600; color: #f1f5f9; text-align: right;">${imagesBackup.fileName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 10px 14px; color: #94a3b8;">Archive Size:</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #fb923c; text-align: right;">${imagesBackup.sizeMB ? `${imagesBackup.sizeMB} MB` : 'Compressed'}</td>
          </tr>
          ${imagesBackup.imagesCount ? `
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 10px 14px; color: #94a3b8;">Image Files Count:</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #f1f5f9; text-align: right;">${imagesBackup.imagesCount} Files</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 10px 14px; color: #94a3b8;">Storage Vaults:</td>
            <td style="padding: 10px 14px; font-weight: 600; color: #a78bfa; text-align: right;">Local NVMe + AWS S3 + Cloudflare R2</td>
          </tr>
        </table>
        ` : ''}

        ${filePath ? `
        <div style="background: #1e293b; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #cbd5e1;">
          📎 <strong>Attachment:</strong> The complete compressed database archive (<code>${fileName}</code>) is attached directly to this email.
        </div>` : ''}

        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
          ${publicUrl ? `
          <a href="${publicUrl}" style="background: #ea580c; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 13px; padding: 10px 16px; border-radius: 6px; display: inline-block;">
            ⚡ Direct DB Download (Cloudflare R2)
          </a>` : ''}
          ${imagesBackup && imagesBackup.publicUrl ? `
          <a href="${imagesBackup.publicUrl}" style="background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 13px; padding: 10px 16px; border-radius: 6px; display: inline-block;">
            🖼️ Download All Images Archive
          </a>` : ''}
        </div>

        <div style="background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-top: 24px;">
          <div style="font-weight: 700; color: #38bdf8; font-size: 13px; margin-bottom: 6px;">⚡ Instant 1-Click Disaster Recovery Playbook</div>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">If any disaster happens, restore your entire database and all images in under 2 minutes:</p>
          <pre style="background: #0f172a; padding: 10px; border-radius: 6px; font-size: 12px; color: #a7f3d0; margin: 0; overflow-x: auto;">node src/scripts/restore_all_data.js</pre>
        </div>

        <div style="border-top: 1px solid #334155; padding-top: 18px; margin-top: 24px; font-size: 12px; color: #64748b; line-height: 1.5;">
          This automated system security notification is delivered daily at 12:00 AM midnight IST to designated system administrators (<a href="mailto:parth6070@gmail.com" style="color: #818cf8;">parth6070@gmail.com</a>, <a href="mailto:harshtsidapara2468@gmail.com" style="color: #818cf8;">harshtsidapara2468@gmail.com</a>).
        </div>
      </div>
    </div>
  `;

	const text = `Elite Edition ERP Automated Midnight Disaster Recovery Backup
Date: ${dateStr} IST
Database Archive: ${fileName} (${sizeMB || 'Compressed'} MB)
${imagesBackup ? `Images Archive: ${imagesBackup.fileName} (${imagesBackup.sizeMB || 'Compressed'} MB, ${imagesBackup.imagesCount || ''} files)` : ''}
Destinations: Local NVMe + AWS S3 Mumbai + Cloudflare R2
1-Click Restore: node src/scripts/restore_all_data.js
`;

	const attachments = [];
	if (filePath && fs.existsSync(filePath)) {
		try {
			const stat = fs.statSync(filePath);
			if (stat.size <= 24 * 1024 * 1024) {
				attachments.push({
					filename: fileName,
					path: filePath,
					contentType: 'application/gzip',
				});
			} else {
				logger.info(`[Backup Email] File size ${(stat.size / 1024 / 1024).toFixed(2)} MB exceeds 24MB attachment threshold; sending cloud links only.`);
			}
		} catch (statErr) {
			logger.warn(`[Backup Email] Could not inspect file for attachment: ${statErr.message}`);
		}
	}

	// Also attach images archive if small enough (e.g. <= 20MB)
	if (imagesBackup && imagesBackup.filePath && fs.existsSync(imagesBackup.filePath)) {
		try {
			const imgStat = fs.statSync(imagesBackup.filePath);
			if (imgStat.size <= 18 * 1024 * 1024) {
				attachments.push({
					filename: imagesBackup.fileName,
					path: imagesBackup.filePath,
					contentType: 'application/gzip',
				});
			}
		} catch (e) {}
	}

	const recipientList = Array.isArray(recipients)
		? recipients
		: String(toList).split(',').map((s) => s.trim()).filter(Boolean);

	const deliveryResults = [];
	for (const targetTo of recipientList) {
		const msg = {
			from: config.email.from || 'Elite Edition ERP <pc.elitedigital@gmail.com>',
			to: targetTo,
			subject,
			text,
			html,
			attachments,
		};

		try {
			const info = await transport.sendMail(msg);
			logger.info(`[Backup Email] Backup report successfully emailed to ${targetTo} (Message ID: ${info.messageId})`);
			deliveryResults.push({ recipient: targetTo, success: true, messageId: info.messageId });
		} catch (mailErr) {
			logger.warn(`[Backup Email] Delivery notice for ${targetTo}: ${mailErr.message}`);
			deliveryResults.push({ recipient: targetTo, success: false, error: mailErr.message });
		}
	}

	const anySuccess = deliveryResults.some((r) => r.success);
	return {
		success: anySuccess,
		recipients: recipientList.join(', '),
		deliveries: deliveryResults,
	};
};

module.exports = {
	transport,
	sendEmail,
	sendResetPasswordEmail,
	sendBackupReportEmail,
};

