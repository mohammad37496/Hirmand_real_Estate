package ir.hirmand.staff

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import org.json.JSONArray

private const val PREFS = "hirmand_staff"
private const val PREF_PENDING_RECORDINGS = "staff_call_recordings_queue"

object StaffCallRecordingStore {
    @Synchronized
    fun enqueue(context: Context, item: org.json.JSONObject) {
        val prefs = prefs(context)
        val current = read(context)
        current.put(item)
        while (current.length() > 20) current.remove(0)
        prefs.edit().putString(PREF_PENDING_RECORDINGS, current.toString()).apply()
    }

    @Synchronized
    fun take(context: Context, limit: Int): JSONArray {
        val current = read(context)
        val batch = JSONArray()
        for (i in 0 until current.length()) {
            if (batch.length() >= limit) break
            current.optJSONObject(i)?.let(batch::put)
        }
        return batch
    }

    @Synchronized
    fun remove(context: Context, batch: JSONArray) {
        if (batch.length() == 0) return
        val paths = buildSet {
            for (i in 0 until batch.length()) {
                batch.optJSONObject(i)?.optString("path")?.takeIf { it.isNotBlank() }?.let(::add)
            }
        }
        if (paths.isEmpty()) return

        val current = read(context)
        val remaining = JSONArray()
        for (i in 0 until current.length()) {
            val item = current.optJSONObject(i) ?: continue
            if (!paths.contains(item.optString("path"))) remaining.put(item)
        }
        prefs(context).edit().putString(PREF_PENDING_RECORDINGS, remaining.toString()).apply()
    }

    fun size(context: Context): Int = read(context).length()

    private fun read(context: Context): JSONArray =
        runCatching {
            JSONArray(prefs(context).getString(PREF_PENDING_RECORDINGS, "[]"))
        }.getOrDefault(JSONArray())

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}

object StaffCallSync {
    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun schedulePeriodicSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = PeriodicWorkRequestBuilder<StaffCallSyncWorker>(
            15,
            TimeUnit.MINUTES,
        ).setConstraints(constraints).build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "hirmand-staff-call-sync",
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun enqueue(context: Context) {
        val request = OneTimeWorkRequestBuilder<StaffCallSyncWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "hirmand-staff-call-sync-now",
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }

    suspend fun flush(context: Context): Boolean {
        val callsOk = StaffCallLogSync.sync(context)
        val recordingsOk = flushRecordings(context)
        return callsOk && recordingsOk
    }

    private fun flushRecordings(context: Context): Boolean {
        val token = StaffTelemetryStore.token(context)
        val deviceId = prefs(context).getString("device_id", "").orEmpty()
        if (token.isBlank() || deviceId.isBlank()) return false

        val batch = StaffCallRecordingStore.take(context, 3)
        if (batch.length() == 0) return true

        val failed = mutableListOf<org.json.JSONObject>()
        for (i in 0 until batch.length()) {
            val item = batch.optJSONObject(i) ?: continue
            if (!uploadRecording(context, token, deviceId, item)) {
                failed += item
            } else {
                File(item.optString("path")).delete()
            }
        }

        if (failed.isEmpty()) {
            StaffCallRecordingStore.remove(context, batch)
            return true
        }

        // Only remove successful entries. The queue is reconstructed from the
        // original batch plus any older entries that follow it.
        val successful = JSONArray()
        for (i in 0 until batch.length()) {
            val item = batch.optJSONObject(i) ?: continue
            if (!failed.any { it.optString("path") == item.optString("path") }) {
                successful.put(item.optString("path"))
            }
        }

        val current = StaffCallRecordingStore.take(context, 20)
        val remaining = JSONArray()
        for (i in 0 until current.length()) {
            val item = current.optJSONObject(i) ?: continue
            if (!successful.asListContains(item.optString("path"))) remaining.put(item)
        }
        replaceQueue(context, remaining)
        return false
    }

    private fun uploadRecording(
        context: Context,
        token: String,
        deviceId: String,
        item: org.json.JSONObject,
    ): Boolean {
        val file = File(item.optString("path"))
        if (!file.exists() || file.length() <= 0L) return true

        val connection = (URL(BuildConfig.STAFF_CALL_RECORDING_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 30_000
            doOutput = true
            useCaches = false
            setFixedLengthStreamingMode(file.length())
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer " + token)
            setRequestProperty("X-Hirmand-Device-Id", deviceId)
            setRequestProperty("X-Hirmand-Source-Call-Id", item.optString("sourceCallId"))
            setRequestProperty("X-Hirmand-Call-Started-At", item.optString("startedAt"))
            setRequestProperty("X-Hirmand-Call-Ended-At", item.optString("endedAt"))
            setRequestProperty("X-Hirmand-Call-Direction", item.optString("direction", "unknown"))
            setRequestProperty("X-Hirmand-Call-Number", item.optString("phoneNumber"))
            setRequestProperty("X-Hirmand-Call-Contact", item.optString("contactName"))
            setRequestProperty("X-Hirmand-Call-Duration", item.optString("durationSeconds", "0"))
            setRequestProperty("X-Hirmand-File-Mime", item.optString("mimeType", "audio/mp4"))
            setRequestProperty("Content-Type", item.optString("mimeType", "audio/mp4"))
            setRequestProperty("X-Hirmand-File-Sha256", item.optString("sha256"))
        }

        return try {
            BufferedInputStream(FileInputStream(file)).use { input ->
                connection.outputStream.use { output ->
                    input.copyTo(output, 32 * 1024)
                }
            }
            connection.responseCode in 200..299
        } catch (_: Exception) {
            false
        } finally {
            connection.disconnect()
        }
    }

    private fun replaceQueue(context: Context, value: JSONArray) {
        prefs(context).edit().putString(PREF_PENDING_RECORDINGS, value.toString()).apply()
    }

    private fun JSONArray.asListContains(value: String): Boolean {
        for (i in 0 until length()) if (optString(i) == value) return true
        return false
    }
}
