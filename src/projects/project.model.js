// Sequelize model definition for Project (shared-schema, tenant-scoped)
// Exports a function: (sequelize, DataTypes) => Model

module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define(
    'Project',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      team_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('draft', 'active', 'archived', 'deleted'),
        allowNull: false,
        defaultValue: 'draft',
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'projects',
      underscored: true,
      timestamps: true,
      paranoid: false,
      indexes: [
        { fields: ['tenant_id'] },
        { fields: ['team_id'] },
        { fields: ['tenant_id', 'status'] },
      ],
    }
  );

  // Tenant-scoped helper scope
  Project.addScope('byTenant', (tenantId) => ({ where: { tenant_id: tenantId } }));

  return Project;
};
