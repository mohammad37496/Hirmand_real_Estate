package ir.hirmand.staff

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

class StaffCallStateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
        if (!StaffCallSettings.agreementAccepted(context)) return

        val prefs = context.getSharedPreferences("hirmand_staff", Context.MODE_PRIVATE)
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return

        when (state) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                prefs.edit()
                    .putString("last_call_direction_hint", "incoming")
                    .putString(
                        "last_call_incoming_number",
                        intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER).orEmpty()
                    )
                    .apply()
            }

            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                if (!StaffCallSettings.recordingCanStart(context)) return

                val direction = if (
                    prefs.getString("last_call_direction_hint", "") == "incoming"
                ) "incoming" else "outgoing"

                val serviceIntent = Intent(context, StaffCallRecordingService::class.java)
                    .setAction(StaffCallRecordingService.ACTION_START)
                    .putExtra(StaffCallRecordingService.EXTRA_DIRECTION, direction)
                    .putExtra(
                        StaffCallRecordingService.EXTRA_NUMBER,
                        prefs.getString("last_call_incoming_number", "").orEmpty()
                    )

                runCatching {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        ContextCompat.startForegroundService(context, serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }
                }
                prefs.edit()
                    .remove("last_call_direction_hint")
                    .remove("last_call_incoming_number")
                    .apply()
            }

            TelephonyManager.EXTRA_STATE_IDLE -> {
                if (
                    ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.READ_CALL_LOG
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    StaffCallSync.enqueue(context)
                }
            }
        }
    }
}
