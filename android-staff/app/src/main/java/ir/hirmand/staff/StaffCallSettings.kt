package ir.hirmand.staff

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

object StaffCallSettings {
    private const val PREFS = "hirmand_staff"
    private const val PREF_RECORDING_ENABLED = "call_recording_enabled"
    private const val AGREEMENT_VERSION = "1.1"

    fun isRecordingEnabled(context: Context): Boolean =
        prefs(context).getBoolean(PREF_RECORDING_ENABLED, false)

    fun setRecordingEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(PREF_RECORDING_ENABLED, enabled).apply()
    }

    fun agreementAccepted(context: Context): Boolean =
        prefs(context).getString("accepted_agreement_version", null) == AGREEMENT_VERSION

    fun hasCallLogPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CALL_LOG,
        ) == PackageManager.PERMISSION_GRANTED

    fun hasRecordingPermissions(context: Context): Boolean =
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO,
        ) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_PHONE_STATE,
            ) == PackageManager.PERMISSION_GRANTED

    fun recordingCanStart(context: Context): Boolean =
        agreementAccepted(context) && isRecordingEnabled(context) && hasRecordingPermissions(context)

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
