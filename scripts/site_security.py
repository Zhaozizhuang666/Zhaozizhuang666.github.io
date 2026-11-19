"""Shared browser security policy for the static website."""

import re


CONTENT_SECURITY_POLICY = (
    "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; "
    "script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; "
    "connect-src 'self'; frame-src 'self'; upgrade-insecure-requests"
)


def secure_html(content: str, *, vla_config: bool = False) -> str:
    if vla_config:
        pattern = re.compile(r"<script>\s*window\.VLA_CONFIG=(\{.*?\});\s*</script>", re.S)
        content, count = pattern.subn(r'<script type="application/json" id="vla-config">\1</script>', content)
        if count == 0 and content.count('id="vla-config"') != 1:
            raise ValueError("Expected one static VLA configuration block")
        if count > 1 or content.count('id="vla-config"') != 1:
            raise ValueError("Repeated VLA configuration block")

    policy = re.search(r'<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"', content, re.I)
    if policy:
        if policy.group(1) != CONTENT_SECURITY_POLICY:
            raise ValueError("Unexpected content security policy")
    else:
        charset = re.compile(r'(<meta\s+charset=["\'][^"\']+["\']\s*/?>)', re.I)
        content, count = charset.subn(
            r'\1\n  <meta http-equiv="Content-Security-Policy" content="' + CONTENT_SECURITY_POLICY + '">',
            content, count=1,
        )
        if count != 1:
            raise ValueError("Missing document charset")

    referrer = re.search(r'<meta\s+name="referrer"\s+content="([^"]*)"', content, re.I)
    if referrer:
        if referrer.group(1) != "strict-origin-when-cross-origin":
            raise ValueError("Unexpected referrer policy")
    else:
        content, count = re.subn(
            r'(<meta\s+http-equiv="Content-Security-Policy"[^>]*>)',
            r'\1\n  <meta name="referrer" content="strict-origin-when-cross-origin">',
            content, count=1,
        )
        if count != 1:
            raise ValueError("Missing content security policy")
    return content
