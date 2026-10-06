package ir.hirmand.staff

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

class StaffCallRecordingService : Service() {
    companion object {
        const val ACTION_START = "ir.hirmand.staff.START_CALL_RECORDING"
        const val ACTION_STOP = "ir.hirmand.staff.STOP_CALL_RECORDING"
        const val EXTRA_DIRECTION = "direction"
        const val EXTRA_NUMBER = "number"

        private const val CHANNEL_ID = "hirmand_call_recording"
        private const val NOTIFICATION_ID = 4807
        private const val MAX_RECORDING_BYTES = 25L * 1024L * 1024L
    }

    private var recorder: MediaRecorder? = null
    private var recordingFile: File? = null
    private var startedAt = 0L
    private var direction = "unknown"
    private var incomingNumber = ""

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startRecording(
                intent.getStringExtra(EXTRA_DIRECTION) ?: "unknown",
                intent.getStringExtra(EXTRA_NUMBER).orEmpty(),
            )
            ACTION_STOP -> stopRecording()
        }
        return START_NOT_STICKY
    }

    private fun startRecording(requestedDirection: String, number: String) {
        if (recorder != null) return
        if (!StaffCallSettings.recordingCanStart(this)) {
            stopSelf()
            return
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            stopSelf()
            return
        }

        createNotificationChannel()

        runCatching {
            val notification = buildNotification(
                "در حال ضبط تماس · ${directionLabel(requestedDirection)}"
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }

            val directory = File(filesDir, "staff-call-recordings").apply { mkdirs() }
            val file = File(directory, "call-${System.currentTimeMillis()}.m4a")

            val current = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(64000)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }

            recorder = current
            recordingFile = file
            startedAt = System.currentTimeMillis()
            direction = when (requestedDirection) {
                "incoming", "outgoing" -> requestedDirection
                else -> "unknown"
            }
            incomingNumber = number.take(80)
        }.onFailure {
            recorder?.runCatching { reset(); release() }
            recorder = null
            recordingFile = null
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun stopRecording() {
        val current = recorder ?: run {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        val file = recordingFile
        val start = startedAt
        val finalDirection = direction
        val numberHint = incomingNumber

        recorder = null
        recordingFile = null

        try {
            current.stop()
        } catch (_: RuntimeException) {
            file?.delete()
            current.runCatching { reset() }
            current.release()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        current.release()

        val size = file?.length() ?: 0L
        if (file == null || !file.exists() || size <= 0L || size > MAX_RECORDING_BYTES) {
            file?.delete()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        val endedAt = System.currentTimeMillis()
        val latestCall = StaffCallLogSync.latestCall(this)
        val sourceCallId = latestCall?.optString("sourceId").orEmpty()
        val number = latestCall?.optString("number").orEmpty().ifBlank { numberHint }
        val contactName = latestCall?.optString("contactName").orEmpty()
        val callDirection = when (latestCall?.optInt("type", -1)) {
            1 -> "incoming"
            2 -> "outgoing"
            else -> finalDirection
        }

        StaffCallRecordingStore.enqueue(
            this,
            org.json.JSONObject()
                .put("path", file.absolutePath)
                .put("startedAt", java.time.Instant.ofEpochMilli(start).toString())
                .put("endedAt", java.time.Instant.ofEpochMilli(endedAt).toString())
                .put("durationSeconds", ((endedAt - start) / 1000L).coerceAtLeast(0L))
                .put("direction", callDirection)
                .put("phoneNumber", number.take(80))
                .put("contactName", contactName.take(160))
                .put("sourceCallId", sourceCallId.take(120))
                .put("mimeType", "audio/mp4")
                .put("sha256", sha256(file))
                .put("sizeBytes", size)
        )

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        StaffCallSync.enqueue(this)
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(32 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun directionLabel(value: String): String = when (value) {
        "incoming" -> "ورودی"
        "outgoing" -> "خروجی"
        else -> "نامشخص"
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "ضبط تماس هیرمند",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "اعلان قابل مشاهده هنگام ضبط تماس"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(text: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("املاک هیرمند · ضبط تماس")
            .setContentText(text)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .build()

    override fun onDestroy() {
        if (recorder != null) {
            runCatching { stopRecording() }
        } else {
            stopForeground(STOP_FOREGROUND_REMOVE)
        }
        recorder = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
