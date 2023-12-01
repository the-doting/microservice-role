import { ServiceSchema } from "../../../lib/types";

import DBMixin from "moleculer-db";
import SqlAdapter from "moleculer-db-adapter-sequelize";
import Sequelize from "sequelize";

import _ from "lodash";

(DBMixin as any).actions = {};

const Service: ServiceSchema = {
	name: "role",
	version: "api.v1",

	/**
	 * Mixins
	 */
	mixins: [DBMixin],

	adapter: new SqlAdapter(process.env.DATABASE_URL || "sqlite://:memory:"),

	model: {
		name: "role",
		define: {
			key: {
				type: Sequelize.STRING, // values: user, root
			},
			permissions: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			createdBy: {
				type: Sequelize.STRING,
				allowNull: false,
			},
		},
	},
	/**
	 * Service settings
	 */
	settings: {},

	/**
	 * Service dependencies
	 */
	// dependencies: [],

	/**
	 * Actions
	 */
	actions: {
		// set
		set: {
			rest: "POST /set",
			params: {
				key: {
					type: "enum",
					values: ["user", "root"],
				},
				permissions: {
					type: "array",
					items: "string",
					min: 1,
				},
			},
			async handler(ctx) {
				try {
					const { key, permissions } = ctx.params;
					const creator = ctx.meta.creator.trim().toLowerCase();

					// find one by key and createdBy
					const [resultFindRole] = await this.adapter.db.query(
						`SELECT * FROM roles WHERE key = '${key}' AND createdBy = '${creator}'`
					);

					// if role exist
					if (resultFindRole.length > 0) {
						const [resultUpdateRole] = await this.adapter.db.query(
							`UPDATE roles SET permissions = '${JSON.stringify(
								permissions
							)}' WHERE key = '${key}' AND createdBy = '${creator}'`
						);

						return {
							code: 200,
							i18n: "ROLE_SET",
						};
					} else {
						await this.adapter.insert({
							key,
							permissions: JSON.stringify(permissions),
							createdBy: creator,
						});

						return {
							code: 200,
							i18n: "ROLE_SET",
						};
					}
				} catch (error) {
					console.error(error);

					return {
						code: 500,
					};
				}
			},
		},
	},

	/**
	 * Events
	 */
	events: {
		"user.login": {
			async handler(ctx: any) {
				const {
					user: { id: user },
				} = ctx.params;

				const creator = ctx.meta.creator.trim().toLowerCase();

				// find one by key and createdBy
				const [[resultFindRole], resultPermissionsByUser] = await Promise.all([
					this.adapter.db.query(
						`SELECT * FROM roles WHERE key = 'user' AND createdBy = '${creator}'`
					),
					ctx.call("api.v1.permission.getByIdentityAndService", {
						identity: user,
						service: "auth",
					}),
				]);

				// if role exist
				if (resultFindRole.length == 1 && resultPermissionsByUser.code == 200) {
					const rolePermissions = JSON.parse(resultFindRole[0].permissions);
					const userPermissions = resultPermissionsByUser.data;

					// check what role permissions are not in user permissions
					const permissionsToAdd = _.difference(
						rolePermissions,
						userPermissions
					);

					// add permissions to user if length > 0
					if (permissionsToAdd.length > 0) {
						await ctx.call("api.v1.permission.give", {
							identity: user,
							service: "auth",
							permissions: permissionsToAdd,
						});
					}
				}
			},
		},
	},

	/**
	 * Methods
	 */
	methods: {},

	/**
	 * Service created lifecycle event handler
	 */
	// created() {},

	/**
	 * Service started lifecycle event handler
	 */
	// started() { },

	/**
	 * Service stopped lifecycle event handler
	 */
	// stopped() { }
};

export = Service;
