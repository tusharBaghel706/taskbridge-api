// Sequelize model: Notification
// Exports: (sequelize, DataTypes) => Model

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    'Notification',
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
      recipient_user_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      event_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      read_status: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'notifications',
      underscored: true,
      timestamps: false,
      indexes: [
        { fields: ['tenant_id', 'recipient_user_id'] },
        { fields: ['tenant_id', 'created_at'] },
      ],
    }
  );

  return Notification;
};
