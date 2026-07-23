UNLIMITED_ACCESS_EMAILS = {
    "tashiftoor12345@gmail.com",
}
 
 
def has_unlimited_access(email: str) -> bool:
    return bool(email) and email.strip().lower() in UNLIMITED_ACCESS_EMAILS