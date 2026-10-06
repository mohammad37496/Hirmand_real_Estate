package ir.hirmand.staff

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class StaffCallSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        if (StaffTelemetryStore.token(applicationContext).isBlank()) {
            return Result.success()
        }

        return if (StaffCallSync.flush(applicationContext)) {
            Result.success()
        } else {
            Result.retry()
        }
    }
}
