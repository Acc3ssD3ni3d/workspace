import mongoose, { Schema, models, model } from "mongoose";

// ------------------------------------
// COMMON REFERENCES AND PERMISSIONS
// ------------------------------------

const ref = {
  type: Schema.Types.ObjectId,
  ref: "User",
};

const shared = [
  {
    _id: false,
    user: ref,
    role: {
      type: String,
      enum: ["view", "edit"],
      default: "view",
    },
  },
];

const org = {
  type: String,
  enum: ["none", "view", "edit"],
  default: "none",
};

// ------------------------------------
// USER MODEL
// ------------------------------------

const userSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
    },

    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: true,
    },

    personalEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    passwordHash: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },

    active: {
      type: Boolean,
      default: true,
    },

    // Existing mailbox integration
    mailboxId: {
      type: String,
      default: "",
    },

    mailboxStatus: {
      type: String,
      enum: ["pending", "active", "failed", "not_created"],
      default: "not_created",
    },

    invitationStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },

    invitationSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export const User = models.User || model("User", userSchema);

// ------------------------------------
// WORKSPACE APPLICATION SETTINGS
// ------------------------------------

const workspaceSettingsSchema = new Schema(
  {
    key: {
      type: String,
      default: "workspace",
      unique: true,
      required: true,
    },

    apps: {
      drive: { type: Boolean, default: true },
      docs: { type: Boolean, default: true },
      sheets: { type: Boolean, default: true },
      calendar: { type: Boolean, default: true },
      meet: { type: Boolean, default: true },
      chat: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },

    updatedBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

export const WorkspaceSettings =
  models.WorkspaceSettings ||
  model("WorkspaceSettings", workspaceSettingsSchema);

// ------------------------------------
// DRIVE ITEM MODEL
// ------------------------------------

const itemSchema = new Schema(
  {
    name: String,

    type: {
      type: String,
      enum: ["folder", "file"],
    },

    parent: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    owner: ref,

    size: {
      type: Number,
      default: 0,
    },

    uploaded: {
      type: Number,
      default: 0,
    },

    mime: String,

    // Where the actual file is stored
    storageProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
      index: true,
    },

    // Google Docs / Sheets references
    googleFileId: {
      type: String,
      default: "",
      index: true,
    },

    googleWebViewLink: {
      type: String,
      default: "",
    },

    googleResourceType: {
      type: String,
      enum: ["document", "spreadsheet", ""],
      default: "",
    },

    // ------------------------------------
    // GOOGLE BACKUP / SYNCHRONIZATION
    // ------------------------------------

    backupStatus: {
      type: String,
      enum: ["not_started", "pending", "synced", "failed"],
      default: "not_started",
      index: true,
    },

    backupMimeType: {
      type: String,
      default: "",
    },

    backupFormat: {
      type: String,
      enum: ["docx", "xlsx", ""],
      default: "",
    },

    // Time the VPS backup was successfully created
    lastSyncedAt: {
      type: Date,
      default: null,
    },

    // Latest modification time reported by Google
    googleModifiedTime: {
      type: Date,
      default: null,
    },

    // Google modification time captured by the last
    // successful VPS backup.
    backupSourceModifiedTime: {
      type: Date,
      default: null,
    },

    lastSyncError: {
      type: String,
      default: "",
    },

    // ------------------------------------
    // EXISTING DRIVE FIELDS
    // ------------------------------------

    trashed: {
      type: Boolean,
      default: false,
    },

    // Individual employee permissions
    shared,

    // Organisation-wide permissions
    org,

    // Google permissions created and managed by EduOne.
    // These IDs allow Private mode to remove only permissions
    // created by the organisation visibility feature.
    googleOrgPermissions: [
      {
        _id: false,

        user: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },

        email: {
          type: String,
          lowercase: true,
          trim: true,
        },

        permissionId: {
          type: String,
          required: true,
        },
      },
    ],

    // Anyone-with-link access settings
    linkAccess: {
      enabled: {
        type: Boolean,
        default: false,
      },

      tokenHash: {
        type: String,
        default: "",
        select: false,
      },

      role: {
        type: String,
        enum: ["view", "edit"],
        default: "view",
      },

      expiresAt: {
        type: Date,
        default: null,
      },

      createdAt: {
        type: Date,
        default: null,
      },
    },

    // Most recent recorded access
    lastAccessedAt: {
      type: Date,
      default: null,
    },

    // Total recorded view events
    accessCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

itemSchema.index({
  owner: 1,
  parent: 1,
  trashed: 1,
});

itemSchema.index({
  owner: 1,
  backupStatus: 1,
});

itemSchema.index({
  owner: 1,
  storageProvider: 1,
  backupSourceModifiedTime: 1,
});

export const Item = models.Item || model("Item", itemSchema);

// ------------------------------------
// FILE ACTIVITY MODEL
// ------------------------------------

const fileActivitySchema = new Schema(
  {
    item: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      required: true,
      index: true,
    },

    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    actorName: {
      type: String,
      default: "Anonymous",
    },

    actorEmail: {
      type: String,
      default: "",
    },

    action: {
      type: String,
      enum: [
        "view",
        "download",
        "upload",
        "edit",
        "rename",
        "share",
        "unshare",
        "link_created",
        "link_revoked",
        "delete",
        "restore",
      ],
      required: true,
    },

    accessMethod: {
      type: String,
      enum: ["owner", "direct", "organisation", "link"],
      default: "direct",
    },

    details: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

fileActivitySchema.index({
  item: 1,
  createdAt: -1,
});

export const FileActivity =
  models.FileActivity || model("FileActivity", fileActivitySchema);

// ------------------------------------
// LEGACY DOCS AND SHEETS MODEL
// ------------------------------------

const docSchema = new Schema(
  {
    title: String,

    kind: {
      type: String,
      enum: ["doc", "sheet"],
    },

    content: {
      type: String,
      default: "",
    },

    owner: ref,

    rev: {
      type: Number,
      default: 0,
    },

    updatedBy: String,

    shared,
    org,
  },
  { timestamps: true },
);

export const Doc = models.Doc || model("Doc", docSchema);

// ------------------------------------
// LEGACY CALENDAR EVENT MODEL
// ------------------------------------

const eventSchema = new Schema(
  {
    title: String,
    desc: String,
    start: Date,
    end: Date,
    room: String,
    createdBy: String,

    googleEventId: {
      type: String,
      default: "",
      index: true,
    },

    googleCalendarId: {
      type: String,
      default: "",
    },

    googleMeetLink: {
      type: String,
      default: "",
    },

    googleSpaceName: {
      type: String,
      default: "",
    },

    googleHtmlLink: {
      type: String,
      default: "",
    },

    organizerUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    meetingStatus: {
      type: String,
      enum: ["scheduled", "live", "ended", "cancelled"],
      default: "scheduled",
      index: true,
    },
  },
  { timestamps: true },
);

export const Event = models.Event || model("Event", eventSchema);

// ------------------------------------
// LEGACY CHAT MESSAGE MODEL
// ------------------------------------

const messageSchema = new Schema(
  {
    channel: {
      type: String,
      index: true,
    },

    from: ref,
    name: String,
    text: String,

    googleSpaceName: {
      type: String,
      default: "",
    },

    googleMessageName: {
      type: String,
      default: "",
    },

    googleThreadName: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

export const Message = models.Message || model("Message", messageSchema);

// ------------------------------------
// GOOGLE ACCOUNT CONNECTION
// ------------------------------------

const googleConnectionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    googleId: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    accessTokenEncrypted: {
      type: String,
      default: "",
      select: false,
    },

    refreshTokenEncrypted: {
      type: String,
      default: "",
      select: false,
    },

    tokenExpiresAt: {
      type: Date,
      default: null,
    },

    // OAuth scopes granted by the employee
    scopes: {
      type: [String],
      default: [],
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export const GoogleConnection =
  models.GoogleConnection || model("GoogleConnection", googleConnectionSchema);

// ------------------------------------
// EXPORTS
// ------------------------------------

export { mongoose };
