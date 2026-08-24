// Repository: encapsulates all Sequelize interactions for Project and Team
// Expects injected models: { Project, Team }

module.exports = function makeProjectRepository({ models }) {
  const { Project, Team } = models;
  if (!Project) throw new Error('Project model is required');

  return {
    async teamBelongsToTenant(teamId, tenantId, options = {}) {
      if (!Team) return false;
      const found = await Team.findOne({ where: { id: teamId, tenant_id: tenantId }, ...options });
      return !!found;
    },

    /**
     * Create a new project record.
     *
     * @async
     * @function createProject
     * @param {Object} params - Destructured parameters.
     * @param {(string|number)} params.tenantId - ID of the tenant that will own the project.
     * @param {(string|number)} params.teamId - ID of the team associated with the project.
     * @param {string} params.name - Name of the project.
     * @param {Object} [params.metadata] - Optional metadata object to store with the project.
     * @param {Object} [options={}] - Options forwarded to the ORM create call (for example, transaction settings).
     * @returns {Promise<Object>} Promise that resolves to the created Project instance (record with tenant_id and team_id set).
     * @throws {Error} If the creation fails or validation does not pass.
     */
    async createProject({ tenantId, teamId, name, metadata }, options = {}) {
      return Project.create({ tenant_id: tenantId, team_id: teamId, name, metadata }, options);
    },

    async findById({ id, tenantId, options = {} }) {
      return Project.findOne({ where: { id, tenant_id: tenantId }, ...options });
    },

    async findByIdForUpdate({ id, tenantId, transaction }) {
      return Project.findOne({
        where: { id, tenant_id: tenantId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    },

    async findAllByTeam({ tenantId, teamId, status, limit = 50, offset = 0 }) {
      const { Op } = require('sequelize');
      const where = { tenant_id: tenantId, team_id: teamId };
      if (status) {
        where.status = status;
      } else {
        where.status = { [Op.ne]: 'deleted' };
      }

      const clampedLimit = Math.min(limit || 50, 100);
      return Project.findAll({ where, limit: clampedLimit, offset: offset || 0, order: [['created_at', 'DESC']] });
    },

    async save(projectInstance, options = {}) {
      return projectInstance.save(options);
    },
  };
};
