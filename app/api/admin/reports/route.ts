import { guard, J } from "@/lib/http";
import {
  User,
  Item,
  WorkspaceSettings,
  Doc,
  Event,
  Message,
} from "@/lib/models";
import { getStorageDirectoryStats } from "@/lib/sftp";

export const GET = guard(async (req) => {
  const url = new URL(req.url);

  const requestedDays = Number(url.searchParams.get("days") || 30);

  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const dateFilter = {
    createdAt: {
      $gte: startDate,
      $lte: now,
    },
  };

  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    admins,
    members,
    newUsers,
    totalFiles,
    fileStats,
    documents,
    sheets,
    events,
    messages,
    settings,
    userActivity,
    fileActivity,
    docActivity,
    eventActivity,
    messageActivity,
  ] = await Promise.all([
    User.countDocuments(),

    User.countDocuments({ active: true }),

    User.countDocuments({ active: false }),

    User.countDocuments({ role: "admin" }),

    User.countDocuments({ role: "member" }),

    User.countDocuments(dateFilter),

    Item.countDocuments({ type: "file" }),

    Item.aggregate([
      {
        $match: {
          type: "file",
        },
      },
      {
        $group: {
          _id: null,
          uploadedBytes: { $sum: "$uploaded" },
          reservedBytes: { $sum: "$size" },
        },
      },
    ]),

    Doc.countDocuments({ kind: "doc" }),

    Doc.countDocuments({ kind: "sheet" }),

    Event.countDocuments(),

    Message.countDocuments(),

    WorkspaceSettings.findOne({
      key: "workspace",
    }).lean(),

    // Daily new user registrations
    User.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),

    // Daily uploaded file records
    Item.aggregate([
      {
        $match: {
          type: "file",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),

    // Daily documents and spreadsheets
    Doc.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),

    // Daily calendar events
    Event.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),

    // Daily chat messages
    Message.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  // Actual VPS storage statistics
  let storage = {
    connected: false,
    usedBytes: 0,
    storedFiles: 0,
  };

  try {
    const remoteFiles = await getStorageDirectoryStats();

    const storedFiles = remoteFiles.filter(
      (file) => file.type === "-" && /^[a-f0-9]{24}$/.test(file.name),
    );

    storage = {
      connected: true,
      usedBytes: storedFiles.reduce((sum, file) => sum + file.size, 0),
      storedFiles: storedFiles.length,
    };
  } catch {
    // Reports remain available if VPS storage is unavailable.
  }

  // Combine daily activity from available records.
  const activityMap = new Map<string, number>();

  const activitySources = [
    userActivity,
    fileActivity,
    docActivity,
    eventActivity,
    messageActivity,
  ];

  for (const source of activitySources) {
    for (const item of source) {
      activityMap.set(item._id, (activityMap.get(item._id) || 0) + item.count);
    }
  }

  const activity = Array.from(activityMap.entries())
    .map(([date, count]) => ({
      date,
      count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Resolve Mongoose lean result safely.
  const workspaceSettings = Array.isArray(settings) ? settings[0] : settings;

  const apps = workspaceSettings?.apps || {
    drive: true,
    docs: true,
    sheets: true,
    calendar: true,
    meet: true,
    chat: true,
    email: true,
  };

  const enabledApps = Object.values(apps).filter(Boolean).length;

  const disabledApps = Object.values(apps).length - enabledApps;

  return J({
    period: {
      days,
      startDate,
      endDate: now,
    },

    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: inactiveUsers,
      admins,
      members,
      newUsers,
    },

    storage: {
      ...storage,
      databaseFiles: totalFiles,
      uploadedBytes: fileStats[0]?.uploadedBytes || 0,
      reservedBytes: fileStats[0]?.reservedBytes || 0,
    },

    applications: {
      total: Object.keys(apps).length,
      enabled: enabledApps,
      disabled: disabledApps,
      apps,
    },

    workspace: {
      documents,
      spreadsheets: sheets,
      calendarEvents: events,
      chatMessages: messages,
    },

    activity,
  });
}, true);
