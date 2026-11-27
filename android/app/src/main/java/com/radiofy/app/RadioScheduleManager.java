package com.radiofy.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Calendar;

final class RadioScheduleManager {
    static final String ACTION_ALARM = "com.radiofy.app.SCHEDULED_RADIO_ALARM";
    static final String ACTION_OPEN_SCHEDULE = "com.radiofy.app.OPEN_SCHEDULED_RADIO";
    static final String EXTRA_ID = "radiofyScheduleId";
    static final String EXTRA_DAY = "radiofyScheduleDay";
    static final String EXTRA_TIME = "radiofyScheduleTime";
    static final String EXTRA_URL = "radiofyStationUrl";
    static final String EXTRA_NAME = "radiofyStationName";
    static final String EXTRA_COUNTRY = "radiofyStationCountry";
    static final String EXTRA_LANGUAGE = "radiofyStationLanguage";

    private static final String PREFERENCES = "radiofy_schedules";
    private static final String SCHEDULES_KEY = "schedules";
    private static final String CHANNEL_ID = "radiofy_schedule_reminders";

    private RadioScheduleManager() {}

    static boolean canScheduleExactAlarms(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return alarmManager != null && alarmManager.canScheduleExactAlarms();
    }

    static void sync(Context context, String schedulesJson) throws JSONException {
        JSONArray schedules = new JSONArray(schedulesJson);
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        JSONArray oldSchedules = new JSONArray(preferences.getString(SCHEDULES_KEY, "[]"));
        cancelSchedules(context, oldSchedules);
        preferences.edit().putString(SCHEDULES_KEY, schedules.toString()).apply();

        if (!canScheduleExactAlarms(context)) {
            return;
        }

        for (int i = 0; i < schedules.length(); i++) {
            JSONObject schedule = schedules.getJSONObject(i);
            JSONObject station = schedule.getJSONObject("station");
            JSONArray days = schedule.getJSONArray("days");
            for (int dayIndex = 0; dayIndex < days.length(); dayIndex++) {
                int day = days.getInt(dayIndex);
                scheduleAlarm(
                    context,
                    schedule,
                    station,
                    day,
                    nextOccurrence(schedule.getString("time"), day, System.currentTimeMillis())
                );
            }
        }
    }

    static void restore(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        String schedulesJson = preferences.getString(SCHEDULES_KEY, "[]");
        try {
            sync(context, schedulesJson);
        } catch (JSONException | RuntimeException error) {
            android.util.Log.e("RadiofySchedules", "Could not restore scheduled radio alarms.", error);
        }
    }

    static void scheduleNextOccurrence(Context context, Intent firedAlarm) {
        try {
            JSONObject schedule = new JSONObject();
            schedule.put("id", firedAlarm.getStringExtra(EXTRA_ID));
            schedule.put("time", firedAlarm.getStringExtra(EXTRA_TIME));
            schedule.put("name", firedAlarm.getStringExtra(EXTRA_NAME));
            schedule.put("url_resolved", firedAlarm.getStringExtra(EXTRA_URL));
            schedule.put("country", firedAlarm.getStringExtra(EXTRA_COUNTRY));
            schedule.put("language", firedAlarm.getStringExtra(EXTRA_LANGUAGE));
            int day = firedAlarm.getIntExtra(EXTRA_DAY, -1);
            if (day < 0 || day > 6) {
                return;
            }
            scheduleAlarm(
                context,
                schedule,
                schedule,
                day,
                nextOccurrence(schedule.getString("time"), day, System.currentTimeMillis())
            );
        } catch (JSONException | RuntimeException error) {
            android.util.Log.e("RadiofySchedules", "Could not schedule the next radio reminder.", error);
        }
    }

    static void showReminder(Context context, Intent alarmIntent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return;
        }

        String id = alarmIntent.getStringExtra(EXTRA_ID);
        int day = alarmIntent.getIntExtra(EXTRA_DAY, 0);
        String stationName = alarmIntent.getStringExtra(EXTRA_NAME);
        String country = alarmIntent.getStringExtra(EXTRA_COUNTRY);
        String language = alarmIntent.getStringExtra(EXTRA_LANGUAGE);
        if (id == null || stationName == null || alarmIntent.getStringExtra(EXTRA_URL) == null) {
            android.util.Log.e("RadiofySchedules", "Skipped a radio reminder with incomplete station data.");
            return;
        }

        ensureNotificationChannel(context);
        Intent openIntent = new Intent(context, MainActivity.class)
            .setAction(ACTION_OPEN_SCHEDULE)
            .setData(scheduleUri(id, day))
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_DAY, day)
            .putExtra(EXTRA_URL, alarmIntent.getStringExtra(EXTRA_URL))
            .putExtra(EXTRA_NAME, stationName)
            .putExtra(EXTRA_COUNTRY, country)
            .putExtra(EXTRA_LANGUAGE, language)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            context,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String details = country == null ? "" : country;
        if (language != null && !language.isEmpty()) {
            details = details.isEmpty() ? language : details + " · " + language;
        }

        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Es hora de escuchar")
            .setContentText(stationName)
            .setSubText(details)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(
                details.isEmpty() ? stationName : stationName + " · " + details
            ))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(contentIntent);

        try {
            NotificationManagerCompat.from(context).notify(notificationId(id, day), notification.build());
        } catch (SecurityException error) {
            android.util.Log.e("RadiofySchedules", "Notification permission is missing for a radio reminder.", error);
        }
    }

    private static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        android.app.NotificationManager manager =
            (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }
        android.app.NotificationChannel channel = new android.app.NotificationChannel(
            CHANNEL_ID,
            "Recordatorios de Radiofy",
            android.app.NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Avisos de las radios que programaste.");
        manager.createNotificationChannel(channel);
    }

    private static void cancelSchedules(Context context, JSONArray schedules) {
        for (int i = 0; i < schedules.length(); i++) {
            JSONObject schedule = schedules.optJSONObject(i);
            if (schedule == null) {
                continue;
            }
            String id = schedule.optString("id", "");
            JSONArray days = schedule.optJSONArray("days");
            if (id.isEmpty() || days == null) {
                continue;
            }
            for (int dayIndex = 0; dayIndex < days.length(); dayIndex++) {
                cancelAlarm(context, id, days.optInt(dayIndex, -1));
            }
        }
    }

    private static void scheduleAlarm(
        Context context,
        JSONObject schedule,
        JSONObject station,
        int day,
        long triggerAtMillis
    ) throws JSONException {
        String id = schedule.getString("id");
        Intent intent = new Intent(context, RadioScheduleAlarmReceiver.class)
            .setAction(ACTION_ALARM)
            .setData(scheduleUri(id, day))
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_DAY, day)
            .putExtra(EXTRA_TIME, schedule.getString("time"))
            .putExtra(EXTRA_URL, station.getString("url_resolved"))
            .putExtra(EXTRA_NAME, station.getString("name"))
            .putExtra(EXTRA_COUNTRY, station.optString("country", ""))
            .putExtra(EXTRA_LANGUAGE, station.optString("language", ""));
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            throw new IllegalStateException("Android alarm service is unavailable.");
        }
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
    }

    private static void cancelAlarm(Context context, String id, int day) {
        if (day < 0 || day > 6) {
            return;
        }
        Intent intent = new Intent(context, RadioScheduleAlarmReceiver.class)
            .setAction(ACTION_ALARM)
            .setData(scheduleUri(id, day));
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pendingIntent == null) {
            return;
        }
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
        }
        pendingIntent.cancel();
    }

    private static Uri scheduleUri(String id, int day) {
        return new Uri.Builder()
            .scheme("radiofy")
            .authority("schedule")
            .appendPath(id)
            .appendPath(Integer.toString(day))
            .build();
    }

    private static long nextOccurrence(String time, int targetDay, long afterMillis) {
        String[] parts = time.split(":");
        if (parts.length != 2 || targetDay < 0 || targetDay > 6) {
            throw new IllegalArgumentException("Invalid radio schedule.");
        }
        int hour = Integer.parseInt(parts[0]);
        int minute = Integer.parseInt(parts[1]);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            throw new IllegalArgumentException("Invalid radio schedule time.");
        }

        Calendar next = Calendar.getInstance();
        next.setTimeInMillis(afterMillis);
        int currentDay = next.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY;
        int daysUntil = (targetDay - currentDay + 7) % 7;
        next.add(Calendar.DAY_OF_YEAR, daysUntil);
        next.set(Calendar.HOUR_OF_DAY, hour);
        next.set(Calendar.MINUTE, minute);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= afterMillis) {
            next.add(Calendar.DAY_OF_YEAR, 7);
        }
        return next.getTimeInMillis();
    }

    private static int notificationId(String id, int day) {
        return (id + "-" + day).hashCode() & 0x7fffffff;
    }
}
