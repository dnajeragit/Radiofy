package com.radiofy.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class RadioScheduleRestoreReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        RadioScheduleManager.restore(context);
    }
}
