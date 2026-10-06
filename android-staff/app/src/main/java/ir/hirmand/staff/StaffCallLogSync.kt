package ir.hirmand.staff

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object StaffCallLogSync {
    fun sync(context: Context): Boolean {
        if (!StaffCallSettings.agreementAccepted(context) || !StaffCallSettings.hasCallLogPermission(context)) {
            return true
        }

        val rows = queryRecentCalls(context)
        if (rows.length() == 0) return true

        val token = StaffTelemetryStore.token(context)
        val deviceId = context
            .getSharedPreferences("hirmand_staff", Context.MODE_PRIVATE)
            .getString("device_id", "")
            .orEmpty()
        if (token.isBlank() || deviceId.isBlank()) return false

        val connection = (URL(BuildConfig.STAFF_CALLS_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8_000
            readTimeout = 20_000
            doOutput = true
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Authorization", "Bearer " + token)
            setRequestProperty("X-Hirmand-Device-Id", deviceId)
        }

        return try {
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use { writer ->
                writer.write(JSONObject().put("calls", rows).toString())
            }
            connection.responseCode in 200..299
        } catch (_: Exception) {
            false
        } finally {
            connection.disconnect()
        }
    }

    fun latestCall(context: Context): JSONObject? {
        if (ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_CALL_LOG,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return null
        }

        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
        )

        return runCatching {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                CallLog.Calls.DATE + " DESC",
            )?.use { cursor ->
                if (!cursor.moveToFirst()) return@use null
                JSONObject()
                    .put("sourceId", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls._ID)))
                    .put("number", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)))
                    .put("contactName", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)))
                    .put("type", cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)))
                    .put("dateMs", cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)))
                    .put("durationSeconds", cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)))
            }
        }.getOrNull()
    }

    private fun queryRecentCalls(context: Context): JSONArray {
        if (ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_CALL_LOG,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return JSONArray()
        }

        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
        )

        return runCatching {
            val result = JSONArray()
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                CallLog.Calls.DATE + " DESC",
            )?.use { cursor ->
                var count = 0
                while (cursor.moveToNext() && count < 500) {
                    result.put(
                        JSONObject()
                            .put("sourceId", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls._ID)))
                            .put("number", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)))
                            .put("contactName", cursor.getString(cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)))
                            .put("type", cursor.getInt(cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)))
                            .put("dateMs", cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)))
                            .put("durationSeconds", cursor.getLong(cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)))
                    )
                    count++
                }
            }
            result
        }.getOrDefault(JSONArray())
    }
}
