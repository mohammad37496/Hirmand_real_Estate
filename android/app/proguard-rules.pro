# The app intentionally uses Android framework APIs only.
# Keep WorkManager worker construction stable for release builds.
-keep class ir.hirmand.realestate.mobile.sync.SyncWorker { *; }
