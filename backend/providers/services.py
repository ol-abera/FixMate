from notifications.models import NotificationType
from notifications.services import notify

from .models import VerificationStatus


def set_verification(profile, status, reason=""):
    """Verify/reject a provider, keep User.is_verified in sync and notify them."""
    if status not in (VerificationStatus.VERIFIED, VerificationStatus.REJECTED, VerificationStatus.PENDING):
        raise ValueError("Invalid verification status")
    profile.verification_status = status
    profile.save(update_fields=["verification_status", "updated_at"])
    user = profile.user
    user.is_verified = status == VerificationStatus.VERIFIED
    user.save(update_fields=["is_verified", "updated_at"])
    if status == VerificationStatus.VERIFIED:
        notify(user, NotificationType.PROVIDER_VERIFICATION, "Verification complete",
               "Your FixMate pro badge is now active. You now appear in the marketplace.")
    elif status == VerificationStatus.REJECTED:
        body = "We could not verify your profile. Please update your details or contact support."
        if reason:
            body = f"We could not verify your profile: {reason} Please update your details or contact support."
        notify(user, NotificationType.PROVIDER_VERIFICATION, "Verification rejected", body)
    return profile
