package ir.hirmand.realestate.mobile.sync

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import ir.hirmand.realestate.mobile.storage.SecureTokenStore
import ir.hirmand.realestate.mobile.storage.SyncDatabase

class SyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {

    override fun doWork(): Result {
        val tokenStore = SecureTokenStore(applicationContext)
        val token = tokenStore.read() ?: return Result.success()
        val database = SyncDatabase(applicationContext)
        val batch = database.peek(MAX_BATCH)

        if (batch.isEmpty()) return Result.success()

        return try {
            HirmandApi(DEFAULT_BASE_URL).sync(
                token = token,
                events = batch.map {
                    QueuedEvent(
                        clientEventId = it.clientEventId,
                        eventType = it.eventType,
                        occurredAt = it.occurredAt,
                        payloadJson = it.payloadJson,
                    )
                },
            )
            database.delete(batch.map { it.id })
            Result.success()
        } catch (error: ApiException) {
            when (error.statusCode) {
                401, 403 -> {
                    // The admin can revoke a device. Keep queued data local until the user pairs again.
                    tokenStore.clear()
                    Result.success()
                }
                in 400..499 -> {
                    // Server rejected a malformed event. Drop only this batch to prevent a permanent retry loop.
                    database.delete(batch.map { it.id })
                    Result.success()
                }
                else -> Result.retry()
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val PERIODIC_NAME = "hirmand-mobile-periodic-sync"
        private const val MAX_BATCH = 100
        const val DEFAULT_BASE_URL = "https://www.hirmandrealestate.ir"
    }
}
