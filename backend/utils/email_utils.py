"""
Email normalization to prevent trivial multi-account abuse via Gmail's
dot-insensitivity and +tag aliasing (e.g. a.li@gmail.com, ali+hr@gmail.com,
and ali@gmail.com all deliver to the same inbox but would otherwise be
treated as distinct accounts).

This does NOT change what gets stored as the user's display email — it's
used to compute a canonical key for duplicate-checking at signup/login.
"""

GMAIL_DOMAINS = {"gmail.com", "googlemail.com"}


def normalize_email(email: str) -> str:
    email = email.strip().lower()
    if "@" not in email:
        return email

    local, domain = email.split("@", 1)

    if domain in GMAIL_DOMAINS:
        # Gmail ignores dots in the local part entirely.
        local = local.replace(".", "")
        # Gmail ignores everything after a "+".
        local = local.split("+", 1)[0]
        domain = "gmail.com"  # googlemail.com and gmail.com are the same inbox

    return f"{local}@{domain}"