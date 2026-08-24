// Project service: encapsulates business logic for Projects
// Functions: createProject, updateProjectStatus, getProjectsByTeam, deleteProject

const { Op } = require('sequelize');

module.exports = function makeProjectService({ models, logger, jobQueue }) {
  const Project = models.Project;

  async function createProject({ tenantId, teamId, name, metadata = {}, actorId = null }) {
    // Validate tenant/team boundaries should be done by caller
    const project = await Project.create({ tenant_id: tenantId, team_id: teamId, name, metadata });
    // Emit audit via jobQueue or logger
    if (jobQueue && jobQueue.enqueue) {
      jobQueue.enqueue('audit.create', {
        tenant_id: tenantId,
        action: 'project.created',
        resource_type: 'project',
        resource_id: project.id,
        actor_id: actorId,
        metadata: { name, teamId },
      });
    } else {
      logger && logger.info({ event: 'audit.create', tenant_id: tenantId, resource_id: project.id });
    }

    return project;
  }

  async function updateProjectStatus({ tenantId, projectId, newStatus, actorId = null }) {
    // Enforce allowed transitions
    const allowed = {
      draft: ['active', 'archived', 'deleted'],
      active: ['archived', 'deleted'],
      archived: ['active', 'deleted'],
      deleted: [],
    };

    const project = await Project.findOne({ where: { id: projectId, tenant_id: tenantId } });
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      throw err;
    }

    if (!allowed[project.status] || !allowed[project.status].includes(newStatus)) {
      const err = new Error('Invalid status transition');
      err.status = 400;
      throw err;
    }

    project.status = newStatus;
    if (newStatus === 'deleted') project.deleted_at = new Date();
    await project.save();

    if (jobQueue && jobQueue.enqueue) {
      jobQueue.enqueue('audit.create', {
        tenant_id: tenantId,
        action: 'project.status_changed',
        resource_type: 'project',
        resource_id: project.id,
        actor_id: actorId,
        metadata: { newStatus },
      });
    } else {
      logger && logger.info({ event: 'audit.status_changed', tenant_id: tenantId, resource_id: project.id, newStatus });
    }

    return project;
  }

  async function getProjectsByTeam({ tenantId, teamId, status, limit = 50, offset = 0 }) {
    const where = { tenant_id: tenantId, team_id: teamId };
    if (status) where.status = status;

    const items = await Project.findAll({ where, limit, offset, order: [['created_at', 'DESC']] });
    return items;
  }

  async function deleteProject({ tenantId, projectId, actorId = null }) {
    // Soft-delete semantics: set status to deleted and deleted_at timestamp
    const project = await Project.findOne({ where: { id: projectId, tenant_id: tenantId } });
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      throw err;
    }

    project.status = 'deleted';
    project.deleted_at = new Date();
    await project.save();

    if (jobQueue && jobQueue.enqueue) {
      jobQueue.enqueue('audit.create', {
        tenant_id: tenantId,
        action: 'project.deleted',
        resource_type: 'project',
        resource_id: project.id,
        actor_id: actorId,
      });
    } else {
      logger && logger.info({ event: 'audit.deleted', tenant_id: tenantId, resource_id: project.id });
    }

    return project;
  }

  return Object.freeze({ createProject, updateProjectStatus, getProjectsByTeam, deleteProject });
};
