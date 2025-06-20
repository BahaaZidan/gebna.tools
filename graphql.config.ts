import type { CodegenConfig } from '@graphql-codegen/cli';
import type { IGraphQLConfig } from 'graphql-config';

const config: IGraphQLConfig = {
	schema: ['src/lib/graphql/schema.graphql', '.houdini/graphql/schema.graphql'],
	documents: ['**/*.gql', '**/*.svelte', './.houdini/graphql/documents.gql'],
	extensions: {
		codegen: {
			generates: {
				'./src/lib/__generated__/graphql-resolvers-types.ts': {
					plugins: [
						{
							add: {
								content: '/* eslint-disable */',
							},
						},
						'typescript',
						'typescript-resolvers',
					],
					config: {
						useTypeImports: true,
						contextType: '$lib/graphql/server/context#Context',
						scalars: {
							ID: 'string',
							DateTime: 'Date',
							URL: 'URL',
						},
						mappers: {
							Website: '$lib/server/db/schema#WebsiteSelectModel',
							Page: '$lib/server/db/schema#PageSelectModel',
							Comment: '$lib/server/db/schema#CommentSelectModel',
						},
					},
				},
			},
		} satisfies CodegenConfig,
	},
};

export default config;
