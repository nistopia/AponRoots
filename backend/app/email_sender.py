"""Send transactional emails over SMTP.

If SMTP env vars aren't configured, emails are logged to stdout instead.
This means dev and bare-metal deploys still work — admins can grab reset
links from the logs.

Required env vars for live email:
  SMTP_HOST      e.g. smtp.gmail.com
  SMTP_PORT      587 (STARTTLS) or 465 (SSL)
  SMTP_USER      sender account
  SMTP_PASSWORD  app password / SMTP credential
  EMAIL_FROM     "From:" header (defaults to SMTP_USER)
"""

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER"))


def send_email(to: str, subject: str, body: str) -> None:
    """Send a plain-text email. Logs and returns silently if SMTP isn't set up."""
    sender = os.environ.get("EMAIL_FROM") or os.environ.get("SMTP_USER", "")
    if not _smtp_configured():
        logger.warning(
            "[email-stub] SMTP not configured; would send to %s\nSubject: %s\n%s",
            to, subject, body,
        )
        return

    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "587"))
    user = os.environ["SMTP_USER"]
    password = os.environ.get("SMTP_PASSWORD", "")

    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    context = ssl.create_default_context()
    try:
        if port == 465:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=30) as smtp:
                smtp.login(user, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as smtp:
                smtp.starttls(context=context)
                smtp.login(user, password)
                smtp.send_message(msg)
        logger.info("Sent email to %s (subject: %s)", to, subject)
    except Exception:
        # Don't let email failures break the request flow — log and swallow.
        # The reset link is also visible in logs for the admin to forward.
        logger.exception("Failed to send email to %s", to)
