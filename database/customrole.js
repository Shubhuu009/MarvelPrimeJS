const mongoose = require('mongoose');

const CustomRoleSchema = new mongoose.Schema({
  guildId: { type: String, index: true },
  name: { type: String, index: true },
  roleId: { type: String, required: true },
}, { timestamps: true });

CustomRoleSchema.index({ guildId: 1, name: 1 }, { unique: true });

const CustomRolePermissionSchema = new mongoose.Schema({
  guildId: { type: String, index: true, unique: true },
  requiredRoleId: { type: String, default: '' },
}, { timestamps: true });

const CustomRoleModel = mongoose.models.CustomRole || mongoose.model('CustomRole', CustomRoleSchema);
const CustomRolePermissionModel = mongoose.models.CustomRolePermission || mongoose.model('CustomRolePermission', CustomRolePermissionSchema);

const getRole = async (guildId, name) => CustomRoleModel.findOne({ guildId, name });
const getRoles = async (guildId) => CustomRoleModel.find({ guildId }).lean();
const upsertRole = async (guildId, name, roleId) => (
  CustomRoleModel.findOneAndUpdate(
    { guildId, name },
    { $set: { roleId } },
    { upsert: true, new: true }
  )
);
const deleteRole = async (guildId, name) => CustomRoleModel.deleteOne({ guildId, name });

const getPermission = async (guildId) => CustomRolePermissionModel.findOne({ guildId });
const setPermission = async (guildId, requiredRoleId) => (
  CustomRolePermissionModel.findOneAndUpdate(
    { guildId },
    { $set: { requiredRoleId } },
    { upsert: true, new: true }
  )
);
const clearPermission = async (guildId) => CustomRolePermissionModel.deleteOne({ guildId });

module.exports = {
  CustomRoleModel,
  CustomRolePermissionModel,
  getRole,
  getRoles,
  upsertRole,
  deleteRole,
  getPermission,
  setPermission,
  clearPermission,
};
