package ir.hirmand.staff

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class StaffOperationsWorker(appContext:Context,workerParams:WorkerParameters):CoroutineWorker(appContext,workerParams){
    override suspend fun doWork():Result{
        if(StaffTelemetryStore.token(applicationContext).isBlank())return Result.success()
        StaffOperations.sendHealth(applicationContext)
        StaffOperations.sync(applicationContext)
        return Result.success()
    }
    companion object{
        private const val NAME="hirmand-staff-operations"
        fun schedule(context:Context){
            val req=PeriodicWorkRequestBuilder<StaffOperationsWorker>(15,TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(NAME,ExistingPeriodicWorkPolicy.UPDATE,req)
        }
    }
}
