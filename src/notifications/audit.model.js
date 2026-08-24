// Sequelize model: AuditLog (append-only)
// Exports: (sequelize, DataTypes) => Model

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    'AuditLog',
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
      event_type: {
        type: DataTypes.ENUM('MILESTONE_CREATED', 'MILESTONE_UPDATED', 'MILESTONE_DELETED'),
        allowNull: false,
      },
      entity_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      entity_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      actor_user_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      actor_organisation_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      previous_state: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      new_state: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'audit_logs',
      underscored: true,
      timestamps: false,
      indexes: [
        { fields: ['tenant_id', 'timestamp'] },
        { fields: ['tenant_id', 'entity_type', 'entity_id'] },
        { fields: ['tenant_id', 'event_type'] },
      ],
    }
  );

  return AuditLog;
};
