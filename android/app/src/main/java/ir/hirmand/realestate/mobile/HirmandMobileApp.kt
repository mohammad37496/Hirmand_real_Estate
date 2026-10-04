package ir.hirmand.realestate.mobile

import android.app.Application
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import ir.hirmand.realestate.mobile.sync.SyncWorker
import java.util.concurrent.TimeUnit

class HirmandMobileApp : Application() {
    override fun onCreate() {
        super.onCreate()

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val periodic = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            SyncWorker.PERIODIC_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodic,
        )
    }
}
