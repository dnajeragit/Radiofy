package com.radiofy.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class RadioScheduleAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        RadioScheduleManager.scheduleNextOccurrence(context, intent);
        RadioScheduleManager.showReminder(context, intent);
    }
}
